/**
 * F&B POS lab demo — waiter/manager users, RESTAURANT + BANQUET outlets, tables, sample menu.
 * Never entrypoint / RUN_SEED. Use: npm run db:seed:demo
 * Requires ERA_SATELLITE_ORGANIZATION_ID (demo-org forbidden).
 */
import { Prisma, PrismaClient } from "@prisma/client";
import { createSatelliteTenantExtension, hashPassword } from "@era/satellite-kit";

const prisma = new PrismaClient().$extends(
  createSatelliteTenantExtension(Prisma as never) as never,
) as unknown as PrismaClient;

function requireSeedOrgId(): string {
  const id =
    process.env.ERA_SATELLITE_ORGANIZATION_ID?.trim() ||
    process.env.ORGANIZATION_ID?.trim() ||
    "";
  if (!id || id === "demo-org" || id === "demo-clinic-org" || id === "demo-bank-org-001") {
    throw new Error(
      "ERA_SATELLITE_ORGANIZATION_ID required for fnb db:seed:demo; demo-org is forbidden",
    );
  }
  return id;
}

async function main() {
  const organizationId = requireSeedOrgId();
  process.env.ERA_SATELLITE_ORGANIZATION_ID = organizationId;

  const waiterRole = await prisma.role.upsert({
    where: { organizationId_code: { organizationId, code: "FB_WAITER" } },
    update: {},
    create: {
      organizationId,
      code: "FB_WAITER",
      name: "Waiter",
    },
  });
  const managerRole = await prisma.role.upsert({
    where: { organizationId_code: { organizationId, code: "FB_MANAGER" } },
    update: {},
    create: {
      organizationId,
      code: "FB_MANAGER",
      name: "Floor manager",
    },
  });
  await prisma.role.upsert({
    where: { organizationId_code: { organizationId, code: "FB_CASHIER" } },
    update: {},
    create: { organizationId, code: "FB_CASHIER", name: "Cashier" },
  });
  await prisma.role.upsert({
    where: { organizationId_code: { organizationId, code: "FB_KITCHEN" } },
    update: {},
    create: { organizationId, code: "FB_KITCHEN", name: "Kitchen" },
  });

  const waiterHash = await hashPassword("waiter");
  const managerHash = await hashPassword("manager");

  await prisma.user.upsert({
    where: { organizationId_login: { organizationId, login: "waiter" } },
    update: { passwordHash: waiterHash, roleId: waiterRole.id },
    create: {
      organizationId,
      login: "waiter",
      fullName: "Demo Waiter",
      passwordHash: waiterHash,
      roleId: waiterRole.id,
    },
  });
  await prisma.user.upsert({
    where: { organizationId_login: { organizationId, login: "manager" } },
    update: { passwordHash: managerHash, roleId: managerRole.id },
    create: {
      organizationId,
      login: "manager",
      fullName: "Demo Manager",
      passwordHash: managerHash,
      roleId: managerRole.id,
    },
  });

  const outlet = await prisma.outlet.upsert({
    where: { organizationId_code: { organizationId, code: "RESTAURANT" } },
    update: {},
    create: {
      organizationId,
      code: "RESTAURANT",
      name: "Main Restaurant",
      revenueCenterCode: "FOOD",
    },
  });

  for (const code of ["T-01", "T-02", "T-03", "T-04"]) {
    await prisma.posTable.upsert({
      where: { outletId_code: { outletId: outlet.id, code } },
      update: {},
      create: {
        outletId: outlet.id,
        organizationId,
        code,
        name: `Table ${code}`,
        seats: 4,
      },
    });
  }

  let cat = await prisma.menuCategory.findFirst({
    where: { organizationId, outletId: outlet.id, name: "Mains" },
  });
  if (!cat) {
    cat = await prisma.menuCategory.create({
      data: {
        organizationId,
        outletId: outlet.id,
        name: "Mains",
        sortOrder: 1,
      },
    });
  }

  await prisma.menuItem.upsert({
    where: { categoryId_plu: { categoryId: cat.id, plu: "PLU-001" } },
    update: {},
    create: {
      organizationId,
      categoryId: cat.id,
      plu: "PLU-001",
      name: "Grilled chicken",
      priceAzn: 18.5,
    },
  });
  await prisma.menuItem.upsert({
    where: { categoryId_plu: { categoryId: cat.id, plu: "PLU-002" } },
    update: {},
    create: {
      organizationId,
      categoryId: cat.id,
      plu: "PLU-002",
      name: "Caesar salad",
      priceAzn: 12.0,
    },
  });

  const banquetOutlet = await prisma.outlet.upsert({
    where: { organizationId_code: { organizationId, code: "BANQUET" } },
    update: {},
    create: {
      organizationId,
      code: "BANQUET",
      name: "Banquet service",
      revenueCenterCode: "FOOD",
    },
  });

  let banquetCat = await prisma.menuCategory.findFirst({
    where: { organizationId, outletId: banquetOutlet.id, name: "Extras" },
  });
  if (!banquetCat) {
    banquetCat = await prisma.menuCategory.create({
      data: {
        organizationId,
        outletId: banquetOutlet.id,
        name: "Extras",
        sortOrder: 1,
      },
    });
  }

  await prisma.menuItem.upsert({
    where: { categoryId_plu: { categoryId: banquetCat.id, plu: "BQ-EXTRA-01" } },
    update: {},
    create: {
      organizationId,
      categoryId: banquetCat.id,
      plu: "BQ-EXTRA-01",
      name: "Banquet extra course",
      priceAzn: 15.0,
    },
  });

  const items = await prisma.menuItem.findMany({
    where: { organizationId },
    select: { id: true, priceAzn: true },
  });
  for (const item of items) {
    const hasPrice = await prisma.menuItemPrice.findFirst({
      where: { menuItemId: item.id, effectiveTo: null },
    });
    if (!hasPrice) {
      await prisma.menuItemPrice.create({
        data: {
          menuItemId: item.id,
          priceAzn: item.priceAzn,
          effectiveFrom: new Date(),
        },
      });
    }
  }

  console.log(`era-fnb-pos demo seed OK for org ${organizationId}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
