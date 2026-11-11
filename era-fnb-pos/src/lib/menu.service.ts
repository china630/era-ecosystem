import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordMenuItemPrice } from "@/lib/menu-price-history";

export function listMenuCategoriesWithItems(includeInactive: boolean) {
  return prisma.menuCategory.findMany({
    include: {
      items: {
        where: includeInactive ? undefined : { active: true },
        orderBy: { name: "asc" },
      },
    },
    orderBy: { sortOrder: "asc" },
  });
}

export function findDailyMenuItemIds(outletId: string, boardDate: Date) {
  return prisma.dailyMenuEntry.findMany({
    where: { outletId, boardDate },
    select: { menuItemId: true },
  });
}

export function findMenuCategoryById(id: string) {
  return prisma.menuCategory.findUnique({ where: { id } });
}

export function findMenuCategoryByOutletAndName(outletId: string, name: string) {
  return prisma.menuCategory.findFirst({
    where: { outletId, name },
  });
}

export function createMenuCategoryForOutlet(data: {
  organizationId: string;
  outletId: string;
  name: string;
  code: string;
  sortOrder: number;
  revenueCode?: string | null;
}) {
  return prisma.menuCategory.create({
    data: {
      organizationId: data.organizationId,
      outletId: data.outletId,
      name: data.name,
      code: data.code,
      sortOrder: data.sortOrder,
      revenueCode: data.revenueCode?.trim() || null,
    },
  });
}

export async function createMenuItemWithInitialPrice(input: {
  organizationId: string;
  categoryId: string;
  plu: string;
  name: string;
  priceAzn: number;
  active: boolean;
  recipeSku: string | null;
  financeSku: string | null;
  imageUrl: string | null;
  createdBy: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const created = await tx.menuItem.create({
      data: {
        organizationId: input.organizationId,
        categoryId: input.categoryId,
        plu: input.plu,
        name: input.name,
        priceAzn: input.priceAzn,
        active: input.active,
        recipeSku: input.recipeSku,
        financeSku: input.financeSku,
        imageUrl: input.imageUrl,
      },
    });
    await recordMenuItemPrice(tx, created.id, input.priceAzn, {
      createdBy: input.createdBy,
    });
    return created;
  });
}

export function findMenuItemById(id: string) {
  return prisma.menuItem.findUnique({ where: { id } });
}

export async function updateMenuItemWithOptionalPrice(input: {
  id: string;
  data: Prisma.MenuItemUpdateInput;
  priceChanged: boolean;
  priceAzn?: number;
  priceReason?: string | null;
  createdBy: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.menuItem.update({
      where: { id: input.id },
      data: input.data,
    });
    if (input.priceChanged && input.priceAzn !== undefined) {
      await recordMenuItemPrice(tx, input.id, input.priceAzn, {
        reason: input.priceReason ?? null,
        createdBy: input.createdBy,
      });
    }
    return updated;
  });
}

export function softDeactivateMenuItem(id: string) {
  return prisma.menuItem.update({
    where: { id },
    data: { active: false },
  });
}

export function listMenuItemPriceHistory(menuItemId: string) {
  return prisma.menuItemPrice.findMany({
    where: { menuItemId },
    orderBy: { effectiveFrom: "desc" },
  });
}

export function listMenuCategoriesWithItemCounts() {
  return prisma.menuCategory.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      _count: { select: { items: true } },
    },
  });
}

export function findMenuCategoryByOutletName(outletId: string, name: string) {
  return prisma.menuCategory.findFirst({
    where: { outletId, name },
  });
}

export function maxMenuCategorySortOrder(outletId: string) {
  return prisma.menuCategory.aggregate({
    where: { outletId },
    _max: { sortOrder: true },
  });
}

export function findMenuCategoryByOutletCode(outletId: string, code: string) {
  return prisma.menuCategory.findFirst({
    where: { outletId, code },
  });
}

export function findMenuCategoryByOutletCodeExcluding(
  outletId: string,
  code: string,
  excludeId: string,
) {
  return prisma.menuCategory.findFirst({
    where: { outletId, code, NOT: { id: excludeId } },
  });
}

export function updateMenuCategory(id: string, data: Prisma.MenuCategoryUpdateInput) {
  return prisma.menuCategory.update({
    where: { id },
    data,
  });
}

export function findMenuCategoryWithItemCount(id: string) {
  return prisma.menuCategory.findUnique({
    where: { id },
    include: { _count: { select: { items: true } } },
  });
}

export function deleteMenuCategory(id: string) {
  return prisma.menuCategory.delete({ where: { id } });
}

export function listMenuItemsForExport(organizationId: string) {
  return prisma.menuItem.findMany({
    where: { organizationId },
    include: {
      category: { select: { name: true } },
      priceHistory: { orderBy: { effectiveFrom: "desc" } },
    },
    orderBy: { name: "asc" },
  });
}

export function listDailyMenuEntries(outletId: string, boardDate: Date) {
  return prisma.dailyMenuEntry.findMany({
    where: { outletId, boardDate },
    include: { menuItem: { include: { category: true } } },
    orderBy: [{ sortOrder: "asc" }, { menuItem: { name: "asc" } }],
  });
}

export function replaceDailyMenuBoard(input: {
  outletId: string;
  boardDate: Date;
  organizationId: string;
  menuItemIds: string[];
}) {
  return prisma.$transaction([
    prisma.dailyMenuEntry.deleteMany({
      where: { outletId: input.outletId, boardDate: input.boardDate },
    }),
    prisma.dailyMenuEntry.createMany({
      data: input.menuItemIds.map((menuItemId, idx) => ({
        organizationId: input.organizationId,
        outletId: input.outletId,
        menuItemId,
        boardDate: input.boardDate,
        sortOrder: idx,
      })),
    }),
  ]);
}

export function findDailyMenuEntriesOnDate(outletId: string, boardDate: Date) {
  return prisma.dailyMenuEntry.findMany({
    where: { outletId, boardDate },
  });
}

export function copyDailyMenuBoard(input: {
  outletId: string;
  organizationId: string;
  fromDate: Date;
  toDate: Date;
  source: Array<{
    menuItemId: string;
    sortOrder: number;
    isFeatured: boolean;
  }>;
}) {
  return prisma.$transaction([
    prisma.dailyMenuEntry.deleteMany({
      where: { outletId: input.outletId, boardDate: input.toDate },
    }),
    prisma.dailyMenuEntry.createMany({
      data: input.source.map((e) => ({
        organizationId: input.organizationId,
        outletId: input.outletId,
        menuItemId: e.menuItemId,
        boardDate: input.toDate,
        sortOrder: e.sortOrder,
        isFeatured: e.isFeatured,
      })),
    }),
  ]);
}
