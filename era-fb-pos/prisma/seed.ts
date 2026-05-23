import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
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

  const cat = await prisma.menuCategory.create({
    data: { outletId: outlet.id, name: "Mains", sortOrder: 1 },
  });
  await prisma.menuItem.create({
    data: {
      categoryId: cat.id,
      plu: "PLU-001",
      name: "Grilled chicken",
      priceAzn: 18.5,
    },
  });

  console.log("era-fb-pos seed OK");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
