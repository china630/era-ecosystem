/**
 * Wave 0: delete outlet code RESTAURANT; ensure NAFTANI (+ optional XUDMANI).
 *
 *   ERA_SATELLITE_ORGANIZATION_ID=<org> npx tsx scripts/ops/kill-restaurant-outlet.ts
 *   ERA_SATELLITE_ORGANIZATION_ID=<org> ENSURE_XUDMANI=1 npx tsx scripts/ops/kill-restaurant-outlet.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const organizationId = process.env.ERA_SATELLITE_ORGANIZATION_ID?.trim();
  if (!organizationId) {
    throw new Error("ERA_SATELLITE_ORGANIZATION_ID is required");
  }

  const restaurant = await prisma.outlet.findFirst({
    where: { organizationId, code: "RESTAURANT" },
  });
  if (restaurant) {
    const openShifts = await prisma.posShift.count({
      where: { outletId: restaurant.id, status: "OPEN" },
    });
    if (openShifts > 0) {
      throw new Error(`RESTAURANT has ${openShifts} OPEN shift(s) — close first`);
    }
    await prisma.outlet.delete({ where: { id: restaurant.id } });
    console.log("deleted outlet RESTAURANT", restaurant.id);
  } else {
    console.log("no RESTAURANT outlet");
  }

  const naftani = await prisma.outlet.upsert({
    where: { organizationId_code: { organizationId, code: "NAFTANI" } },
    update: {
      active: true,
      name: "Naftani",
      shapeHint: "restaurant",
      capTill: true,
      capTables: true,
      capBuffetPlanner: true,
    },
    create: {
      organizationId,
      code: "NAFTANI",
      name: "Naftani",
      shapeHint: "restaurant",
      capTill: true,
      capTables: true,
      capBuffetPlanner: true,
    },
  });
  console.log("ensured NAFTANI", naftani.id);

  if (process.env.ENSURE_XUDMANI === "1") {
    const x = await prisma.outlet.upsert({
      where: { organizationId_code: { organizationId, code: "XUDMANI" } },
      update: {
        active: true,
        name: "Xudmani Kafe",
        shapeHint: "cafe",
        capTill: true,
        capTables: true,
        capBuffetPlanner: false,
      },
      create: {
        organizationId,
        code: "XUDMANI",
        name: "Xudmani Kafe",
        shapeHint: "cafe",
        capTill: true,
        capTables: true,
        capBuffetPlanner: false,
      },
    });
    console.log("ensured XUDMANI", x.id);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
