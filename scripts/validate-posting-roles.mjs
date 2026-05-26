#!/usr/bin/env node
/**
 * CI: posting role presets must reference accounts in chart JSON (or runtime allowlist).
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dbPkg = join(dirname(fileURLToPath(import.meta.url)), "..", "era-finance-core", "packages", "database");

const r = spawnSync("npx", ["tsx", "prisma/scripts/validate-posting-roles.ts"], {
  cwd: dbPkg,
  stdio: "inherit",
  shell: true,
});

process.exit(r.status ?? 1);
