#!/usr/bin/env node
// Deletes everything inside data/stale-data/. The folder itself is kept.
const fs = require('node:fs');
const path = require('node:path');

const STALE_DIR = path.join(__dirname, '..', 'data', 'stale-data');

function main() {
  if (!fs.existsSync(STALE_DIR)) {
    console.log(`nothing to clean: ${STALE_DIR} does not exist`);
    return;
  }

  const entries = fs.readdirSync(STALE_DIR);
  for (const name of entries) {
    fs.rmSync(path.join(STALE_DIR, name), { recursive: true, force: true });
  }
  console.log(`cleanup done: removed ${entries.length} item(s) from ${STALE_DIR}`);
}

try {
  main();
} catch (err) {
  console.error(`cleanup failed: ${err.message}`);
  process.exit(1);
}
