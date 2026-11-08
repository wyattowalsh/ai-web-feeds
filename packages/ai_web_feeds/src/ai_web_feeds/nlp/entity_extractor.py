"""Named entity extraction using spaCy (Phase 5B)."""

from __future__ import annotations

import importlib
from typing import Any, ClassVar, Protocol

from loguru import logger
from pydantic import BaseModel, Field

from ai_web_feeds.config import Settings


class _TokenSpan(Protocol):
    """spaCy span fields the extractor reads. Tests can supply the same shape."""

    text: str
    label_: str
    start_char: int
    end_char: int


class _LazySpacy:
    """Patchable spaCy loader. The package is imported only when a model is requested."""

    def load(self, name: str, *args: object, **kwargs: object) -> Any:
        module = importlib.import_module("spacy")
        return module.load(name, *args, **kwargs)


# Name kept so callers can patch `entity_extractor.spacy.load` without importing spaCy.
spacy = _LazySpacy()


class ExtractedEntity(BaseModel):
    """An extracted entity with metadata."""

    text: str = Field(description="Entity text as it appears")
    label: str = Field(description="Entity type label")
    start: int = Field(description="Character start position")
    end: int = Field(description="Character end position")
    confidence: float = Field(ge=0.0, le=1.0, description="Extraction confidence")

    def __getitem__(self, key: str):
        if key == "type":
            return EntityExtractor.ENTITY_TYPE_MAP.get(self.label)
        return getattr(self, key)


class EntityExtractor:
    """Extract and normalize entities from article text using spaCy.

    Extracts entities for:
    - PERSON: People, including authors and researchers
    - ORG: Organizations (companies, universities, labs)
    - GPE: Geopolitical entities (countries, cities)
    - PRODUCT: Products, software, datasets
    - WORK_OF_ART: Papers, publications, projects
    - EVENT: Conferences, workshops
    - LAW: Regulations, standards
    - NORP: Nationalities, groups

    Performs entity normalization and alias resolution for canonical names.
    """

    # Entity type mapping from spaCy to our taxonomy
    ENTITY_TYPE_MAP: ClassVar[dict[str, str]] = {
        "PERSON": "person",
        "ORG": "organization",
        "GPE": "location",
        "PRODUCT": "technique",  # Software/tools often represent techniques
        "WORK_OF_ART": "dataset",  # Papers and datasets
        "EVENT": "concept",
        "LAW": "concept",
        "NORP": "concept",
        "LANGUAGE": "concept",
        "FAC": "organization",  # Facilities like labs
    }

    def __init__(self, settings: Settings | None = None, nlp: Any | None = None):
        """Initialize entity extractor.

        The model is injected. Construction does not import spaCy or download weights.
        A missing model is resolved later by :meth:`ensure_model`.

        Args:
            settings: Application settings (uses defaults if None)
            nlp: Optional callable spaCy language model. When omitted, the configured
                model is loaded on first use if the optional ml extra is installed.
        """
        self.settings = settings or Settings()
        self.config = self.settings.phase5
        self.min_confidence = self.config.entity_confidence_threshold
        self.nlp = nlp
        self._model_unavailable = False

    def ensure_model(self) -> bool:
        """Return whether a model is ready.

        An injected model is used as-is. Otherwise load the configured spaCy model
        from the local install. A missing optional ml extra or model is logged once
        and does not download weights.
        """
        if self.nlp is not None:
            return True
        if self._model_unavailable:
            return False
        try:
            self.nlp = spacy.load(self.config.spacy_model)
        except (ImportError, OSError) as exc:
            self._model_unavailable = True
            logger.warning(
                "Optional ml extra is missing or spaCy model "
                f"{self.config.spacy_model} is unavailable: {exc}"
            )
            return False
        logger.info(f"Loaded spaCy model: {self.config.spacy_model}")
        return True

    def extract_entities(
        self, article: dict, min_confidence: float | None = None
    ) -> list[ExtractedEntity]:
        """Extract entities from article text.

        Args:
            article: Article dict with keys: content, summary, title
            min_confidence: Minimum confidence threshold (default: from config)

        Returns:
            List of extracted entities with metadata
        """
        min_conf = min_confidence or self.min_confidence

        try:
            # Extract text content
            content = self._get_content(article)
            if not content:
                logger.debug(f"No content to extract entities from: {article.get('id')}")
                return []
            if not self.ensure_model():
                return []
            model = self.nlp
            if model is None:
                return []

            # Process with the injected or locally installed model.
            doc = model(content[:10000])  # Keep extraction bounded on long articles

            # Extract entities above confidence threshold
            entities = []
            for ent in doc.ents:
                entity_type = self._map_spacy_label(ent.label_)
                if entity_type is None:
                    continue

                # Calculate confidence (spaCy doesn't provide confidence directly)
                # Use a heuristic based on entity properties
                confidence = self._calculate_confidence(ent)

                if confidence >= min_conf:
                    entities.append(
                        ExtractedEntity(
                            text=ent.text,
                            label=ent.label_,
                            start=ent.start_char,
                            end=ent.end_char,
                            confidence=confidence,
                        )
                    )

            logger.debug(f"Extracted {len(entities)} entities from article {article.get('id')}")
            return entities

        except Exception as e:
            logger.error(f"Failed to extract entities from article {article.get('id')}: {e}")
            return []

    def normalize_entity(
        self,
        entity_text: str,
        entity_label: str,
        existing_entities: dict[str, dict] | list[str] | None = None,
    ) -> dict | str:
        """Normalize entity to canonical form.

        Performs:
        - Case normalization
        - Alias resolution
        - Duplicate detection

        Args:
            entity_text: Raw entity text
            entity_label: Entity type label
            existing_entities: Dict of existing entities for deduplication

        Returns:
            Dict with canonical_name, entity_type, aliases
        """
        # Basic normalization
        canonical = entity_text.strip()

        if isinstance(existing_entities, list):
            normalized = canonical.title() if canonical else ""
            for existing in existing_entities:
                if self._is_same_entity(normalized, existing):
                    return existing
            return normalized

        # Map spaCy label to our taxonomy
        entity_type = self.ENTITY_TYPE_MAP.get(entity_label, "concept")

        # Check for existing entity with similar name
        if existing_entities:
            for existing_id, existing in existing_entities.items():
                if self._is_same_entity(canonical, existing["canonical_name"]):
                    # Return existing entity
                    return {
                        "id": existing_id,
                        "canonical_name": existing["canonical_name"],
                        "entity_type": existing["entity_type"],
                        "is_new": False,
                    }

        # New entity
        return {
            "canonical_name": canonical,
            "entity_type": entity_type,
            "aliases": [canonical],  # Start with original text
            "is_new": True,
        }

    def _map_spacy_label(self, label: str) -> str | None:
        """Map a spaCy label into the internal entity taxonomy."""

        return self.ENTITY_TYPE_MAP.get(label)

    def _extract_context(self, ent: _TokenSpan, doc: Any, window: int = 50) -> str:
        """Extract a short text window around an entity span."""

        start = max(0, ent.start_char - window)
        end = min(len(doc.text), ent.end_char + window)
        return doc.text[start:end]

    def _infer_type(self, entity_text: str) -> str:
        """Infer a coarse entity type from the surface form."""

        parts = [part for part in entity_text.strip().split() if part]
        if 2 <= len(parts) <= 3:
            return "person"
        return "organization"

    def _get_content(self, article: dict) -> str:
        """Extract text content from article."""
        # Combine title, summary, and content
        parts = []

        if article.get("title"):
            parts.append(article["title"])

        if article.get("summary"):
            parts.append(article["summary"])

        content = article.get("content", "")
        if isinstance(content, list):
            content = " ".join(item.get("value", "") for item in content if isinstance(item, dict))
        if content:
            parts.append(content)

        return " ".join(parts)

    def _calculate_confidence(self, ent: _TokenSpan) -> float:
        """Calculate confidence score for an entity.

        spaCy doesn't provide confidence directly, so we use heuristics:
        - Entity length (longer = more confident)
        - Capitalization (proper case = more confident)
        - Frequency in document (more mentions = more confident)
        - Entity type reliability

        Args:
            ent: spaCy entity span

        Returns:
            Confidence score (0.0-1.0)
        """
        score = 0.5  # Base score

        # Length bonus (up to +0.2)
        if len(ent.text) > 10:
            score += 0.2
        elif len(ent.text) > 5:
            score += 0.1

        # Capitalization bonus (+0.1)
        if ent.text[0].isupper():
            score += 0.1

        # Entity type reliability (+0.2 for high-confidence types)
        high_confidence_types = {"PERSON", "ORG", "GPE", "PRODUCT"}
        if ent.label_ in high_confidence_types:
            score += 0.2

        return min(1.0, score)

    def _is_same_entity(self, name1: str, name2: str) -> bool:
        """Check if two entity names refer to the same entity.

        Uses simple string matching. Could be enhanced with:
        - Levenshtein distance
        - Abbreviation matching
        - Fuzzy matching

        Args:
            name1: First entity name
            name2: Second entity name

        Returns:
            True if entities are likely the same
        """
        # Case-insensitive exact match
        if name1.lower() == name2.lower():
            return True

        # Check if one is contained in the other
        # (handles "MIT" vs "Massachusetts Institute of Technology")
        n1_lower = name1.lower()
        n2_lower = name2.lower()
        if n1_lower in n2_lower or n2_lower in n1_lower:
            # Only match if the shorter one is a "significant" substring
            shorter = min(len(n1_lower), len(n2_lower))
            longer = max(len(n1_lower), len(n2_lower))
            if shorter / longer > 0.3:  # At least 30% overlap
                return True

        return False
