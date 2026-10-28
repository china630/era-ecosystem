/**
 * F&B: remap outlet / category / dish revenue codes 41xx–43xx → 4001–4007.
 * Usage: node scripts/ops/nafta-revenue-remap.mjs [--dry-run]
 * Env: DATABASE_URL (fnb)
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
    return matrix.fbOutletCategoryRemap[old.slice(2)] ?? '4001';
  }
  if (old === 'FOOD') return '4001';
  return old;
}

async function main() {
  console.log(dryRun ? 'DRY-RUN' : 'APPLY', 'fnb org', orgId);
  let updated = 0;

  const outlets = await prisma.outlet.findMany({
    where: { organizationId: orgId },
    select: { id: true, revenueCenterCode: true, code: true },
  });
  for (const o of outlets) {
    const next = mapCode(o.revenueCenterCode) || '4001';
    if (next !== o.revenueCenterCode) {
      console.log('outlet', o.code, o.revenueCenterCode, '→', next);
      if (!dryRun) {
        await prisma.outlet.update({
          where: { id: o.id },
          data: { revenueCenterCode: next },
        });
      }
      updated += 1;
    }
  }

  // MenuCategory.revenueCode / MenuItem.revenueCode if present
  try {
    const cats = await prisma.$queryRawUnsafe(
      `SELECT id, revenue_code AS code FROM menu_categories WHERE organization_id = $1 AND revenue_code IS NOT NULL`,
      orgId,
    );
    for (const row of cats) {
      const next = mapCode(row.code);
      if (next && next !== row.code) {
        if (!dryRun) {
          await prisma.$executeRawUnsafe(
            `UPDATE menu_categories SET revenue_code = $1 WHERE id = $2`,
            next,
            row.id,
          );
        }
        updated += 1;
      }
    }
  } catch (e) {
    console.log('menu_categories skip', e.message);
  }

  try {
    const items = await prisma.$queryRawUnsafe(
      `SELECT id, revenue_code AS code FROM menu_items WHERE organization_id = $1 AND revenue_code IS NOT NULL`,
      orgId,
    );
    for (const row of items) {
      const next = mapCode(row.code);
      if (next && next !== row.code) {
        if (!dryRun) {
          await prisma.$executeRawUnsafe(
            `UPDATE menu_items SET revenue_code = $1 WHERE id = $2`,
            next,
            row.id,
          );
        }
        updated += 1;
      }
    }
  } catch (e) {
    console.log('menu_items skip', e.message);
  }

  console.log({ updated });
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
