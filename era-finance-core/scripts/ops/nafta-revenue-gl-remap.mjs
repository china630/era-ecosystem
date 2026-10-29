/**
 * Finance NAS: densify hotel revenue leaves + remap journal lines off retired accounts.
 * Usage: node era-finance-core/scripts/ops/nafta-revenue-gl-remap.mjs [--dry-run]
 * Env: DATABASE_URL (finance)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const matrixPath = path.join(root, '../scripts/ops/nafta-revenue-remap-matrix.json');
const matrix = JSON.parse(fs.readFileSync(matrixPath, 'utf8'));
const dryRun = process.argv.includes('--dry-run');
const orgId = process.env.ERA_NAFTA_ORG_ID || matrix.orgId;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const TARGET_ACCOUNTS = [
  { code: '601.01', nameAz: 'Otel gəliri', nameRu: 'Выручка отеля', nameEn: 'Hotel revenue', parent: '601' },
  { code: '601.02', nameAz: 'Klinika gəliri', nameRu: 'Выручка клиники', nameEn: 'Clinic revenue', parent: '601' },
  { code: '601.03', nameAz: 'Mağaza gəliri', nameRu: 'Выручка магазина', nameEn: 'Shop revenue', parent: '601' },
  { code: '601.04', nameAz: 'F&B gəliri', nameRu: 'Выручка F&B', nameEn: 'F&B revenue', parent: '601' },
  { code: '521.01', nameAz: 'Turist rüsumu', nameRu: 'Туристический сбор', nameEn: 'City tax', parent: '521' },
  ...matrix.targetCodes.map((t) => ({
    code: t.gl,
    nameAz: t.nameAz,
    nameRu: t.nameRu,
    nameEn: t.nameEn,
    parent: t.gl.startsWith('521') ? '521' : t.gl.split('.').slice(0, 2).join('.'),
  })),
];

async function main() {
  console.log(dryRun ? 'DRY-RUN' : 'APPLY', 'finance org', orgId);
  const report = { ensured: 0, journalsMoved: 0, retired: 0 };

  const books = await prisma.accountingBook.findMany({
    where: { organizationId: orgId },
    select: { id: true },
  });
  if (books.length === 0) {
    console.warn('No accounting book for org; skip');
    await prisma.$disconnect();
    return;
  }

  for (const book of books) {
    const byCode = new Map(
      (
        await prisma.account.findMany({
          where: { organizationId: orgId, accountingBookId: book.id, ledgerType: 'NAS' },
          select: { id: true, code: true, type: true, parentId: true },
        })
      ).map((a) => [a.code, a]),
    );

    // Ensure parents then leaves
    for (const level of [1, 2]) {
      for (const t of TARGET_ACCOUNTS) {
        const depth = t.code.split('.').length;
        if (level === 1 && depth !== 2) continue;
        if (level === 2 && depth < 3 && t.code !== '521.01') continue;
        if (level === 2 && depth === 2 && t.code !== '521.01') continue;
        if (byCode.has(t.code)) {
          if (!dryRun) {
            await prisma.account.update({
              where: { id: byCode.get(t.code).id },
              data: { nameAz: t.nameAz, nameRu: t.nameRu, nameEn: t.nameEn, deletedAt: null },
            });
          }
          report.ensured += 1;
          continue;
        }
        const parent = byCode.get(t.parent);
        if (!parent && t.parent !== '601' && t.parent !== '521') {
          console.warn('missing parent', t.parent, 'for', t.code);
          continue;
        }
        // Parent 601 / 521 must exist in chart
        const parentRow =
          parent ||
          byCode.get(t.parent) ||
          (await prisma.account.findFirst({
            where: { organizationId: orgId, accountingBookId: book.id, code: t.parent, ledgerType: 'NAS' },
          }));
        if (!parentRow) {
          console.warn('skip', t.code, 'no parent', t.parent);
          continue;
        }
        if (!dryRun) {
          const created = await prisma.account.create({
            data: {
              organizationId: orgId,
              accountingBookId: book.id,
              code: t.code,
              nameAz: t.nameAz,
              nameRu: t.nameRu,
              nameEn: t.nameEn,
              type: parentRow.type,
              currency: 'AZN',
              ledgerType: 'NAS',
              parentId: parentRow.id,
            },
          });
          byCode.set(t.code, created);
        }
        report.ensured += 1;
      }
    }

    // Refresh map
    const accounts = await prisma.account.findMany({
      where: { organizationId: orgId, accountingBookId: book.id, ledgerType: 'NAS' },
      select: { id: true, code: true },
    });
    const idByCode = new Map(accounts.map((a) => [a.code, a.id]));

    for (const [oldGl, newGl] of Object.entries(matrix.glRemap)) {
      if (oldGl === newGl) continue;
      const fromId = idByCode.get(oldGl);
      const toId = idByCode.get(newGl);
      if (!fromId || !toId || fromId === toId) continue;
      if (!dryRun) {
        const moved = await prisma.journalEntry.updateMany({
          where: { organizationId: orgId, accountId: fromId },
          data: { accountId: toId },
        });
        report.journalsMoved += moved.count;
        await prisma.account.update({
          where: { id: fromId },
          data: { deletedAt: new Date(), deletedReason: 'nafta-revenue-gl-remap' },
        });
        report.retired += 1;
      } else {
        console.log('would move journals', oldGl, '→', newGl);
      }
    }
  }

  console.log(JSON.stringify(report, null, 2));
  await prisma.$disconnect();
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect().catch(() => undefined);
  await pool.end().catch(() => undefined);
  process.exit(1);
});
