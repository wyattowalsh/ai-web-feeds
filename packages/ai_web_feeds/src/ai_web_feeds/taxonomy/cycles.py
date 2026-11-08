"""Iterative cycle detection for directed topic graphs."""

from __future__ import annotations

from collections import defaultdict, deque
from collections.abc import Hashable, Iterable
from typing import NamedTuple


class Edge(NamedTuple):
    """Directed edge from ``source`` to ``target``."""

    source: Hashable
    target: Hashable


def has_cycle(edges: Iterable[tuple[Hashable, Hashable]]) -> bool:
    """Return whether the directed graph described by ``edges`` has a cycle.

    An empty edge list is acyclic. A self-loop is a cycle, including when the
    cycle sits in a component that is not reachable from the rest of the graph.
    Detection uses Kahn's algorithm so a long chain does not grow the call stack.
    Duplicate edges are ignored and do not create a cycle by themselves.
    """
    adjacency: dict[Hashable, set[Hashable]] = defaultdict(set)
    indegree: dict[Hashable, int] = {}

    for source, target in edges:
        indegree.setdefault(source, 0)
        indegree.setdefault(target, 0)
        if target in adjacency[source]:
            continue
        adjacency[source].add(target)
        indegree[target] += 1

    pending: deque[Hashable] = deque(node for node, degree in indegree.items() if degree == 0)
    remaining = len(indegree)

    while pending:
        node = pending.popleft()
        remaining -= 1
        for successor in adjacency.get(node, ()):
            indegree[successor] -= 1
            if indegree[successor] == 0:
                pending.append(successor)

    return remaining > 0
