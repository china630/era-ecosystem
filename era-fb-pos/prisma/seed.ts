import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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

  await prisma.user.upsert({
    where: { login: "waiter" },
    update: {},
    create: {
      login: "waiter",
      fullName: "Demo Waiter",
      passwordHash: "waiter",
      roleId: waiterRole.id,
    },
  });
  await prisma.user.upsert({
    where: { login: "manager" },
    update: {},
    create: {
      login: "manager",
      fullName: "Demo Manager",
      passwordHash: "manager",
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

  console.log("era-fb-pos seed OK");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
