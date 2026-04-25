"""Initialize Alembic for database migrations"""

import shutil
import subprocess  # nosec B404 - used only to execute a resolved local alembic binary
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

    alembic_executable = shutil.which("alembic")
    if alembic_executable is None:
        msg = "Alembic executable not found on PATH"
        raise RuntimeError(msg)

    # Run alembic init
    result = subprocess.run(  # noqa: S603
        [alembic_executable, "init", "alembic"],
        cwd=project_root,
        capture_output=True,
        text=True,
        check=False,
    )  # nosec B603

    if result.returncode == 0:
        print(f"✓ Initialized Alembic: {alembic_dir}")
        print("\nNext steps:")
        print("1. Edit alembic.ini to configure your database URL")
        print("2. Edit alembic/env.py to import your SQLModel models")
        print("3. Run: alembic revision --autogenerate -m 'Initial migration'")
        print("4. Run: alembic upgrade head")
    else:
        print(f"✗ Failed to initialize Alembic: {result.stderr}")
        sys.exit(1)


if __name__ == "__main__":
    init_alembic()
