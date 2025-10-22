#!/bin/bash
# Verification script for Python autodocumentation integration

set -e

echo "🔍 Verifying Python Autodocumentation Integration..."
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check Node.js dependencies
echo "📦 Checking Node.js dependencies..."
if grep -q "fumadocs-python" apps/web/package.json; then
    echo -e "${GREEN}✓${NC} fumadocs-python found in package.json"
else
    echo -e "${RED}✗${NC} fumadocs-python NOT found in package.json"
    exit 1
fi

if grep -q "shiki" apps/web/package.json; then
    echo -e "${GREEN}✓${NC} shiki found in package.json"
else
    echo -e "${RED}✗${NC} shiki NOT found in package.json"
    exit 1
fi

# Check Python dependencies
echo ""
echo "🐍 Checking Python dependencies..."
if grep -q "fumadocs-python" pyproject.toml; then
    echo -e "${GREEN}✓${NC} fumadocs-python found in pyproject.toml"
else
    echo -e "${RED}✗${NC} fumadocs-python NOT found in pyproject.toml"
    exit 1
fi

# Check scripts
echo ""
echo "📜 Checking scripts..."
if [ -f "apps/web/scripts/generate-python-docs.mjs" ]; then
    echo -e "${GREEN}✓${NC} generate-python-docs.mjs exists"
else
    echo -e "${RED}✗${NC} generate-python-docs.mjs NOT found"
    exit 1
fi

# Check package.json script
if grep -q "generate:docs" apps/web/package.json; then
    echo -e "${GREEN}✓${NC} generate:docs script in package.json"
else
    echo -e "${RED}✗${NC} generate:docs script NOT found"
    exit 1
fi

# Check MDX components
echo ""
echo "🧩 Checking MDX components..."
if grep -q "fumadocs-python/components" apps/web/mdx-components.tsx; then
    echo -e "${GREEN}✓${NC} Python components imported in mdx-components.tsx"
else
    echo -e "${RED}✗${NC} Python components NOT imported"
    exit 1
fi

# Check global CSS
echo ""
echo "🎨 Checking styles..."
if grep -q "fumadocs-python/preset.css" apps/web/app/global.css; then
    echo -e "${GREEN}✓${NC} Python preset styles imported in global.css"
else
    echo -e "${RED}✗${NC} Python preset styles NOT imported"
    exit 1
fi

# Check documentation
echo ""
echo "📚 Checking documentation..."
if [ -f "apps/web/content/docs/development/python-autodoc.mdx" ]; then
    echo -e "${GREEN}✓${NC} python-autodoc.mdx documentation exists"
else
    echo -e "${RED}✗${NC} python-autodoc.mdx NOT found"
    exit 1
fi

# Check navigation
if grep -q "python-autodoc" apps/web/content/docs/meta.json; then
    echo -e "${GREEN}✓${NC} python-autodoc in navigation (meta.json)"
else
    echo -e "${RED}✗${NC} python-autodoc NOT in navigation"
    exit 1
fi

# Check gitignore
echo ""
echo "🚫 Checking .gitignore..."
if grep -q "ai_web_feeds.json" apps/web/.gitignore; then
    echo -e "${GREEN}✓${NC} ai_web_feeds.json in .gitignore"
else
    echo -e "${YELLOW}⚠${NC} ai_web_feeds.json NOT in .gitignore (optional)"
fi

if grep -q "/content/docs/api" apps/web/.gitignore; then
    echo -e "${GREEN}✓${NC} /content/docs/api in .gitignore"
else
    echo -e "${YELLOW}⚠${NC} /content/docs/api NOT in .gitignore (optional)"
fi

# Check Makefile
echo ""
echo "🔨 Checking Makefile..."
if grep -q "docs-api" Makefile; then
    echo -e "${GREEN}✓${NC} docs-api target in Makefile"
else
    echo -e "${YELLOW}⚠${NC} docs-api target NOT in Makefile (optional)"
fi

# Summary
echo ""
echo -e "${GREEN}✅ All critical checks passed!${NC}"
echo ""
echo "📋 Next steps:"
echo "  1. Install dependencies:"
echo "     $ cd apps/web && pnpm install"
echo "     $ pip install fumadocs-python"
echo ""
echo "  2. Generate docs:"
echo "     $ make docs-api"
echo ""
echo "  3. View docs:"
echo "     $ cd apps/web && pnpm dev"
echo "     Visit: http://localhost:3000/docs/api"
echo ""
