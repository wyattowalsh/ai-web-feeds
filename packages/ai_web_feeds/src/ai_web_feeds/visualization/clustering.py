"""
Topic clustering algorithms for 3D visualization.

Implements Phase 4 (US2): T039-T041
- Force-directed graph layout
- K-means clustering
- DBSCAN clustering
- Topic similarity calculation
"""

from dataclasses import dataclass
from typing import Any

import numpy as np
from sklearn.cluster import DBSCAN, KMeans
from sklearn.decomposition import PCA
from sklearn.metrics.pairwise import cosine_similarity


@dataclass
class TopicNode:
    """Represents a topic node in 3D space."""

    id: str
    label: str
    size: float
    position: tuple[float, float, float]
    color: str | None = None
    category: str | None = None


@dataclass
class TopicLink:
    """Represents a connection between topics."""

    source: str
    target: str
    strength: float


class TopicClusteringService:
    """Service for clustering topics in 3D space."""

    def __init__(self, method: str = "force-directed"):
        """
        Initialize clustering service.

        Args:
            method: Clustering method ('force-directed', 'kmeans', 'dbscan', 'pca')
        """
        self.method = method

    def cluster_topics(
        self,
        topic_embeddings: dict[str, np.ndarray],
        topic_metadata: dict[str, dict[str, Any]],
        n_clusters: int | None = None,
    ) -> tuple[list[TopicNode], list[TopicLink]]:
        """
        Cluster topics and generate 3D positions.

        Args:
            topic_embeddings: Map of topic_id -> embedding vector
            topic_metadata: Map of topic_id -> metadata (size, label, etc.)
            n_clusters: Number of clusters (for k-means)

        Returns:
            Tuple of (nodes, links)
        """
        topic_ids = list(topic_embeddings.keys())
        embeddings = np.array([topic_embeddings[tid] for tid in topic_ids])

        # Calculate 3D positions
        if self.method == "force-directed":
            positions = self._force_directed_layout(embeddings, topic_ids)
        elif self.method == "kmeans":
            positions = self._kmeans_layout(embeddings, n_clusters or 5)
        elif self.method == "dbscan":
            positions = self._dbscan_layout(embeddings)
        elif self.method == "pca":
            positions = self._pca_layout(embeddings)
        else:
            msg = f"Unknown clustering method: {self.method}"
            raise ValueError(msg)

        # Create nodes
        nodes = []
        for i, topic_id in enumerate(topic_ids):
            metadata = topic_metadata.get(topic_id, {})
            node = TopicNode(
                id=topic_id,
                label=metadata.get("label", topic_id),
                size=metadata.get("size", 10.0),
                position=positions[i],
                color=metadata.get("color"),
                category=metadata.get("category"),
            )
            nodes.append(node)

        # Calculate links based on similarity
        links = self._calculate_links(topic_ids, embeddings)

        return nodes, links

    def _force_directed_layout(
        self,
        embeddings: np.ndarray,
        topic_ids: list[str],
        iterations: int = 100,
    ) -> list[tuple[float, float, float]]:
        """
        Force-directed graph layout (Fruchterman-Reingold).

        Args:
            embeddings: Topic embedding vectors
            topic_ids: Topic identifiers
            iterations: Number of iterations

        Returns:
            List of 3D positions
        """
        n_topics = len(embeddings)

        # Calculate similarity matrix
        similarity = cosine_similarity(embeddings)

        # Initialize positions randomly in 3D space
        positions = np.random.randn(n_topics, 3) * 20

        # Force-directed layout parameters
        k = 20  # Optimal distance
        area = 100 * 100 * 100  # 3D volume
        t = 10.0  # Temperature

        for _ in range(iterations):
            # Calculate repulsive forces
            delta = positions[:, np.newaxis, :] - positions[np.newaxis, :, :]
            distance = np.sqrt(np.sum(delta**2, axis=2))
            distance = np.maximum(distance, 0.01)  # Avoid division by zero

            repulsive = (k**2 / distance**2)[:, :, np.newaxis] * delta / distance[:, :, np.newaxis]
            repulsive = np.nan_to_num(repulsive)

            # Calculate attractive forces (weighted by similarity)
            attractive = np.zeros_like(positions)
            for i in range(n_topics):
                for j in range(i + 1, n_topics):
                    if similarity[i, j] > 0.3:  # Only connect similar topics
                        force = (
                            (distance[i, j] ** 2 / k)
                            * similarity[i, j]
                            * delta[i, j]
                            / distance[i, j]
                        )
                        attractive[i] += force
                        attractive[j] -= force

            # Update positions
            displacement = repulsive.sum(axis=1) + attractive
            disp_length = np.sqrt(np.sum(displacement**2, axis=1))
            disp_length = np.maximum(disp_length, 0.01)

            positions += (displacement / disp_length[:, np.newaxis]) * np.minimum(
                disp_length[:, np.newaxis], t
            )

            # Cool down
            t *= 0.95

        # Convert to list of tuples
        return [(float(x), float(y), float(z)) for x, y, z in positions]

    def _kmeans_layout(
        self,
        embeddings: np.ndarray,
        n_clusters: int,
    ) -> list[tuple[float, float, float]]:
        """
        K-means clustering with PCA for 3D positioning.

        Args:
            embeddings: Topic embedding vectors
            n_clusters: Number of clusters

        Returns:
            List of 3D positions
        """
        # Reduce to 3D using PCA
        pca = PCA(n_components=3)
        positions_3d = pca.fit_transform(embeddings)

        # Perform k-means clustering
        kmeans = KMeans(n_clusters=n_clusters, random_state=42)
        labels = kmeans.fit_predict(embeddings)

        # Spread clusters apart in 3D space
        cluster_centers = kmeans.cluster_centers_
        cluster_centers_3d = pca.transform(cluster_centers)

        # Scale positions
        positions_3d = positions_3d * 30  # Scale up for visibility

        return [(float(x), float(y), float(z)) for x, y, z in positions_3d]

    def _dbscan_layout(
        self,
        embeddings: np.ndarray,
    ) -> list[tuple[float, float, float]]:
        """
        DBSCAN clustering with PCA for 3D positioning.

        Args:
            embeddings: Topic embedding vectors

        Returns:
            List of 3D positions
        """
        # Reduce to 3D using PCA
        pca = PCA(n_components=3)
        positions_3d = pca.fit_transform(embeddings)

        # Perform DBSCAN clustering
        dbscan = DBSCAN(eps=0.5, min_samples=2)
        labels = dbscan.fit_predict(embeddings)

        # Scale positions
        positions_3d = positions_3d * 30

        return [(float(x), float(y), float(z)) for x, y, z in positions_3d]

    def _pca_layout(
        self,
        embeddings: np.ndarray,
    ) -> list[tuple[float, float, float]]:
        """
        PCA dimensionality reduction to 3D.

        Args:
            embeddings: Topic embedding vectors

        Returns:
            List of 3D positions
        """
        pca = PCA(n_components=3)
        positions_3d = pca.fit_transform(embeddings)

        # Scale positions
        positions_3d = positions_3d * 30

        return [(float(x), float(y), float(z)) for x, y, z in positions_3d]

    def _calculate_links(
        self,
        topic_ids: list[str],
        embeddings: np.ndarray,
        threshold: float = 0.3,
    ) -> list[TopicLink]:
        """
        Calculate topic similarity links.

        Args:
            topic_ids: Topic identifiers
            embeddings: Topic embedding vectors
            threshold: Minimum similarity threshold

        Returns:
            List of topic links
        """
        similarity = cosine_similarity(embeddings)
        links = []

        for i in range(len(topic_ids)):
            for j in range(i + 1, len(topic_ids)):
                if similarity[i, j] >= threshold:
                    link = TopicLink(
                        source=topic_ids[i],
                        target=topic_ids[j],
                        strength=float(similarity[i, j]),
                    )
                    links.append(link)

        return links


def generate_sample_embeddings(n_topics: int = 15, dim: int = 128) -> dict[str, np.ndarray]:
    """
    Generate sample topic embeddings for testing.

    Args:
        n_topics: Number of topics
        dim: Embedding dimension

    Returns:
        Map of topic_id -> embedding vector
    """
    topics = [f"topic-{i}" for i in range(n_topics)]
    embeddings = {}

    # Create 3 clusters of related topics
    cluster_centers = np.random.randn(3, dim) * 2

    for i, topic_id in enumerate(topics):
        cluster_idx = i % 3
        # Generate embedding near cluster center with some noise
        embedding = cluster_centers[cluster_idx] + np.random.randn(dim) * 0.5
        # Normalize
        embedding = embedding / np.linalg.norm(embedding)
        embeddings[topic_id] = embedding

    return embeddings
