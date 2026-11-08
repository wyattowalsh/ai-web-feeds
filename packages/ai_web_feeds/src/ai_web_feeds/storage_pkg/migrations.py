"""Alembic upgrades for the operational database."""

from loguru import logger
from sqlalchemy import text
from sqlalchemy.engine import make_url

from ai_web_feeds.config import DEFAULT_DATABASE_URL


def upgrade_database_to_head(database_url: str = DEFAULT_DATABASE_URL) -> None:
    """Apply reviewed Alembic migrations to the configured database."""
    from ai_web_feeds import storage

    url = make_url(database_url)
    if url.drivername.startswith("sqlite") and url.database and url.database != ":memory:":
        storage.Path(url.database).parent.mkdir(parents=True, exist_ok=True)

    packages_dir = storage.Path(storage.__file__).resolve().parents[3]
    config_path = packages_dir / "alembic.ini"
    if not config_path.exists():
        raise FileNotFoundError(f"Alembic config not found: {config_path}")

    alembic_config = storage.Config(str(config_path))
    alembic_config.set_main_option("sqlalchemy.url", database_url)
    script = storage.ScriptDirectory.from_config(alembic_config)
    head_revision = script.get_current_head()

    engine = storage.create_engine(database_url)
    inspector = storage.inspect(engine)
    has_sources = inspector.has_table("sources")
    has_alembic = inspector.has_table("alembic_version")

    if has_sources and not has_alembic and head_revision:
        storage.command.stamp(alembic_config, head_revision)
        logger.info("Stamped existing schema to Alembic head: {}", head_revision)
        return

    if has_alembic and head_revision:
        with engine.begin() as connection:
            current = connection.execute(text("SELECT version_num FROM alembic_version")).scalar()
        known_revisions = {rev.revision for rev in script.walk_revisions()}
        if current and current not in known_revisions:
            with engine.begin() as connection:
                connection.execute(
                    text("UPDATE alembic_version SET version_num = :head"),
                    {"head": head_revision},
                )
            logger.warning(
                "Unknown Alembic revision {} rewritten to head {}",
                current,
                head_revision,
            )
            return

    try:
        storage.command.upgrade(alembic_config, "head")
    except Exception as exc:
        if has_sources and head_revision and "already exists" in str(exc).lower():
            storage.command.stamp(alembic_config, head_revision)
            logger.warning("Schema already present; stamped Alembic head after upgrade conflict")
            return
        raise
    logger.info("Database migrations applied to head")
