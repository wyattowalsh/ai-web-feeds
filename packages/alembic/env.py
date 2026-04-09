from logging.config import fileConfig
from pathlib import Path

# Import all models for autogenerate support
import sys

from alembic import context
from sqlalchemy import engine_from_config, pool


# Add parent directory to path so we can import ai_web_feeds
sys.path.insert(0, str(Path(__file__).parent.parent / "ai_web_feeds" / "src"))

from ai_web_feeds.config import default_database_url, resolve_database_url
from ai_web_feeds.models import SQLModel  # This imports core storage models via SQLModel registry
from ai_web_feeds.visualization import models as _visualization_models  # noqa: F401


# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here
# for 'autogenerate' support
target_metadata = SQLModel.metadata

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


def _resolve_configured_database_url() -> str:
    """Resolve the effective Alembic database URL from shared config defaults."""
    configured_url = config.get_main_option("sqlalchemy.url", "").strip()
    if not configured_url or configured_url == "__AIWF_DEFAULT_DATABASE_URL__":
        resolved_url = default_database_url()
    else:
        resolved_url = resolve_database_url(configured_url)

    config.set_main_option("sqlalchemy.url", resolved_url)
    return resolved_url


DATABASE_URL = _resolve_configured_database_url()


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = DATABASE_URL
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
