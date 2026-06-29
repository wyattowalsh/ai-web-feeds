"""Taxonomy visualization helpers."""

from __future__ import annotations

from collections import Counter, deque
from typing import Any, Literal

from ai_web_feeds.taxonomy.models import Taxonomy, Topic

FacetGroup = Literal["conceptual", "technical", "contextual", "communicative"]

FACET_GROUP_STYLES: dict[str, tuple[str, str]] = {
    "conceptual": ("#e1f5ff", "#01579b"),
    "technical": ("#e8f5e9", "#2e7d32"),
    "contextual": ("#fff9c4", "#f57f17"),
    "communicative": ("#fce4ec", "#c2185b"),
}


def _escape_mermaid_label(value: str) -> str:
    return value.replace('"', "'")


def _topic_depths(taxonomy: Taxonomy) -> dict[str, int]:
    depths: dict[str, int] = {}
    roots = [topic for topic in taxonomy.topics if not topic.parents]
    queue: deque[tuple[str, int]] = deque((topic.id, 0) for topic in roots)

    while queue:
        topic_id, depth = queue.popleft()
        if topic_id in depths and depths[topic_id] <= depth:
            continue
        depths[topic_id] = depth
        for child in taxonomy.get_children(topic_id):
            queue.append((child.id, depth + 1))

    for topic in taxonomy.topics:
        depths.setdefault(topic.id, 0)

    return depths


class TaxonomyVisualizer:
    """Generate Mermaid, JSON graph, and statistics from a taxonomy."""

    def __init__(self, taxonomy: Taxonomy) -> None:
        self._taxonomy = taxonomy

    def to_mermaid(
        self,
        *,
        direction: str = "TD",
        max_depth: int | None = None,
        include_relations: bool = True,
        filter_facets: list[str] | None = None,
    ) -> str:
        depths = _topic_depths(self._taxonomy)
        facet_filter = {facet.lower() for facet in filter_facets} if filter_facets else None

        included: list[Topic] = []
        for topic in self._taxonomy.topics:
            if facet_filter and (topic.facet or "").lower() not in facet_filter:
                continue
            if max_depth is not None and depths.get(topic.id, 0) > max_depth:
                continue
            included.append(topic)

        included_ids = {topic.id for topic in included}
        lines = [f"graph {direction}"]

        for topic in included:
            label = _escape_mermaid_label(topic.label)
            group = topic.facet_group or "conceptual"
            lines.append(f'    {topic.id}["{label}"]:::{group}')

        for topic in included:
            for parent_id in topic.parents:
                if parent_id in included_ids:
                    lines.append(f"    {parent_id} --> {topic.id}")

        if include_relations:
            for topic in included:
                for relation_type, targets in topic.relations.items():
                    for target_id in targets:
                        if target_id in included_ids:
                            lines.append(
                                f"    {topic.id} -.->{target_id}:::relation %% {relation_type}"
                            )

        used_groups = {topic.facet_group or "conceptual" for topic in included}
        for group in sorted(used_groups):
            fill, stroke = FACET_GROUP_STYLES.get(group, ("#f5f5f5", "#424242"))
            lines.append(f"    classDef {group} fill:{fill},stroke:{stroke},stroke-width:2px")
        if include_relations:
            lines.append("    classDef relation stroke-dasharray:5 5,stroke:#666")

        return "\n".join(lines) + "\n"

    def to_json_graph(self) -> dict[str, list[dict[str, Any]]]:
        nodes = [
            {
                "id": topic.id,
                "label": topic.label,
                "facet": topic.facet,
                "facet_group": topic.facet_group,
            }
            for topic in self._taxonomy.topics
        ]
        links: list[dict[str, Any]] = []
        for topic in self._taxonomy.topics:
            for parent_id in topic.parents:
                links.append({"source": parent_id, "target": topic.id, "type": "parent"})
            for relation_type, targets in topic.relations.items():
                for target_id in targets:
                    links.append(
                        {
                            "source": topic.id,
                            "target": target_id,
                            "type": relation_type,
                        }
                    )
        return {"nodes": nodes, "links": links}

    def get_statistics(self) -> dict[str, Any]:
        depths = _topic_depths(self._taxonomy)
        depth_values = list(depths.values())
        facets = Counter(topic.facet or "unknown" for topic in self._taxonomy.topics)
        facet_groups = Counter(topic.facet_group or "unknown" for topic in self._taxonomy.topics)
        root_topics = sum(1 for topic in self._taxonomy.topics if not topic.parents)
        max_depth = max(depth_values) if depth_values else 0
        avg_depth = sum(depth_values) / len(depth_values) if depth_values else 0.0

        return {
            "total_topics": len(self._taxonomy.topics),
            "root_topics": root_topics,
            "max_depth": max_depth,
            "avg_depth": avg_depth,
            "facets": dict(facets),
            "facet_groups": dict(facet_groups),
        }
