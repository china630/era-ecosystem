import { resolveHotelRevenueCode } from "@era/satellite-kit/integration/hotel-revenue-route";
import { prisma } from "@/lib/prisma";

/** Category, otherwise the outlet default. A code on the product card is ignored. */
export async function revenueCodeForSaleLine(input: {
  plu: string;
  outletRevenueCode?: string | null;
}): Promise<string> {
  const product = await prisma.productCache.findFirst({
    where: { sku: input.plu },
    select: { category: { select: { revenueCode: true } } },
  });
  try {
    return resolveHotelRevenueCode({
      category: product?.category?.revenueCode,
      satellite: input.outletRevenueCode,
    });
  } catch {
    throw new Error(`Revenue code is required for ${input.plu}`);
  }
}
