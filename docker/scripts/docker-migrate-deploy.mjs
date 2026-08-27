#!/usr/bin/env node
/**
 * Apply pending SQL migrations without Prisma CLI (Docker standalone images).
 * Requires: psql in PATH, DATABASE_URL, prisma/migrations (+ optional prisma/baseline.sql).
 *
 * Empty database: satellites whose first SQL is ALTER (no init) cannot replay history.
 * Images built with docker/Dockerfile.satellite ship prisma/baseline.sql (current schema).
 * We apply that once, then stamp every migration folder as applied.
 */
import { createHash, randomUUID } from 'crypto';
import { readdirSync, readFileSync, existsSync } from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const LOCK_KEY = 87261401;
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDir = path.join(root, 'prisma', 'migrations');
const baselinePath = path.join(root, 'prisma', 'baseline.sql');
let dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.error('[migrate] DATABASE_URL is not set');
  process.exit(1);
}

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
  psql(
    [],
    `
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
`,
  );
}

function appliedNames() {
  const out = psql(
    ['-t', '-A'],
    `SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL;`,
  );
  return new Set(
    out
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

function publicRelationCount() {
  const out = psql(
    ['-t', '-A'],
    `SELECT count(*)::text FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
       AND table_name <> '_prisma_migrations';`,
  );
  return Number.parseInt(out.trim(), 10) || 0;
}

function checksum(sql) {
  return createHash('sha256').update(sql).digest('hex');
}

function listMigrationDirs() {
  if (!existsSync(migrationsDir)) return [];
  return readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

function stamp(name, sql) {
  const sum = checksum(sql);
  const id = randomUUID();
  psql(
    [],
    `INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, applied_steps_count)
     VALUES ('${id}', '${sum}', NOW(), '${name.replace(/'/g, "''")}', NULL, 1)
     ON CONFLICT (id) DO NOTHING;`,
  );
}

function stampMissing(dirs, done) {
  let n = 0;
  for (const name of dirs) {
    if (done.has(name)) continue;
    const sqlPath = path.join(migrationsDir, name, 'migration.sql');
    if (!existsSync(sqlPath)) continue;
    stamp(name, readFileSync(sqlPath, 'utf8'));
    n += 1;
  }
  return n;
}

function applyBaselineAndStamp(dirs) {
  if (!existsSync(baselinePath)) {
    throw new Error(
      '[migrate] empty database but prisma/baseline.sql is missing — rebuild the satellite image (Dockerfile.satellite generates it)',
    );
  }
  console.log('[migrate] empty database — applying prisma/baseline.sql (current schema)');
  psql(['-f', baselinePath]);
  const stamped = stampMissing(dirs, new Set());
  console.log(`[migrate] baselined and stamped ${stamped} migration(s)`);
}

function applyPending(dirs, done) {
  let count = 0;
  for (const name of dirs) {
    if (done.has(name)) continue;
    const sqlPath = path.join(migrationsDir, name, 'migration.sql');
    if (!existsSync(sqlPath)) continue;
    const sql = readFileSync(sqlPath, 'utf8');
    console.log(`[migrate] applying ${name}…`);
    psql(['-f', sqlPath]);
    stamp(name, sql);
    count += 1;
  }
  if (count === 0) {
    console.log('[migrate] database is up to date');
  } else {
    console.log(`[migrate] applied ${count} migration(s)`);
  }
}

function migrate() {
  if (!existsSync(migrationsDir)) {
    console.log('[migrate] no prisma/migrations directory');
    return;
  }
  psql([], `SELECT pg_advisory_lock(${LOCK_KEY});`);
  try {
    ensureMigrationsTable();
    const done = appliedNames();
    const dirs = listMigrationDirs();
    const tables = publicRelationCount();

    if (done.size === 0 && tables === 0) {
      if (existsSync(baselinePath)) {
        applyBaselineAndStamp(dirs);
        return;
      }
      applyPending(dirs, done);
      return;
    }
    if (done.size === 0 && tables > 0) {
      const n = stampMissing(dirs, done);
      console.log(`[migrate] existing schema without history — stamped ${n} migration(s)`);
      return;
    }
    applyPending(dirs, done);
  } finally {
    try {
      psql([], `SELECT pg_advisory_unlock(${LOCK_KEY});`);
    } catch {
      // unlock best-effort
    }
  }
}

try {
  migrate();
} catch (e) {
  console.error('[migrate] failed:', e.message || e);
  process.exit(1);
}
