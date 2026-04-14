import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TARGETS = [
  "app/(home)",
  "app/downloads",
  "app/explorer",
  "app/feeds",
  "app/stats",
  "components/recommendations",
  "components/search",
  "content/docs",
  "lib/layout.shared.tsx",
];

const BANNED_PHRASES = [
  { phrase: "reader-first", replacement: "describe the actual page behavior instead" },
  { phrase: "source slice", replacement: "source list or current filters" },
  { phrase: "support surface", replacement: "support page or secondary page" },
  { phrase: "support surfaces", replacement: "support pages or secondary pages" },
  { phrase: "canonical route", replacement: "main page or primary route" },
  { phrase: "machine-facing outputs", replacement: "plain-text docs or machine-readable docs" },
  { phrase: "supporting catalog explorer", replacement: "catalog explorer" },
];

const TEXT_FILE_EXTENSIONS = new Set([".ts", ".tsx", ".mdx", ".md", ".json"]);

function collectFiles(targetPath) {
  const absolutePath = path.join(ROOT, targetPath);
  if (!fs.existsSync(absolutePath)) {
    return [];
  }

  const stat = fs.statSync(absolutePath);
  if (stat.isFile()) {
    return [absolutePath];
  }

  const files = [];
  for (const entry of fs.readdirSync(absolutePath, { withFileTypes: true })) {
    const resolved = path.join(absolutePath, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(path.relative(ROOT, resolved)));
      continue;
    }

    if (TEXT_FILE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(resolved);
    }
  }

  return files;
}

const findings = [];
for (const target of TARGETS) {
  for (const filePath of collectFiles(target)) {
    const source = fs.readFileSync(filePath, "utf8");
    const lowered = source.toLowerCase();

    for (const banned of BANNED_PHRASES) {
      if (lowered.includes(banned.phrase)) {
        findings.push({
          filePath: path.relative(ROOT, filePath),
          phrase: banned.phrase,
          replacement: banned.replacement,
        });
      }
    }
  }
}

if (findings.length > 0) {
  console.error("Found banned copy phrases in user-facing web content:\n");
  for (const finding of findings) {
    console.error(`- ${finding.filePath}: \"${finding.phrase}\" -> ${finding.replacement}`);
  }
  process.exit(1);
}

console.log("Copy lexicon check passed.");
