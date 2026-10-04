import { prisma } from "@/lib/prisma";

export type CatalogPriceInput = {
  organizationId: string;
  code: string;
  amount: number;
  listAmount: number | null;
  effectiveFrom?: Date;
};

function sameMoney(a: { amount: unknown; listAmount: unknown } | null, amount: number, listAmount: number | null) {
  if (!a) return false;
  const prevList = a.listAmount == null ? null : Number(a.listAmount);
  const nextList = listAmount == null ? null : Number(listAmount);
  return Number(a.amount) === amount && prevList === nextList;
}

/** Append a price row when commercial amount or retail list changes. */
export async function recordCatalogPriceIfChanged(input: CatalogPriceInput) {
  const catalog = await prisma.serviceCatalogCache.findUnique({
    where: {
      organizationId_code: {
        organizationId: input.organizationId,
        code: input.code,
      },
    },
    select: { id: true },
  });
  if (!catalog) return;

  const last = await prisma.serviceCatalogPrice.findFirst({
    where: { catalogId: catalog.id },
    orderBy: { effectiveFrom: "desc" },
  });
  if (sameMoney(last, input.amount, input.listAmount)) return;

  await prisma.serviceCatalogPrice.create({
    data: {
      organizationId: input.organizationId,
      catalogId: catalog.id,
      code: input.code,
      amount: input.amount,
      listAmount: input.listAmount,
      effectiveFrom: input.effectiveFrom ?? new Date(),
    },
  });
}
