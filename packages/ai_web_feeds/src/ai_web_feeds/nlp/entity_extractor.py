"""Named entity extraction using spaCy (Phase 5B)."""

from typing import ClassVar

import spacy
from loguru import logger
from pydantic import BaseModel, Field

from ai_web_feeds.config import Settings
from ai_web_feeds.nlp.content import article_value, extract_article_text


def _legacy_entity_type(label: str) -> str | None:
    return {
        "PERSON": "person",
        "ORG": "organization",
        "GPE": "organization",
        "PRODUCT": "technique",
    }.get(label.upper())


class ExtractedEntity(BaseModel):
    """An extracted entity with metadata."""

    text: str = Field(description="Entity text as it appears")
    label: str = Field(description="Entity type label")
    start: int = Field(description="Character start position")
    end: int = Field(description="Character end position")
    confidence: float = Field(ge=0.0, le=1.0, description="Extraction confidence")
    context: str = Field("", description="Source text snippet around the entity")

    @property
    def type(self) -> str | None:
        """Legacy dict-style entity type accessor used by older tests/helpers."""
        return _legacy_entity_type(self.label)

    @property
    def entity_type(self) -> str | None:
        """Legacy alias for callers that expect ``entity_type`` instead of ``type``."""
        return self.type

    @property
    def start_char(self) -> int:
        """Legacy alias for the entity start offset."""
        return self.start

    @property
    def end_char(self) -> int:
        """Legacy alias for the entity end offset."""
        return self.end

    def __getitem__(self, key: str):
        if key == "type":
            return self.type
        if key == "entity_type":
            return self.entity_type
        if key == "start_char":
            return self.start_char
        if key == "end_char":
            return self.end_char
        return getattr(self, key)

    def __contains__(self, key: str) -> bool:
        return key in {
            "text",
            "label",
            "type",
            "entity_type",
            "start",
            "end",
            "start_char",
            "end_char",
            "confidence",
            "context",
        }

    def get(self, key: str, default=None):
        """Provide dict-style access for legacy callers."""
        if key in self:
            return self[key]
        return default

    def items(self):
        """Iterate as a legacy mapping."""
        yield from self.model_dump().items()

    def keys(self):
        """Expose keys for legacy mapping consumers."""
        return self.model_dump().keys()

    def model_dump(self, *args, **kwargs):
        """Include the legacy ``type`` field in dumped payloads."""
        payload = super().model_dump(*args, **kwargs)
        payload["type"] = self.type
        payload["entity_type"] = self.entity_type
        payload["start_char"] = self.start_char
        payload["end_char"] = self.end_char
        return payload

    def __getitem__(self, key: str):
        if key == "type":
            return EntityExtractor.ENTITY_TYPE_MAP.get(self.label)
        return getattr(self, key)


class EntityExtractor:
    """Extract and normalize entities from article text using spaCy."""

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
        "GPE": "organization",
        "PRODUCT": "technique",
        "WORK_OF_ART": "dataset",
        "EVENT": "concept",
        "LAW": "concept",
        "NORP": "concept",
        "LANGUAGE": "concept",
        "FAC": "organization",
    }

    def __init__(self, settings: Settings | None = None):
        """Initialize entity extractor with spaCy model."""
        self.settings = settings or Settings()
        self.config = self.settings.phase5
        self.min_confidence = self.config.entity_confidence_threshold

        try:
            self.nlp = spacy.load(self.config.spacy_model)
            logger.info(f"Loaded spaCy model: {self.config.spacy_model}")
        except OSError:
            logger.warning(
                f"spaCy model {self.config.spacy_model} not found. "
                f"Download with: python -m spacy download {self.config.spacy_model}"
            )
            raise

    def extract_entities(
        self,
        article: dict,
        min_confidence: float | None = None,
    ) -> list[ExtractedEntity]:
        """Extract entities from sufficiently long article content."""
        min_conf = min_confidence or self.min_confidence
        article_id = article_value(article, "id")

        try:
            content = self._get_content(article)
            if not content or len(content.strip()) < 100:
                logger.debug(f"No content to extract entities from: {article_id}")
                return []

            # Process with spaCy
            doc = self.nlp(content[:10000])  # Keep extraction bounded on long articles

            for ent in doc.ents:
                entity_type = self._map_spacy_label(ent.label_)
                if entity_type is None:
                    continue

                # Calculate confidence (spaCy doesn't provide confidence directly)
                # Use a heuristic based on entity properties
                confidence = self._calculate_confidence(ent)

                confidence = self._compute_confidence(ent)
                if confidence >= min_conf:
                    entities.append(
                        ExtractedEntity(
                            text=ent.text,
                            label=ent.label_,
                            start=ent.start_char,
                            end=ent.end_char,
                            confidence=confidence,
                            context=self._extract_context(ent, doc),
                        )
                    )

            logger.debug(f"Extracted {len(entities)} entities from article {article_id}")
            return entities

        except Exception as e:
            logger.error(f"Failed to extract entities from article {article_id}: {e}")
            return []

    def normalize_entity(
        self,
        entity_text: str,
        entity_label: str,
        existing_entities: dict[str, dict] | list[str] | None = None,
    ) -> dict | str:
        """Normalize entity to canonical form.

            for existing in existing_entities:
                normalized_existing = existing.strip().title()
                if self._is_same_entity(canonical, normalized_existing):
                    return normalized_existing

            return canonical

        canonical = entity_text.strip()
        entity_type = self._map_spacy_label(entity_label) or self._infer_type(canonical)

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
                    return {
                        "id": existing_id,
                        "canonical_name": existing["canonical_name"],
                        "entity_type": existing["entity_type"],
                        "is_new": False,
                    }

        return {
            "canonical_name": canonical,
            "entity_type": entity_type,
            "aliases": [canonical],
            "is_new": True,
        }

    def _map_spacy_label(self, label: str) -> str | None:
        """Map a spaCy label into the internal entity taxonomy."""

        return self.ENTITY_TYPE_MAP.get(label)

    def _compute_confidence(self, ent: spacy.tokens.Span) -> float:
        """Compatibility wrapper for older helper naming."""

        return self._calculate_confidence(ent)

    def _extract_context(self, ent: spacy.tokens.Span, doc, window: int = 50) -> str:
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
        return extract_article_text(article)

    def _map_spacy_label(self, label: str) -> str | None:
        """Map spaCy labels to the legacy test taxonomy."""
        return _legacy_entity_type(label)

    def _compute_confidence(self, ent: spacy.tokens.Span) -> float:
        """Compute a stable confidence heuristic for legacy callers."""
        text = getattr(ent, "text", "") or ""
        score = 0.75

        if len(text) > 20:
            score += 0.1
        elif len(text) > 10:
            score += 0.05

        if text and text[0].isupper():
            score += 0.05

        if getattr(ent, "label_", "") in {"PERSON", "ORG", "GPE", "PRODUCT"}:
            score += 0.05

        return min(1.0, score)

    def _calculate_confidence(self, ent: spacy.tokens.Span) -> float:
        """Backward-compatible alias for older helpers."""
        return self._compute_confidence(ent)

    def _extract_context(self, ent, doc, window: int = 50) -> str:
        """Extract a short snippet of source text around an entity."""
        text = getattr(doc, "text", "") or ""
        start = max(0, getattr(ent, "start_char", 0) - window)
        end = min(len(text), getattr(ent, "end_char", 0) + window)
        return text[start:end]

    def _infer_type(self, entity_text: str) -> str:
        """Infer a basic entity type when no explicit mapping is available."""
        words = [word for word in entity_text.split() if word]
        if 2 <= len(words) <= 3:
            return "person"
        return "organization"

    def _is_same_entity(self, name1: str, name2: str) -> bool:
        """Check if two entity names refer to the same entity."""
        if name1.lower() == name2.lower():
            return True

        # Check if one is contained in the other
        # (handles "MIT" vs "Massachusetts Institute of Technology")
        n1_lower = name1.lower()
        n2_lower = name2.lower()
        if n1_lower in n2_lower or n2_lower in n1_lower:
            shorter = min(len(n1_lower), len(n2_lower))
            longer = max(len(n1_lower), len(n2_lower))
            if longer > 0 and shorter / longer > 0.3:
                return True

        return False
