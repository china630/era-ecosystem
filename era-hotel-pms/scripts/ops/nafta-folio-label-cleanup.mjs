/**
 * Shorten lodging revenue labels (1001 Room / 1002 Medical package) and strip
 * trailing YYYY-MM-DD from medical package FolioCharge descriptions.
 *
 * Usage (hotel container / host with DATABASE_URL):
 *   node scripts/ops/nafta-folio-label-cleanup.mjs [--dry-run]
 *   ORGANIZATION_ID=… node scripts/ops/nafta-folio-label-cleanup.mjs
 */
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const dryRun = process.argv.includes('--dry-run');
const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(__dirname, '../../package.json'));
const { PrismaClient } = require('@prisma/client');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const matrixPath = join(__dirname, '../../../scripts/ops/nafta-revenue-remap-matrix.json');
const matrix = JSON.parse(readFileSync(matrixPath, 'utf8'));
const orgId =
  process.env.ORGANIZATION_ID?.trim() ||
  process.env.ERA_SATELLITE_ORGANIZATION_ID?.trim() ||
  matrix.orgId;

const SHORT_CODES = new Set(['1001', '1002']);
const PACKAGE_NIGHT = /^(?:Package .+|Medical package) (\d{4}-\d{2}-\d{2})$/i;

const prisma = new PrismaClient();

async function main() {
  const report = { labels: 0, descriptions: 0, dryRun };

  for (const t of matrix.targetCodes) {
    if (!SHORT_CODES.has(t.code)) continue;
    const rows = await prisma.revenueCode.findMany({
      where: { organizationId: orgId, code: t.code },
      select: { id: true, name: true, nameEn: true, nameRu: true, nameAz: true },
    });
    for (const row of rows) {
      const same =
        row.name === t.nameEn &&
        row.nameEn === t.nameEn &&
        row.nameRu === t.nameRu &&
        row.nameAz === t.nameAz;
      if (same) continue;
      console.log(
        dryRun ? 'would label' : 'label',
        t.code,
        `${row.nameAz ?? row.name} → ${t.nameAz}`,
      );
      if (!dryRun) {
        await prisma.revenueCode.update({
          where: { id: row.id },
          data: {
            name: t.nameEn,
            nameEn: t.nameEn,
            nameRu: t.nameRu,
            nameAz: t.nameAz,
          },
        });
      }
      report.labels += 1;
    }
  }

  const charges = await prisma.folioCharge.findMany({
    where: { organizationId: orgId },
    select: { id: true, description: true },
  });

  for (const charge of charges) {
    const raw = (charge.description ?? '').trim();
    if (!raw || !PACKAGE_NIGHT.test(raw)) continue;
    const next = raw.replace(/\s+(\d{4}-\d{2}-\d{2})$/, '').trim();
    if (!next || next === raw) continue;
    console.log(dryRun ? 'would desc' : 'desc', charge.id.slice(0, 8), `${raw} → ${next}`);
    if (!dryRun) {
      await prisma.folioCharge.update({
        where: { id: charge.id },
        data: { description: next },
      });
    }
    report.descriptions += 1;
  }

  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
