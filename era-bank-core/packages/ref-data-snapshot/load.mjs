#!/usr/bin/env node
/**
 * On-prem reference data loader — validates bundled snapshot.json for bank-core dev.
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const path = join(process.cwd(), "packages/ref-data-snapshot/snapshot.json");
if (!existsSync(path)) {
  console.error(`Snapshot not found: ${path}`);
  process.exit(1);
}
const snap = JSON.parse(readFileSync(path, "utf8"));
console.info(JSON.stringify({ loaded: true, version: snap.version, fxRates: snap.fxRates?.length ?? 0 }, null, 2));
