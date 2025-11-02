# Web App Scripts

This directory contains utility scripts for the AIWebFeeds web application.

## 📋 Overview

Scripts for documentation generation, PDF export, and development workflows.

## � Available Scripts

### Python API Documentation Generation

**File**: `generate-python-docs.mjs`

Converts Python docstrings to MDX documentation pages.

**Usage**:

```bash
# 1. Generate JSON from Python package
fumapy-generate ai_web_feeds
mv ai_web_feeds.json apps/web/

# 2. Convert to MDX
cd apps/web
pnpm generate:docs
```

**Output**: `content/docs/api/` (auto-generated)

**See**: [Python Autodoc Documentation](/docs/development/python-autodoc) for details

______________________________________________________________________

## PDF Export Scripts

- **Navigation hiding**: Sidebars and navigation elements are hidden in print mode
- **Interactive components**: Accordions and tabs are expanded to show all content
- **Print optimization**: Proper page breaks and spacing for professional output

## 🚀 Usage

### Option 1: Export from Development Server (Recommended for testing)

1. Start the development server:

   ```bash
   pnpm dev
   ```

1. In a new terminal, run the export script:

   ```bash
   pnpm export-pdf
   ```

PDFs will be generated in the `pdfs/` directory.

### Option 2: Export from Production Build (Recommended for final export)

Run the automated build and export:

```bash
pnpm export-pdf:build
```

This will:

1. Build the site with PDF export mode enabled (`NEXT_PUBLIC_PDF_EXPORT=true`)
1. Start the production server
1. Export all pages to PDF
1. Automatically shut down the server

### Option 3: Manual Export

For more control over the process:

1. Build with PDF export mode:

   ```bash
   NEXT_PUBLIC_PDF_EXPORT=true pnpm build
   ```

1. Start the production server:

   ```bash
   pnpm start
   ```

1. In a new terminal, run the export:

   ```bash
   pnpm export-pdf
   ```

1. Stop the server when done

## 📁 Output

PDFs are saved to the `pdfs/` directory with filenames based on the page URL:

- `/docs` → `index.pdf`
- `/docs/getting-started` → `docs-getting-started.pdf`
- `/docs/api/config` → `docs-api-config.pdf`

## 🎨 Customization

### Modifying the Export Script

Edit `scripts/export-pdf.ts` to customize:

- **Page dimensions**: Change the `width` in the `page.pdf()` call
- **Margins**: Adjust the `margin` object
- **Concurrency**: Modify the `CONCURRENCY` constant to control parallel exports
- **URL filtering**: Add logic to `getAllDocUrls()` to export specific pages

### Print Styles

Print-specific styles are defined in `app/global.css`:

```css
@media print {
  /* Hide navigation */
  #nd-docs-layout {
    --fd-sidebar-width: 0px !important;
  }

  /* Additional print styles... */
}
```

### Handling Interactive Components

The `mdx-components.tsx` file contains print-friendly versions of interactive components
like Accordions and Tabs. When `NEXT_PUBLIC_PDF_EXPORT=true` is set, these components
render all content in an expanded state.

## ⚙️ Configuration

### Environment Variables

- `NEXT_PUBLIC_PDF_EXPORT`: Set to `'true'` to enable PDF-friendly rendering of
  interactive components

### TypeScript Configuration

The script uses `tsx` to run TypeScript files directly. Make sure it's installed:

```bash
pnpm add -D tsx
```

## 🐛 Troubleshooting

### Issue: PDFs are blank or incomplete

- Ensure the server is fully started before running export
- Increase the `timeout` in `page.goto()` options
- Check console logs for navigation errors

### Issue: Navigation elements visible in PDF

- Verify print styles are loaded
- Check browser dev tools print preview
- Ensure CSS is properly compiled

### Issue: Accordion/Tab content missing

- Verify `NEXT_PUBLIC_PDF_EXPORT=true` is set during build
- Check `mdx-components.tsx` is properly configured
- Rebuild the site with the environment variable

### Issue: Script fails with timeout

- Increase the `timeout` value in the script
- Reduce `CONCURRENCY` to avoid overwhelming the server
- Ensure the server has enough resources

## 📝 Notes

- The export process automatically discovers all documentation pages from the Fumadocs
  source
- Large documentation sites may take several minutes to export
- PDF quality depends on the page content and complexity
- Consider using headless mode in production for better performance
