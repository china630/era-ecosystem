/**
 * Align ProcedureType.durationMin to scheduling slot grid (ceil),
 * then fix SCHEDULED/CHECKED_IN order / booking / allocation endsAt.
 *
 * Usage (inside clinic container):
 *   node prisma/normalize-procedure-durations.cjs
 */
const { PrismaClient } = require("@prisma/client");

const SLOT = Number(process.env.SCHEDULING_SLOT_MINUTES || 5);

function alignDuration(durationMin) {
  const raw = Math.max(1, Math.floor(Number(durationMin) || 0));
  return Math.ceil(raw / SLOT) * SLOT;
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const types = await prisma.procedureType.findMany();
    let typesFixed = 0;
    const durationById = new Map();
    for (const t of types) {
      const aligned = alignDuration(t.durationMin);
      durationById.set(t.id, aligned);
      if (aligned !== t.durationMin) {
        await prisma.procedureType.update({
          where: { id: t.id },
          data: { durationMin: aligned },
        });
        typesFixed += 1;
        console.log("type", t.code, t.durationMin, "->", aligned);
      }
    }

    const orders = await prisma.procedureOrder.findMany({
      where: {
        status: { in: ["SCHEDULED", "CHECKED_IN"] },
        procedureTypeId: { not: null },
      },
      select: {
        id: true,
        scheduledAt: true,
        endsAt: true,
        procedureTypeId: true,
      },
    });

    let ordersFixed = 0;
    for (const o of orders) {
      const duration = durationById.get(o.procedureTypeId) ?? alignDuration(15);
      const endsAt = new Date(o.scheduledAt.getTime() + duration * 60_000);
      if (o.endsAt && o.endsAt.getTime() === endsAt.getTime()) continue;

      await prisma.$transaction([
        prisma.procedureOrder.update({
          where: { id: o.id },
          data: { endsAt },
        }),
        prisma.resourceBooking.updateMany({
          where: { procedureOrderId: o.id },
          data: { endsAt },
        }),
        prisma.procedureAllocation.updateMany({
          where: { procedureOrderId: o.id },
          data: { endsAt },
        }),
      ]);
      ordersFixed += 1;
    }

    console.log("NORMALIZE OK", {
      slot: SLOT,
      typesFixed,
      ordersFixed,
      ordersChecked: orders.length,
    });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
