"""
Unit tests for topic clustering algorithms.
"""

import numpy as np
import pytest
from ai_web_feeds.visualization.clustering import (
    TopicClusteringService,
    TopicLink,
    TopicNode,
    generate_sample_embeddings,
)


class TestTopicClusteringService:
    """Test TopicClusteringService."""

    @pytest.fixture
    def sample_data(self):
        """Build deterministic topic vectors for layout checks.

        The product helper returns no synthetic embeddings. These vectors
        exist only inside the test.
        """
        dim = 64
        rng = np.random.default_rng(0)
        centers = rng.normal(size=(3, dim))
        embeddings: dict[str, np.ndarray] = {}
        for index in range(10):
            vector = centers[index % 3] + rng.normal(scale=0.05, size=dim)
            embeddings[f"topic-{index}"] = vector / np.linalg.norm(vector)
        metadata = {
            topic_id: {
                "label": f"TopicNode {i}",
                "size": float(10 + i * 5),
                "category": f"Category {i % 3}",
            }
            for i, topic_id in enumerate(embeddings.keys())
        }
        return embeddings, metadata

    def test_force_directed_layout(self, sample_data):
        """Test force-directed layout algorithm."""
        embeddings, metadata = sample_data

        service = TopicClusteringService(method="force-directed")
        nodes, links = service.cluster_topics(embeddings, metadata)

        assert len(nodes) == 10
        assert all(isinstance(node, TopicNode) for node in nodes)
        assert all(len(node.position) == 3 for node in nodes)
        assert len(links) > 0
        assert all(isinstance(link, TopicLink) for link in links)

    def test_pca_layout(self, sample_data):
        """Test PCA layout algorithm."""
        embeddings, metadata = sample_data

        service = TopicClusteringService(method="pca")
        nodes, _links = service.cluster_topics(embeddings, metadata)

        assert len(nodes) == 10
        assert all(len(node.position) == 3 for node in nodes)

    def test_kmeans_layout(self, sample_data):
        """Test K-means layout algorithm."""
        embeddings, metadata = sample_data

        service = TopicClusteringService(method="kmeans")
        nodes, _links = service.cluster_topics(embeddings, metadata, n_clusters=3)

        assert len(nodes) == 10

    def test_dbscan_layout(self, sample_data):
        """Test DBSCAN layout algorithm."""
        embeddings, metadata = sample_data

        service = TopicClusteringService(method="dbscan")
        nodes, _links = service.cluster_topics(embeddings, metadata)

        assert len(nodes) == 10

    def test_invalid_method(self, sample_data):
        """Test invalid clustering method."""
        embeddings, metadata = sample_data

        service = TopicClusteringService(method="invalid")

        with pytest.raises(ValueError, match="Unknown clustering method"):
            service.cluster_topics(embeddings, metadata)

    def test_topic_links_threshold(self, sample_data):
        """Test link generation with similarity threshold."""
        embeddings, metadata = sample_data

        service = TopicClusteringService(method="pca")
        _nodes, links = service.cluster_topics(embeddings, metadata)

        # All links should have strength >= 0.3 (default threshold)
        assert all(link.strength >= 0.3 for link in links)

    def test_node_properties(self, sample_data):
        """Test node properties are correctly set."""
        embeddings, metadata = sample_data

        service = TopicClusteringService(method="pca")
        nodes, _links = service.cluster_topics(embeddings, metadata)

        for node in nodes:
            assert node.id in embeddings
            assert node.label.startswith("TopicNode")
            assert node.size >= 10
            assert node.category is not None
            assert len(node.position) == 3


class TestSampleDataGeneration:
    """The product helper does not invent topic vectors."""

    def test_generate_sample_embeddings_returns_empty(self):
        """Stored assignments are the source of groupings."""
        assert generate_sample_embeddings(n_topics=20, dim=128) == {}

    def test_generate_sample_embeddings_rejects_negative(self):
        """Negative sizes are rejected before the empty result."""
        with pytest.raises(ValueError, match="non-negative"):
            generate_sample_embeddings(n_topics=-1, dim=8)
