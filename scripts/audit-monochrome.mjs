// scripts/audit-monochrome.mjs
// Automated CI/Pre-commit Zero-Hue Monochrome AST & Token Auditor

import fs from 'node:fs';
import path from 'node:path';

const SRC_DIR = path.join(process.cwd(), 'src');
const FORBIDDEN_REGEX = /\b(text|bg|border|ring|fill|stroke)-(red|blue|green|emerald|yellow|amber|orange|purple|violet|pink|rose|cyan|teal|indigo)-[0-9]+/i;

function walkDir(dir, callback) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath, callback);
    } else if (/\.(tsx|ts|jsx|js)$/.test(entry.name)) {
      callback(fullPath);
    }
  }
}

console.log('--- NEURON Monochrome AST & Token Compliance Audit ---');
let totalScanned = 0;
const violations = [];

walkDir(SRC_DIR, (filePath) => {
  totalScanned++;
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, index) => {
    const match = line.match(FORBIDDEN_REGEX);
    if (match) {
      violations.push({
        file: path.relative(process.cwd(), filePath),
        line: index + 1,
        token: match[0],
      });
    }
  });
});

if (violations.length > 0) {
  console.error(`FAILED: Found ${violations.length} chromatic token violations:`);
  violations.forEach((v) => {
    console.error(`  ${v.file}:${v.line} -> Forbidden token "${v.token}"`);
  });
  process.exit(1);
} else {
  console.log(`PASSED: All ${totalScanned} source files strictly comply with zero-hue monochrome standards.`);
}
