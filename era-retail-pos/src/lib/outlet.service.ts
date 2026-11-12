import { prisma } from "@/lib/prisma";

export async function listOutletsForAdmin() {
  return prisma.outlet.findMany({
    orderBy: { code: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      revenueCode: true,
      phone: true,
      email: true,
      address: true,
      website: true,
    },
  });
}

export async function getOutletById(id: string) {
  return prisma.outlet.findUnique({ where: { id } });
}

export async function updateOutletContacts(
  id: string,
  data: {
    revenueCode?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    website?: string | null;
  },
) {
  return prisma.outlet.update({
    where: { id },
    data: {
      ...(data.revenueCode !== undefined
        ? { revenueCode: data.revenueCode?.trim() || null }
        : {}),
      ...(data.phone !== undefined ? { phone: data.phone } : {}),
      ...(data.email !== undefined ? { email: data.email } : {}),
      ...(data.address !== undefined ? { address: data.address } : {}),
      ...(data.website !== undefined ? { website: data.website } : {}),
    },
  });
}
