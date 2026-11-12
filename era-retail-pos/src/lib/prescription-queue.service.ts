import { prisma } from "@/lib/prisma";

export async function createPrescriptionQueueRow(data: {
  organizationId: string;
  visitId: string;
  patientRef: string;
  patientOrigin: string;
  reservationId: string | null;
  linesJson: string;
}) {
  return prisma.prescriptionQueue.create({ data });
}

export async function getPrescriptionQueueById(id: string) {
  return prisma.prescriptionQueue.findUnique({ where: { id } });
}

export async function markPrescriptionQueueReady(id: string) {
  return prisma.prescriptionQueue.update({
    where: { id },
    data: { status: "READY", paidAt: new Date() },
  });
}

export async function markPrescriptionQueueDispensed(id: string, receiptId: string) {
  return prisma.prescriptionQueue.update({
    where: { id },
    data: { status: "DISPENSED", dispensedAt: new Date(), receiptId },
  });
}

export async function markPrescriptionQueueReturned(id: string) {
  return prisma.prescriptionQueue.update({
    where: { id },
    data: { status: "RETURNED", returnedAt: new Date() },
  });
}

export async function getPrescriptionQueueForSettlement(id: string) {
  return prisma.prescriptionQueue.findUnique({ where: { id } });
}

export async function markPrescriptionQueueReadyFromHub(id: string) {
  return prisma.prescriptionQueue.update({
    where: { id },
    data: { status: "READY", paidAt: new Date() },
  });
}
