import { Prisma, PrismaClient } from "@prisma/client";
import { createSatelliteTenantExtension, hashPassword } from "@era/satellite-kit";

const prisma = new PrismaClient().$extends(
  createSatelliteTenantExtension(Prisma as never) as never,
) as unknown as PrismaClient;

async function main() {
  const waiterRole = await prisma.role.upsert({
    where: { code: "FB_WAITER" },
    update: {},
    create: { code: "FB_WAITER", name: "Waiter" },
  });
  const managerRole = await prisma.role.upsert({
    where: { code: "FB_MANAGER" },
    update: {},
    create: { code: "FB_MANAGER", name: "Floor manager" },
  });

  const waiterHash = await hashPassword("waiter");
  const managerHash = await hashPassword("manager");

  await prisma.user.upsert({
    where: { login: "waiter" },
    update: { passwordHash: waiterHash },
    create: {
      login: "waiter",
      fullName: "Demo Waiter",
      passwordHash: waiterHash,
      roleId: waiterRole.id,
    },
  });
  await prisma.user.upsert({
    where: { login: "manager" },
    update: { passwordHash: managerHash },
    create: {
      login: "manager",
      fullName: "Demo Manager",
      passwordHash: managerHash,
      roleId: managerRole.id,
    },
  });

  const outlet = await prisma.outlet.upsert({
    where: { code: "RESTAURANT" },
    update: {},
    create: {
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
        code,
        name: `Table ${code}`,
        seats: 4,
      },
    });
  }

  let cat = await prisma.menuCategory.findFirst({
    where: { outletId: outlet.id, name: "Mains" },
  });
  if (!cat) {
    cat = await prisma.menuCategory.create({
      data: { outletId: outlet.id, name: "Mains", sortOrder: 1 },
    });
  }

  await prisma.menuItem.upsert({
    where: { categoryId_plu: { categoryId: cat.id, plu: "PLU-001" } },
    update: {},
    create: {
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
      categoryId: cat.id,
      plu: "PLU-002",
      name: "Caesar salad",
      priceAzn: 12.0,
    },
  });

  const banquetOutlet = await prisma.outlet.upsert({
    where: { code: "BANQUET" },
    update: {},
    create: {
      code: "BANQUET",
      name: "Banquet service",
      revenueCenterCode: "FOOD",
    },
  });

  let banquetCat = await prisma.menuCategory.findFirst({
    where: { outletId: banquetOutlet.id, name: "Extras" },
  });
  if (!banquetCat) {
    banquetCat = await prisma.menuCategory.create({
      data: { outletId: banquetOutlet.id, name: "Extras", sortOrder: 1 },
    });
  }

  await prisma.menuItem.upsert({
    where: { categoryId_plu: { categoryId: banquetCat.id, plu: "BQ-EXTRA-01" } },
    update: {},
    create: {
      categoryId: banquetCat.id,
      plu: "BQ-EXTRA-01",
      name: "Banquet extra course",
      priceAzn: 15.0,
    },
  });

  const items = await prisma.menuItem.findMany({
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

  console.log("era-fnb-pos seed OK");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
