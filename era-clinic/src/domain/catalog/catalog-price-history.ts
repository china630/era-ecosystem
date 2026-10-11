import { catalogUnitPrice } from "@/domain/catalog/catalog-price.service";
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
  return catalogUnitPrice(a) === catalogUnitPrice({ amount, listAmount });
}

/** Append a price row when the payable catalog price changes. */
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
  const procedure = await prisma.procedureType.findUnique({
    where: {
      organizationId_code: {
        organizationId: input.organizationId,
        code: input.code,
      },
    },
    select: { id: true },
  });
  if (!procedure) return;
  const lastProcedure = await prisma.procedureTypePrice.findFirst({
    where: { procedureTypeId: procedure.id },
    orderBy: { effectiveFrom: "desc" },
  });
  if (lastProcedure && Number(lastProcedure.amount) === input.amount) return;
  await prisma.procedureTypePrice.create({
    data: {
      organizationId: input.organizationId,
      procedureTypeId: procedure.id,
      amount: input.amount,
      effectiveFrom: input.effectiveFrom ?? new Date(),
    },
  });
}
