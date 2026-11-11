import { prisma } from "@/lib/prisma";

export async function listAppointments() {
  return prisma.appointment.findMany({
    include: { workOrder: true },
    orderBy: { scheduledAt: "asc" },
    take: 100,
  });
}

export async function createAppointment(data: {
  vehiclePlate: string;
  customerName?: string;
  scheduledAt: Date;
}) {
  return prisma.appointment.create({
    data: {
      vehiclePlate: data.vehiclePlate,
      customerName: data.customerName,
      scheduledAt: data.scheduledAt,
    },
  });
}
