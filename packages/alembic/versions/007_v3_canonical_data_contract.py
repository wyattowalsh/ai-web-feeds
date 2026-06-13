"""Add v3 canonical data contract.

Revision ID: 007_v3_contract
Revises: 006_visualization
Create Date: 2026-06-13
"""

from collections.abc import Sequence
import json

from alembic import context, op
import sqlalchemy as sa


revision: str = "007_v3_contract"
down_revision: str | Sequence[str] | None = "006_visualization"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _table_names() -> set[str]:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return set(inspector.get_table_names())


def _column_names(table_name: str) -> set[str]:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if table_name not in set(inspector.get_table_names()):
        return set()
    return {column["name"] for column in inspector.get_columns(table_name)}


def _add_column_if_missing(table_name: str, column: sa.Column) -> None:
    if column.name not in _column_names(table_name):
        op.add_column(table_name, column)


def _create_index_if_missing(
    index_name: str,
    table_name: str,
    columns: list[str],
    *,
    unique: bool = False,
) -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = {index["name"] for index in inspector.get_indexes(table_name)}
    if index_name not in existing:
        op.create_index(index_name, table_name, columns, unique=unique)


def _drop_index_if_exists(index_name: str, table_name: str) -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = {index["name"] for index in inspector.get_indexes(table_name)}
    if index_name in existing:
        op.drop_index(index_name, table_name=table_name)


def _drop_column_if_present(table_name: str, column_name: str) -> None:
    if column_name in _column_names(table_name):
        with op.batch_alter_table(table_name) as batch_op:
            batch_op.drop_column(column_name)


def _create_table_if_missing(table_name: str, *columns: sa.Column, **kwargs: object) -> None:
    if table_name not in _table_names():
        op.create_table(table_name, *columns, **kwargs)


def _normalize_user_source_follows_table() -> None:
    tables = _table_names()
    if "user_feed_follows" in tables and "user_source_follows" not in tables:
        _drop_index_if_exists("ix_user_feed_follows_feed_id", "user_feed_follows")
        _drop_index_if_exists("ix_user_feed_follows_user_id", "user_feed_follows")
        _drop_index_if_exists("ix_user_feed_follows_user_feed", "user_feed_follows")
        op.rename_table("user_feed_follows", "user_source_follows")

    if "user_source_follows" in _table_names():
        columns = _column_names("user_source_follows")
        if "feed_id" in columns and "source_id" not in columns:
            with op.batch_alter_table("user_source_follows") as batch_op:
                batch_op.alter_column(
                    "feed_id",
                    new_column_name="source_id",
                    existing_type=sa.String(),
                )


def _source_ids_from_profile_value(value: object) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        try:
            decoded = json.loads(value)
        except json.JSONDecodeError:
            return []
        value = decoded
    if not isinstance(value, list):
        return []
    return [source_id for source_id in value if isinstance(source_id, str) and source_id]


def _backfill_user_source_follows_from_profiles() -> None:
    tables = _table_names()
    if "user_profiles" not in tables or "user_source_follows" not in tables:
        return
    if "followed_feeds" not in _column_names("user_profiles"):
        return

    bind = op.get_bind()
    rows = bind.execute(sa.text("SELECT user_id, followed_feeds FROM user_profiles")).fetchall()
    for user_id, followed_feeds in rows:
        for source_id in _source_ids_from_profile_value(followed_feeds):
            bind.execute(
                sa.text(
                    "INSERT OR IGNORE INTO user_source_follows "
                    "(user_id, source_id, followed_at) "
                    "VALUES (:user_id, :source_id, CURRENT_TIMESTAMP)"
                ),
                {"user_id": user_id, "source_id": source_id},
            )


def _backfill_article_identity_columns() -> None:
    columns = _column_names("articles")
    if "canonical_url" in columns and "link" in columns:
        op.execute(sa.text("UPDATE articles SET canonical_url = link WHERE canonical_url IS NULL"))
    if "first_seen_at" in columns:
        timestamp_column = "discovered_at" if "discovered_at" in columns else "created_at"
        if timestamp_column == "discovered_at":
            op.execute(
                sa.text(
                    "UPDATE articles SET first_seen_at = discovered_at WHERE first_seen_at IS NULL"
                )
            )
        elif timestamp_column == "created_at":
            op.execute(
                sa.text(
                    "UPDATE articles SET first_seen_at = created_at WHERE first_seen_at IS NULL"
                )
            )
    if "last_seen_at" in columns:
        timestamp_column = "discovered_at" if "discovered_at" in columns else "created_at"
        if timestamp_column == "discovered_at":
            op.execute(
                sa.text(
                    "UPDATE articles SET last_seen_at = discovered_at WHERE last_seen_at IS NULL"
                )
            )
        elif timestamp_column == "created_at":
            op.execute(
                sa.text("UPDATE articles SET last_seen_at = created_at WHERE last_seen_at IS NULL")
            )


def _create_v3_tables() -> None:
    _create_table_if_missing(
        "source_topics",
        sa.Column("source_id", sa.String(), sa.ForeignKey("sources.id"), primary_key=True),
        sa.Column("topic_id", sa.String(), sa.ForeignKey("topics.id"), primary_key=True),
        sa.Column(
            "origin",
            sa.String(length=50),
            primary_key=True,
            nullable=False,
            server_default="catalog",
        ),
        sa.Column("weight", sa.Float(), nullable=True),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    _create_table_if_missing(
        "topic_edges",
        sa.Column("topic_id", sa.String(), sa.ForeignKey("topics.id"), primary_key=True),
        sa.Column("related_topic_id", sa.String(), sa.ForeignKey("topics.id"), primary_key=True),
        sa.Column(
            "relation_type",
            sa.String(length=50),
            primary_key=True,
            nullable=False,
            server_default="related",
        ),
        sa.Column("weight", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    _create_table_if_missing(
        "article_topics",
        sa.Column("article_id", sa.Integer(), sa.ForeignKey("articles.id"), primary_key=True),
        sa.Column("topic_id", sa.String(), sa.ForeignKey("topics.id"), primary_key=True),
        sa.Column(
            "origin",
            sa.String(length=50),
            primary_key=True,
            nullable=False,
            server_default="source",
        ),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    _create_table_if_missing(
        "article_raw_terms",
        sa.Column("article_id", sa.Integer(), sa.ForeignKey("articles.id"), primary_key=True),
        sa.Column("term", sa.String(length=255), primary_key=True),
        sa.Column("scheme", sa.String(length=255), nullable=True),
        sa.Column(
            "source",
            sa.String(length=50),
            primary_key=True,
            nullable=False,
            server_default="feed",
        ),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    _create_table_if_missing(
        "pipeline_runs",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("run_type", sa.String(length=80), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="running"),
        sa.Column("started_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("catalog_hash", sa.String(length=128), nullable=True),
        sa.Column("input_hashes", sa.JSON(), nullable=True),
        sa.Column("summary", sa.JSON(), nullable=True),
        sa.Column("error_message", sa.String(), nullable=True),
    )
    _create_table_if_missing(
        "pipeline_stage_runs",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "run_id",
            sa.String(length=36),
            sa.ForeignKey("pipeline_runs.id"),
            nullable=False,
        ),
        sa.Column("stage_name", sa.String(length=120), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="running"),
        sa.Column("started_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("records_in", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("records_out", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("records_quarantined", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("metrics", sa.JSON(), nullable=True),
        sa.Column("error_message", sa.String(), nullable=True),
        sa.UniqueConstraint("run_id", "stage_name", name="uq_pipeline_stage_run"),
    )
    _create_table_if_missing(
        "asset_manifests",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("run_id", sa.String(length=36), sa.ForeignKey("pipeline_runs.id"), nullable=True),
        sa.Column("asset_path", sa.String(length=512), nullable=False),
        sa.Column("schema_version", sa.String(length=80), nullable=False),
        sa.Column("content_hash", sa.String(length=128), nullable=False),
        sa.Column("source_hashes", sa.JSON(), nullable=True),
        sa.Column("row_count", sa.Integer(), nullable=True),
        sa.Column("generated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("freshness_watermark", sa.DateTime(), nullable=True),
        sa.Column("partial_coverage", sa.JSON(), nullable=True),
        sa.UniqueConstraint("asset_path", "content_hash", name="uq_asset_manifest_hash"),
    )
    _create_table_if_missing(
        "quarantine_records",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("run_id", sa.String(length=36), sa.ForeignKey("pipeline_runs.id"), nullable=True),
        sa.Column("stage_name", sa.String(length=120), nullable=False),
        sa.Column("record_type", sa.String(length=80), nullable=False),
        sa.Column("record_id", sa.String(length=255), nullable=True),
        sa.Column("reason_code", sa.String(length=120), nullable=False),
        sa.Column("reason_detail", sa.String(), nullable=True),
        sa.Column("payload", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("resolved_at", sa.DateTime(), nullable=True),
    )
    _create_table_if_missing(
        "data_quality_results",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("run_id", sa.String(length=36), sa.ForeignKey("pipeline_runs.id"), nullable=True),
        sa.Column("asset_path", sa.String(length=512), nullable=True),
        sa.Column("check_name", sa.String(length=160), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("severity", sa.String(length=50), nullable=False, server_default="error"),
        sa.Column("observed_value", sa.String(), nullable=True),
        sa.Column("expected_value", sa.String(), nullable=True),
        sa.Column("details", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    _create_table_if_missing(
        "user_source_follows",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("source_id", sa.String(), sa.ForeignKey("sources.id"), nullable=False),
        sa.Column("followed_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "source_id", name="uq_user_source_follow"),
    )
    _create_table_if_missing(
        "user_article_states",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("article_id", sa.Integer(), sa.ForeignKey("articles.id"), nullable=False),
        sa.Column("read_at", sa.DateTime(), nullable=True),
        sa.Column("saved_at", sa.DateTime(), nullable=True),
        sa.Column("starred_at", sa.DateTime(), nullable=True),
        sa.Column("archived_at", sa.DateTime(), nullable=True),
        sa.Column("annotation_ids", sa.JSON(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "article_id", name="uq_user_article_state"),
    )
    _create_table_if_missing(
        "user_topic_preferences",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("topic_id", sa.String(), sa.ForeignKey("topics.id"), nullable=False),
        sa.Column("preference", sa.String(length=40), nullable=False),
        sa.Column("weight", sa.Float(), nullable=False, server_default="1.0"),
        sa.Column("source", sa.String(length=50), nullable=False, server_default="user"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "topic_id", "preference", name="uq_user_topic_preference"),
    )
    _create_table_if_missing(
        "sync_events",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("event_type", sa.String(length=80), nullable=False),
        sa.Column("entity_type", sa.String(length=80), nullable=False),
        sa.Column("entity_id", sa.String(length=255), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=True),
        sa.Column("client_updated_at", sa.DateTime(), nullable=True),
        sa.Column(
            "server_received_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("applied_at", sa.DateTime(), nullable=True),
        sa.Column("conflict_status", sa.String(length=50), nullable=True),
    )


def _create_v3_indexes() -> None:
    tables = _table_names()
    if "articles" in tables:
        article_columns = _column_names("articles")
        if {"feed_id", "guid_hash"}.issubset(article_columns):
            _create_index_if_missing(
                "ix_articles_feed_guid_hash",
                "articles",
                ["feed_id", "guid_hash"],
                unique=True,
            )
        if {"feed_id", "link_hash"}.issubset(article_columns):
            _create_index_if_missing(
                "ix_articles_feed_link_hash",
                "articles",
                ["feed_id", "link_hash"],
                unique=True,
            )
    if "pipeline_runs" in tables:
        _create_index_if_missing("ix_pipeline_runs_run_type", "pipeline_runs", ["run_type"])
        _create_index_if_missing("ix_pipeline_runs_status", "pipeline_runs", ["status"])
        _create_index_if_missing("ix_pipeline_runs_catalog_hash", "pipeline_runs", ["catalog_hash"])
    if "asset_manifests" in tables:
        _create_index_if_missing("ix_asset_manifests_asset_path", "asset_manifests", ["asset_path"])
        _create_index_if_missing(
            "ix_asset_manifests_schema_version",
            "asset_manifests",
            ["schema_version"],
        )
    if "user_source_follows" in tables:
        _create_index_if_missing(
            "ix_user_source_follows_user_source",
            "user_source_follows",
            ["user_id", "source_id"],
            unique=True,
        )
    if "saved_searches" in tables:
        _create_index_if_missing(
            "ix_saved_searches_user_name",
            "saved_searches",
            ["user_id", "search_name"],
            unique=True,
        )


def upgrade() -> None:
    """Upgrade schema to the v3 canonical model contract."""
    if context.is_offline_mode():
        op.rename_table("feed_entries", "articles")
        op.drop_table("items")
        op.add_column("sources", sa.Column("url", sa.String(), nullable=True))
        op.add_column("topics", sa.Column("label", sa.String(), nullable=True))
        op.execute(sa.text("UPDATE topics SET label = name WHERE label IS NULL"))
        op.add_column("topics", sa.Column("facet", sa.String(), nullable=True))
        op.add_column("topics", sa.Column("facet_group", sa.String(), nullable=True))
        op.add_column("topics", sa.Column("parents", sa.JSON(), nullable=True))
        op.add_column("topics", sa.Column("relations", sa.JSON(), nullable=True))
        op.add_column("topics", sa.Column("examples", sa.JSON(), nullable=True))
        op.add_column("topics", sa.Column("uri", sa.String(), nullable=True))
        op.add_column("topics", sa.Column("mappings", sa.JSON(), nullable=True))
        op.add_column("topics", sa.Column("i18n", sa.JSON(), nullable=True))
        op.add_column("topics", sa.Column("rank_hint", sa.Float(), nullable=True))
        op.add_column("topics", sa.Column("tags", sa.JSON(), nullable=True))
        op.add_column("topics", sa.Column("notes", sa.String(), nullable=True))
        op.add_column("articles", sa.Column("topics", sa.JSON(), nullable=True))
        op.execute(sa.text("UPDATE articles SET topics = categories WHERE topics IS NULL"))
        op.add_column("articles", sa.Column("raw_categories", sa.JSON(), nullable=True))
        op.execute(
            sa.text("UPDATE articles SET raw_categories = categories WHERE raw_categories IS NULL")
        )
        op.rename_table("user_feed_follows", "user_source_follows")
        op.alter_column("user_source_follows", "feed_id", new_column_name="source_id")
        op.drop_column("user_profiles", "followed_feeds")
        return

    tables = _table_names()

    if "feed_entries" in tables and "articles" not in tables:
        op.rename_table("feed_entries", "articles")
        tables.remove("feed_entries")
        tables.add("articles")

    if "items" in tables:
        op.drop_table("items")

    if "sources" in tables:
        _add_column_if_missing("sources", sa.Column("url", sa.String(), nullable=True))

    if "topics" in tables:
        topic_columns = _column_names("topics")
        if "label" not in topic_columns:
            op.add_column("topics", sa.Column("label", sa.String(), nullable=True))
            if "name" in topic_columns:
                op.execute(sa.text("UPDATE topics SET label = name WHERE label IS NULL"))
        _add_column_if_missing("topics", sa.Column("facet", sa.String(), nullable=True))
        _add_column_if_missing("topics", sa.Column("facet_group", sa.String(), nullable=True))
        _add_column_if_missing("topics", sa.Column("parents", sa.JSON(), nullable=True))
        _add_column_if_missing("topics", sa.Column("relations", sa.JSON(), nullable=True))
        _add_column_if_missing("topics", sa.Column("examples", sa.JSON(), nullable=True))
        _add_column_if_missing("topics", sa.Column("uri", sa.String(), nullable=True))
        _add_column_if_missing("topics", sa.Column("mappings", sa.JSON(), nullable=True))
        _add_column_if_missing("topics", sa.Column("i18n", sa.JSON(), nullable=True))
        _add_column_if_missing("topics", sa.Column("rank_hint", sa.Float(), nullable=True))
        _add_column_if_missing("topics", sa.Column("tags", sa.JSON(), nullable=True))
        _add_column_if_missing("topics", sa.Column("notes", sa.String(), nullable=True))

    if "articles" in tables:
        article_columns = _column_names("articles")
        if "topics" not in article_columns:
            op.add_column("articles", sa.Column("topics", sa.JSON(), nullable=True))
            if "categories" in article_columns:
                op.execute(sa.text("UPDATE articles SET topics = categories WHERE topics IS NULL"))
        if "raw_categories" not in article_columns:
            op.add_column("articles", sa.Column("raw_categories", sa.JSON(), nullable=True))
            if "categories" in article_columns:
                op.execute(
                    sa.text(
                        "UPDATE articles SET raw_categories = categories "
                        "WHERE raw_categories IS NULL"
                    )
                )
        if "nlp_failures" not in article_columns:
            op.add_column("articles", sa.Column("nlp_failures", sa.JSON(), nullable=True))
        _add_column_if_missing("articles", sa.Column("guid_hash", sa.String(), nullable=True))
        _add_column_if_missing("articles", sa.Column("link_hash", sa.String(), nullable=True))
        _add_column_if_missing(
            "articles",
            sa.Column("canonical_url", sa.String(length=2048), nullable=True),
        )
        _add_column_if_missing("articles", sa.Column("first_seen_at", sa.DateTime(), nullable=True))
        _add_column_if_missing("articles", sa.Column("last_seen_at", sa.DateTime(), nullable=True))
        _backfill_article_identity_columns()

    if "entities" in tables:
        entity_columns = _column_names("entities")
        if "aliases" not in entity_columns:
            op.add_column("entities", sa.Column("aliases", sa.JSON(), nullable=True))
        if "entity_metadata" not in entity_columns:
            op.add_column("entities", sa.Column("entity_metadata", sa.JSON(), nullable=True))

    if "analytics" in tables:
        analytics_columns = _column_names("analytics")
        if (
            "avg_categories_per_item" in analytics_columns
            and "avg_raw_terms_per_item" not in analytics_columns
        ):
            with op.batch_alter_table("analytics") as batch_op:
                batch_op.alter_column(
                    "avg_categories_per_item",
                    new_column_name="avg_raw_terms_per_item",
                    existing_type=sa.Float(),
                )

    _normalize_user_source_follows_table()
    _create_v3_tables()
    _backfill_user_source_follows_from_profiles()
    _drop_column_if_present("user_profiles", "followed_feeds")
    _create_v3_indexes()


def downgrade() -> None:
    """Downgrade is intentionally lossy for the breaking v3 contract."""
    if context.is_offline_mode():
        op.rename_table("articles", "feed_entries")
        return

    tables = _table_names()
    if "articles" in tables and "feed_entries" not in tables:
        op.rename_table("articles", "feed_entries")
