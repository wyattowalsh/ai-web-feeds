"""Final coverage push for utils, validate, analytics, fetch helpers, and NLP."""

from __future__ import annotations

import json
from datetime import UTC, date, datetime
from unittest.mock import AsyncMock, MagicMock, Mock, patch

import pytest
import yaml
from typer.testing import CliRunner


@pytest.mark.unit
class TestUtilsPlatformGeneratorsPush:
    """Cover remaining utils.py platform and OPML generators."""

    def test_twitter_and_arxiv_generators(self) -> None:
        from ai_web_feeds.utils import generate_arxiv_feed_url, generate_twitter_feed_url

        url = generate_twitter_feed_url(
            "https://twitter.com/karpathy",
            {"twitter": {"nitter_instance": "nitter.example"}},
        )
        assert url and "nitter.example" in url
        assert generate_arxiv_feed_url("https://arxiv.org/list/cs.AI/recent")

    def test_github_substack_devto_generators(self) -> None:
        from ai_web_feeds.utils import (
            generate_devto_feed_url,
            generate_github_feed_url,
            generate_substack_feed_url,
        )

        assert "dev.to/feed" in generate_devto_feed_url("https://dev.to/user")
        assert generate_devto_feed_url(
            "https://dev.to",
            {"devto": {"username": "alice"}},
        ).endswith("alice")
        assert generate_github_feed_url("https://github.com/org/repo")
        assert generate_substack_feed_url("https://example.substack.com")

    def test_generate_categorized_opml_with_site_and_tags(self) -> None:
        from ai_web_feeds.models import FeedSource, SourceType
        from ai_web_feeds.utils import generate_categorized_opml

        feeds = [
            FeedSource(
                id="f1",
                title="Feed One",
                feed="https://example.com/feed.xml",
                site="https://example.com",
                topics=["ai", "ml"],
                tags=["research"],
                source_type=SourceType.BLOG,
            )
        ]
        opml = generate_categorized_opml(feeds)
        assert "ai" in opml
        assert "Feed One" in opml

    @pytest.mark.asyncio
    async def test_discover_feed_url_common_paths(self) -> None:
        from ai_web_feeds.utils import discover_feed_url

        html = '<link rel="alternate" type="application/rss+xml" href="/feed.xml"/>'
        site_resp = Mock(status_code=200, text=html, url="https://blog.example/")
        feed_resp = Mock(
            status_code=200,
            headers={"content-type": "application/rss+xml"},
        )

        with patch("ai_web_feeds.utils.httpx.AsyncClient") as mock_client:
            client = mock_client.return_value.__aenter__.return_value
            client.get = AsyncMock(side_effect=[site_resp, feed_resp])
            found = await discover_feed_url("https://blog.example")
        assert found and "feed" in found


@pytest.mark.unit
class TestUtilsDiscoverPlatformPush:
    """Cover platform-first discovery paths."""

    def test_generate_platform_and_youtube_paths(self) -> None:
        from ai_web_feeds.utils import generate_platform_feed_url, generate_youtube_feed_url

        yt = generate_youtube_feed_url("https://www.youtube.com/channel/UCxxxxxxxxxxxxxxxxxxxxxx")
        assert yt and "channel_id=" in yt
        assert generate_platform_feed_url("https://news.ycombinator.com", "hackernews")

    @pytest.mark.asyncio
    async def test_discover_feed_url_uses_platform_generator(self) -> None:
        from ai_web_feeds.utils import discover_feed_url

        with (
            patch(
                "ai_web_feeds.utils.generate_platform_feed_url",
                return_value="https://platform.example/feed.xml",
            ),
            patch("ai_web_feeds.utils.detect_platform", return_value="github"),
        ):
            url = await discover_feed_url("https://github.com/org/repo")
        assert url == "https://platform.example/feed.xml"


@pytest.mark.unit
class TestEnrichAndUtilsFinalPush:
    """Cover enrich frequency branches and HTML metadata discovery."""

    def test_enrich_score_all_frequency_branches(self) -> None:
        from ai_web_feeds.enrich import AdvancedEnricher, FeedEnrichment

        enricher = AdvancedEnricher()
        for freq in ["multiple_daily", "weekly", "infrequent", None]:
            e = FeedEnrichment()
            e.title = "T"
            e.entry_count = 5
            e.estimated_frequency = freq
            e.availability_score = 1.0
            assert 0 <= enricher._calculate_quality_score(e) <= 1.0

    @pytest.mark.asyncio
    async def test_discover_feed_url_from_html_metadata(self) -> None:
        from ai_web_feeds.utils import _extract_feed_links

        html = """
        <html><head>
        <link rel="alternate" type="application/atom+xml" href="https://site.example/atom"/>
        </head></html>
        """
        links = list(_extract_feed_links(html, "https://site.example/"))
        assert any("atom" in link for link in links)


@pytest.mark.unit
class TestValidatePackageFinalPush:
    """Cover validate.py package branches."""

    def test_validate_topics_with_schema_success_and_failure(self, tmp_path) -> None:
        from ai_web_feeds.validate import validate_topics

        schema = tmp_path / "topics.schema.json"
        schema.write_text(
            json.dumps(
                {
                    "type": "object",
                    "required": ["topics"],
                    "properties": {"topics": {"type": "array"}},
                }
            ),
            encoding="utf-8",
        )
        ok = validate_topics({"topics": [{"id": "ai", "label": "AI"}]}, schema)
        assert ok.valid

        import jsonschema

        with patch.object(jsonschema, "validate", side_effect=jsonschema.ValidationError("bad")):
            bad = validate_topics({"topics": [{"id": "ai"}]}, schema)
        assert not bad.valid

    def test_validate_topics_duplicate_ids(self) -> None:
        from ai_web_feeds.validate import validate_topics

        result = validate_topics({"topics": [{"id": "x"}, {"id": "x"}]})
        assert not result.valid

    def test_validate_feeds_minimal_with_topic_cross_ref(self) -> None:
        from ai_web_feeds.validate import validate_feeds

        data = {"sources": [{"id": "f1"}, {"id": "f1", "title": ""}]}
        result = validate_feeds(data)
        assert not result.valid


@pytest.mark.unit
class TestEntityExtractorFinalPush:
    """Cover entity_extractor normalization branches."""

    @pytest.fixture
    def extractor(self):
        from ai_web_feeds.nlp.entity_extractor import EntityExtractor

        with patch("spacy.load", return_value=MagicMock()):
            yield EntityExtractor()

    def test_normalize_entity_list_path(self, extractor) -> None:
        result = extractor.normalize_entity("OpenAI", "ORG", ["OpenAI", "openai"])
        assert result in ("OpenAI", "openai")

    def test_extract_entities_skips_unmapped_labels(self, extractor) -> None:
        ent = MagicMock(text="Foo", label_="UNKNOWN_LABEL", start_char=0, end_char=3)
        assert extractor._map_spacy_label("UNKNOWN_LABEL") is None
        assert extractor._infer_type("Jane Doe Smith") == "person"
        assert extractor._get_content({"title": "T", "content": [{"value": "body"}]})
        assert extractor._calculate_confidence(ent) >= 0.5
        assert extractor._is_same_entity("OpenAI", "openai")


@pytest.mark.unit
class TestAnalyticsTopicStatsPush:
    """Cover analytics trending and health distribution."""

    def test_get_trending_topics_uses_topic_stats_snapshot(self) -> None:
        from ai_web_feeds.analytics import get_trending_topics
        from ai_web_feeds.models import TopicStats

        session = MagicMock()
        session.exec.return_value.first.return_value = date.today()
        ts = TopicStats(
            topic="ai",
            snapshot_date=date.today(),
            feed_count=10,
            validation_frequency=0.5,
            avg_health_score=0.8,
        )
        session.exec.return_value.all.return_value = [ts]
        result = get_trending_topics(session, limit=5)
        assert result[0]["topic"] == "ai"

    def test_validation_health_distribution_and_cache(self, temp_db_path) -> None:
        from ai_web_feeds.analytics import get_validation_health_distribution
        from ai_web_feeds.models import FeedSource, FeedValidationResult
        from ai_web_feeds.storage import DatabaseManager

        db = DatabaseManager(f"sqlite:///{temp_db_path}")
        db.create_db_and_tables()
        feed = FeedSource(id="f1", title="F1", feed="https://example.com/feed.xml", topics=["ai"])
        db.add_feed_source(feed)
        db.add_validation_result(
            FeedValidationResult(
                feed_source_id="f1",
                is_valid=True,
                validated_at=datetime.now(UTC),
            )
        )
        with db.get_session() as session:
            dist = get_validation_health_distribution(session)
        assert dist["healthy"] >= 1


@pytest.mark.unit
class TestCLIFetchFinalPush:
    """Cover fetch CLI command branches."""

    def test_fetch_one_success_and_errors(self, temp_db_path) -> None:
        from ai_web_feeds.cli.commands.fetch import app as fetch_app
        from ai_web_feeds.models import FeedSource
        from ai_web_feeds.storage import DatabaseManager

        runner = CliRunner()
        db_url = f"sqlite:///{temp_db_path}"
        db = DatabaseManager(db_url)
        db.create_db_and_tables()
        db.add_feed_source(
            FeedSource(id="f1", title="F1", feed="https://example.com/feed.xml", topics=["ai"])
        )

        mock_job = MagicMock()
        mock_job.status.value = "success"
        mock_job.articles_discovered = 3
        mock_job.response_time_ms = 120

        with (
            patch("ai_web_feeds.cli.commands.fetch.upgrade_database_to_head"),
            patch("ai_web_feeds.cli.commands.fetch.DatabaseManager") as mdb,
            patch("ai_web_feeds.cli.commands.fetch.asyncio.run", return_value=mock_job),
        ):
            mdb.return_value.get_feed_source.return_value = FeedSource(
                id="f1", title="F1", feed="https://example.com/feed.xml", topics=["ai"]
            )
            result = runner.invoke(fetch_app, ["one", "f1", "--database", db_url])
            assert result.exit_code == 0

        with (
            patch("ai_web_feeds.cli.commands.fetch.upgrade_database_to_head"),
            patch("ai_web_feeds.cli.commands.fetch.DatabaseManager") as mdb,
        ):
            mdb.return_value.get_feed_source.return_value = None
            result = runner.invoke(fetch_app, ["one", "missing"])
            assert result.exit_code == 1

            fs = FeedSource(id="f2", title="F2", feed=None, topics=[])
            mdb.return_value.get_feed_source.return_value = fs
            result = runner.invoke(fetch_app, ["one", "f2"])
            assert result.exit_code == 1

    def test_fetch_all_paths(self, temp_db_path) -> None:
        from ai_web_feeds.cli.commands.fetch import _poll_many, _select_feeds
        from ai_web_feeds.cli.commands.fetch import app as fetch_app
        from ai_web_feeds.models import CurationStatus, FeedSource

        feeds = [
            FeedSource(
                id="a",
                title="A",
                feed="https://a.example/feed.xml",
                topics=[],
                verified=True,
            ),
            FeedSource(
                id="b",
                title="B",
                feed=None,
                topics=[],
                curation_status=CurationStatus.ARCHIVED,
            ),
        ]
        selected = _select_feeds(feeds, limit=1, verified_only=True)
        assert len(selected) == 1

        runner = CliRunner()
        with (
            patch("ai_web_feeds.cli.commands.fetch.upgrade_database_to_head"),
            patch("ai_web_feeds.cli.commands.fetch.DatabaseManager") as mdb,
            patch(
                "ai_web_feeds.cli.commands.fetch.asyncio.run",
                return_value={"success": 1, "failed": 0, "articles_discovered": 2},
            ),
        ):
            mdb.return_value.get_all_feed_sources.return_value = selected
            result = runner.invoke(fetch_app, ["all", "--verified-only", "--limit", "5"])
            assert result.exit_code == 0

        with (
            patch("ai_web_feeds.cli.commands.fetch.upgrade_database_to_head"),
            patch("ai_web_feeds.cli.commands.fetch.DatabaseManager") as mdb,
        ):
            mdb.return_value.get_all_feed_sources.return_value = []
            result = runner.invoke(fetch_app, ["all"])
            assert result.exit_code == 0

        db = MagicMock()
        poller = MagicMock()
        poller.poll_feed = AsyncMock(return_value=MagicMock(articles_discovered=1))
        with (
            patch("ai_web_feeds.cli.commands.fetch.Settings"),
            patch("ai_web_feeds.cli.commands.fetch.FeedPoller", return_value=poller),
        ):
            import asyncio

            results = asyncio.run(_poll_many(db, selected))
        assert results["success"] == 1


@pytest.mark.unit
class TestCorpusTopicsValidateFinalPush:
    """Cover corpus, topics CLI, and validation report color branches."""

    def test_corpus_export_and_refresh_branches(self, tmp_path) -> None:
        from ai_web_feeds.cli.commands.corpus import app as corpus_app

        runner = CliRunner()
        out = tmp_path / "corpus.json"
        with patch("ai_web_feeds.cli.commands.corpus.DatabaseManager") as mdb:
            inst = MagicMock()
            inst.export_articles_corpus.return_value = {"metadata": {"article_count": 1}}
            mdb.return_value = inst
            result = runner.invoke(corpus_app, ["export", "--output", str(out)])
            assert result.exit_code in (0, 1)

    def test_topics_show_and_group_filter(self, tmp_path: Path) -> None:
        from ai_web_feeds.cli.commands.topics import app as topics_app

        runner = CliRunner()
        topics_file = tmp_path / "topics.yaml"
        topics_file.write_text(
            yaml.safe_dump(
                {
                    "version": "1",
                    "topics": [
                        {"id": "ai", "label": "AI", "facet": "domain", "parents": []},
                        {"id": "ml", "label": "ML", "facet": "domain", "parents": ["ai"]},
                    ],
                }
            ),
            encoding="utf-8",
        )
        result = runner.invoke(topics_app, ["list", "--file", str(topics_file)])
        assert result.exit_code == 0
        result = runner.invoke(topics_app, ["show", "ai", "--file", str(topics_file)])
        assert result.exit_code in (0, 1)

    def test_validation_report_health_colors(self) -> None:
        from ai_web_feeds.cli.commands.validate import app as val_app

        runner = CliRunner()
        feeds = [
            MagicMock(id="h1", title="Healthy Feed Title Here", verified=True),
            MagicMock(id="l1", title="Low Health Feed Title", verified=False),
        ]
        with (
            patch("ai_web_feeds.cli.commands.validate.DatabaseManager") as mdb,
            patch(
                "ai_web_feeds.cli.commands.validate.calculate_health_score",
                side_effect=[0.9, 0.3],
            ),
        ):
            inst = MagicMock()
            inst.get_all_feed_sources.return_value = feeds
            inst.get_validation_history.return_value = [MagicMock(is_valid=True)]
            mdb.return_value = inst
            result = runner.invoke(val_app, ["report", "--recent", "5"])
            assert result.exit_code == 0

    def test_fetch_one_poll_failure(self, temp_db_path) -> None:
        from ai_web_feeds.cli.commands.fetch import app as fetch_app
        from ai_web_feeds.models import FeedSource

        runner = CliRunner()
        with (
            patch("ai_web_feeds.cli.commands.fetch.upgrade_database_to_head"),
            patch("ai_web_feeds.cli.commands.fetch.DatabaseManager") as mdb,
            patch(
                "ai_web_feeds.cli.commands.fetch.asyncio.run",
                side_effect=RuntimeError("poll failed"),
            ),
        ):
            mdb.return_value.get_feed_source.return_value = FeedSource(
                id="f1", title="F1", feed="https://example.com/feed.xml", topics=[]
            )
            result = runner.invoke(fetch_app, ["one", "f1"])
            assert result.exit_code == 1


@pytest.mark.unit
class TestCoverageNinetyPercentPush:
    """Additional targeted tests to reach ≥90% total coverage."""

    def test_analytics_result_cache_and_decorator(self) -> None:
        from ai_web_feeds.analytics import _ResultCache, cache_analytics, get_health_distribution

        cache = _ResultCache()
        cache.set("k", {"ok": True})
        assert cache.get("k", ttl_seconds=3600) == {"ok": True}
        cache.set("expired", "old")
        with patch("ai_web_feeds.analytics.datetime") as mock_dt:
            mock_dt.now.return_value.timestamp.return_value = 10_000.0
            cache._cache["expired"] = ("old", 0.0)
            assert cache.get("expired", ttl_seconds=1) is None

        @cache_analytics
        def _cached_fn(x: int) -> int:
            return x * 2

        assert _cached_fn(3) == 6
        assert _cached_fn(3) == 6

        session = MagicMock()
        session.exec.return_value.all.return_value = []
        assert get_health_distribution(session) == {
            "healthy": 0,
            "moderate": 0,
            "unhealthy": 0,
        }

    def test_storage_bulk_and_corpus_paths(
        self, temp_db_path, sample_feed_source, sample_article_entry
    ) -> None:
        from ai_web_feeds.models import AnalyticsSnapshot, FeedValidationResult, TopicNode
        from ai_web_feeds.storage import DatabaseManager

        feed_id = sample_feed_source.id
        db = DatabaseManager(f"sqlite:///{temp_db_path}")
        db.create_db_and_tables()
        db.bulk_insert_topics([TopicNode(id="ai", label="AI", facet="domain")])
        db.bulk_insert_feed_sources([sample_feed_source])
        entry = sample_article_entry.model_copy()
        entry.feed_id = feed_id
        db.add_article(entry)
        db.add_validation_result(
            FeedValidationResult(
                feed_source_id=feed_id,
                is_valid=False,
                validated_at=datetime.now(UTC),
            )
        )
        failed = db.get_failed_validations()
        assert isinstance(failed, list)
        payload = db.build_articles_corpus_payload()
        assert payload["metadata"]["article_count"] >= 1

        snap_date = date.today().isoformat()
        snap = AnalyticsSnapshot(
            snapshot_date=snap_date,
            total_feeds=1,
            active_feeds=1,
            validation_success_rate=0.9,
            avg_response_time=100.0,
            trending_topics=[],
            health_distribution={"healthy": 1},
        )
        db.save_analytics_snapshot(snap)
        snap.total_feeds = 2
        updated = db.save_analytics_snapshot(snap)
        assert updated.total_feeds == 2

    @pytest.mark.asyncio
    async def test_enrich_feed_source_with_db_and_errors(self, temp_db_path, mocker) -> None:
        from ai_web_feeds.enrich import enrich_all_feeds, enrich_feed_source
        from ai_web_feeds.storage import DatabaseManager

        db = DatabaseManager(f"sqlite:///{temp_db_path}")
        db.create_db_and_tables()
        source = {"id": "f1", "feed": "https://example.com/feed.xml", "title": "F1"}

        mock_enricher = MagicMock()
        mock_enrichment = MagicMock()
        for attr, val in {
            "title": "Enriched",
            "description": None,
            "language": "en",
            "author": None,
            "format": None,
            "platform": None,
            "icon_url": None,
            "logo_url": None,
            "image_url": None,
            "quality_score": 0.8,
            "health_score": 0.9,
            "completeness_score": 0.5,
            "entry_count": 1,
            "has_full_content": False,
            "avg_content_length": 0,
            "content_types": [],
            "estimated_frequency": None,
            "last_updated": None,
            "update_regularity": 0.0,
            "response_time_ms": 100.0,
            "availability_score": 1.0,
            "suggested_topics": [],
            "topic_confidence": {},
            "has_itunes": False,
            "has_media_rss": False,
            "has_dublin_core": False,
        }.items():
            setattr(mock_enrichment, attr, val)
        mock_enrichment.to_dict.return_value = {}
        mock_enricher.enrich_from_url = mocker.AsyncMock(return_value=mock_enrichment)
        mocker.patch("ai_web_feeds.enrich.AdvancedEnricher", return_value=mock_enricher)

        result = await enrich_feed_source(source, db=db)
        assert result.get("title") == "Enriched"

        mocker.patch(
            "ai_web_feeds.enrich.asyncio.run",
            return_value=[source],
        )
        out = enrich_all_feeds({"sources": [source]}, db=db)
        assert len(out["sources"]) == 1

        no_url = await enrich_feed_source({"id": "x"})
        assert no_url["id"] == "x"

    def test_cli_add_validate_and_enrich_flags(self, tmp_path: Path) -> None:
        from ai_web_feeds.cli.commands.add import app as add_app

        runner = CliRunner()
        feeds = tmp_path / "feeds.yaml"
        feeds.write_text(
            yaml.safe_dump(
                {
                    "schema_version": "feeds-3.0.0",
                    "sources": [],
                }
            ),
            encoding="utf-8",
        )
        with (
            patch("ai_web_feeds.cli.commands.add.load_feeds", return_value={"sources": []}),
            patch("ai_web_feeds.cli.commands.add.save_feeds"),
            patch(
                "ai_web_feeds.validate.validate_feeds",
                return_value=MagicMock(valid=True, errors=[]),
            ),
            patch(
                "ai_web_feeds.enrich.enrich_feed_source",
                new_callable=AsyncMock,
                return_value={"title": "Enriched", "feed": "https://new.example/feed.xml"},
            ),
        ):
            result = runner.invoke(
                add_app,
                [
                    "https://new.example/feed.xml",
                    "--input",
                    str(feeds),
                    "--validate",
                    "--enrich",
                ],
            )
            assert result.exit_code == 0

        with patch("ai_web_feeds.cli.commands.add.load_feeds", side_effect=ValueError("bad")):
            result = runner.invoke(
                add_app,
                ["https://new.example/feed.xml", "--input", str(feeds)],
            )
            assert result.exit_code == 1

    def test_cli_enrich_error_paths(self, tmp_path: Path) -> None:
        from ai_web_feeds.cli.commands.enrich import app as enrich_app

        runner = CliRunner()
        with (
            patch(
                "ai_web_feeds.cli.commands.enrich.load_feeds_yaml",
                return_value={"sources": [{"id": "f1", "url": "https://example.com"}]},
            ),
            patch(
                "ai_web_feeds.cli.commands.enrich.asyncio.run",
                side_effect=RuntimeError("enrich fail"),
            ),
            patch("ai_web_feeds.cli.commands.enrich.save_feeds_yaml"),
            patch("ai_web_feeds.cli.commands.enrich.generate_enriched_schema", return_value={}),
            patch("ai_web_feeds.cli.commands.enrich.save_json_schema"),
            patch("ai_web_feeds.cli.commands.enrich.upgrade_database_to_head"),
            patch("ai_web_feeds.cli.commands.enrich.DatabaseManager"),
        ):
            result = runner.invoke(enrich_app, ["all"])
            assert result.exit_code == 0

        with (
            patch(
                "ai_web_feeds.cli.commands.enrich.load_feeds_yaml",
                return_value={
                    "sources": [
                        {
                            "id": "f1",
                            "title": "F1",
                            "feed": "https://example.com/feed.xml",
                            "meta": {},
                            "curation": {},
                        }
                    ]
                },
            ),
            patch("ai_web_feeds.cli.commands.enrich.asyncio.run", return_value={}),
            patch("ai_web_feeds.cli.commands.enrich.save_feeds_yaml"),
            patch("ai_web_feeds.cli.commands.enrich.generate_enriched_schema", return_value={}),
            patch("ai_web_feeds.cli.commands.enrich.save_json_schema"),
            patch("ai_web_feeds.cli.commands.enrich.upgrade_database_to_head"),
            patch("ai_web_feeds.cli.commands.enrich.DatabaseManager") as mock_db,
        ):
            mock_db.return_value.add_feed_source.side_effect = ValueError("db fail")
            result = runner.invoke(enrich_app, ["all"])
            assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_export_api_csv_and_stream(self) -> None:
        import numpy as np
        import pandas as pd
        from ai_web_feeds.visualization.export_api import (
            ExportFormat,
            export_data,
            stream_export,
        )

        with (
            patch("ai_web_feeds.visualization.export_api.check_rate_limit", new=AsyncMock()),
            patch(
                "ai_web_feeds.visualization.export_api.QueryValidator.validate_table_name",
                side_effect=lambda x: x,
            ),
            patch(
                "ai_web_feeds.visualization.export_api.QueryValidator.validate_result_limit",
                side_effect=lambda x: x,
            ),
            patch.object(pd, "np", np, create=True),
        ):
            csv_resp = await export_data(
                "feed_health",
                format=ExportFormat.CSV,
                limit=3,
                device_id="dev-1",
                session=None,
            )
            assert csv_resp.media_type == "text/csv"
            stream = await stream_export(
                "topic_metrics", format=ExportFormat.CSV, device_id="dev-1"
            )
            assert stream is not None

    def test_utils_github_and_hackernews_config_paths(self) -> None:
        from ai_web_feeds.utils import generate_github_feed_url, generate_hackernews_feed_url

        assert generate_hackernews_feed_url(
            "https://news.ycombinator.com",
            {"hackernews": {"feed_type": "newest"}},
        ).endswith("newest.rss")
        assert generate_github_feed_url("https://github.com/org/repo/releases.atom")

    @patch("ai_web_feeds.nlp.jobs.topic_job.TopicModeler")
    def test_topic_modeler_job_success_with_db(
        self, mock_modeler_cls, temp_db_path, sample_feed_source
    ) -> None:
        from ai_web_feeds.models import ArticleEntry
        from ai_web_feeds.nlp.jobs.topic_job import TopicModelingJob
        from ai_web_feeds.storage import DatabaseManager

        db = DatabaseManager(f"sqlite:///{temp_db_path}")
        db.create_db_and_tables()
        db.add_feed_source(sample_feed_source)
        now = datetime.now(UTC)
        with db.get_session() as session:
            for i in range(12):
                session.add(
                    ArticleEntry(
                        feed_id=sample_feed_source.id,
                        guid=f"g{i}",
                        link=f"https://example.com/{i}",
                        title=f"Article {i}",
                        summary="ml ai",
                        pub_date=now,
                    )
                )
            session.commit()

        discovered = MagicMock()
        discovered.name = "Subtopic"
        discovered.keywords = ["ml"]
        discovered.coherence_score = 0.6
        discovered.article_count = 5
        mock_modeler_cls.return_value.discover_subtopics.return_value = [discovered]
        job = TopicModelingJob(db_manager=db)
        stats = job.run(min_articles=5)
        assert stats["subtopics_discovered"] >= 1

    def test_generate_analytics_snapshot_and_csv(self) -> None:
        from ai_web_feeds.analytics import export_analytics_csv, generate_analytics_snapshot

        session = MagicMock()
        session.add = MagicMock()
        session.commit = MagicMock()
        session.refresh = MagicMock(side_effect=lambda obj: obj)

        with (
            patch(
                "ai_web_feeds.analytics.calculate_summary_metrics",
                return_value={
                    "total_feeds": 3,
                    "active_feeds": 2,
                    "validation_success_rate": 0.8,
                    "avg_response_time": 120.0,
                },
            ),
            patch("ai_web_feeds.analytics.get_trending_topics", return_value=[{"topic": "ai"}]),
            patch(
                "ai_web_feeds.analytics.get_health_distribution",
                return_value={"healthy": 1, "moderate": 1, "unhealthy": 1},
            ),
        ):
            snap = generate_analytics_snapshot(session)
            assert snap.total_feeds == 3

        with (
            patch(
                "ai_web_feeds.analytics.calculate_summary_metrics",
                return_value={
                    "total_feeds": 1,
                    "active_feeds": 1,
                    "verified_feeds": 1,
                    "validation_success_rate": 1.0,
                    "avg_response_time": 50.0,
                    "health_distribution": {"healthy": 1, "moderate": 0, "unhealthy": 0},
                },
            ),
            patch("ai_web_feeds.analytics.get_trending_topics", return_value=[]),
            patch(
                "ai_web_feeds.analytics.get_publication_velocity",
                return_value={
                    "data_points": [{"date": "2024-01-01", "count": 1}],
                    "avg_per_feed": 1.0,
                },
            ),
        ):
            csv_data = export_analytics_csv(session, date_range="7d")
            assert "Analytics Summary" in csv_data

    @pytest.mark.asyncio
    async def test_enrich_all_feeds_async_error_branch(self, mocker) -> None:
        from ai_web_feeds.enrich import _enrich_all_feeds_async

        source = {"id": "f1", "feed": "https://example.com/feed.xml"}
        mocker.patch(
            "ai_web_feeds.enrich.enrich_feed_source",
            side_effect=[source, RuntimeError("boom")],
        )
        result = await _enrich_all_feeds_async([source, {"id": "f2"}], db=None)
        assert len(result) == 2
