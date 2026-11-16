/**
 * Create missing LAB-BIOCHEM-INFECT orders for OPEN courses that already have
 * a LAB_INFECT balance slot (paid auto block) but no non-cancelled lab order.
 *
 * Pure Prisma (no Nest ALS) — safe to run inside the clinic container:
 *   node scripts/backfill-infect-biochem-orders.mjs
 *   node scripts/backfill-infect-biochem-orders.mjs --apply
 */
import { PrismaClient, Prisma } from "@prisma/client";

const APPLY = process.argv.includes("--apply");
const CODE = "LAB-BIOCHEM-INFECT";
const BLOCK = "LAB_INFECT";

const prisma = new PrismaClient();

function listPrice(catalog) {
  if (!catalog) return 20;
  const list = catalog.listAmount != null ? Number(catalog.listAmount) : NaN;
  if (Number.isFinite(list) && list > 0) return list;
  const amt = catalog.amount != null ? Number(catalog.amount) : NaN;
  if (Number.isFinite(amt) && amt > 0) return amt;
  return 20;
}

async function main() {
  const episodes = await prisma.clinicalEpisode.findMany({
    where: {
      status: "OPEN",
      patientRefId: { not: null },
      programInstance: {
        is: {
          procedureLines: {
            some: { procedureCode: BLOCK, quotaTotal: { gt: 0 } },
          },
        },
      },
      labOrders: { none: { testCode: CODE, cancelledAt: null } },
    },
    orderBy: { openedAt: "desc" },
    select: {
      id: true,
      organizationId: true,
      patientRefId: true,
      reservationId: true,
      roomNumber: true,
      patientOrigin: true,
      patientRef: { select: { refCode: true } },
      programInstance: {
        select: {
          procedureLines: {
            where: { procedureCode: BLOCK },
            select: { quotaTotal: true, quotaUsed: true },
          },
        },
      },
    },
  });
  const rows = episodes.map((episode) => {
    const line = episode.programInstance?.procedureLines[0];
    return {
      episodeId: episode.id,
      organizationId: episode.organizationId,
      patientRefId: episode.patientRefId,
      reservationId: episode.reservationId,
      roomNumber: episode.roomNumber,
      patientOrigin: episode.patientOrigin,
      refCode: episode.patientRef?.refCode ?? episode.id,
      quotaTotal: line?.quotaTotal ?? 0,
      quotaUsed: line?.quotaUsed ?? 0,
    };
  });

  console.log(`candidates=${rows.length} apply=${APPLY}`);
  if (!APPLY) {
    for (const row of rows.slice(0, 15)) {
      console.log(`  ${row.refCode} episode=${row.episodeId}`);
    }
    if (rows.length > 15) console.log(`  … +${rows.length - 15} more`);
    console.log("Re-run with --apply to create orders.");
    return;
  }

  const svc = await prisma.diagnosticService.findFirst({
    where: { code: CODE, active: true },
    select: { id: true, organizationId: true },
  });
  if (!svc) {
    throw new Error(`DiagnosticService ${CODE} not found`);
  }

  let ok = 0;
  let fail = 0;
  for (const row of rows) {
    try {
      const catalog = await prisma.serviceCatalogCache.findFirst({
        where: { code: CODE, organizationId: row.organizationId },
      });
      const amount = listPrice(catalog);
      const amountDec = new Prisma.Decimal(amount.toFixed(2));
      const origin = row.patientOrigin === "WALK_IN" ? "WALK_IN" : "IN_HOUSE";

      await prisma.labOrder.create({
        data: {
          organizationId: row.organizationId,
          patientRefId: row.patientRefId,
          clinicalEpisodeId: row.episodeId,
          testCode: CODE,
          amountNet: amountDec,
          source: "IN_HOUSE",
          fasting: false,
          inPackage: false,
          packageQuotaCode: null,
          releaseAfterPay: false,
          autoPaidStay: false,
          reservationId: row.reservationId ?? undefined,
          roomNumber: row.roomNumber ?? undefined,
          patientOrigin: origin,
          status: "ORDERED",
          items: {
            create: [
              {
                organizationId: row.organizationId,
                diagnosticServiceId: svc.id,
                serviceCode: CODE,
                amountNet: amountDec,
                sortOrder: 0,
                inPackage: false,
                packageQuotaCode: null,
              },
            ],
          },
        },
      });
      ok += 1;
      console.log(`ok ${row.refCode} amount=${amount}`);
    } catch (err) {
      fail += 1;
      console.error(`fail ${row.refCode}`, err?.message ?? err);
    }
  }
  console.log(`done ok=${ok} fail=${fail}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
