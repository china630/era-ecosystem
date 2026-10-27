/**
 * One-shot / ops: list or close stale PENDING_PAY extras that the evening
 * sweep will also clear (overdue scheduledAt, or unseated created before today).
 *
 * Dry-run by default. Apply with --apply.
 *
 * Usage (from era-clinic, with DATABASE_URL):
 *   node scripts/ops/purge-stale-pending-extras.mjs
 *   node scripts/ops/purge-stale-pending-extras.mjs --apply
 *
 * Prefer waiting for POST /api/cron/procedure-no-show-sweep after dayEndHour
 * once the extended sweep is deployed. Use this only to clear a live tail now.
 */
import { PrismaClient } from "@prisma/client";

const apply = process.argv.includes("--apply");
const prisma = new PrismaClient();

function bakuYmd(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Baku",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Start of Baku calendar day as UTC Date (midnight Baku). */
function bakuDayStart(ymd) {
  return new Date(`${ymd}T00:00:00+04:00`);
}

async function main() {
  const ymd = bakuYmd();
  const start = bakuDayStart(ymd);
  const base = { status: "PENDING_PAY", inPackage: false };
  const overdue = await prisma.procedureOrder.findMany({
    where: { ...base, scheduledAt: { lt: start } },
    select: {
      id: true,
      clinicalEpisodeId: true,
      scheduledAt: true,
      resourceId: true,
      createdAt: true,
      cancelReason: true,
    },
    take: 500,
  });
  const unseated = await prisma.procedureOrder.findMany({
    where: { ...base, resourceId: null, createdAt: { lt: start } },
    select: {
      id: true,
      clinicalEpisodeId: true,
      scheduledAt: true,
      resourceId: true,
      createdAt: true,
      cancelReason: true,
    },
    take: 500,
  });
  const rows = [...overdue, ...unseated];
  const ids = [...new Set(rows.map((r) => r.id))];
  console.log(
    JSON.stringify(
      {
        bakuDay: ymd,
        dryRun: !apply,
        overdue: overdue.length,
        unseatedBeforeToday: unseated.length,
        uniqueIds: ids.length,
        sample: rows.slice(0, 20),
      },
      null,
      2,
    ),
  );
  if (!apply || ids.length === 0) {
    if (!apply) console.log("Dry-run only. Re-run with --apply to mark UNPAID_MISSED.");
    return;
  }
  await prisma.$transaction(async (tx) => {
    await tx.resourceBooking.deleteMany({
      where: { procedureOrderId: { in: ids } },
    });
    await tx.procedureOrder.updateMany({
      where: { id: { in: ids }, status: "PENDING_PAY" },
      data: {
        status: "UNPAID_MISSED",
        resourceId: null,
        cancelledAt: new Date(),
        cancelReason: "unpaid_missed_ops_purge",
      },
    });
  });
  console.log(`Marked ${ids.length} → UNPAID_MISSED (unpaid_missed_ops_purge).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
