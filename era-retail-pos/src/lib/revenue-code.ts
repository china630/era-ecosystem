import { resolveHotelRevenueCode } from "@era/satellite-kit/integration/hotel-revenue-route";
import { prisma } from "@/lib/prisma";

/** Product, then its category, then the outlet default. Empty refuses the hotel post. */
export async function revenueCodeForSaleLine(input: {
  plu: string;
  outletRevenueCode?: string | null;
}): Promise<string> {
  const product = await prisma.productCache.findFirst({
    where: { sku: input.plu },
    select: {
      revenueCode: true,
      category: { select: { revenueCode: true } },
    },
  });
  try {
    return resolveHotelRevenueCode({
      product: product?.revenueCode,
      category: product?.category?.revenueCode,
      satellite: input.outletRevenueCode,
    });
  } catch {
    throw new Error(`Revenue code is required for ${input.plu}`);
  }
}
