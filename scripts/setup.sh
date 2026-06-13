#!/usr/bin/env bash
#
# Quick setup script for ai-web-feeds
# Initializes the database and generates initial outputs

set -e

echo "🚀 ai-web-feeds - Quick Setup"
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
uv run ai-web-feeds enrich all \
    --input data/feeds.yaml \
    --output data/feeds.enriched.yaml \
    --schema data/feeds.enriched.schema.json \
    --database sqlite:///data/ai-web-feeds.db

echo ""
echo "📄 Step 3: Generating OPML files..."
uv run ai-web-feeds opml all --output data/feeds.opml
uv run ai-web-feeds opml categorized --output data/feeds.categorized.opml

echo ""
echo "📊 Step 4: Displaying statistics..."
uv run ai-web-feeds stats show

echo ""
echo "════════════════════════════════════════════════════════"
echo "✅ Setup complete!"
echo ""
echo "Generated files:"
echo "  - data/feeds.enriched.yaml       (Enriched feed data)"
echo "  - data/feeds.enriched.schema.json (JSON schema)"
echo "  - data/ai-web-feeds.db          (SQLite database)"
echo "  - data/feeds.opml               (All feeds)"
echo "  - data/feeds.categorized.opml   (Categorized feeds)"
echo ""
echo "Next steps:"
echo "  - Import OPML files into your feed reader"
echo "  - Generate custom filtered OPML:"
echo "    uv run ai-web-feeds opml filtered data/nlp.opml --topic nlp"
echo "  - View help:"
echo "    uv run ai-web-feeds --help"
echo ""
