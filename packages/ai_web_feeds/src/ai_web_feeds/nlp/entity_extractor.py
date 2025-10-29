"""Named entity extraction using spaCy (Phase 5B placeholder)."""

from typing import Optional
from ai_web_feeds.config import Settings


class EntityExtractor:
    """Extract and normalize entities from article text (Phase 5B)."""
    
    def __init__(self, settings: Optional[Settings] = None):
        """Initialize entity extractor."""
        self.settings = settings or Settings()
        self.config = self.settings.phase5
    
    def extract_entities(self, article: dict) -> list[dict]:
        """Extract entities from article (to be implemented in Phase 5B)."""
        return []
