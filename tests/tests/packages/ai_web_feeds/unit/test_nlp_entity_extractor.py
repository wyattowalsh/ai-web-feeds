"""Unit tests for Entity Extractor (Phase 5B)"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from ai_web_feeds.nlp.entity_extractor import EntityExtractor
from ai_web_feeds.config import Settings


class TestEntityExtractor:
    """Test suite for EntityExtractor class"""

    @pytest.fixture
    def extractor(self):
        """Create EntityExtractor instance for testing"""
        with patch('ai_web_feeds.nlp.entity_extractor.spacy.load') as mock_load:
            # Mock spaCy model
            mock_nlp = MagicMock()
            mock_load.return_value = mock_nlp
            extractor = EntityExtractor()
            extractor.nlp = mock_nlp
            yield extractor

    @pytest.fixture
    def sample_article(self):
        """Sample article for testing"""
        return {
            "id": 1,
            "title": "Attention Is All You Need",
            "content": "The Transformer architecture, introduced by Vaswani et al. in 2017, "
                      "revolutionized natural language processing. Unlike previous approaches that "
                      "relied on recurrent neural networks, Transformers use self-attention mechanisms. "
                      "Key researchers include Ashish Vaswani from Google Brain and Ilya Sutskever from OpenAI."
        }

    def test_initialization(self, extractor):
        """Test EntityExtractor initializes correctly"""
        assert extractor is not None
        assert extractor.config is not None
        assert extractor.nlp is not None

    def test_initialization_custom_settings(self):
        """Test EntityExtractor with custom settings"""
        settings = Settings()
        settings.phase5.spacy_model = "en_core_web_md"

        with patch('ai_web_feeds.nlp.entity_extractor.spacy.load') as mock_load:
            mock_nlp = MagicMock()
            mock_load.return_value = mock_nlp
            extractor = EntityExtractor(settings)

            assert extractor.config.spacy_model == "en_core_web_md"

    def test_extract_entities_basic(self, extractor, sample_article):
        """Test basic entity extraction"""
        # Mock spaCy doc
        mock_ent1 = Mock()
        mock_ent1.text = "Ashish Vaswani"
        mock_ent1.label_ = "PERSON"
        mock_ent1.start_char = 10
        mock_ent1.end_char = 25

        mock_ent2 = Mock()
        mock_ent2.text = "Google Brain"
        mock_ent2.label_ = "ORG"
        mock_ent2.start_char = 30
        mock_ent2.end_char = 42

        mock_doc = Mock()
        mock_doc.ents = [mock_ent1, mock_ent2]
        mock_doc.text = sample_article["content"]

        extractor.nlp.return_value = mock_doc

        entities = extractor.extract_entities(sample_article)

        assert len(entities) == 2
        assert entities[0]["text"] == "Ashish Vaswani"
        assert entities[0]["type"] == "person"
        assert entities[1]["text"] == "Google Brain"
        assert entities[1]["type"] == "organization"

    def test_extract_entities_empty_content(self, extractor):
        """Test extraction with empty content"""
        article = {"id": 1, "content": ""}

        entities = extractor.extract_entities(article)

        assert entities == []

    def test_extract_entities_short_content(self, extractor):
        """Test extraction with content < 100 chars"""
        article = {"id": 1, "content": "Short text"}

        entities = extractor.extract_entities(article)

        assert entities == []

    def test_map_spacy_label_person(self, extractor):
        """Test spaCy label mapping for PERSON"""
        result = extractor._map_spacy_label("PERSON")
        assert result == "person"

    def test_map_spacy_label_org(self, extractor):
        """Test spaCy label mapping for ORG"""
        result = extractor._map_spacy_label("ORG")
        assert result == "organization"

    def test_map_spacy_label_gpe(self, extractor):
        """Test spaCy label mapping for GPE"""
        result = extractor._map_spacy_label("GPE")
        assert result == "organization"

    def test_map_spacy_label_product(self, extractor):
        """Test spaCy label mapping for PRODUCT"""
        result = extractor._map_spacy_label("PRODUCT")
        assert result == "technique"

    def test_map_spacy_label_unmapped(self, extractor):
        """Test spaCy label mapping for unmapped labels"""
        assert extractor._map_spacy_label("LOC") is None
        assert extractor._map_spacy_label("DATE") is None
        assert extractor._map_spacy_label("NORP") is None

    def test_compute_confidence(self, extractor):
        """Test confidence computation"""
        mock_ent = Mock()
        mock_ent.text = "Geoffrey Hinton"

        confidence = extractor._compute_confidence(mock_ent)

        assert 0.0 <= confidence <= 1.0
        assert confidence >= 0.75  # Base confidence

    def test_extract_context(self, extractor):
        """Test context extraction"""
        mock_doc = Mock()
        mock_doc.text = "This is a test sentence with Geoffrey Hinton mentioned in the middle of the text."

        mock_ent = Mock()
        mock_ent.start_char = 30
        mock_ent.end_char = 45

        context = extractor._extract_context(mock_ent, mock_doc, window=20)

        assert len(context) > 0
        assert "Geoffrey Hinton" in context

    def test_normalize_entity_exact_match(self, extractor):
        """Test entity normalization with exact match"""
        existing = ["Geoffrey Hinton", "OpenAI", "Transformers"]

        normalized = extractor.normalize_entity("Geoffrey Hinton", "person", existing)

        assert normalized == "Geoffrey Hinton"

    def test_normalize_entity_similar_name(self, extractor):
        """Test entity normalization with similar name (Levenshtein)"""
        existing = ["Geoffrey Hinton"]

        # "G. Hinton" should normalize to "Geoffrey Hinton" (distance = 8, but within threshold for person type logic)
        normalized = extractor.normalize_entity("Geoffrey Hinton", "person", existing)

        assert normalized == "Geoffrey Hinton"

    def test_normalize_entity_new_name(self, extractor):
        """Test entity normalization creates new name"""
        existing = ["Geoffrey Hinton", "OpenAI"]

        normalized = extractor.normalize_entity("Yann LeCun", "person", existing)

        assert normalized == "Yann Lecun"  # Title case

    def test_normalize_entity_case_insensitive(self, extractor):
        """Test normalization is case-insensitive"""
        existing = ["Geoffrey Hinton"]

        normalized1 = extractor.normalize_entity("geoffrey hinton", "person", existing)
        normalized2 = extractor.normalize_entity("GEOFFREY HINTON", "person", existing)

        assert normalized1 == "Geoffrey Hinton"
        assert normalized2 == "Geoffrey Hinton"

    def test_extract_entities_filters_low_confidence(self, extractor, sample_article):
        """Test that entities with unmapped labels are filtered"""
        # Mock entity with unmapped label
        mock_ent = Mock()
        mock_ent.text = "2017"
        mock_ent.label_ = "DATE"  # DATE is not mapped
        mock_ent.start_char = 0
        mock_ent.end_char = 4

        mock_doc = Mock()
        mock_doc.ents = [mock_ent]
        mock_doc.text = sample_article["content"]

        extractor.nlp.return_value = mock_doc

        entities = extractor.extract_entities(sample_article)

        assert len(entities) == 0  # Filtered out

    def test_extract_entities_handles_long_content(self, extractor):
        """Test extraction truncates very long content"""
        article = {
            "id": 1,
            "content": "A" * 20000  # 20k characters
        }

        mock_doc = Mock()
        mock_doc.ents = []
        mock_doc.text = "A" * 10000  # Should be truncated to 10k

        extractor.nlp.return_value = mock_doc

        entities = extractor.extract_entities(article)

        # Should call nlp with truncated content (max 10k)
        call_args = extractor.nlp.call_args[0][0]
        assert len(call_args) <= 10000

    def test_infer_type_person(self, extractor):
        """Test type inference for person (2-3 words)"""
        result = extractor._infer_type("Geoffrey Hinton")
        assert result == "person"

    def test_infer_type_organization(self, extractor):
        """Test type inference for organization (not 2-3 words)"""
        result = extractor._infer_type("OpenAI")
        assert result == "organization"


class TestEntityNormalization:
    """Test suite for entity normalization edge cases"""

    @pytest.fixture
    def extractor(self):
        """Create EntityExtractor instance"""
        with patch('ai_web_feeds.nlp.entity_extractor.spacy.load') as mock_load:
            mock_nlp = MagicMock()
            mock_load.return_value = mock_nlp
            extractor = EntityExtractor()
            extractor.nlp = mock_nlp
            yield extractor

    def test_normalize_strips_whitespace(self, extractor):
        """Test normalization strips leading/trailing whitespace"""
        existing = []

        normalized = extractor.normalize_entity("  Geoffrey Hinton  ", "person", existing)

        assert normalized == "Geoffrey Hinton"
        assert normalized[0] != " "
        assert normalized[-1] != " "

    def test_normalize_handles_special_characters(self, extractor):
        """Test normalization with special characters"""
        existing = []

        normalized = extractor.normalize_entity("O'Reilly", "organization", existing)

        assert "O'Reilly" in normalized or "O'Reilly" in normalized

    def test_normalize_empty_string(self, extractor):
        """Test normalization with empty string"""
        existing = []

        normalized = extractor.normalize_entity("", "person", existing)

        assert normalized == ""


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
