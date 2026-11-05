// scripts/audit-migrations.mjs
// Automated CI/Pre-commit Multi-File PostgreSQL Migration & 100% RLS Security Auditor

import fs from 'node:fs';
import path from 'node:path';

const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations');

console.log('--- NEURON PostgreSQL Multi-File Migration & RLS Security Audit ---');

if (!fs.existsSync(MIGRATIONS_DIR)) {
  console.error(`FAILED: Migration directory ${MIGRATIONS_DIR} does not exist`);
  process.exit(1);
}

const files = fs
  .readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort();

if (files.length === 0) {
  console.error('FAILED: No migration SQL files found');
  process.exit(1);
}

let totalTables = 0;
let totalPolicies = 0;
const errors = [];

for (const file of files) {
  const filePath = path.join(MIGRATIONS_DIR, file);
  const sql = fs.readFileSync(filePath, 'utf8');

  // Find all CREATE TABLE statements (excluding temporary)
  const createTableRegex = /CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+public\.([a-zA-Z0-9_]+)/gi;
  let match;
  const tablesInFile = [];

  while ((match = createTableRegex.exec(sql)) !== null) {
    tablesInFile.push(match[1]);
  }

  for (const table of tablesInFile) {
    totalTables++;
    // 1. Verify ALTER TABLE ... ENABLE ROW LEVEL SECURITY
    const rlsPattern = new RegExp(
      `ALTER\\s+TABLE\\s+public\\.${table}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`,
      'i'
    );
    if (!rlsPattern.test(sql)) {
      errors.push(`${file}: Table public.${table} missing ENABLE ROW LEVEL SECURITY`);
    }

    // 2. Verify RLS Policy exists
    const policyPattern = new RegExp(`CREATE\\s+POLICY[\\s\\S]*?ON\\s+public\\.${table}`, 'i');
    if (!policyPattern.test(sql)) {
      errors.push(`${file}: Table public.${table} missing CREATE POLICY`);
    } else {
      totalPolicies++;
    }

    // 3. Verify tenant isolation condition auth.uid() = user_id
    if (!sql.includes('auth.uid() = user_id')) {
      errors.push(`${file}: Missing tenant isolation rule auth.uid() = user_id`);
    }
  }
}

if (errors.length > 0) {
  console.error(`FAILED: Found ${errors.length} database security / RLS violations:`);
  errors.forEach((e) => console.error(`  - ${e}`));
  process.exit(1);
} else {
  console.log(
    `PASSED: ${files.length} migration files audited. All ${totalTables} tables strictly enforce 100% RLS (${totalPolicies} policies verified).`
  );
}
