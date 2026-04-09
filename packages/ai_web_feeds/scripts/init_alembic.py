"""Initialize Alembic for database migrations"""

import subprocess
import sys
from pathlib import Path


def init_alembic() -> None:
    """Initialize Alembic in the project."""
    # Get the project root
    project_root = Path(__file__).parent.parent.parent
    alembic_dir = project_root / "alembic"

    if alembic_dir.exists():
        print(f"✓ Alembic directory already exists: {alembic_dir}")
        return

    # Run alembic init
    result = subprocess.run(  # noqa: S603 - fixed internal command list
        ["uv", "run", "alembic", "init", "alembic"],
        cwd=project_root,
        capture_output=True,
        text=True,
        check=False,
    )

    if result.returncode == 0:
        print(f"✓ Initialized Alembic: {alembic_dir}")
        print("\nNext steps:")
        print("1. Export AIWF_DATABASE_URL if you need a non-default database path")
        print("2. Edit alembic/env.py to import your SQLModel models")
        print("3. Run: uv run alembic revision --autogenerate -m 'Initial migration'")
        print("4. Run: uv run alembic upgrade head")
    else:
        print(f"✗ Failed to initialize Alembic: {result.stderr}")
        sys.exit(1)


if __name__ == "__main__":
    init_alembic()
