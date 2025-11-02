#!/usr/bin/env python3
"""Data Assets Validation Script.

Validates all generated data assets for the AI Web Feeds project.
"""

import json
import sqlite3
import sys
from pathlib import Path

import yaml


def validate_json_file(filepath: Path, description: str) -> bool:
    """Validate a JSON file can be loaded."""
    try:
        data = json.loads(filepath.read_text())
        sys.stdout.write(f"✓ {description}: Valid JSON with {len(str(data))} characters\n")
    except Exception as e:
        sys.stdout.write(f"✗ {description}: Failed - {e}\n")
        return False
    else:
        return True


def validate_yaml_file(filepath: Path, description: str) -> bool:
    """Validate a YAML file can be loaded."""
    try:
        data = yaml.safe_load(filepath.read_text())
        sys.stdout.write(f"✓ {description}: Valid YAML\n")
        if isinstance(data, dict) and "sources" in data:
            sys.stdout.write(f"  - Found {len(data['sources'])} sources\n")
    except Exception as e:
        sys.stdout.write(f"✗ {description}: Failed - {e}\n")
        return False
    else:
        return True


def validate_sqlite_db(filepath: Path, description: str) -> bool:
    """Validate SQLite database structure."""
    try:
        conn = sqlite3.connect(filepath)
        cursor = conn.cursor()

        # Get table count
        cursor.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='table'")
        table_count = cursor.fetchone()[0]

        # Get table names
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        tables = [row[0] for row in cursor.fetchall()]

        conn.close()

        sys.stdout.write(f"✓ {description}: Valid SQLite database\n")
        sys.stdout.write(f"  - {table_count} tables created\n")
        sys.stdout.write(f"  - Sample tables: {', '.join(tables[:5])}...\n")
    except Exception as e:
        sys.stdout.write(f"✗ {description}: Failed - {e}\n")
        return False
    else:
        return True


def main() -> int:
    """Run all validation checks."""
    sys.stdout.write("=" * 70 + "\n")
    sys.stdout.write("AI Web Feeds - Data Assets Validation\n")
    sys.stdout.write("=" * 70 + "\n")
    sys.stdout.write("\n")

    base_path = Path(__file__).parent
    results = []

    # Validate JSON Schema files
    sys.stdout.write("📋 JSON Schema Files:\n")
    results.append(
        validate_json_file(
            base_path / "feeds.schema.json",
            "feeds.schema.json (minimal contributor schema)",
        )
    )
    results.append(
        validate_json_file(
            base_path / "feeds.enriched.schema.json",
            "feeds.enriched.schema.json (enriched feeds schema)",
        )
    )
    results.append(
        validate_json_file(
            base_path / "topics.schema.json",
            "topics.schema.json (topics taxonomy schema)",
        )
    )
    sys.stdout.write("\n")

    # Validate YAML data files
    sys.stdout.write("📄 YAML Data Files:\n")
    results.append(
        validate_yaml_file(base_path / "feeds.yaml", "feeds.yaml (minimal contributor feeds)")
    )
    results.append(
        validate_yaml_file(
            base_path / "feeds.enriched.example.yaml",
            "feeds.enriched.example.yaml (enriched feed examples)",
        )
    )
    results.append(validate_yaml_file(base_path / "topics.yaml", "topics.yaml (topic taxonomy)"))
    sys.stdout.write("\n")

    # Validate JSON data files
    sys.stdout.write("📊 JSON Data Files:\n")
    results.append(
        validate_json_file(
            base_path / "sample_analytics_data.json",
            "sample_analytics_data.json (analytics test data)",
        )
    )
    sys.stdout.write("\n")

    # Validate SQLite database
    sys.stdout.write("🗄️  Database Files:\n")
    results.append(
        validate_sqlite_db(base_path / "aiwebfeeds.db", "aiwebfeeds.db (SQLite database)")
    )
    sys.stdout.write("\n")

    # Summary
    sys.stdout.write("=" * 70 + "\n")
    passed = sum(results)
    total = len(results)

    if passed == total:
        sys.stdout.write(f"✅ All validation checks passed ({passed}/{total})\n")
        sys.stdout.write("\n")
        sys.stdout.write("Data assets are ready for use:\n")
        sys.stdout.write("  • JSON Schemas: 3 files validated\n")
        sys.stdout.write("  • YAML Data: 3 files validated\n")
        sys.stdout.write("  • JSON Data: 1 file validated\n")
        sys.stdout.write("  • SQLite DB: 1 database validated\n")
        return 0

    sys.stdout.write(f"❌ Some validation checks failed ({passed}/{total} passed)\n")
    return 1


if __name__ == "__main__":
    sys.exit(main())
