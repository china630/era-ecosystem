import { prisma } from "@/lib/prisma";
import type {
  InpatientMedicationRoute,
  InpatientOrderKind,
  InpatientOrderStatus,
  OrderAdministrationStatus,
} from "@prisma/client";

export async function listOrdersForAdmission(admissionId: string) {
  return prisma.inpatientOrder.findMany({
    where: { admissionId },
    orderBy: { startAt: "desc" },
    include: {
      medication: true,
      procedureType: { select: { id: true, code: true, name: true } },
      administrations: { orderBy: { scheduledAt: "asc" }, take: 48 },
    },
  });
}

export async function createInpatientOrder(input: {
  admissionId: string;
  kind: InpatientOrderKind;
  medicationId?: string | null;
  procedureTypeId?: string | null;
  dose?: string | null;
  doseUnit?: string | null;
  route?: InpatientMedicationRoute | null;
  frequency?: string | null;
  startAt: Date;
  endAt?: Date | null;
  prn?: boolean;
  orderedByPractitionerId?: string | null;
}) {
  const admission = await prisma.inpatientAdmission.findUnique({
    where: { id: input.admissionId },
    select: { status: true },
  });
  if (!admission || admission.status !== "ADMITTED") {
    throw new Error("Admission not active");
  }
  return prisma.inpatientOrder.create({
    data: {
      admissionId: input.admissionId,
      kind: input.kind,
      medicationId: input.medicationId ?? null,
      procedureTypeId: input.procedureTypeId ?? null,
      dose: input.dose ?? null,
      doseUnit: input.doseUnit ?? null,
      route: input.route ?? null,
      frequency: input.frequency ?? null,
      startAt: input.startAt,
      endAt: input.endAt ?? null,
      prn: input.prn ?? false,
      orderedByPractitionerId: input.orderedByPractitionerId ?? null,
      status: "ACTIVE",
    },
  });
}

export async function stopInpatientOrder(orderId: string) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.inpatientOrder.update({
      where: { id: orderId },
      data: { status: "STOPPED" as InpatientOrderStatus, endAt: new Date() },
    });
    await tx.orderAdministration.updateMany({
      where: { orderId, status: "DUE" as OrderAdministrationStatus, scheduledAt: { gt: new Date() } },
      data: { status: "HELD" },
    });
    return order;
  });
}

export async function markAdministration(
  administrationId: string,
  status: Exclude<OrderAdministrationStatus, "DUE">,
  input?: { givenByUserId?: string | null; note?: string | null },
) {
  return prisma.orderAdministration.update({
    where: { id: administrationId },
    data: {
      status,
      givenAt: status === "GIVEN" ? new Date() : undefined,
      givenByUserId: input?.givenByUserId ?? null,
      note: input?.note ?? null,
    },
  });
}