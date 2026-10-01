/**
 * Run Elektraweb hotel import pack from a directory (wizard order #03–#15).
 *
 * Usage:
 *   npx tsx scripts/ops/import-hotel-pack.ts /path/to/hotel --org=<uuid> [--dry-run] [--from=guests]
 *   (or ERA_SATELLITE_ORGANIZATION_ID=<uuid> instead of --org)
 *
 * Runs inside that org's tenant context — the kit filter stays on.
 *
 * File name hints (first match wins):
 *   *Revenue* *Bed* *Room*View* *Room*Type* *Rate* *Rooms* *Agenc*
 *   *Guest* *Reservation* *Note* *Folio* *Package* *Agency*Statement*
 */
import fs from 'node:fs';
import path from 'node:path';
import { isSentinelOrganizationId, runWithSatelliteTenant } from '@era/satellite-kit';
import { listImportEntities, getImportAdapter } from '../../src/lib/import/adapters';
import { runImport, runImportBuffers } from '../../src/lib/import/run-import';

const dryRun = process.argv.includes('--dry-run');
const fromArg = process.argv.find((a) => a.startsWith('--from='))?.slice(7);
const packArg = process.argv.find((a) => !a.startsWith('-') && fs.existsSync(a));
const organizationId =
  process.argv.find((a) => a.startsWith('--org='))?.slice(6)?.trim() ||
  process.env.ERA_SATELLITE_ORGANIZATION_ID?.trim() ||
  '';

if (!packArg) {
  console.error(
    'Usage: npx tsx scripts/ops/import-hotel-pack.ts <packDir> --org=<uuid> [--dry-run] [--from=entity]',
  );
  process.exit(1);
}
if (!organizationId || isSentinelOrganizationId(organizationId)) {
  console.error('Pass --org=<uuid> or ERA_SATELLITE_ORGANIZATION_ID (real org UUID)');
  process.exit(1);
}

const packDir: string = packArg;

function findFiles(dir: string, pattern: RegExp): string[] {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && /\.xlsx$/i.test(e.name) && pattern.test(e.name))
    .map((e) => path.join(dir, e.name))
    .sort();
}

async function importEntity(entity: string, files: string[]) {
  const adapter = getImportAdapter(entity);
  if (!adapter) throw new Error(`Unknown entity ${entity}`);
  if (!files.length) {
    console.log(`SKIP ${entity} — no file in ${packDir}`);
    return;
  }
  console.log(`\n=== ${entity} (${files.length} file(s)) ===`);
  const buffers = files.map((f) => fs.readFileSync(f));
  const result =
    files.length > 1 || adapter.allowMultiple
      ? await runImportBuffers(adapter, buffers, dryRun)
      : await runImport(adapter, buffers[0]!, dryRun);
  console.log(JSON.stringify(result, null, 2));
  if (result.errors.length) {
    throw new Error(`${entity}: ${result.errors.length} row errors`);
  }
}

const FILE_PATTERNS: Record<string, RegExp> = {
  'revenue-codes': /revenue|03-/i,
  'bed-types': /bed.?type|04-/i,
  'room-views': /room.?view|05-/i,
  'room-types': /room.?type|06-/i,
  'rate-plans': /rate|07-/i,
  rooms: /^(?!.*room.?type).*rooms|08-/i,
  agencies: /agenc|travel|09-/i,
  guests: /guest|10-/i,
  reservations: /reservation(?!.*note)|11-/i,
  'reservation-notes': /note|12-/i,
  folios: /folio|13-/i,
  'package-sell': /package|14-/i,
  'agency-statement': /agency.?statement|15-/i,
};

async function main() {
  const entities = listImportEntities()
    .sort((a, b) => a.order - b.order)
    .map((e) => e.entity);
  const fromIdx = fromArg ? entities.indexOf(fromArg) : 0;
  if (fromArg && fromIdx < 0) {
    throw new Error(`Unknown --from entity: ${fromArg}`);
  }
  const startIdx = fromArg ? fromIdx : 0;

  console.log(`${dryRun ? '[dry-run] ' : ''}Import pack: ${packDir} (org ${organizationId})`);
  for (const entity of entities.slice(startIdx)) {
    const pattern = FILE_PATTERNS[entity];
    const files = pattern ? findFiles(packDir, pattern) : [];
    await importEntity(entity, files);
  }
}

runWithSatelliteTenant({ organizationId }, main).catch((e) => {
  console.error(e);
  process.exit(1);
});
