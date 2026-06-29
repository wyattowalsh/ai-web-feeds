"""Unit tests for taxonomy loading and visualization."""

from __future__ import annotations

import pytest
from ai_web_feeds.taxonomy import TaxonomyVisualizer, Topic, load_taxonomy


@pytest.mark.unit
def test_load_taxonomy_returns_topics() -> None:
    taxonomy = load_taxonomy()
    assert len(taxonomy.topics) >= 90


@pytest.mark.unit
def test_visualizer_statistics_keys() -> None:
    taxonomy = load_taxonomy()
    visualizer = TaxonomyVisualizer(taxonomy)
    stats = visualizer.get_statistics()

    assert stats["total_topics"] == len(taxonomy.topics)
    assert stats["root_topics"] >= 1
    assert "facets" in stats
    assert "facet_groups" in stats
    assert "max_depth" in stats
    assert "avg_depth" in stats


@pytest.mark.unit
def test_to_mermaid_contains_graph_and_classdefs() -> None:
    taxonomy = load_taxonomy()
    visualizer = TaxonomyVisualizer(taxonomy)
    mermaid = visualizer.to_mermaid(include_relations=True)

    assert mermaid.startswith("graph TD")
    assert "classDef conceptual" in mermaid or "classDef technical" in mermaid
    assert "classDef relation" in mermaid


@pytest.mark.unit
def test_to_json_graph_nodes_and_links() -> None:
    taxonomy = load_taxonomy()
    visualizer = TaxonomyVisualizer(taxonomy)
    graph = visualizer.to_json_graph()

    assert len(graph["nodes"]) == len(taxonomy.topics)
    assert graph["nodes"][0]["id"]
    parent_links = [link for link in graph["links"] if link["type"] == "parent"]
    assert parent_links


@pytest.mark.unit
def test_topic_from_entry_minimal() -> None:
    topic = Topic.from_entry({"id": "test-topic", "label": "Test Topic"})
    assert topic.id == "test-topic"
    assert topic.label == "Test Topic"
    assert topic.parents == ()
    assert topic.relations == {}
