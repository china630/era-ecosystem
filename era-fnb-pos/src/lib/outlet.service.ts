import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordMenuItemPrice } from "@/lib/menu-price-history";

export function listActiveOutlets() {
  return prisma.outlet.findMany({
    where: { active: true },
    orderBy: { code: "asc" },
  });
}

export function findActiveOutletForCopy(id: string, organizationId: string) {
  return prisma.outlet.findFirst({
    where: { id, organizationId, active: true },
    select: {
      id: true,
      revenueCenterCode: true,
      financeWarehouseCode: true,
      phone: true,
      email: true,
      address: true,
      website: true,
    },
  });
}

export function createOutlet(data: Prisma.OutletCreateInput) {
  return prisma.outlet.create({ data });
}

export function isOutletCodeDuplicateError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

export async function copyOutletLayoutFromSource(
  sourceOutletId: string,
  targetOutletId: string,
  organizationId: string,
) {
  const cats = await prisma.menuCategory.findMany({
    where: { outletId: sourceOutletId },
    include: { items: true },
  });
  for (const cat of cats) {
    const nc = await prisma.menuCategory.create({
      data: {
        organizationId,
        outletId: targetOutletId,
        name: cat.name,
        code: cat.code,
        revenueCode: cat.revenueCode,
        sortOrder: cat.sortOrder,
      },
    });
    for (const item of cat.items) {
      const ni = await prisma.menuItem.create({
        data: {
          organizationId,
          categoryId: nc.id,
          plu: item.plu,
          name: item.name,
          priceAzn: item.priceAzn,
          active: item.active,
          recipeSku: item.recipeSku,
          financeSku: item.financeSku,
          revenueCode: null,
          imageUrl: item.imageUrl,
        },
      });
      await recordMenuItemPrice(prisma, ni.id, Number(item.priceAzn), {
        reason: "branch-copy",
      });
    }
  }

  const halls = await prisma.posHall.findMany({
    where: { outletId: sourceOutletId },
    orderBy: { sortOrder: "asc" },
  });
  const hallIdMap = new Map<string, string>();
  for (const hall of halls) {
    const nh = await prisma.posHall.create({
      data: {
        organizationId,
        outletId: targetOutletId,
        name: hall.name,
        sortOrder: hall.sortOrder,
      },
    });
    hallIdMap.set(hall.id, nh.id);
  }

  const tables = await prisma.posTable.findMany({
    where: { outletId: sourceOutletId },
    orderBy: { code: "asc" },
  });
  for (const table of tables) {
    await prisma.posTable.create({
      data: {
        organizationId,
        outletId: targetOutletId,
        hallId: table.hallId ? hallIdMap.get(table.hallId) ?? null : null,
        code: table.code,
        name: table.name,
        seats: table.seats,
        zone: table.zone,
        status: "FREE",
        currentTicketId: null,
      },
    });
  }
}

export function findOutletById(id: string) {
  return prisma.outlet.findUnique({ where: { id } });
}

export function updateOutlet(id: string, data: Prisma.OutletUpdateInput) {
  return prisma.outlet.update({ where: { id }, data });
}

export function countOpenPosShiftsForOutlet(outletId: string) {
  return prisma.posShift.count({
    where: { outletId, status: "OPEN" },
  });
}

export function deleteOutletById(id: string) {
  return prisma.outlet.delete({ where: { id } });
}

export function outletXReportHiddenValue(
  value: string[] | null,
): Prisma.NullableJsonNullValueInput | string[] {
  return value === null ? Prisma.JsonNull : value;
}
