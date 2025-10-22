import { rimraf } from 'rimraf';
import * as Python from 'fumadocs-python';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

/**
 * Generate Python API documentation from JSON output
 * 
 * This script converts Python docstrings to MDX format using fumadocs-python.
 * 
 * Prerequisites:
 * 1. Install fumadocs-python: pip install fumadocs-python
 * 2. Generate JSON: fumapy-generate ai_web_feeds
 * 
 * Usage:
 *   pnpm generate:docs
 */

// Configuration
const PACKAGE_NAME = 'ai_web_feeds';
const JSON_PATH = path.join(process.cwd(), `${PACKAGE_NAME}.json`);
const OUTPUT_DIR = path.join(process.cwd(), 'content/docs/api');
const BASE_URL = '/docs/api';

async function generate() {
  try {
    console.log('🔍 Reading Python docs from:', JSON_PATH);
    
    // Check if JSON file exists
    try {
      await fs.access(JSON_PATH);
    } catch (error) {
      console.error(`❌ JSON file not found: ${JSON_PATH}`);
      console.log(`\n📝 To generate the JSON file, run:`);
      console.log(`   pip install fumadocs-python`);
      console.log(`   fumapy-generate ${PACKAGE_NAME}`);
      process.exit(1);
    }

    // Clean previous output
    console.log('🧹 Cleaning previous output...');
    await rimraf(OUTPUT_DIR);

    // Read and parse JSON
    const content = JSON.parse((await fs.readFile(JSON_PATH)).toString());
    
    // Convert to MDX
    console.log('🔄 Converting to MDX...');
    const converted = Python.convert(content, {
      baseUrl: BASE_URL,
    });

    // Write MDX files
    console.log('✍️  Writing MDX files...');
    await Python.write(converted, {
      outDir: OUTPUT_DIR,
    });

    console.log(`✅ Successfully generated docs in: ${OUTPUT_DIR}`);
    console.log(`📚 View at: http://localhost:3000${BASE_URL}`);
  } catch (error) {
    console.error('❌ Error generating docs:', error);
    process.exit(1);
  }
}

// Run generation
void generate();
