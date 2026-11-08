"""Characterization tests for visualization topic clustering.

Locks public names and the return shape on a tiny in-memory input.
Does not snapshot generator coordinates. Stored-label grouping
assertions stay valid for a deterministic grouping of those labels.
Synthetic sampled embeddings are rejected.
"""

import inspect
from collections.abc import Mapping

import numpy as np
import pytest
from ai_web_feeds.visualization import clustering

_PUBLIC_NAMES = (
    "TopicClusteringService",
    "TopicLink",
    "TopicNode",
    "generate_sample_embeddings",
)


def _hand_built_inputs() -> tuple[
    dict[str, np.ndarray],
    dict[str, dict[str, str | float]],
]:
    """Four hand-built vectors. No model and no sampled coordinates."""
    embeddings = {
        "alpha": np.array([1.0, 0.0, 0.0, 0.0]),
        "beta": np.array([0.8, 0.2, 0.0, 0.0]),
        "gamma": np.array([0.0, 0.0, 1.0, 0.0]),
        "delta": np.array([0.0, 0.0, 0.2, 0.8]),
    }
    metadata: dict[str, dict[str, str | float]] = {
        "alpha": {"label": "Alpha", "size": 4.0, "category": "nlp", "color": "#111111"},
        "beta": {"label": "Beta", "size": 5.0, "category": "nlp", "color": "#222222"},
        "gamma": {"label": "Gamma", "size": 6.0, "category": "vision", "color": "#333333"},
        "delta": {"label": "Delta", "size": 7.0, "category": "vision", "color": "#444444"},
    }
    return embeddings, metadata


def _stored_label_groups(result: object) -> dict[str, list[str]] | list[object]:
    """Return a mapping or a list of groups from the current result shape."""
    if isinstance(result, Mapping):
        normalized: dict[str, list[str]] = {}
        for key, members in result.items():
            label = str(key)
            if isinstance(members, list):
                normalized[label] = [str(member) for member in members]
            else:
                normalized[label] = [str(members)]
        return normalized
    if isinstance(result, list):
        if not result or not isinstance(result[0], clustering.TopicNode):
            plain: list[object] = []
            for item in result:
                plain.append(item)
            return plain
        grouped: dict[str, list[str]] = {}
        for node in result:
            assert isinstance(node, clustering.TopicNode)
            label = node.category if node.category is not None else node.id
            grouped.setdefault(label, []).append(node.id)
        return grouped
    if isinstance(result, tuple) and result and isinstance(result[0], list):
        return _stored_label_groups(result[0])
    if isinstance(result, tuple) and len(result) == 0:
        return {}
    msg = f"clustering result is not a grouping: {type(result).__name__}"
    raise AssertionError(msg)


@pytest.mark.unit
def test_public_clustering_names() -> None:
    """Public clustering callables stay importable by name."""
    for name in _PUBLIC_NAMES:
        assert callable(getattr(clustering, name))
    assert callable(clustering.TopicClusteringService.cluster_topics)


@pytest.mark.unit
def test_tiny_hand_built_input_return_shape() -> None:
    """Hand-built vectors return nodes and links without pinning RNG output."""
    embeddings, metadata = _hand_built_inputs()
    service = clustering.TopicClusteringService(method="pca")

    result = service.cluster_topics(embeddings, metadata)

    assert isinstance(result, tuple)
    assert len(result) == 2
    nodes, links = result
    assert isinstance(nodes, list)
    assert isinstance(links, list)
    assert len(nodes) == len(embeddings)
    assert {node.id for node in nodes} == set(embeddings)

    for node in nodes:
        assert isinstance(node, clustering.TopicNode)
        info = metadata[node.id]
        assert node.label == info["label"]
        assert node.size == info["size"]
        assert node.color == info["color"]
        assert node.category == info["category"]
        assert isinstance(node.position, tuple)
        assert len(node.position) == 3
        assert all(isinstance(coord, float) for coord in node.position)

    known_ids = set(embeddings)
    for link in links:
        assert isinstance(link, clustering.TopicLink)
        assert link.source in known_ids
        assert link.target in known_ids
        assert link.source != link.target
        assert isinstance(link.strength, float)

    groups = _stored_label_groups(result)
    assert isinstance(groups, dict)
    assert {label: sorted(members) for label, members in groups.items()} == {
        "nlp": ["alpha", "beta"],
        "vision": ["delta", "gamma"],
    }


@pytest.mark.unit
def test_empty_input_yields_empty_grouping() -> None:
    """No stored topics yields an empty mapping or an empty list of groups."""
    service = clustering.TopicClusteringService(method="pca")
    embeddings: dict[str, np.ndarray] = {}
    metadata: dict[str, dict[str, str | float]] = {}

    raw: object = service.cluster_topics(embeddings, metadata)

    groups = _stored_label_groups(raw)
    assert isinstance(groups, dict | list)
    assert len(groups) == 0


@pytest.mark.unit
def test_sample_embeddings_are_not_a_random_series() -> None:
    """Stored assignments only: no sampled series and no generator in source."""
    source = inspect.getsource(clustering)
    assert "default_rng" not in source
    assert "np.random" not in source
    assert "numpy.random" not in source

    assert clustering.generate_sample_embeddings() == {}
    assert clustering.generate_sample_embeddings(n_topics=15, dim=128) == {}
