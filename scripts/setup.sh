#!/usr/bin/env bash
#
# Quick setup script for AI Web Feeds
# Initializes the database and generates initial outputs

set -e

echo "🚀 AI Web Feeds - Quick Setup"
echo "════════════════════════════════════════════════════════"

# Check if uv is installed
if ! command -v uv &> /dev/null; then
    echo "❌ uv is not installed. Please install it first:"
    echo "   curl -LsSf https://astral.sh/uv/install.sh | sh"
    exit 1
fi

echo ""
echo "📦 Step 1: Installing dependencies..."
uv sync

echo ""
echo "🔄 Step 2: Enriching feeds..."
uv run aiwebfeeds enrich all \
    --input data/feeds.yaml \
    --output data/feeds.enriched.yaml \
    --schema data/feeds.enriched.schema.json \
    --database sqlite:///data/aiwebfeeds.db

echo ""
echo "📄 Step 3: Generating OPML files..."
uv run aiwebfeeds opml all --output data/all.opml
uv run aiwebfeeds opml categorized --output data/categorized.opml

echo ""
echo "📊 Step 4: Displaying statistics..."
uv run aiwebfeeds stats show

echo ""
echo "════════════════════════════════════════════════════════"
echo "✅ Setup complete!"
echo ""
echo "Generated files:"
echo "  - data/feeds.enriched.yaml       (Enriched feed data)"
echo "  - data/feeds.enriched.schema.json (JSON schema)"
echo "  - data/aiwebfeeds.db             (SQLite database)"
echo "  - data/all.opml                  (All feeds)"
echo "  - data/categorized.opml          (Categorized feeds)"
echo ""
echo "Next steps:"
echo "  - Import OPML files into your feed reader"
echo "  - Generate custom filtered OPML:"
echo "    uv run aiwebfeeds opml filtered data/nlp.opml --topic nlp"
echo "  - View help:"
echo "    uv run aiwebfeeds --help"
echo ""
