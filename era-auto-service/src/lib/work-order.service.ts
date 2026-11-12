import { prisma } from "@/lib/prisma";
export async function listWorkOrders() {
  return prisma.workOrder.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { vehicle: true },
  });
}

export async function createWorkOrder(data: {
  code: string;
  vehicleId?: string;
  vehiclePlate?: string;
  vin?: string;
  laborAmount: number;
  partsAmount: number;
}) {
  return prisma.workOrder.create({
    data: {
      code: data.code,
      vehicleId: data.vehicleId,
      vehiclePlate: data.vehiclePlate,
      vin: data.vin,
      laborAmount: data.laborAmount,
      partsAmount: data.partsAmount,
    },
    include: { vehicle: true, laborLines: true, partLines: true },
  });
}

export async function findWorkOrderById(id: string) {
  return prisma.workOrder.findUnique({ where: { id } });
}

export async function updateWorkOrderShopFloorStart(id: string) {
  return prisma.workOrder.update({
    where: { id },
    data: { shopFloorStartedAt: new Date(), status: "IN_PROGRESS" },
  });
}

export async function updateWorkOrderShopFloorEnd(id: string) {
  return prisma.workOrder.update({
    where: { id },
    data: { shopFloorEndedAt: new Date() },
  });
}

export async function updateWorkOrderPartsStatus(
  id: string,
  partsStatus: "NONE" | "ORDERED" | "RECEIVED" | "INSTALLED",
) {
  return prisma.workOrder.update({
    where: { id },
    data: { partsStatus },
  });
}

export async function updateWorkOrderIntake(
  id: string,
  data: {
    vin?: string;
    intakeNotes?: string;
    intakePhotoUrls?: string | null;
    existingVin: string | null;
    existingIntakePhotoUrls: string | null;
  },
) {
  return prisma.workOrder.update({
    where: { id },
    data: {
      vin: data.vin?.trim() || data.existingVin,
      intakeNotes: data.intakeNotes,
      intakePhotoUrls: data.intakePhotoUrls ?? data.existingIntakePhotoUrls,
      intakeCompletedAt: new Date(),
    },
  });
}

export async function markWorkOrderPaid(
  id: string,
  data: { paymentMethod: string; fiscalNumber: string | null },
) {
  return prisma.workOrder.update({
    where: { id },
    data: {
      paymentMethod: data.paymentMethod,
      fiscalNumber: data.fiscalNumber,
      paidAt: new Date(),
    },
  });
}

export async function completeWorkOrder(id: string) {
  return prisma.workOrder.update({
    where: { id },
    data: { status: "COMPLETED", completedAt: new Date() },
  });
}

export async function listWorkOrderPartLines(workOrderId: string) {
  return prisma.workOrderPartLine.findMany({
    where: { workOrderId },
    orderBy: { sortOrder: "asc" },
  });
}

export async function createWorkOrderPartLine(data: {
  workOrderId: string;
  sku?: string;
  description: string;
  qty: number;
  unitPrice: number;
  amountAzn: number;
}) {
  return prisma.workOrderPartLine.create({
    data: {
      workOrderId: data.workOrderId,
      sku: data.sku,
      description: data.description,
      qty: data.qty,
      unitPrice: data.unitPrice,
      amountAzn: data.amountAzn,
    },
  });
}

export async function listWorkOrderLaborLines(workOrderId: string) {
  return prisma.workOrderLaborLine.findMany({
    where: { workOrderId },
    orderBy: { sortOrder: "asc" },
  });
}

export async function createWorkOrderLaborLine(data: {
  workOrderId: string;
  description: string;
  hours: number;
  rateAzn: number;
  amountAzn: number;
}) {
  return prisma.workOrderLaborLine.create({
    data: {
      workOrderId: data.workOrderId,
      description: data.description,
      hours: data.hours,
      rateAzn: data.rateAzn,
      amountAzn: data.amountAzn,
    },
  });
}

export async function findAgedOpenWorkOrders(dueBefore: Date) {
  return prisma.workOrder.findMany({
    where: {
      status: "OPEN",
      createdAt: { lte: dueBefore },
    },
    take: 50,
  });
}

export async function findWorkOrdersByPlateOrVin(plate: string | undefined, vin: string | undefined) {
  const orClause = [
    ...(plate ? [{ vehiclePlate: plate }] : []),
    ...(vin ? [{ vin }] : []),
  ];
  return prisma.workOrder.findMany({
    where: { OR: orClause },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}
