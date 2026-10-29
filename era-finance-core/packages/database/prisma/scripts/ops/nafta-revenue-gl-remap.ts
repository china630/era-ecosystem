/**
 * Finance NAS densify + remap journal lines for Nafta revenue catalog v2.
 * Run from @erafinance/database with DATABASE_URL:
 *   npx tsx prisma/scripts/ops/nafta-revenue-gl-remap.ts [--dry-run]
 */
import fs from 'node:fs';
import path from 'node:path';
import { closePrismaPool, createPrismaClient } from '../../../prisma-client';

const dryRun = process.argv.includes('--dry-run');
const matrixPath = path.resolve(
  __dirname,
  '../../../../../../scripts/ops/nafta-revenue-remap-matrix.json',
);
const matrix = JSON.parse(fs.readFileSync(matrixPath, 'utf8'));
const orgId = process.env.ERA_NAFTA_ORG_ID || matrix.orgId;
const prisma = createPrismaClient();

async function main() {
  console.log(dryRun ? 'DRY-RUN' : 'APPLY', 'finance org', orgId);
  const report = { ensured: 0, journalsMoved: 0, retired: 0 };

  const books = await prisma.accountingBook.findMany({
    where: { organizationId: orgId },
    select: { id: true },
  });
  if (books.length === 0) {
    console.warn('No accounting book for org; skip');
    return;
  }

  const leafSpecs = matrix.targetCodes.map(
    (t: {
      gl: string;
      nameAz: string;
      nameRu: string;
      nameEn: string;
    }) => ({
      code: t.gl,
      nameAz: t.nameAz,
      nameRu: t.nameRu,
      nameEn: t.nameEn,
      parent: t.gl.startsWith('521') ? '521' : t.gl.split('.').slice(0, 2).join('.'),
    }),
  );

  for (const book of books) {
    const byCode = new Map(
      (
        await prisma.account.findMany({
          where: { organizationId: orgId, accountingBookId: book.id, ledgerType: 'NAS' },
          select: { id: true, code: true, type: true },
        })
      ).map((a) => [a.code, a]),
    );

    for (const t of leafSpecs) {
      const existing = byCode.get(t.code);
      if (existing) {
        if (!dryRun) {
          await prisma.account.update({
            where: { id: existing.id },
            data: {
              nameAz: t.nameAz,
              nameRu: t.nameRu,
              nameEn: t.nameEn,
              deletedAt: null,
              deletedReason: null,
            },
          });
        }
        report.ensured += 1;
        continue;
      }
      const parent = byCode.get(t.parent);
      if (!parent) {
        console.warn('skip', t.code, 'missing parent', t.parent);
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
            type: parent.type,
            currency: 'AZN',
            ledgerType: 'NAS',
            parentId: parent.id,
          },
        });
        byCode.set(t.code, created);
      }
      report.ensured += 1;
    }

    const accounts = await prisma.account.findMany({
      where: { organizationId: orgId, accountingBookId: book.id, ledgerType: 'NAS' },
      select: { id: true, code: true },
    });
    const idByCode = new Map(accounts.map((a) => [a.code, a.id]));

    for (const [oldGl, newGl] of Object.entries(matrix.glRemap as Record<string, string>)) {
      if (oldGl === newGl) continue;
      const fromId = idByCode.get(oldGl);
      const toId = idByCode.get(newGl);
      if (!fromId || !toId || fromId === toId) continue;
      if (dryRun) {
        console.log('would move', oldGl, '→', newGl);
        continue;
      }
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
    }
  }

  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePrismaPool();
  });
