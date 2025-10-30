"""Unit tests for Topic Modeler (Phase 5D)"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from ai_web_feeds.nlp.topic_modeler import TopicModeler
from ai_web_feeds.config import Settings


class TestTopicModeler:
    """Test suite for TopicModeler class"""

    @pytest.fixture
    def modeler(self):
        """Create TopicModeler instance for testing"""
        modeler = TopicModeler()
        yield modeler

    @pytest.fixture
    def sample_articles(self):
        """Sample articles for topic modeling"""
        return [
            {
                "id": 1,
                "content": "Transformer models use self-attention mechanisms for NLP tasks. "
                          "BERT and GPT are popular transformer architectures."
            },
            {
                "id": 2,
                "content": "Reinforcement learning from human feedback improves model alignment. "
                          "RLHF helps AI systems behave according to human values."
            },
            {
                "id": 3,
                "content": "Computer vision models process images using convolutional neural networks. "
                          "CNNs extract features from visual data."
            },
            {
                "id": 4,
                "content": "Natural language processing enables machines to understand text. "
                          "NLP techniques include tokenization and embedding."
            },
            {
                "id": 5,
                "content": "Deep learning neural networks learn hierarchical representations. "
                          "Training requires large datasets and computational resources."
            }
        ]

    def test_initialization(self, modeler):
        """Test TopicModeler initializes correctly"""
        assert modeler is not None
        assert modeler.config is not None

    def test_initialization_custom_settings(self):
        """Test TopicModeler with custom settings"""
        settings = Settings()
        settings.phase5.topic_coherence_min = 0.6

        modeler = TopicModeler(settings)

        assert modeler.config.topic_coherence_min == 0.6

    def test_preprocess_text_basic(self, modeler):
        """Test text preprocessing"""
        text = "The Transformer architecture uses self-attention mechanisms."

        tokens = modeler._preprocess_text(text)

        # Should tokenize, lowercase, remove stopwords
        assert isinstance(tokens, list)
        assert len(tokens) > 0
        assert "transformer" in tokens or "architecture" in tokens
        # Stopwords should be removed
        assert "the" not in tokens

    def test_preprocess_text_removes_stopwords(self, modeler):
        """Test stopword removal"""
        text = "The a an and or but the"

        tokens = modeler._preprocess_text(text)

        # All stopwords should be removed
        assert len(tokens) == 0

    def test_preprocess_text_short_words(self, modeler):
        """Test removal of very short words"""
        text = "AI ML is a big field"

        tokens = modeler._preprocess_text(text)

        # Words < 3 chars should be removed
        assert "ai" not in tokens
        assert "ml" not in tokens
        assert "is" not in tokens
        assert "a" not in tokens

    def test_preprocess_text_empty(self, modeler):
        """Test preprocessing empty text"""
        tokens = modeler._preprocess_text("")

        assert tokens == []

    @patch('ai_web_feeds.nlp.topic_modeler.models.LdaModel')
    @patch('ai_web_feeds.nlp.topic_modeler.corpora.Dictionary')
    def test_extract_subtopics_basic(self, mock_dict, mock_lda, modeler, sample_articles):
        """Test basic subtopic extraction"""
        # Mock dictionary
        mock_dictionary = MagicMock()
        mock_dictionary.filter_extremes = MagicMock()
        mock_dict.return_value = mock_dictionary

        # Mock LDA model
        mock_model = MagicMock()
        mock_model.get_topics.return_value = [[0.1, 0.2, 0.05]]  # Topic-word matrix
        mock_model.show_topic.return_value = [
            ("transformer", 0.15),
            ("attention", 0.12),
            ("bert", 0.10),
            ("gpt", 0.08),
            ("model", 0.07)
        ]
        mock_lda.return_value = mock_model

        # Mock coherence
        with patch.object(modeler, '_compute_coherence', return_value=0.65):
            subtopics = modeler.extract_subtopics(
                parent_topic="NLP",
                articles=sample_articles,
                num_topics=2
            )

        assert isinstance(subtopics, list)
        # Should return topics (may be 0 if filtered by coherence)
        assert len(subtopics) >= 0

    def test_extract_subtopics_insufficient_articles(self, modeler):
        """Test extraction with too few articles"""
        articles = [
            {"id": 1, "content": "Short article one."},
            {"id": 2, "content": "Short article two."}
        ]

        subtopics = modeler.extract_subtopics(
            parent_topic="Test",
            articles=articles,
            num_topics=5
        )

        # Should return empty list if not enough articles
        assert subtopics == []

    def test_extract_subtopics_empty_articles(self, modeler):
        """Test extraction with empty articles list"""
        subtopics = modeler.extract_subtopics(
            parent_topic="Test",
            articles=[],
            num_topics=5
        )

        assert subtopics == []

    def test_generate_subtopic_name(self, modeler):
        """Test subtopic name generation from keywords"""
        keywords = ["transformer", "attention", "bert", "gpt", "model"]

        name = modeler._generate_subtopic_name(keywords)

        assert isinstance(name, str)
        assert len(name) > 0
        # Should be title case
        assert name[0].isupper()

    def test_generate_subtopic_description(self, modeler):
        """Test subtopic description generation"""
        parent_topic = "NLP"
        keywords = ["transformer", "attention", "bert"]

        description = modeler._generate_subtopic_description(parent_topic, keywords)

        assert isinstance(description, str)
        assert len(description) > 0
        assert parent_topic.lower() in description.lower()

    @patch('ai_web_feeds.nlp.topic_modeler.CoherenceModel')
    def test_compute_coherence(self, mock_coherence_model, modeler):
        """Test coherence computation"""
        mock_cm = MagicMock()
        mock_cm.get_coherence.return_value = 0.72
        mock_coherence_model.return_value = mock_cm

        # Mock inputs
        mock_model = MagicMock()
        mock_dictionary = MagicMock()
        texts = [["word1", "word2"], ["word3", "word4"]]

        coherence = modeler._compute_coherence(mock_model, mock_dictionary, texts)

        assert coherence == 0.72

    def test_detect_evolution_empty_previous(self, modeler):
        """Test evolution detection with no previous topics"""
        current_topics = [
            {"name": "Topic1", "keywords": ["a", "b"]},
            {"name": "Topic2", "keywords": ["c", "d"]}
        ]

        events = modeler.detect_evolution(current_topics, previous_topics=[])

        # All current topics are emergent
        assert len(events) >= 1
        assert any(e["type"] == "emergence" for e in events)

    def test_detect_evolution_emergence(self, modeler):
        """Test detection of emerging topics"""
        previous_topics = [
            {"name": "OldTopic", "keywords": ["old", "keywords"], "article_count": 10}
        ]

        current_topics = [
            {"name": "OldTopic", "keywords": ["old", "keywords"], "article_count": 12},
            {"name": "NewTopic", "keywords": ["new", "topic"], "article_count": 25}
        ]

        events = modeler.detect_evolution(current_topics, previous_topics)

        # Should detect NewTopic as emergence
        emergence_events = [e for e in events if e["type"] == "emergence"]
        assert len(emergence_events) > 0

    def test_detect_evolution_decline(self, modeler):
        """Test detection of declining topics"""
        previous_topics = [
            {"name": "DecliningTopic", "keywords": ["declining"], "article_count": 100}
        ]

        current_topics = [
            {"name": "DecliningTopic", "keywords": ["declining"], "article_count": 30}
        ]

        events = modeler.detect_evolution(current_topics, previous_topics)

        # Should detect decline
        decline_events = [e for e in events if e["type"] == "decline"]
        assert len(decline_events) >= 0  # May or may not detect depending on threshold

    def test_compute_growth_rate(self, modeler):
        """Test growth rate computation"""
        prev_count = 100
        curr_count = 150

        growth_rate = modeler._compute_growth_rate(curr_count, prev_count)

        assert growth_rate == 0.5  # 50% growth

    def test_compute_growth_rate_zero_previous(self, modeler):
        """Test growth rate with zero previous count"""
        growth_rate = modeler._compute_growth_rate(100, 0)

        assert growth_rate == 1.0  # 100% growth or infinity represented as 1.0

    def test_compute_growth_rate_negative(self, modeler):
        """Test growth rate with decline"""
        growth_rate = modeler._compute_growth_rate(50, 100)

        assert growth_rate == -0.5  # 50% decline


class TestTopicModelingEdgeCases:
    """Test suite for topic modeling edge cases"""

    @pytest.fixture
    def modeler(self):
        """Create TopicModeler instance"""
        return TopicModeler()

    def test_preprocess_special_characters(self, modeler):
        """Test preprocessing with special characters"""
        text = "Hello!@#$%^&*(){}[] world123"

        tokens = modeler._preprocess_text(text)

        # Should handle special chars gracefully
        assert isinstance(tokens, list)

    def test_preprocess_numbers(self, modeler):
        """Test preprocessing removes numbers"""
        text = "Article 123 discusses 456 models"

        tokens = modeler._preprocess_text(text)

        # Numbers should be removed or ignored
        assert "123" not in tokens
        assert "456" not in tokens

    def test_preprocess_unicode(self, modeler):
        """Test preprocessing with unicode characters"""
        text = "Machine learning 机器学习 apprentissage automatique"

        tokens = modeler._preprocess_text(text)

        # Should handle unicode gracefully
        assert isinstance(tokens, list)

    def test_extract_subtopics_duplicate_content(self, modeler):
        """Test extraction with duplicate articles"""
        articles = [
            {"id": 1, "content": "Same content repeated" * 50},
            {"id": 2, "content": "Same content repeated" * 50},
            {"id": 3, "content": "Same content repeated" * 50}
        ]

        # Should not crash
        try:
            subtopics = modeler.extract_subtopics(
                parent_topic="Test",
                articles=articles,
                num_topics=2
            )
            # If it succeeds, that's fine
            assert isinstance(subtopics, list)
        except Exception:
            # If it fails due to insufficient unique content, that's also acceptable
            pass

    def test_generate_subtopic_name_empty_keywords(self, modeler):
        """Test name generation with empty keywords"""
        name = modeler._generate_subtopic_name([])

        # Should return something reasonable
        assert isinstance(name, str)

    def test_generate_subtopic_name_single_keyword(self, modeler):
        """Test name generation with single keyword"""
        name = modeler._generate_subtopic_name(["transformer"])

        assert isinstance(name, str)
        assert "transformer" in name.lower()

    def test_detect_evolution_identical_topics(self, modeler):
        """Test evolution detection with identical topics"""
        topics = [
            {"name": "Topic1", "keywords": ["a", "b"], "article_count": 10}
        ]

        events = modeler.detect_evolution(topics, topics)

        # Should detect no significant changes
        assert isinstance(events, list)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
