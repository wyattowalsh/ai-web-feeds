"""Public feed listing does not export an inactive filter.

``list_feeds`` is not part of the package surface. ``load_feeds`` and
``DatabaseManager.get_all_feed_sources`` return the rows they load and do not
accept an active or inactive flag. Other callers drop inactive feeds inside
their own queries; none of those helpers accept an in-memory mix of rows.
"""

import inspect

import ai_web_feeds
import pytest
from ai_web_feeds import load, storage
from ai_web_feeds.storage import DatabaseManager

_INACTIVE_FLAG_NAMES = frozenset(
    {
        "active",
        "inactive",
        "include_inactive",
        "is_active",
        "active_only",
        "only_active",
    }
)


def _public_functions(module: object) -> dict[str, object]:
    """Return module-level functions, excluding private helpers."""
    return {
        name: value
        for name, value in vars(module).items()
        if inspect.isfunction(value) and not name.startswith("_")
    }


@pytest.mark.unit
def test_package_does_not_export_list_feeds() -> None:
    """``ai_web_feeds`` does not export a function named ``list_feeds``."""
    exported_functions = _public_functions(ai_web_feeds)

    assert "list_feeds" not in ai_web_feeds.__all__
    assert "list_feeds" not in exported_functions
    assert not hasattr(ai_web_feeds, "list_feeds")


@pytest.mark.unit
def test_storage_and_load_have_no_public_inactive_list() -> None:
    """Public storage and load lists neither export ``list_feeds`` nor filter inactive rows."""
    assert "list_feeds" not in _public_functions(storage)
    assert "list_feeds" not in _public_functions(load)
    assert not hasattr(DatabaseManager, "list_feeds")

    public_lists = (
        DatabaseManager.get_all_feed_sources,
        load.load_feeds,
    )
    for function in public_lists:
        parameter_names = set(inspect.signature(function).parameters)
        assert parameter_names.isdisjoint(_INACTIVE_FLAG_NAMES)
