import { prisma } from "@/lib/prisma";

export async function listCustomerVehicles(plateFilter?: string) {
  return prisma.customerVehicle.findMany({
    where: plateFilter ? { plate: { contains: plateFilter, mode: "insensitive" } } : undefined,
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { _count: { select: { workOrders: true } } },
  });
}

export async function upsertCustomerVehicle(data: {
  plate: string;
  vin?: string;
  customerName?: string;
  phone?: string;
  financeCounterpartyId?: string;
}) {
  return prisma.customerVehicle.upsert({
    where: { plate: data.plate },
    create: {
      plate: data.plate,
      vin: data.vin,
      customerName: data.customerName,
      phone: data.phone,
      financeCounterpartyId: data.financeCounterpartyId,
    },
    update: {
      vin: data.vin,
      customerName: data.customerName,
      phone: data.phone,
      financeCounterpartyId: data.financeCounterpartyId,
    },
  });
}

export async function upsertCustomerVehicleByPlate(plate: string, vin?: string) {
  return prisma.customerVehicle.upsert({
    where: { plate },
    create: { plate, vin },
    update: { vin: vin ?? undefined },
  });
}
