/**
 * Hotel Nafta revenue densify + FK remap.
 * Usage (from era-hotel-pms): node scripts/ops/nafta-revenue-remap.mjs [--dry-run]
 * Env: DATABASE_URL
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

function mapFbCode(code) {
  if (!/^(41|42|43)\d{2}$/.test(code)) return null;
  return matrix.fbOutletCategoryRemap[code.slice(2)] ?? null;
}

function resolveTargetCode(oldCode) {
  if (matrix.codeRemap[oldCode]) return matrix.codeRemap[oldCode];
  return mapFbCode(oldCode);
}

async function main() {
  const report = { upserted: 0, fkRemapped: 0, deactivated: 0, renamed: 0 };
  console.log(dryRun ? 'DRY-RUN' : 'APPLY', 'org', orgId);

  // Prisma $executeRawUnsafe allows one statement per call.
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "RevenueCode" ADD COLUMN IF NOT EXISTS "allowManualCharge" BOOLEAN NOT NULL DEFAULT true`,
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "RevenueCode" ADD COLUMN IF NOT EXISTS "allowManualPayment" BOOLEAN NOT NULL DEFAULT true`,
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "RevenueCode" ADD COLUMN IF NOT EXISTS "reportType" TEXT`,
  );

  if (!dryRun) {
    await prisma.revenueCode.updateMany({
      where: { organizationId: orgId },
      data: { systemRole: null },
    });
  }

  const targetByNew = {};
  for (const t of matrix.targetCodes) {
    const temp = `__t_${t.code}`;
    let row = await prisma.revenueCode.findFirst({
      where: { organizationId: orgId, OR: [{ code: t.code }, { code: temp }] },
    });
    if (!row) {
      if (!dryRun) {
        row = await prisma.revenueCode.create({
          data: {
            organizationId: orgId,
            code: temp,
            name: t.nameEn,
            nameEn: t.nameEn,
            nameRu: t.nameRu,
            nameAz: t.nameAz,
            taxTag: t.tax,
            active: true,
            allowManualCharge: t.allowManualCharge,
            allowManualPayment: t.allowManualPayment,
            reportType: t.reportType,
          },
        });
      }
      report.upserted += 1;
    } else if (!dryRun) {
      row = await prisma.revenueCode.update({
        where: { id: row.id },
        data: {
          name: t.nameEn,
          nameEn: t.nameEn,
          nameRu: t.nameRu,
          nameAz: t.nameAz,
          taxTag: t.tax,
          active: true,
          allowManualCharge: t.allowManualCharge,
          allowManualPayment: t.allowManualPayment,
          reportType: t.reportType,
        },
      });
      report.upserted += 1;
    }
    if (row) targetByNew[t.code] = row.id;
  }

  if (dryRun) {
    console.log('would upsert targets', Object.keys(targetByNew).length);
    await prisma.$disconnect();
    return;
  }

  const allOld = await prisma.revenueCode.findMany({
    where: { organizationId: orgId },
    select: { id: true, code: true },
  });
  const idRemap = [];
  for (const row of allOld) {
    if (row.code.startsWith('__t_')) continue;
    const targetCode = resolveTargetCode(row.code);
    if (!targetCode) continue;
    const targetId = targetByNew[targetCode];
    if (targetId && targetId !== row.id) idRemap.push([row.id, targetId]);
  }

  for (const [fromId, toId] of idRemap) {
    const ops = [
      prisma.folioCharge.updateMany({ where: { revenueCodeId: fromId }, data: { revenueCodeId: toId } }),
      prisma.folioPayment.updateMany({ where: { revenueCodeId: fromId }, data: { revenueCodeId: toId } }),
      prisma.ratePlanPackageLine.updateMany({
        where: { revenueCodeId: fromId },
        data: { revenueCodeId: toId },
      }),
      prisma.folioRoutingRule.updateMany({ where: { revenueCodeId: fromId }, data: { revenueCodeId: toId } }),
      prisma.reservationFolioRoutingOverride.updateMany({
        where: { revenueCodeId: fromId },
        data: { revenueCodeId: toId },
      }),
      prisma.addOn.updateMany({ where: { revenueCodeId: fromId }, data: { revenueCodeId: toId } }),
      prisma.ratePlan.updateMany({ where: { roomRevenueCodeId: fromId }, data: { roomRevenueCodeId: toId } }),
    ];
    const results = await Promise.all(ops);
    report.fkRemapped += results.reduce((s, r) => s + r.count, 0);
    await prisma.hotelRevenueGlMapping.deleteMany({ where: { revenueCodeId: fromId } });
  }

  // EventOrderLine if model exists
  try {
    await prisma.$executeRawUnsafe(
      `UPDATE "EventOrderLine" SET "revenueCodeId" = $1 WHERE "revenueCodeId" = $2`,
      // noop batch — done in loop below
    );
  } catch {
    /* optional table */
  }
  for (const [fromId, toId] of idRemap) {
    try {
      const n = await prisma.$executeRawUnsafe(
        `UPDATE "EventOrderLine" SET "revenueCodeId" = $1 WHERE "revenueCodeId" = $2`,
        toId,
        fromId,
      );
      report.fkRemapped += Number(n) || 0;
    } catch {
      break;
    }
  }

  for (const t of matrix.targetCodes) {
    const temp = `__t_${t.code}`;
    const tempRow = await prisma.revenueCode.findFirst({
      where: { organizationId: orgId, code: temp },
    });
    const finalRow = await prisma.revenueCode.findFirst({
      where: { organizationId: orgId, code: t.code },
    });
    let id = finalRow?.id ?? tempRow?.id;
    if (tempRow && !finalRow) {
      await prisma.revenueCode.update({ where: { id: tempRow.id }, data: { code: t.code } });
      id = tempRow.id;
      report.renamed += 1;
    } else if (tempRow && finalRow && tempRow.id !== finalRow.id) {
      // Merge remaining FKs from temp → final then delete temp
      await prisma.folioCharge.updateMany({
        where: { revenueCodeId: tempRow.id },
        data: { revenueCodeId: finalRow.id },
      });
      await prisma.hotelRevenueGlMapping.deleteMany({ where: { revenueCodeId: tempRow.id } });
      await prisma.revenueCode.delete({ where: { id: tempRow.id } }).catch(() => undefined);
      id = finalRow.id;
    }
    if (!id) continue;
    await prisma.revenueCode.update({
      where: { id },
      data: {
        systemRole: t.role,
        allowManualCharge: t.allowManualCharge,
        allowManualPayment: t.allowManualPayment,
        reportType: t.reportType,
        name: t.nameEn,
        nameEn: t.nameEn,
        nameRu: t.nameRu,
        nameAz: t.nameAz,
        taxTag: t.tax,
        active: true,
      },
    });
    await prisma.hotelRevenueGlMapping.upsert({
      where: { revenueCodeId: id },
      create: { organizationId: orgId, revenueCodeId: id, glAccountCode: t.gl },
      update: { glAccountCode: t.gl },
    });
  }

  const targetSet = matrix.targetCodes.map((t) => t.code);
  const deact = await prisma.revenueCode.updateMany({
    where: { organizationId: orgId, code: { notIn: targetSet }, active: true },
    data: { active: false, systemRole: null },
  });
  report.deactivated = deact.count;

  console.log(JSON.stringify(report, null, 2));
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
