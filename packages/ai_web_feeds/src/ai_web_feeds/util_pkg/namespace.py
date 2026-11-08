"""Call-time lookup of names on the utils facade.

Callers and tests patch ``ai_web_feeds.utils``. Implementations resolve
``urlparse`` and sibling helpers there so those patches still apply.
"""

import sys
from typing import Any


def lookup(name: str) -> Any:
    """Return the current ``ai_web_feeds.utils`` binding for ``name``."""
    return getattr(sys.modules["ai_web_feeds.utils"], name)
