"""
Unit tests for topic clustering algorithms.
"""

import numpy as np
import pytest
from ai_web_feeds.visualization.clustering import (
    TopicClusteringService,
    TopicNode,
    TopicLink,
    generate_sample_embeddings,
)


class TestTopicClusteringService:
    """Test TopicClusteringService."""

    @pytest.fixture
    def sample_data(self):
        """Generate sample topic data."""
        embeddings = generate_sample_embeddings(n_topics=10, dim=64)
        metadata = {
            topic_id: {
                "label": f"Topic {i}",
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
        nodes, links = service.cluster_topics(embeddings, metadata)
        
        assert len(nodes) == 10
        assert all(len(node.position) == 3 for node in nodes)

    def test_kmeans_layout(self, sample_data):
        """Test K-means layout algorithm."""
        embeddings, metadata = sample_data
        
        service = TopicClusteringService(method="kmeans")
        nodes, links = service.cluster_topics(embeddings, metadata, n_clusters=3)
        
        assert len(nodes) == 10

    def test_dbscan_layout(self, sample_data):
        """Test DBSCAN layout algorithm."""
        embeddings, metadata = sample_data
        
        service = TopicClusteringService(method="dbscan")
        nodes, links = service.cluster_topics(embeddings, metadata)
        
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
        nodes, links = service.cluster_topics(embeddings, metadata)
        
        # All links should have strength >= 0.3 (default threshold)
        assert all(link.strength >= 0.3 for link in links)

    def test_node_properties(self, sample_data):
        """Test node properties are correctly set."""
        embeddings, metadata = sample_data
        
        service = TopicClusteringService(method="pca")
        nodes, links = service.cluster_topics(embeddings, metadata)
        
        for node in nodes:
            assert node.id in embeddings
            assert node.label.startswith("Topic")
            assert node.size >= 10
            assert node.category is not None
            assert len(node.position) == 3


class TestSampleDataGeneration:
    """Test sample data generation."""

    def test_generate_sample_embeddings(self):
        """Test sample embedding generation."""
        embeddings = generate_sample_embeddings(n_topics=20, dim=128)
        
        assert len(embeddings) == 20
        assert all(emb.shape == (128,) for emb in embeddings.values())
        
        # Check embeddings are normalized
        for emb in embeddings.values():
            norm = np.linalg.norm(emb)
            assert abs(norm - 1.0) < 0.01

    def test_sample_embeddings_clustering(self):
        """Test that sample embeddings form clusters."""
        embeddings = generate_sample_embeddings(n_topics=15, dim=64)
        
        # Calculate pairwise similarities
        from sklearn.metrics.pairwise import cosine_similarity
        
        emb_array = np.array(list(embeddings.values()))
        similarities = cosine_similarity(emb_array)
        
        # Should have some high similarity pairs (from same cluster)
        assert np.any(similarities > 0.5)
