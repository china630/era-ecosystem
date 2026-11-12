import { prisma } from "@/lib/prisma";

export async function listProductCategories() {
  return prisma.productCategory.findMany({ orderBy: { code: "asc" } });
}

export async function createProductCategory(data: {
  organizationId: string;
  code: string;
  name: string;
  revenueCode: string | null;
}) {
  return prisma.productCategory.create({ data });
}

export async function getProductCategoryById(id: string) {
  return prisma.productCategory.findUnique({ where: { id } });
}

export async function updateProductCategory(
  id: string,
  data: { name?: string; revenueCode?: string | null },
) {
  return prisma.productCategory.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.revenueCode !== undefined ? { revenueCode: data.revenueCode?.trim() || null } : {}),
    },
  });
}
