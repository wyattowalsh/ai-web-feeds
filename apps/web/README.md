# web

This is a Next.js application generated with
[Create Fumadocs](https://github.com/fuma-nama/fumadocs).

## 🚀 Features

- 📚 **Documentation**: Full-featured docs with Fumadocs UI
- 🐍 **Python Autodocs**: Auto-generated API docs from docstrings
- 🤖 **AI Integration**: LLM-friendly endpoints and content negotiation
- 📄 **PDF Export**: Export documentation as high-quality PDFs
- 📰 **RSS Feeds**: Subscribe via RSS, Atom, or JSON feeds
- 🔍 **Search**: Built-in documentation search
- 🎨 **Customizable**: Tailwind CSS and MDX components

## Quick Start

Run development server:

```bash
pnpm dev
```

Open http://localhost:3000 with your browser to see the result.

## 📁 Project Structure

| Path | Description |
| ---- | ----------- |
| `app/(home)` | Landing page and other pages |
| `app/docs` | Documentation layout and pages |
| `app/api/search/route.ts` | Search route handler |
| `app/llms.txt` | AI discovery endpoint |
| `app/llms-full.txt` | Complete docs for AI agents |
| `app/llms.mdx/[[...slug]]` | Markdown version of pages |
| `app/rss.xml` | Sitewide RSS feed |
| `app/docs/rss.xml` | Documentation RSS feed |
| `lib/source.ts` | Content source adapter |
| `lib/rss.ts` | RSS feed generation |
| `lib/layout.shared.tsx` | Shared layout options |
| `content/docs` | MDX documentation files |
| `components/page-actions.tsx` | AI page action buttons |
| `scripts/` | Utility scripts (PDF export) |

## 🤖 AI & LLM Integration

This site includes comprehensive AI integration following [Fumadocs best practices](https://fumadocs.dev/docs/ui/llms):

### Endpoints

- `/llms.txt` - Discovery file for AI agents
- `/llms-full.txt` - All documentation in one file
- `*.mdx` - Markdown version of any page (e.g., `/docs/page.mdx`)
- `*.md` - Alternative markdown extension

### Content Negotiation

Send `Accept: text/markdown` header to automatically receive markdown:

```bash
curl -H "Accept: text/markdown" http://localhost:3000/docs
```

### Page Actions

Every docs page includes:
- **Copy Markdown** button
- **View Options** dropdown with links to GitHub, Scira AI, Perplexity, ChatGPT

### Documentation

See the complete documentation at:
- [AI Integration Guide](/docs/features/ai-integration) - Complete feature guide
- [llms-full.txt Format](/docs/features/llms-full-format) - Format specification
- [Testing Guide](/docs/guides/testing) - Testing instructions
- [Quick Reference](/docs/guides/quick-reference) - Commands and endpoints

## 📄 PDF Export

Export documentation pages as PDFs using Puppeteer:

```bash
# Export all pages (requires server running)
pnpm export-pdf

# Export specific pages
pnpm export-pdf:specific /docs /docs/getting-started

# Automated build and export
pnpm export-pdf:build
```

### PDF Export Documentation

See the complete documentation at:
- [PDF Export Guide](/docs/features/pdf-export) - Complete PDF export guide
- [Scripts Documentation](./scripts/README.md) - Script documentation

## � RSS Feeds

Subscribe to documentation updates via RSS, Atom, or JSON feeds:

### Feed URLs

**Sitewide Feeds:**
- `/rss.xml` - RSS 2.0 format
- `/atom.xml` - Atom 1.0 format
- `/feed.json` - JSON Feed format

**Documentation Feeds:**
- `/docs/rss.xml` - RSS 2.0 format
- `/docs/atom.xml` - Atom 1.0 format
- `/docs/feed.json` - JSON Feed format

### Features

- Auto-discoverable via metadata
- Hourly updates with smart caching
- Multiple format support (RSS, Atom, JSON)
- Categorized content

### RSS Documentation

See the complete documentation at:
- [RSS Feeds Guide](/docs/features/rss-feeds) - Complete RSS setup guide

## 🛠️ Development

### Scripts

| Command | Description |
| ------- | ----------- |
| `pnpm dev` | Start development server |
| `pnpm build` | Build for production |
| `pnpm start` | Start production server |
| `pnpm lint` | Run ESLint |
| `pnpm generate:docs` | Generate Python API docs |
| `pnpm export-pdf` | Export docs to PDF |
| `pnpm export-pdf:specific <urls>` | Export specific pages |
| `pnpm export-pdf:build` | Build and export PDFs |

### Python API Documentation

Generate API documentation from Python docstrings:

```bash
# From workspace root
make docs-api

# Or manually
fumapy-generate ai_web_feeds
mv ai_web_feeds.json apps/web/
cd apps/web && pnpm generate:docs
```

See: [Python Autodoc Setup](./PYTHON_AUTODOC_SETUP.md) for quick reference

### Configuration Files

- `source.config.ts` - Fumadocs MDX configuration
- `next.config.mjs` - Next.js configuration with rewrites
- `middleware.ts` - Content negotiation middleware
- `mdx-components.tsx` - MDX component overrides
- `tsconfig.json` - TypeScript configuration
- `tailwind.config.ts` - Tailwind CSS configuration

## 📝 Content Management

### Adding Documentation

1. Create MDX files in `content/docs/`
2. Add frontmatter (title, description)
3. Write content using MDX components
4. Run `pnpm dev` to see changes

### Frontmatter Schema

Customize in `source.config.ts`:

```typescript
export const docs = defineDocs({
  docs: {
    schema: frontmatterSchema,
    postprocess: {
      includeProcessedMarkdown: true, // Required for AI integration
    },
  },
});
```

## 🎨 Customization

### Styling

- Global styles: `app/global.css`
- Tailwind config: `tailwind.config.ts`
- Component styles: Use Fumadocs UI components

### MDX Components

Customize in `mdx-components.tsx`:

```tsx
export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    // Your custom components
    ...components,
  };
}
```

### Layout

Shared layout options in `lib/layout.shared.tsx`

## 🔍 Search

Built-in search powered by Fumadocs:

- Real-time search
- Keyboard shortcuts
- Result highlighting

## 📚 Learn More

### Complete Documentation

Full guides available at:

- [Getting Started](/docs) - Overview and quick start
- [PDF Export](/docs/features/pdf-export) - Export docs as PDFs
- [AI Integration](/docs/features/ai-integration) - AI/LLM endpoints
- [llms-full.txt Format](/docs/features/llms-full-format) - Format specification
- [Quick Reference](/docs/guides/quick-reference) - Commands and endpoints
- [Testing Guide](/docs/guides/testing) - Verify your setup

### Next.js

- [Next.js Documentation](https://nextjs.org/docs)
- [Learn Next.js](https://nextjs.org/learn)

### Fumadocs

- [Fumadocs Documentation](https://fumadocs.dev)
- [Fumadocs MDX](https://fumadocs.dev/docs/mdx)
- [Fumadocs UI](https://fumadocs.dev/docs/ui)
- [AI & LLM Integration](https://fumadocs.dev/docs/ui/llms)
- [PDF Export](https://fumadocs.dev/docs/ui/export-pdf)

## 🤝 Contributing

See [`CONTRIBUTING.md`](../../CONTRIBUTING.md) in the repository root.

## 📄 License

See [`LICENSE`](../../LICENSE) in the repository root.

