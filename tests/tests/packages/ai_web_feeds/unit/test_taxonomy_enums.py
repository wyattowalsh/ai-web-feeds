"""Unit tests for taxonomy facet and relation enums."""

from __future__ import annotations

import pytest
from ai_web_feeds.taxonomy.models import RelationType, TopicFacet

_TOPIC_FACETS = {
    "domain",
    "subfield",
    "task",
    "methodology",
    "modality",
    "data",
    "workflow",
    "ops",
    "deployment",
    "infra",
    "devtools",
    "hardware",
    "research",
    "safety",
    "ethics",
    "privacy",
    "security",
    "governance",
    "regulation",
    "education",
    "industry",
    "community",
    "product",
    "open-source",
    "media",
    "prompting",
}

_RELATION_TYPES = {
    "depends_on",
    "implements",
    "influences",
    "contrasts_with",
    "same_as",
    "related_to",
}


@pytest.mark.unit
def test_topic_facet_members() -> None:
    """TopicFacet matches the topics.schema.json facet enum."""
    assert {member.value for member in TopicFacet} == _TOPIC_FACETS
    assert TopicFacet.DOMAIN == "domain"
    assert TopicFacet.OPEN_SOURCE == "open-source"
    assert TopicFacet.PROMPTING == "prompting"
    assert isinstance(TopicFacet.TASK, str)


@pytest.mark.unit
def test_relation_type_members() -> None:
    """RelationType matches the topics.schema.json relation_type enum."""
    assert {member.value for member in RelationType} == _RELATION_TYPES
    assert RelationType.DEPENDS_ON == "depends_on"
    assert RelationType.IMPLEMENTS == "implements"
    assert RelationType.INFLUENCES == "influences"
    assert RelationType.CONTRASTS_WITH == "contrasts_with"
    assert RelationType.SAME_AS == "same_as"
    assert RelationType.RELATED_TO == "related_to"
    assert isinstance(RelationType.RELATED_TO, str)
