"""Unit tests for basic topic split/merge detection (Spec 005 TODO)."""

from ai_web_feeds.nlp.topic_modeler import DiscoveredSubtopic, TopicModeler


class TestTopicSplitMergeDetection:
    """Tests for split/merge detection in topic evolution."""

    def test_detect_split_basic(self):
        """One previous topic splits into multiple current similar topics."""
        modeler = TopicModeler()

        prev = [
            DiscoveredSubtopic(
                name="Transformers",
                keywords=["attention", "transformer", "bert", "gpt", "model"],
                coherence_score=0.8,
                article_count=50,
            )
        ]
        curr = [
            DiscoveredSubtopic(
                name="BERT",
                keywords=["bert", "encoder", "pretrain", "attention"],
                coherence_score=0.7,
                article_count=30,
            ),
            DiscoveredSubtopic(
                name="GPT",
                keywords=["gpt", "decoder", "attention", "generate"],
                coherence_score=0.75,
                article_count=25,
            ),
        ]

        # Use low threshold to trigger via keyword overlap
        events = []
        # Invoke internal via the public track? but to isolate use private
        modeler._detect_split_merge(events, prev, curr, "2026-01", threshold=0.3)

        split_events = [e for e in events if e["event_type"] == "split"]
        assert len(split_events) == 1
        assert split_events[0]["source_topic"] == "Transformers"
        assert set(split_events[0]["target_topics"]) == {"BERT", "GPT"}

    def test_detect_merge_basic(self):
        """Multiple previous topics merge into one current."""
        modeler = TopicModeler()

        prev = [
            DiscoveredSubtopic(
                name="CNNs",
                keywords=["cnn", "convolution", "vision", "image"],
                coherence_score=0.8,
                article_count=20,
            ),
            DiscoveredSubtopic(
                name="Vision Transformers",
                keywords=["vit", "attention", "vision", "transformer"],
                coherence_score=0.8,
                article_count=30,
            ),
        ]
        curr = [
            DiscoveredSubtopic(
                name="ModernCV",
                keywords=["vision", "transformer", "cnn", "attention", "image"],
                coherence_score=0.82,
                article_count=55,
            )
        ]

        events = []
        modeler._detect_split_merge(events, prev, curr, "2026-02", threshold=0.4)

        merge_events = [e for e in events if e["event_type"] == "merge"]
        assert len(merge_events) == 1
        assert merge_events[0]["target_topics"] == ["ModernCV"]
        assert "source_topics" in merge_events[0]
        assert set(merge_events[0]["source_topics"]) == {"CNNs", "Vision Transformers"}

    def test_no_split_merge_when_one_to_one(self):
        """Stable mapping should not produce split or merge."""
        modeler = TopicModeler()

        prev = [
            DiscoveredSubtopic(name="RL", keywords=["reinforce", "agent", "reward"], coherence_score=0.7, article_count=10)
        ]
        curr = [
            DiscoveredSubtopic(name="RL", keywords=["reinforce", "agent", "reward", "policy"], coherence_score=0.71, article_count=12)
        ]

        events = []
        modeler._detect_split_merge(events, prev, curr, "p", threshold=0.6)

        assert all(e["event_type"] not in ("split", "merge") for e in events)

    def test_cosine_similarity_used_when_available(self):
        """_cosine_keyword_similarity returns float or None (graceful)."""
        modeler = TopicModeler()
        a = DiscoveredSubtopic(name="A", keywords=["x", "y", "z"], coherence_score=0.5, article_count=1)
        b = DiscoveredSubtopic(name="B", keywords=["x", "y", "w"], coherence_score=0.5, article_count=1)

        sim = modeler._cosine_keyword_similarity(a, b)
        # Either float (if np) or None
        assert sim is None or isinstance(sim, float)
        if sim is not None:
            assert 0.0 <= sim <= 1.0
