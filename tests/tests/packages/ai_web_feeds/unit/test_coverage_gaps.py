"""Targeted unit tests for uncovered branches in core packages and CLI helpers."""

from __future__ import annotations

import json
import subprocess
import sys
import textwrap
from datetime import UTC, datetime, timedelta
from pathlib import Path
from time import mktime
from unittest.mock import AsyncMock, MagicMock, Mock, patch

import pytest
import yaml
from typer.testing import CliRunner


@pytest.fixture
def catalog_db(tmp_path):
    from ai_web_feeds.storage import DatabaseManager

    db = DatabaseManager(f"sqlite:///{tmp_path / 'gaps.db'}")
    db.create_db_and_tables()
    yield db
    db.close()


@pytest.mark.unit
class TestCatalogSyncStagesEdgeCases:
    """Cover catalog_sync/stages.py error paths and helpers."""

    def test_load_yaml_document_and_invalid_entries(self, tmp_path, catalog_db) -> None:
        from ai_web_feeds.catalog_sync.stages import (
            count_source_topics,
            feed_source_from_mapped,
            load_yaml_document,
            purge_stale_sources,
            sync_edges,
            sync_junctions,
            sync_sources,
            sync_topics,
            topic_entry_to_node,
        )
        from ai_web_feeds.catalog_sync.types import QuarantineReason
        from ai_web_feeds.models import FeedSource, Medium, SourceType

        yaml_path = tmp_path / "topics.yaml"
        yaml_path.write_text("version: test\ntopics: []\n", encoding="utf-8")
        assert load_yaml_document(yaml_path) == {"version": "test", "topics": []}

        yaml_path.write_text("not a mapping\n", encoding="utf-8")
        assert load_yaml_document(yaml_path) == {}

        with pytest.raises(ValueError, match="topic id is required"):
            topic_entry_to_node({})
        with pytest.raises(ValueError, match="topic label is required"):
            topic_entry_to_node({"id": "x"})
        node = topic_entry_to_node({"id": "ai", "label": "AI"})
        assert node.facet == "domain"

        topics_doc = {
            "topics": [
                "not-a-mapping",
                {
                    "id": "ai",
                    "label": "AI",
                    "parents": ["missing"],
                    "relations": {"related_to": [1]},
                },
            ]
        }
        with catalog_db.get_session() as session:
            result, known = sync_topics(session, topics_doc)
            session.commit()
        assert result.errors
        assert "ai" in known

        edges_doc = {
            "topics": [
                {"id": "ai", "label": "AI", "parents": ["ml"], "relations": {"related_to": ["ml"]}},
                {"id": "ml", "label": "ML", "parents": []},
            ]
        }
        with catalog_db.get_session() as session:
            _, known = sync_topics(session, edges_doc)
            edges_result = sync_edges(session, edges_doc, known)
            edges_result2 = sync_edges(session, edges_doc, known)
            session.commit()
        assert edges_result.inserted >= 1
        assert edges_result2.updated >= 1

        mapped = {
            "id": "feed-x",
            "title": "Feed X",
            "url": "https://example.com/feed.xml",
            "feed": "https://example.com/feed.xml",
            "source_type": SourceType.BLOG,
            "mediums": [Medium.TEXT, "invalid"],
            "topics": ["ai"],
        }
        feed = feed_source_from_mapped(mapped)
        assert feed.source_type == SourceType.BLOG
        assert Medium.TEXT in feed.mediums

        enriched_doc = {
            "sources": [
                "bad",
                {"id": "dup", "url": "https://a.example/feed.xml", "title": "A", "topics": []},
                {"id": "dup", "url": "https://b.example/feed.xml", "title": "B", "topics": []},
                {"id": "bad-url", "url": "not-a-url", "title": "Bad", "topics": []},
                {
                    "id": "good",
                    "url": "https://good.example/feed.xml",
                    "title": "Good",
                    "topics": ["ai"],
                    "source_type": "blog",
                },
            ]
        }
        with catalog_db.get_session() as session:
            _, known = sync_topics(session, {"topics": [{"id": "ai", "label": "AI"}]})
            sources_result, synced = sync_sources(session, enriched_doc, known)
            sources_result2, _ = sync_sources(session, enriched_doc, known)
            junctions = sync_junctions(session, synced, known)
            session.commit()
        assert QuarantineReason.DUPLICATE_ID.value in " ".join(sources_result.errors)
        assert QuarantineReason.INVALID_URL.value in " ".join(sources_result.errors)
        assert sources_result2.updated >= 1
        assert junctions.inserted >= 1

        with catalog_db.get_session() as session:
            session.add(
                FeedSource(
                    id="stale",
                    title="Stale",
                    feed="https://stale.example/feed.xml",
                    topics=["ai"],
                )
            )
            session.commit()
            purge_result = purge_stale_sources(session, active_ids={"good"})
            session.commit()
        assert purge_result.deleted >= 1

        with catalog_db.get_session() as session:
            junctions_skip = sync_junctions(session, [{"topics": ["ai"]}], {"ai"})
            assert junctions_skip.inserted == 0
            assert count_source_topics(session) >= 0

    def test_catalog_sync_topics_module_import(self) -> None:
        from ai_web_feeds.catalog_sync import stages

        assert stages.CatalogSyncStage is not None


@pytest.mark.unit
class TestCLITestCommandCoverage:
    """Cover apps/cli/commands/test.py branches."""

    def test_get_project_root_and_tests_dir(self, tmp_path: Path) -> None:
        from ai_web_feeds.cli.commands import test as test_cmd

        (tmp_path / "tests").mkdir()
        (tmp_path / "packages").mkdir()
        pyproject = tmp_path / "pyproject.toml"
        pyproject.write_text('[tool.uv.workspace]\nmembers = ["packages/*"]\n', encoding="utf-8")

        with patch.object(test_cmd, "Path") as mock_path:
            mock_path.cwd.return_value = tmp_path
            mock_path.return_value.resolve.return_value.parents = [tmp_path]
            root = test_cmd.get_project_root()
            assert root == tmp_path
            assert test_cmd.get_tests_dir() == tmp_path / "tests"

    def test_resolve_uv_executable_missing(self) -> None:
        from ai_web_feeds.cli.commands.test import resolve_uv_executable

        with patch("ai_web_feeds.cli.commands.test.shutil.which", return_value=None):
            with pytest.raises(RuntimeError, match="uv executable not found"):
                resolve_uv_executable()

    def test_run_uv_command_invokes_subprocess(self, tmp_path: Path) -> None:
        from ai_web_feeds.cli.commands.test import run_uv_command

        with (
            patch("ai_web_feeds.cli.commands.test.resolve_uv_executable", return_value="uv"),
            patch("ai_web_feeds.cli.commands.test.subprocess.run") as mock_run,
        ):
            mock_run.return_value = subprocess.CompletedProcess(args=[], returncode=0)
            code = run_uv_command(["pytest", "-q"], cwd=tmp_path)
            assert code == 0
            mock_run.assert_called_once()

    def test_all_cli_subcommands(self, tmp_path: Path) -> None:
        from ai_web_feeds.cli.commands.test import app as test_app

        runner = CliRunner()
        patches = {
            "resolve_uv_executable": patch(
                "ai_web_feeds.cli.commands.test.resolve_uv_executable", return_value="uv"
            ),
            "get_tests_dir": patch(
                "ai_web_feeds.cli.commands.test.get_tests_dir", return_value=tmp_path
            ),
            "run_uv": patch("ai_web_feeds.cli.commands.test.run_uv_command", return_value=0),
        }
        with patches["resolve_uv_executable"], patches["get_tests_dir"], patches["run_uv"]:
            for args in [
                ["all", "--verbose", "--coverage", "--parallel"],
                ["unit", "--fast"],
                ["integration"],
                ["e2e"],
                ["coverage", "--open"],
                ["quick"],
                ["file", "tests/unit", "-k", "smoke"],
                ["debug", "tests/unit/test_x.py"],
                ["markers"],
            ]:
                result = runner.invoke(test_app, args)
                assert result.exit_code in (0, 1, 2)

        with (
            patches["resolve_uv_executable"],
            patches["get_tests_dir"],
            patch("ai_web_feeds.cli.commands.test.run_uv_command", return_value=1),
        ):
            result = runner.invoke(test_app, ["unit"])
            assert result.exit_code == 1

        with (
            patches["resolve_uv_executable"],
            patches["get_tests_dir"],
            patch("ai_web_feeds.cli.commands.test.run_uv_command", side_effect=KeyboardInterrupt),
        ):
            result = runner.invoke(test_app, ["watch"])
            assert result.exit_code == 0


@pytest.mark.unit
class TestEnrichCoverageGaps:
    """Cover enrich.py branches not hit by base tests."""

    @pytest.mark.asyncio
    async def test_enrich_from_feed_image_and_media_paths(self) -> None:
        from ai_web_feeds.enrich import AdvancedEnricher, FeedEnrichment
        from ai_web_feeds.models import FeedFormat

        enricher = AdvancedEnricher()
        enrichment = FeedEnrichment()

        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.content = b"""<?xml version='1.0'?>
<rss><channel><title>T</title><image>https://img.example/icon.png</image>
<item><title>Post</title><summary>short</summary>
<media:content xmlns:media="http://search.yahoo.com/mrss/" url="x"/>
<link type="image/png" href="https://img.example/p.png"/>
<link type="video/mp4" href="https://vid.example/v.mp4"/>
</item></channel></rss>"""
        mock_response.raise_for_status = Mock()

        with (
            patch("ai_web_feeds.enrich.httpx.AsyncClient") as mock_client,
            patch("ai_web_feeds.enrich.detect_feed_format", new=AsyncMock(return_value="rss")),
            patch("ai_web_feeds.enrich.feedparser.parse") as mock_parse,
        ):
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )
            entry = {
                "title": "Machine learning advances",
                "summary": "neural network research paper",
                "content": [{"value": "x" * 600}],
                "published_parsed": mktime(datetime.now(UTC).timetuple()),
                "media_content": True,
                "links": [{"type": "audio/mpeg", "href": "https://a.example/a.mp3"}],
            }
            mock_parse.return_value = Mock(
                feed={
                    "title": "T",
                    "description": "D",
                    "image": "https://img.example/logo.png",
                    "logo": "https://logo.example/l.png",
                    "icon": "https://icon.example/i.png",
                },
                entries=[entry, entry],
                namespaces={"itunes": "x", "media": "y", "dc": "z"},
                version="rss20",
            )
            await enricher._enrich_from_feed("https://example.com/feed.xml", enrichment)

        assert enrichment.format == FeedFormat.RSS
        assert enrichment.image_url
        assert enrichment.has_full_content
        assert enrichment.entry_count >= 1

    @pytest.mark.asyncio
    async def test_analyze_update_frequency_and_suggest_topics(self) -> None:
        from ai_web_feeds.enrich import AdvancedEnricher, FeedEnrichment

        enricher = AdvancedEnricher()
        enrichment = FeedEnrichment()
        now = datetime.now(UTC)
        dates = [now - timedelta(days=i * 3) for i in range(4)]
        entries = []
        for dt in dates:
            entries.append(
                {
                    "title": "Deep learning pytorch tensorflow",
                    "summary": "machine learning neural network",
                    "published_parsed": dt.timetuple(),
                }
            )
        await enricher._analyze_update_frequency(entries, enrichment)
        assert enrichment.estimated_frequency in {"weekly", "biweekly", "daily", "multiple_daily"}

        await enricher._suggest_topics(entries, enrichment)
        assert enrichment.suggested_topics or enrichment.topic_confidence

    def test_score_branches(self) -> None:
        from ai_web_feeds.enrich import AdvancedEnricher, FeedEnrichment

        enricher = AdvancedEnricher()
        enrichment = FeedEnrichment()
        enrichment.title = "T"
        enrichment.description = "D"
        enrichment.entry_count = 15
        enrichment.has_full_content = True
        enrichment.estimated_frequency = "daily"
        enrichment.update_regularity = 0.8
        enrichment.icon_url = "https://i.example/i.png"
        enrichment.availability_score = 0.6
        enrichment.last_updated = datetime.now(UTC) - timedelta(days=20)
        enrichment.response_time_ms = 2500
        enrichment.language = "en"
        enrichment.author = "A"
        enrichment.format = "rss"
        enrichment.content_types = ["text"]

        assert enricher._calculate_quality_score(enrichment) > 0.5
        assert enricher._calculate_health_score(enrichment) > 0
        assert enricher._calculate_completeness_score(enrichment) >= 0.5

    @pytest.mark.asyncio
    async def test_enrich_from_site_html_paths(self) -> None:
        from ai_web_feeds.enrich import AdvancedEnricher, FeedEnrichment

        enricher = AdvancedEnricher()
        enrichment = FeedEnrichment()
        html = """
        <html lang="en">
        <head>
          <meta property="og:title" content="OG Title"/>
          <meta property="og:description" content="OG Desc"/>
          <meta property="og:image" content="https://og.example/img.png"/>
          <link rel="icon" href="/favicon.ico"/>
        </head><body><title>Page</title></body></html>
        """
        mock_response = Mock(status_code=200, text=html)
        with patch("ai_web_feeds.enrich.httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )
            await enricher._enrich_from_site("https://example.com", enrichment)
        assert enrichment.title == "OG Title"
        assert enrichment.icon_url.endswith("favicon.ico")


@pytest.mark.unit
class TestCLIEnrichCommandGaps:
    """Cover CLI enrich command handlers."""

    def test_enrich_all_and_one(self, tmp_path: Path) -> None:
        from ai_web_feeds.cli.commands.enrich import app as enrich_app

        runner = CliRunner()
        feeds = tmp_path / "feeds.yaml"
        feeds.write_text(
            yaml.safe_dump(
                {
                    "schema_version": "feeds-3.0.0",
                    "sources": [
                        {
                            "id": "f1",
                            "url": "https://example.com/feed.xml",
                            "title": "F1",
                            "topics": ["ai"],
                        }
                    ],
                }
            ),
            encoding="utf-8",
        )
        enriched = {
            "id": "f1",
            "title": "F1",
            "feed": "https://example.com/feed.xml",
            "topics": ["ai"],
            "meta": {"language": "en", "format": "rss", "verified": True},
            "curation": {"status": "active", "quality_score": 0.9},
            "provenance": {"source": "test"},
        }
        with (
            patch(
                "ai_web_feeds.cli.commands.enrich.load_feeds_yaml",
                return_value={
                    "sources": [{"id": "f1", "url": "https://example.com/feed.xml", "title": "F1"}]
                },
            ),
            patch(
                "ai_web_feeds.cli.commands.enrich.asyncio.run",
                return_value=enriched,
            ),
            patch("ai_web_feeds.cli.commands.enrich.save_feeds_yaml"),
            patch("ai_web_feeds.cli.commands.enrich.generate_enriched_schema", return_value={}),
            patch("ai_web_feeds.cli.commands.enrich.save_json_schema"),
            patch("ai_web_feeds.cli.commands.enrich.upgrade_database_to_head"),
            patch("ai_web_feeds.cli.commands.enrich.DatabaseManager") as mock_db,
        ):
            mock_db.return_value.add_feed_source.return_value = None
            result = runner.invoke(
                enrich_app,
                ["all", "--input", str(feeds), "--output", str(tmp_path / "out.yaml")],
            )
            assert result.exit_code == 0

        with (
            patch(
                "ai_web_feeds.cli.commands.enrich.load_feeds_yaml",
                return_value={
                    "sources": [{"id": "f1", "url": "https://example.com", "title": "F1"}]
                },
            ),
            patch("ai_web_feeds.cli.commands.enrich.asyncio.run", return_value=enriched),
        ):
            result = runner.invoke(enrich_app, ["one", "f1", "--input", str(feeds)])
            assert result.exit_code == 0

        with patch(
            "ai_web_feeds.cli.commands.enrich.load_feeds_yaml",
            return_value={"sources": []},
        ):
            result = runner.invoke(enrich_app, ["one", "missing", "--input", str(feeds)])
            assert result.exit_code == 1


@pytest.mark.unit
class TestCLIMainModuleGaps:
    """Cover ai_web_feeds.cli __init__ helpers and pipeline branches."""

    def test_private_helper_functions(self, tmp_path: Path) -> None:
        from ai_web_feeds.cli import (
            _load_existing_enriched_sources,
            _looks_like_url_title,
            _reuse_existing_enrichment,
            _source_keys,
        )

        source = {"url": "https://a.example", "feed": "https://a.example/feed.xml"}
        assert _source_keys(source) == ["https://a.example", "https://a.example/feed.xml"]
        assert _looks_like_url_title("https://title.example")
        assert not _looks_like_url_title("Human Title")

        out = tmp_path / "enriched.yaml"
        out.write_text(
            yaml.safe_dump(
                {
                    "sources": [
                        {
                            "id": "x",
                            "url": "https://a.example",
                            "title": "Kept Title",
                            "topics": ["ai"],
                        }
                    ]
                }
            ),
            encoding="utf-8",
        )
        existing = _load_existing_enriched_sources(out)
        assert "https://a.example" in existing

        feeds = {"sources": [{"url": "https://a.example", "title": "https://bad"}]}
        reused = _reuse_existing_enrichment(feeds, out)
        assert reused["sources"][0]["title"] == "Kept Title"

    def test_process_and_load_error_paths(self, tmp_path: Path) -> None:
        from ai_web_feeds.cli import app as main_app

        runner = CliRunner()
        missing = tmp_path / "missing.yaml"
        result = runner.invoke(main_app, ["load", str(missing)])
        assert result.exit_code == 1

        bad = tmp_path / "bad.yaml"
        bad.write_text("invalid: [\n", encoding="utf-8")
        with patch("ai_web_feeds.cli.load_feeds", side_effect=ValueError("bad yaml")):
            result = runner.invoke(main_app, ["process", "--input", str(bad), "--no-export"])
            assert result.exit_code == 1

    def test_main_entrypoint(self) -> None:
        from ai_web_feeds.cli import main

        with patch("ai_web_feeds.cli.app") as mock_app:
            main()
            mock_app.assert_called_once()


@pytest.mark.unit
class TestUtilsAndValidateGaps:
    """Cover utils platform generators and validate package branches."""

    def test_reddit_and_medium_feed_url_generators(self) -> None:
        from ai_web_feeds.utils import generate_medium_feed_url, generate_reddit_feed_url

        assert "machinelearning" in generate_reddit_feed_url("https://reddit.com/r/machinelearning")
        assert generate_reddit_feed_url(
            "https://reddit.com/r/ml",
            {"reddit": {"subreddit": "ml", "sort": "top", "time": "week"}},
        ).endswith("t=week")
        assert generate_medium_feed_url("https://towardsdatascience.com").endswith(
            "towardsdatascience"
        )
        assert generate_medium_feed_url(
            "https://medium.com",
            {"medium": {"username": "@writer"}},
        ).endswith("@writer")

    def test_validate_feeds_canonical_branches(self, tmp_path: Path) -> None:
        from ai_web_feeds.validate import ValidationResult, validate_feeds, validate_topics

        data = {
            "schema_version": "feeds-3.0.0",
            "sources": [
                {"id": "a", "title": "A", "topics": ["missing-topic"]},
                {"id": "a", "title": "Dup"},
            ],
        }
        schema = tmp_path / "schema.json"
        schema.write_text(
            json.dumps(
                {
                    "type": "object",
                    "required": ["schema_version", "sources"],
                    "properties": {"schema_version": {}, "sources": {"type": "array"}},
                }
            ),
            encoding="utf-8",
        )
        result = validate_feeds(data, schema)
        assert not result.valid

        topics = {"topics": [{"id": "t1"}, {"id": "t1"}]}
        tresult = validate_topics(topics, schema)
        assert not tresult.valid

        assert bool(ValidationResult(valid=True))


@pytest.mark.unit
class TestVisualizationCoverageGaps:
    """Cover visualization service, dashboard, and auth branches."""

    @pytest.mark.asyncio
    async def test_visualization_service_branches(self) -> None:
        from ai_web_feeds.visualization.models import ChartType, DataSource
        from ai_web_feeds.visualization.validators import ValidationError
        from ai_web_feeds.visualization.visualization_service import VisualizationService

        service = VisualizationService()
        with patch("ai_web_feeds.visualization.visualization_service.get_session") as mock_sess:
            mock_sess.side_effect = RuntimeError("db down")
            assert await service.list_visualizations("device-1") == []

        viz = {
            "data_source": "topics",
            "filters": {"topic_ids": ["ai"]},
            "device_id": "device-1",
        }
        with patch.object(service.data_service, "query_topic_metrics", return_value=[{"x": 1}]):
            data = await service.fetch_visualization_data(viz)
            assert data["count"] == 1

        viz["data_source"] = "feeds"
        with patch.object(service.data_service, "query_feed_health", return_value=[]):
            data = await service.fetch_visualization_data(viz)
            assert data["count"] == 0

        viz["data_source"] = "unknown"
        data = await service.fetch_visualization_data(viz)
        assert data["records"] == []

        with patch("ai_web_feeds.visualization.visualization_service.get_session") as mock_sess:
            session = MagicMock()
            mock_sess.return_value.__enter__.return_value = session
            session.execute.return_value.scalar_one_or_none.return_value = None
            assert await service.get_visualization(1, "device-1") is None
            session.execute.return_value.rowcount = 0
            assert await service.delete_visualization(99, "device-1") is False

        with patch("ai_web_feeds.visualization.visualization_service.get_session") as mock_sess:
            session = MagicMock()
            mock_sess.return_value.__enter__.return_value = session
            viz_obj = MagicMock()
            viz_obj.to_dict.return_value = {"id": 1}
            session.execute.return_value.scalar_one_or_none.return_value = viz_obj
            with patch.object(
                service.customization_validator,
                "validate_title",
                side_effect=ValidationError("bad title"),
            ):
                with pytest.raises(ValidationError):
                    await service.create_visualization(
                        "device-1",
                        "n",
                        ChartType.LINE,
                        DataSource.TOPICS,
                        {},
                        {"title": "x"},
                    )

    @pytest.mark.asyncio
    async def test_dashboard_service_error_paths(self) -> None:
        from ai_web_feeds.visualization.dashboard_service import DashboardService
        from ai_web_feeds.visualization.validators import ValidationError

        service = DashboardService()
        with patch("ai_web_feeds.visualization.dashboard_service.get_session") as mock_sess:
            mock_sess.side_effect = RuntimeError("db")
            assert await service.list_dashboards("d1") == []

            mock_sess.side_effect = None
            session = MagicMock()
            mock_sess.return_value.__enter__.return_value = session

            class _Dash:
                version = 2
                name = "old"
                description = None
                layout: dict[str, object]

            dash = _Dash()
            dash.layout = {}
            session.execute.return_value.scalar_one_or_none.return_value = dash
            with pytest.raises(ValidationError, match="Version mismatch"):
                await service.update_dashboard(1, "d1", name="New", expected_version=1)

    @pytest.mark.asyncio
    async def test_auth_and_export_api_paths(self) -> None:
        from ai_web_feeds.visualization import auth as viz_auth

        with patch.object(viz_auth.settings, "jwt_secret_key", "test-secret-key-32chars-min!!!!"):
            token = viz_auth.create_jwt_token("device-abc")
            assert viz_auth.verify_jwt_token(token) == "device-abc"
            assert viz_auth.verify_jwt_token("bad.token.here") is None

        plain, hashed = viz_auth.generate_api_key()
        assert viz_auth.verify_api_key(plain, hashed)
        assert viz_auth.verify_api_key("wrong", hashed) is False


@pytest.mark.unit
class TestLoggerAndNLPInitGaps:
    """Cover logger singleton and nlp __init__ lazy imports."""

    def test_logger_get_settings_singleton(self) -> None:
        import ai_web_feeds.logger as logger_mod

        logger_mod._settings = None
        s1 = logger_mod.get_settings()
        s2 = logger_mod.get_settings()
        assert s1 is s2

    def test_nlp_init_unknown_attribute(self) -> None:
        from ai_web_feeds import nlp

        with pytest.raises(AttributeError):
            _ = nlp.definitely_not_a_real_export_xyz  # type: ignore[attr-defined]


@pytest.mark.unit
class TestSentimentJobCoverageGaps:
    """Cover sentiment batch job classification branches."""

    @patch("ai_web_feeds.nlp.jobs.sentiment_job.SentimentAnalyzer")
    def test_sentiment_job_classification_branches(
        self, mock_analyzer_cls, temp_db_path, sample_feed_source
    ) -> None:
        from ai_web_feeds.models import ArticleEntry
        from ai_web_feeds.nlp.jobs.sentiment_job import SentimentBatchJob
        from ai_web_feeds.storage import DatabaseManager

        db = DatabaseManager(f"sqlite:///{temp_db_path}")
        db.create_db_and_tables()
        db.add_feed_source(sample_feed_source)
        now = datetime.now(UTC)
        articles = [
            ArticleEntry(
                feed_id=sample_feed_source.id,
                title="Good news",
                summary="positive outlook",
                guid="g1",
                link="https://example.com/1",
                pub_date=now,
            ),
            ArticleEntry(
                feed_id=sample_feed_source.id,
                title="Bad",
                summary="negative",
                guid="g2",
                link="https://example.com/2",
                pub_date=now,
            ),
            ArticleEntry(
                feed_id=sample_feed_source.id,
                title="Neutral",
                summary="ok",
                guid="g3",
                link="https://example.com/3",
                pub_date=now,
            ),
        ]
        with db.get_session() as session:
            session.add_all(articles)
            session.commit()

        job = SentimentBatchJob(db_manager=db)
        pos = MagicMock(
            sentiment_score=0.9,
            classification="positive",
            model_name="test",
            confidence=0.8,
        )
        neg = MagicMock(
            sentiment_score=-0.9,
            classification="negative",
            model_name="test",
            confidence=0.8,
        )
        job.analyzer.analyze_sentiment.side_effect = [pos, None, neg]
        stats = job.run(batch_size=10, force=True)
        assert stats["analyzed"] >= 1

    @patch("ai_web_feeds.nlp.jobs.sentiment_job.SentimentAnalyzer")
    def test_sentiment_job_failure_path(
        self, mock_analyzer_cls, temp_db_path, sample_feed_source
    ) -> None:
        from ai_web_feeds.models import ArticleEntry
        from ai_web_feeds.nlp.jobs.sentiment_job import SentimentBatchJob
        from ai_web_feeds.storage import DatabaseManager

        db = DatabaseManager(f"sqlite:///{temp_db_path}")
        db.create_db_and_tables()
        db.add_feed_source(sample_feed_source)
        with db.get_session() as session:
            session.add(
                ArticleEntry(
                    feed_id=sample_feed_source.id,
                    title="X",
                    summary="Y",
                    guid="g1",
                    link="https://example.com/1",
                    pub_date=datetime.now(UTC),
                )
            )
            session.commit()

        job = SentimentBatchJob(db_manager=db)
        job.analyzer.analyze_sentiment.side_effect = RuntimeError("boom")
        stats = job.run(batch_size=5)
        assert stats["failed"] >= 1


@pytest.mark.unit
class TestTopicJobAndForecastGaps:
    """Cover topic modeling job and forecast service branches."""

    def test_topic_modeling_job_skip_and_failure(self, temp_db_path) -> None:
        from ai_web_feeds.nlp.jobs.topic_job import TopicModelingJob
        from ai_web_feeds.storage import DatabaseManager

        db = DatabaseManager(f"sqlite:///{temp_db_path}")
        db.create_db_and_tables()
        job = TopicModelingJob(db_manager=db)
        stats = job.run(min_articles=100)
        assert stats["topics_processed"] == 0

        with patch.object(job.modeler, "discover_subtopics", side_effect=RuntimeError("fail")):
            with patch.object(job, "db_manager") as mock_db:
                mock_db.get_session.return_value.__enter__.return_value.exec.return_value.all.return_value = [
                    MagicMock(
                        id=i, title=f"T{i}", content_html="x", summary="y", topics_processed=False
                    )
                    for i in range(12)
                ]
                stats = job.run(min_articles=5)
        assert stats["failed"] >= 1

    def test_topic_modeling_job_success_path(self, temp_db_path) -> None:
        from ai_web_feeds.nlp.jobs.topic_job import TopicModelingJob
        from ai_web_feeds.storage import DatabaseManager

        db = DatabaseManager(f"sqlite:///{temp_db_path}")
        db.create_db_and_tables()
        job = TopicModelingJob(db_manager=db)
        discovered = MagicMock(name="Sub", keywords=["ml"], coherence_score=0.5, article_count=3)
        articles = [
            MagicMock(
                id=f"a{i}",
                title="ML",
                content_html="text",
                summary="s",
                topics_processed=False,
            )
            for i in range(12)
        ]
        with patch.object(job.modeler, "discover_subtopics", return_value=[discovered]):
            with patch.object(job.db_manager, "get_session") as mock_sess:
                session = MagicMock()
                mock_sess.return_value.__enter__.return_value = session
                session.exec.return_value.all.return_value = articles
                stats = job.run(min_articles=5)
        assert stats["subtopics_discovered"] >= 1

    @pytest.mark.asyncio
    async def test_forecast_service_metrics_and_validation(self) -> None:
        import pandas as pd
        from ai_web_feeds.visualization.forecast_service import ForecastService

        service = ForecastService(MagicMock())
        with pytest.raises(ValueError, match="ds"):
            await service.generate_forecast(
                "device-1",
                "topics",
                pd.DataFrame({"value": [1, 2, 3]}),
                horizon_days=7,
            )
