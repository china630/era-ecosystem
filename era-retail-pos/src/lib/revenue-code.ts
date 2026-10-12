import { prisma } from "@/lib/prisma";

/** Item revenue key, then the outlet default. Empty refuses the hotel post. */
export async function revenueCodeForSaleLine(input: {
  plu: string;
  outletRevenueCode?: string | null;
}): Promise<string> {
  const product = await prisma.productCache.findFirst({
    where: { sku: input.plu },
    select: { revenueCode: true },
  });
  const code = product?.revenueCode?.trim() || input.outletRevenueCode?.trim() || "";
  if (!code) {
    throw new Error(`Revenue code is required for ${input.plu}`);
  }
  return code;
}
