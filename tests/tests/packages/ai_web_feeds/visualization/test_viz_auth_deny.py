"""Characterization: a visualization request without the required role is denied.

Today's gate is ``get_current_device_id``. A role header or a JWT ``role`` claim
is not accepted. The request is denied with HTTP 401 unless a device JWT or API
key is present. These cases stay on that denial path and do not call the network.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import jwt
import pytest
from ai_web_feeds.visualization import auth as viz_auth
from ai_web_feeds.visualization.api import router
from fastapi import FastAPI
from fastapi.testclient import TestClient
from httpx import Response

_VISUALIZATION_PATHS: tuple[str, ...] = (
    "/api/v1/visualizations",
    "/api/v1/visualizations/1",
    "/api/v1/dashboards",
)
_AUTH_DETAIL = "Authentication required (provide JWT token or API key)"
_FORMAT_DETAIL = "Invalid authorization header format"
_SIGNING_MATERIAL = "viz-auth-deny-signing-material-32"


def _visualization_app() -> FastAPI:
    app = FastAPI()
    app.include_router(router)
    return app


def _assert_denied(response: Response, detail: str) -> None:
    assert response.status_code == 401
    payload: object = response.json()
    assert isinstance(payload, dict)
    assert payload.get("detail") == detail


@pytest.mark.unit
def test_visualization_request_without_required_role_is_denied() -> None:
    """No credential, and a non-admin role header, are both denied."""
    with TestClient(_visualization_app()) as client:
        for path in _VISUALIZATION_PATHS:
            missing = client.get(path)
            _assert_denied(missing, _AUTH_DETAIL)
            assert missing.headers["www-authenticate"] == "Bearer"

            insufficient_role = client.get(path, headers={"X-Role": "viewer"})
            _assert_denied(insufficient_role, _AUTH_DETAIL)
            assert insufficient_role.headers["www-authenticate"] == "Bearer"

            malformed = client.get(
                path,
                headers={"Authorization": "Token viewer", "X-Role": "admin"},
            )
            _assert_denied(malformed, _FORMAT_DETAIL)
            assert "www-authenticate" not in malformed.headers


@pytest.mark.unit
def test_role_claim_without_device_identity_is_denied(monkeypatch: pytest.MonkeyPatch) -> None:
    """A signed role claim is not the principal today's visualization auth accepts."""
    monkeypatch.setattr(viz_auth.settings, "jwt_secret_key", _SIGNING_MATERIAL)
    encoded = jwt.encode(
        {
            "role": "viewer",
            "exp": datetime.now(UTC) + timedelta(hours=1),
            "iat": datetime.now(UTC),
        },
        _SIGNING_MATERIAL,
        algorithm=viz_auth.JWT_ALGORITHM,
    )
    bearer = encoded if isinstance(encoded, str) else encoded.decode()

    with TestClient(_visualization_app()) as client:
        response = client.get(
            "/api/v1/visualizations",
            headers={"Authorization": f"Bearer {bearer}", "X-Role": "viewer"},
        )

    _assert_denied(response, _AUTH_DETAIL)
    assert response.headers["www-authenticate"] == "Bearer"
