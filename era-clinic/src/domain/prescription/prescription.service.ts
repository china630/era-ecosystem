import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";

export type PrescriptionLineInput = {
  medicationId?: string;
  sku?: string;
  qty: number;
  dose?: string;
  route?: string;
  frequency?: string;
  durationDays?: number;
  instructions?: string;
  rxRequired?: boolean;
  description?: string;
};

export async function resolveLineSku(line: PrescriptionLineInput, organizationId: string): Promise<string> {
  if (line.sku?.trim()) return line.sku.trim();
  if (line.medicationId) {
    const med = await prisma.medicationCatalog.findFirst({
      where: { id: line.medicationId, organizationId },
      select: { financeSku: true, code: true },
    });
    if (!med) throw new Error("Medication not found");
    const sku = med.financeSku?.trim() || med.code.trim();
    if (!sku) throw new Error("Finance SKU is required");
    return sku;
  }
  throw new Error("sku or medicationId required");
}

export async function createPrescriptionForVisit(input: {
  visitId: string;
  patientRefId: string;
  organizationId: string;
  issuedByUserId?: string;
  prescriptionQueueId?: string | null;
  lines: PrescriptionLineInput[];
}) {
  return prisma.$transaction(async (tx) => {
    const prescription = await tx.prescription.create({
      data: {
        organizationId: input.organizationId,
        visitId: input.visitId,
        patientRefId: input.patientRefId,
        status: input.prescriptionQueueId ? "SENT_TO_PHARMACY" : "ISSUED",
        prescriptionQueueId: input.prescriptionQueueId,
        issuedByUserId: input.issuedByUserId,
        lines: {
          create: await Promise.all(
            input.lines.map(async (line) => ({
              organizationId: input.organizationId,
              medicationId: line.medicationId ?? null,
              sku: await resolveLineSku(line, input.organizationId),
              qty: line.qty,
              dose: line.dose,
              route: line.route,
              frequency: line.frequency,
              durationDays: line.durationDays,
              instructions: line.instructions ?? line.description,
              rxRequired: line.rxRequired ?? true,
            })),
          ),
        },
      },
      include: {
        lines: { include: { medication: true } },
        patientRef: { select: { refCode: true, fullName: true } },
        visit: { select: { practitioner: { select: { fullName: true } } } },
      },
    });
    return prescription;
  });
}

export async function getPrescriptionForPrint(id: string) {
  const organizationId = requestOrganizationId();
  return prisma.prescription.findFirst({
    where: { id, organizationId },
    include: {
      lines: { include: { medication: true } },
      patientRef: { select: { refCode: true, fullName: true, birthDate: true } },
      visit: { select: { practitioner: { select: { fullName: true, code: true } } } },
    },
  });
}

export async function listPrescriptionsForPatient(patientRefId: string) {
  const organizationId = requestOrganizationId();
  return prisma.prescription.findMany({
    where: { organizationId, patientRefId },
    orderBy: { issuedAt: "desc" },
    take: 20,
    include: {
      lines: { include: { medication: true } },
    },
  });
}