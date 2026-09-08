import { prisma } from "@/lib/prisma";

/** Prefer listAmount (retail) over commercial package amount. */
export async function resolveProcedureAmount(
  procedureCode: string,
): Promise<{ amountNet: number; packageIncluded: boolean; priceMissing: boolean }> {
  const catalog = await prisma.serviceCatalogCache.findFirst({
    where: { code: procedureCode },
  });
  if (!catalog) {
    return { amountNet: 0, packageIncluded: false, priceMissing: true };
  }
  const packageIncluded = catalog.packageIncluded;
  const list =
    catalog.listAmount != null ? Number(catalog.listAmount) : NaN;
  const amount = Number(catalog.amount);
  const listPrice =
    Number.isFinite(list) && list > 0
      ? list
      : Number.isFinite(amount) && amount > 0
        ? amount
        : 0;
  if (packageIncluded) {
    return {
      amountNet: 0,
      packageIncluded: true,
      priceMissing: listPrice <= 0,
    };
  }
  return {
    amountNet: listPrice,
    packageIncluded: false,
    priceMissing: listPrice <= 0,
  };
}
