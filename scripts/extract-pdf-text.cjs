// Minimal PDF text extractor using pdf-parse
// Usage: node scripts/extract-pdf-text.cjs "<path-to-pdf>"
const fs = require('fs');
const path = require('path');

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: node scripts/extract-pdf-text.cjs <pdf-path>');
    process.exit(2);
  }
  const resolved = path.resolve(process.cwd(), file);
  try {
    const pdf = require('pdf-parse');
    const buffer = fs.readFileSync(resolved);
    const data = await pdf(buffer);
    // Print text content; limit overly long whitespace
    const text = (data.text || '').replace(/\s+$/gm, '').trim();
    console.log(text);
  } catch (err) {
    console.error('Failed to extract PDF text:', err && err.message ? err.message : err);
    process.exit(1);
  }
}

main();

