import puppeteer from 'puppeteer';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Export specific documentation pages to PDF
 * 
 * Usage:
 *   tsx scripts/export-pdf-specific.ts /docs/getting-started /docs/api/config
 */

const browser = await puppeteer.launch();
const outDir = 'pdfs';

// Get URLs from command line arguments
const urls = process.argv.slice(2);

if (urls.length === 0) {
  console.error('Error: No URLs provided');
  console.log('Usage: pnpm tsx scripts/export-pdf-specific.ts <url1> <url2> ...');
  console.log('Example: pnpm tsx scripts/export-pdf-specific.ts /docs /docs/getting-started');
  process.exit(1);
}

/**
 * Export a single page to PDF
 */
async function exportPdf(pathname: string): Promise<void> {
  const page = await browser.newPage();
  
  try {
    await page.setViewport({
      width: 1200,
      height: 800,
    });

    const url = `http://localhost:3000${pathname}`;
    console.log(`Processing: ${url}`);
    
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    await new Promise(resolve => setTimeout(resolve, 1000));

    const filename = pathname === '/docs' 
      ? 'index.pdf'
      : pathname.slice(1).replaceAll('/', '-') + '.pdf';
    
    const outputPath = path.join(outDir, filename);

    await page.pdf({
      path: outputPath,
      width: '950px',
      printBackground: true,
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px',
      },
    });

    console.log(`✓ PDF generated: ${filename}`);
  } catch (error) {
    console.error(`✗ Failed to export ${pathname}:`, error);
    throw error;
  } finally {
    await page.close();
  }
}

/**
 * Main export function
 */
async function main() {
  console.log('Starting PDF export...\n');
  
  await fs.mkdir(outDir, { recursive: true });
  console.log(`Output directory: ${path.resolve(outDir)}\n`);
  console.log(`Exporting ${urls.length} page(s):\n`);

  for (const url of urls) {
    await exportPdf(url);
  }

  console.log(`\n✓ Successfully exported ${urls.length} PDF(s) to ${outDir}/`);
}

main()
  .catch((error) => {
    console.error('Export failed:', error);
    process.exit(1);
  })
  .finally(() => {
    browser.close();
  });
