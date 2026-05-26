import { prisma } from "@/lib/prisma";

const DEMO_PRODUCTS = [
  { sku: "SKU-001", barcode: "2000000000001", description: "Milk 1L", unitPrice: 2.5 },
  { sku: "SKU-002", barcode: "2000000000002", description: "Bread loaf", unitPrice: 1.2 },
  { sku: "SKU-003", barcode: "2000000000003", description: "Coffee 250g", unitPrice: 8.9 },
  { sku: "SKU-PH-01", barcode: "3000000000001", description: "OTC Vitamin C", unitPrice: 12.0 },
];

export async function ensureProductCacheSeeded(): Promise<void> {
  const count = await prisma.productCache.count();
  if (count > 0) return;
  await prisma.productCache.createMany({
    data: DEMO_PRODUCTS.map((p) => ({
      sku: p.sku,
      barcode: p.barcode,
      description: p.description,
      unitPrice: p.unitPrice,
    })),
    skipDuplicates: true,
  });
}
