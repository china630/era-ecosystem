import { prisma } from "@/lib/prisma";

export async function resolveProcedureAmount(
  procedureCode: string,
): Promise<{ amountNet: number; packageIncluded: boolean }> {
  const catalog = await prisma.serviceCatalogCache.findUnique({
    where: { code: procedureCode },
  });
  if (!catalog) {
    return { amountNet: 0, packageIncluded: false };
  }
  const packageIncluded = catalog.packageIncluded;
  const amountNet = packageIncluded ? 0 : Number(catalog.amount);
  return { amountNet, packageIncluded };
}
