"""Taxonomy graph models."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class Topic:
    """Canonical topic node from topics.yaml."""

    id: str
    label: str
    facet: str | None = None
    facet_group: str | None = None
    description: str | None = None
    parents: tuple[str, ...] = ()
    relations: dict[str, list[str]] = field(default_factory=dict)
    aliases: tuple[str, ...] = ()
    rank_hint: float | None = None

    @classmethod
    def from_entry(cls, entry: dict[str, Any]) -> Topic:
        relations_raw = entry.get("relations") or {}
        relations: dict[str, list[str]] = {}
        if isinstance(relations_raw, dict):
            for key, value in relations_raw.items():
                if isinstance(value, list):
                    relations[str(key)] = [str(item) for item in value]

        parents_raw = entry.get("parents") or []
        parents = tuple(str(item) for item in parents_raw) if isinstance(parents_raw, list) else ()

        aliases_raw = entry.get("aliases") or []
        aliases = tuple(str(item) for item in aliases_raw) if isinstance(aliases_raw, list) else ()

        rank_hint = entry.get("rank_hint")
        parsed_rank = float(rank_hint) if isinstance(rank_hint, (int, float)) else None

        return cls(
            id=str(entry["id"]),
            label=str(entry.get("label") or entry["id"]),
            facet=str(entry["facet"]) if entry.get("facet") is not None else None,
            facet_group=str(entry["facet_group"]) if entry.get("facet_group") is not None else None,
            description=str(entry["description"]) if entry.get("description") is not None else None,
            parents=parents,
            relations=relations,
            aliases=aliases,
            rank_hint=parsed_rank,
        )


class Taxonomy:
    """In-memory taxonomy graph with indexed lookups."""

    def __init__(self, topics: list[Topic]) -> None:
        self._topics = list(topics)
        self._by_id: dict[str, Topic] = {topic.id: topic for topic in topics}
        self._children: dict[str, list[Topic]] = defaultdict(list)
        self._by_facet_group: dict[str, list[Topic]] = defaultdict(list)

        for topic in topics:
            if topic.facet_group:
                self._by_facet_group[topic.facet_group].append(topic)
            for parent_id in topic.parents:
                if parent_id not in self._by_id:
                    msg = f"Unknown parent topic '{parent_id}' for '{topic.id}'"
                    raise ValueError(msg)
                self._children[parent_id].append(topic)

        for child_list in self._children.values():
            child_list.sort(key=lambda item: item.label)

        for group_topics in self._by_facet_group.values():
            group_topics.sort(key=lambda item: item.label)

    @property
    def topics(self) -> list[Topic]:
        return list(self._topics)

    def get_topic(self, topic_id: str) -> Topic | None:
        return self._by_id.get(topic_id)

    def get_children(self, topic_id: str) -> list[Topic]:
        return list(self._children.get(topic_id, []))

    def get_topics_by_facet_group(self, facet_group: str) -> list[Topic]:
        return list(self._by_facet_group.get(facet_group, []))
