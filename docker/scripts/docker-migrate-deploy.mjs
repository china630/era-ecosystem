#!/usr/bin/env node
/**
 * Apply pending SQL migrations without Prisma CLI (for Docker standalone images).
 * Requires: psql in PATH, DATABASE_URL, prisma/migrations folders with migration.sql
 */
import { createHash, randomUUID } from 'crypto';
import { readdirSync, readFileSync, existsSync } from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDir = path.join(root, 'prisma', 'migrations');
let dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.error('[migrate] DATABASE_URL is not set');
  process.exit(1);
}

// psql does not accept Prisma's ?schema=public query param
try {
  const normalized = dbUrl.replace(/^postgresql:/i, 'postgres:');
  const u = new URL(normalized);
  u.searchParams.delete('schema');
  dbUrl = u.toString();
} catch {
  dbUrl = dbUrl.replace(/\?.*$/, '');
}

function psql(args, input) {
  const r = spawnSync('psql', [dbUrl, '-v', 'ON_ERROR_STOP=1', ...args], {
    encoding: 'utf8',
    input,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  if (r.status !== 0) {
    const err = r.stderr || r.stdout || `psql exit ${r.status}`;
    throw new Error(err.trim());
  }
  return r.stdout ?? '';
}

function ensureMigrationsTable() {
  psql([], `
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
  "id" VARCHAR(36) PRIMARY KEY,
  "checksum" VARCHAR(64) NOT NULL,
  "finished_at" TIMESTAMPTZ,
  "migration_name" VARCHAR(255) NOT NULL,
  "logs" TEXT,
  "rolled_back_at" TIMESTAMPTZ,
  "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "applied_steps_count" INTEGER NOT NULL DEFAULT 0
);
`);
}

function appliedNames() {
  const out = psql(['-t', '-A'], `SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL;`);
  return new Set(out.split('\n').map((s) => s.trim()).filter(Boolean));
}

function checksum(sql) {
  return createHash('sha256').update(sql).digest('hex');
}

function main() {
  if (!existsSync(migrationsDir)) {
    console.log('[migrate] no prisma/migrations directory');
    return;
  }
  ensureMigrationsTable();
  const done = appliedNames();
  const dirs = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  let count = 0;
  for (const name of dirs) {
    if (done.has(name)) continue;
    const sqlPath = path.join(migrationsDir, name, 'migration.sql');
    if (!existsSync(sqlPath)) continue;
    const sql = readFileSync(sqlPath, 'utf8');
    const sum = checksum(sql);
    console.log(`[migrate] applying ${name}…`);
    psql(['-f', sqlPath]);
    const id = randomUUID();
    psql(
      [],
      `INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, applied_steps_count)
       VALUES ('${id}', '${sum}', NOW(), '${name.replace(/'/g, "''")}', NULL, 1);`,
    );
    count += 1;
  }
  if (count === 0) {
    console.log('[migrate] database is up to date');
  } else {
    console.log(`[migrate] applied ${count} migration(s)`);
  }
}

try {
  main();
} catch (e) {
  console.error('[migrate] failed:', e.message || e);
  process.exit(1);
}
