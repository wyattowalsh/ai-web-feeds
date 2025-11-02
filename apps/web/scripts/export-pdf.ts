import puppeteer from "puppeteer";
import fs from "node:fs/promises";
import path from "node:path";
import { source } from "../lib/source";

const browser = await puppeteer.launch();
const outDir = "pdfs";

/**
 * Get all documentation URLs from the source
 */
async function getAllDocUrls(): Promise<string[]> {
  const pages = source.getPages();
  return pages.map((page) => page.url);
}

/**
 * Export a single page to PDF
 */
async function exportPdf(pathname: string): Promise<void> {
  const page = await browser.newPage();

  try {
    // Set viewport for consistent rendering
    await page.setViewport({
      width: 1200,
      height: 800,
    });

    // Navigate to the page
    const url = `http://localhost:3000${pathname}`;
    console.log(`Processing: ${url}`);

    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    // Wait a bit for any dynamic content to settle
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Generate filename from pathname
    const filename =
      pathname === "/docs" ? "index.pdf" : pathname.slice(1).replaceAll("/", "-") + ".pdf";

    const outputPath = path.join(outDir, filename);

    // Export to PDF
    await page.pdf({
      path: outputPath,
      width: "950px",
      printBackground: true,
      margin: {
        top: "20px",
        right: "20px",
        bottom: "20px",
        left: "20px",
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
  console.log("Starting PDF export process...\n");

  // Create output directory
  await fs.mkdir(outDir, { recursive: true });
  console.log(`Output directory: ${path.resolve(outDir)}\n`);

  // Get all documentation URLs
  const urls = await getAllDocUrls();
  console.log(`Found ${urls.length} pages to export\n`);

  // Export all pages (with concurrency limit to avoid overwhelming the server)
  const CONCURRENCY = 3;
  for (let i = 0; i < urls.length; i += CONCURRENCY) {
    const batch = urls.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(exportPdf));
  }

  console.log(`\n✓ Successfully exported ${urls.length} PDFs to ${outDir}/`);
}

// Run the export
main()
  .catch((error) => {
    console.error("Export failed:", error);
    process.exit(1);
  })
  .finally(() => {
    browser.close();
  });
