"""Characterization of web API authorization as implemented today.

Visualization routes mounted by ``create_app`` depend on ``get_current_device_id``.
That dependency fails closed: a request with no device credential is 401.
A session cookie is not a credential. Claiming a role in a header or cookie,
including a missing or non-admin role, does not make the request succeed.
"""

from collections.abc import Iterator
from typing import Any

import pytest
from ai_web_feeds.visualization.auth import get_current_device_id
from ai_web_feeds.web_api import create_app
from fastapi import FastAPI
from fastapi.routing import APIRoute
from fastapi.testclient import TestClient

AUTH_REQUIRED = "Authentication required (provide JWT token or API key)"
BAD_AUTHORIZATION = "Invalid authorization header format"

# Routes whose handler dependency chain calls get_current_device_id.
EXPECTED_PROTECTED: frozenset[tuple[str, str]] = frozenset(
    {
        ("DELETE", "/api/v1/dashboards/{dashboard_id}"),
        ("DELETE", "/api/v1/visualizations/{visualization_id}"),
        ("GET", "/api/v1/dashboards"),
        ("GET", "/api/v1/dashboards/{dashboard_id}"),
        ("GET", "/api/v1/visualizations"),
        ("GET", "/api/v1/visualizations/{visualization_id}"),
        ("POST", "/api/v1/dashboards"),
        ("POST", "/api/v1/dashboards/{dashboard_id}/widgets"),
        ("POST", "/api/v1/visualizations"),
        ("POST", "/api/v1/visualizations/{visualization_id}/data"),
        ("PUT", "/api/v1/dashboards/{dashboard_id}"),
        ("PUT", "/api/v1/visualizations/{visualization_id}"),
    }
)

_BODIES: dict[tuple[str, str], dict[str, Any]] = {
    ("POST", "/api/v1/dashboards"): {"name": "board"},
    ("POST", "/api/v1/dashboards/{dashboard_id}/widgets"): {
        "widget_type": "chart",
        "data_source": "feeds",
        "position": {"x": 0, "y": 0, "w": 1, "h": 1},
    },
    ("POST", "/api/v1/visualizations"): {
        "name": "chart",
        "chart_type": "line",
        "data_source": "feeds",
    },
    ("POST", "/api/v1/visualizations/{visualization_id}/data"): {},
    ("PUT", "/api/v1/dashboards/{dashboard_id}"): {"version": 1},
    ("PUT", "/api/v1/visualizations/{visualization_id}"): {},
}

PROTECTED_CALLS: tuple[tuple[str, str, dict[str, Any] | None], ...] = tuple(
    (method, path, _BODIES.get((method, path))) for method, path in sorted(EXPECTED_PROTECTED)
)

# Cookie shapes the web app recognizes, plus a legacy underscore name it does not.
# None of them are device credentials on this API.
_SESSION_COOKIES: tuple[str, ...] = (
    "aiwf.session_token=present",
    "aiwf-session_token=present",
    "__Secure-aiwf.session_token=present",
    "better-auth.session_token=present",
    "aiwf_session_token=present",
    "role=user",
    "aiwf.session_token=present; role=user",
    "aiwf.session_token=present; role=admin",
)


@pytest.fixture(scope="module")
def client() -> Iterator[TestClient]:
    """Serve the current web API in-process. No live network."""
    app = create_app()
    with TestClient(app) as test_client:
        yield test_client


def _uses_device_auth(dependant: object) -> bool:
    """Return whether a FastAPI dependant chain calls the device-id dependency."""
    pending: list[object] = [dependant]
    while pending:
        current = pending.pop()
        call = getattr(current, "call", None)
        if call is get_current_device_id:
            return True
        if getattr(call, "__name__", "") == "get_current_device_id":
            return True
        children = getattr(current, "dependencies", None)
        if isinstance(children, list):
            pending.extend(children)
    return False


def _iter_api_routes(app: FastAPI) -> Iterator[APIRoute]:
    """Yield API routes, including routers mounted via ``include_router``."""
    pending: list[object] = list(app.routes)
    while pending:
        route = pending.pop()
        if isinstance(route, APIRoute):
            yield route
            continue
        original = getattr(route, "original_router", None)
        nested = getattr(original, "routes", None) if original is not None else None
        if not isinstance(nested, list):
            nested = getattr(route, "routes", None)
        if isinstance(nested, list):
            pending.extend(nested)


def _protected_operations(app: FastAPI) -> set[tuple[str, str]]:
    """Return ``(method, path)`` pairs guarded by device authentication."""
    found: set[tuple[str, str]] = set()
    for route in _iter_api_routes(app):
        if not _uses_device_auth(route.dependant):
            continue
        methods = route.methods
        if methods is None:
            continue
        for method in methods:
            if method in {"HEAD", "OPTIONS"}:
                continue
            found.add((method, route.path))
    return found


def _concrete_path(path: str) -> str:
    """Fill path parameters so the test client can call the route."""
    concrete = path.replace("{visualization_id}", "1").replace("{dashboard_id}", "1")
    if "{" in concrete:
        message = f"unsubstituted path parameter in {path}"
        raise AssertionError(message)
    return concrete


def _send(
    client: TestClient,
    method: str,
    path: str,
    body: dict[str, Any] | None,
    headers: dict[str, str] | None = None,
) -> Any:
    """Call one protected route with an optional JSON body."""
    return client.request(method, _concrete_path(path), json=body, headers=headers)


def _assert_unauthorized(response: Any, detail: str) -> None:
    """A rejected credential is 401 and is not an HTTP success."""
    assert response.status_code == 401
    assert response.is_success is False
    assert response.json() == {"detail": detail}


@pytest.mark.unit
def test_device_auth_routes_match_current_surface(client: TestClient) -> None:
    """The mounted device-auth surface is the visualization CRUD routes."""
    app = client.app
    assert isinstance(app, FastAPI)
    actual = _protected_operations(app)
    missing = EXPECTED_PROTECTED - actual
    unexpected = actual - EXPECTED_PROTECTED
    assert actual == EXPECTED_PROTECTED, (missing, unexpected)


@pytest.mark.unit
@pytest.mark.parametrize(
    ("method", "path", "body"),
    PROTECTED_CALLS,
    ids=[f"{method} {path}" for method, path, _body in PROTECTED_CALLS],
)
def test_missing_credentials_fail_closed(
    client: TestClient,
    method: str,
    path: str,
    body: dict[str, Any] | None,
) -> None:
    """No Authorization header and no API key is denied."""
    response = _send(client, method, path, body)
    _assert_unauthorized(response, AUTH_REQUIRED)
    assert response.headers.get("www-authenticate") == "Bearer"


@pytest.mark.unit
@pytest.mark.parametrize(
    ("method", "path", "body"),
    PROTECTED_CALLS,
    ids=[f"{method} {path}" for method, path, _body in PROTECTED_CALLS],
)
@pytest.mark.parametrize("role", [None, "", "user", "viewer"])
def test_missing_admin_role_fails_closed(
    client: TestClient,
    method: str,
    path: str,
    body: dict[str, Any] | None,
    role: str | None,
) -> None:
    """A session cookie without an admin role does not authorize the route.

    ``role is None`` omits the header entirely. Other values are present and
    are not ``admin``. Today's handler never reads a role; it rejects the call
    because there is no device credential.
    """
    headers = {"cookie": "aiwf.session_token=present"}
    if role is not None:
        headers["x-role"] = role

    response = _send(client, method, path, body, headers=headers)
    _assert_unauthorized(response, AUTH_REQUIRED)
    assert response.is_success is False


@pytest.mark.unit
@pytest.mark.parametrize("cookie", _SESSION_COOKIES)
@pytest.mark.parametrize(
    "path",
    ["/api/v1/visualizations", "/api/v1/dashboards"],
)
def test_session_cookie_alone_is_not_success(
    client: TestClient,
    cookie: str,
    path: str,
) -> None:
    """Cookie presence is not success. The current code already rejects it."""
    response = client.get(path, headers={"cookie": cookie})
    _assert_unauthorized(response, AUTH_REQUIRED)


@pytest.mark.unit
@pytest.mark.parametrize(
    ("method", "path", "body"),
    PROTECTED_CALLS,
    ids=[f"{method} {path}" for method, path, _body in PROTECTED_CALLS],
)
def test_non_bearer_authorization_fails_closed(
    client: TestClient,
    method: str,
    path: str,
    body: dict[str, Any] | None,
) -> None:
    """A non-Bearer Authorization header is rejected even when a cookie is set."""
    response = _send(
        client,
        method,
        path,
        body,
        headers={
            "authorization": "Basic present",
            "cookie": "aiwf.session_token=present",
            "x-role": "admin",
        },
    )
    _assert_unauthorized(response, BAD_AUTHORIZATION)


@pytest.mark.unit
def test_unknown_api_key_with_admin_cookie_fails_closed(client: TestClient) -> None:
    """An unknown API key plus an admin-labeled cookie is still denied."""
    response = client.get(
        "/api/v1/visualizations",
        headers={
            "x-api-key": "awf_not-a-stored-key",
            "cookie": "aiwf.session_token=present; role=admin",
            "x-role": "admin",
        },
    )
    _assert_unauthorized(response, AUTH_REQUIRED)
    assert response.headers.get("www-authenticate") == "Bearer"
