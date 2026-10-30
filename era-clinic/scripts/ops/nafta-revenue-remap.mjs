/**
 * Clinic: remap hotel_folio / department / modality revenue code strings.
 * Usage: node scripts/ops/nafta-revenue-remap.mjs [--dry-run]
 * Env: DATABASE_URL (clinic)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
const matrix = JSON.parse(
  fs.readFileSync(path.join(root, 'scripts/ops/nafta-revenue-remap-matrix.json'), 'utf8'),
);
const dryRun = process.argv.includes('--dry-run');
const orgId = process.env.ERA_NAFTA_ORG_ID || matrix.orgId;
const prisma = new PrismaClient();

function mapCode(old) {
  if (!old) return old;
  if (matrix.codeRemap[old]) return matrix.codeRemap[old];
  if (/^(41|42|43)\d{2}$/.test(old)) {
    return matrix.fbOutletCategoryRemap[old.slice(2)] ?? old;
  }
  return old;
}

async function main() {
  const tenantCode = matrix.tenantDefaultCode;
  console.log(dryRun ? 'DRY-RUN' : 'APPLY', 'clinic org', orgId, '→ tenant', tenantCode);

  if (!dryRun) {
    await prisma.$executeRawUnsafe(
      `UPDATE "Tenant" SET hotel_folio_revenue_code = $1 WHERE "organizationId" = $2`,
      tenantCode,
      orgId,
    );

    for (const [dept, code] of Object.entries(matrix.clinicDepartmentRemap)) {
      if (dept.startsWith('_')) continue;
      await prisma.$executeRawUnsafe(
        `UPDATE service_department SET hotel_revenue_code = $1 WHERE "organizationId" = $2 AND code = $3`,
        code,
        orgId,
        dept,
      );
    }
    await prisma.$executeRawUnsafe(
      `UPDATE service_department SET hotel_revenue_code = $1
       WHERE "organizationId" = $2 AND (hotel_revenue_code IS NULL OR hotel_revenue_code = '' OR hotel_revenue_code = '2007')`,
      matrix.clinicDepartmentRemap._default,
      orgId,
    );
    // Remap any leftover old codes on departments
    const deps = await prisma.$queryRawUnsafe(
      `SELECT id, hotel_revenue_code AS code FROM service_department WHERE "organizationId" = $1`,
      orgId,
    );
    for (const row of deps) {
      const next = mapCode(row.code);
      if (next && next !== row.code) {
        await prisma.$executeRawUnsafe(
          `UPDATE service_department SET hotel_revenue_code = $1 WHERE id = $2`,
          next,
          row.id,
        );
      }
    }

    for (const [mod, code] of Object.entries(matrix.clinicModalityRemap)) {
      if (mod.startsWith('_')) continue;
      await prisma.$executeRawUnsafe(
        `UPDATE "Modality" SET hotel_revenue_code = $1 WHERE "organizationId" = $2 AND code = $3`,
        code,
        orgId,
        mod,
      );
    }
    const mods = await prisma.$queryRawUnsafe(
      `SELECT id, hotel_revenue_code AS code FROM "Modality" WHERE "organizationId" = $1`,
      orgId,
    );
    for (const row of mods) {
      const next = mapCode(row.code) || matrix.clinicModalityRemap._default;
      if (next && next !== row.code) {
        await prisma.$executeRawUnsafe(
          `UPDATE "Modality" SET hotel_revenue_code = $1 WHERE id = $2`,
          next,
          row.id,
        );
      }
    }
  }

  console.log('clinic remap done');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
