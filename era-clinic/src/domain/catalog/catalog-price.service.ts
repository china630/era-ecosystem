import { prisma } from "@/lib/prisma";

/**
 * One catalog price. `listAmount` wins when it is set (older Nafta rows kept the
 * payable number there and left `amount` at 0). Otherwise `amount`.
 * Quota, not this number, decides a 0 charge.
 */
export function catalogUnitPrice(
  catalog: { listAmount: unknown; amount: unknown } | null,
): number {
  if (!catalog) return 0;
  const list = catalog.listAmount != null ? Number(catalog.listAmount) : NaN;
  if (Number.isFinite(list) && list > 0) return list;
  const amount = Number(catalog.amount);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

export async function resolveProcedureAmount(
  procedureCode: string,
): Promise<{ amountNet: number; priceMissing: boolean }> {
  const catalog = await prisma.serviceCatalogCache.findFirst({
    where: { code: procedureCode },
  });
  if (!catalog) {
    return { amountNet: 0, priceMissing: true };
  }
  const amountNet = catalogUnitPrice(catalog);
  return { amountNet, priceMissing: amountNet <= 0 };
}
