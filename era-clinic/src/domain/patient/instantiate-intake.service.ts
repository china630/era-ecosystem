import { prisma } from "@/lib/prisma";
import { createLabOrderWithItems } from "@/domain/lab/lab-order-write.service";
import {
  naftaIntakeLabOrderCodes,
  naftaIntakeVisitCodes,
} from "@/lib/import/nafta-intake-map";

export type InstantiateIntakeResult = {
  episodeId: string;
  patientRefId: string;
  createdVisitCodes: string[];
  createdLabCodes: string[];
  skippedVisitCodes: string[];
  skippedLabCodes: string[];
};

async function resolveDefaultPractitioner(
  organizationId: string,
): Promise<string | null> {
  const doc = await prisma.practitioner.findFirst({
    where: { organizationId, active: true, staffKind: "DOCTOR" },
    orderBy: { code: "asc" },
    select: { id: true },
  });
  return doc?.id ?? null;
}

async function hasVisitLine(
  patientRefId: string,
  serviceCode: string,
): Promise<boolean> {
  const row = await prisma.visitServiceLine.findFirst({
    where: { serviceCode, visit: { patientRefId, status: { not: "CANCELLED" } } },
    select: { id: true },
  });
  return Boolean(row);
}

async function hasAnyVisit(patientRefId: string): Promise<boolean> {
  const row = await prisma.visit.findFirst({
    where: { patientRefId, status: { not: "CANCELLED" } },
    select: { id: true },
  });
  return Boolean(row);
}

async function hasLabOrder(
  patientRefId: string,
  clinicalEpisodeId: string,
  testCode: string,
): Promise<boolean> {
  const byEpisode = await prisma.labOrder.findFirst({
    where: {
      patientRefId,
      clinicalEpisodeId,
      OR: [
        { testCode },
        { items: { some: { serviceCode: testCode } } },
      ],
    },
    select: { id: true },
  });
  if (byEpisode) return true;
  const byPatient = await prisma.labOrder.findFirst({
    where: {
      patientRefId,
      OR: [
        { testCode },
        { items: { some: { serviceCode: testCode } } },
      ],
    },
    select: { id: true },
  });
  return Boolean(byPatient);
}

const VISIT_TITLES: Record<string, string> = {
  "SANATORIUM-INTAKE": "Sanatorium intake / doctor exam",
  "GYN-VISIT": "Gynecologist exam",
  "URO-VISIT": "Urologist exam",
};

/**
 * Idempotent Nafta check-in package on episode open.
 * Creates missing intake / GYN|URO visits and ORDERED LabOrders (ECG-12, USG-ABD).
 * Does not start physio FIFO / program instantiation.
 */
export async function instantiateIntakePackage(
  episodeId: string,
): Promise<InstantiateIntakeResult> {
  const episode = await prisma.clinicalEpisode.findUnique({
    where: { id: episodeId },
    include: { patientRef: true },
  });
  if (!episode?.patientRefId || !episode.patientRef) {
    throw new Error("Episode patient not found");
  }
  const patientRefId = episode.patientRefId;
  const organizationId = episode.organizationId;
  const sex = episode.patientRef.sex;

  const createdVisitCodes: string[] = [];
  const skippedVisitCodes: string[] = [];
  const createdLabCodes: string[] = [];
  const skippedLabCodes: string[] = [];

  const practitionerId = await resolveDefaultPractitioner(organizationId);
  const visitCodes = naftaIntakeVisitCodes(sex);

  for (const code of visitCodes) {
    if (code === "SANATORIUM-INTAKE") {
      const exists =
        (await hasVisitLine(patientRefId, "SANATORIUM-INTAKE")) ||
        (await hasAnyVisit(patientRefId));
      if (exists) {
        skippedVisitCodes.push(code);
        continue;
      }
    } else if (await hasVisitLine(patientRefId, code)) {
      skippedVisitCodes.push(code);
      continue;
    }

    if (!practitionerId) {
      skippedVisitCodes.push(code);
      continue;
    }

    await prisma.visit.create({
      data: {
        organizationId,
        patientRefId,
        practitionerId,
        status: "IN_PROGRESS",
        patientOrigin: episode.patientOrigin,
        reservationId: episode.reservationId,
        roomNumber: episode.roomNumber,
        amountNet: 0,
        serviceLines: {
          create: {
            serviceCode: code,
            description: VISIT_TITLES[code] ?? code,
            amount: 0,
          },
        },
      },
    });
    createdVisitCodes.push(code);
  }

  for (const code of naftaIntakeLabOrderCodes(sex)) {
    if (await hasLabOrder(patientRefId, episodeId, code)) {
      skippedLabCodes.push(code);
      continue;
    }
    await createLabOrderWithItems({
      patientRefId,
      clinicalEpisodeId: episodeId,
      codes: [code],
      source: "IN_HOUSE",
      fasting: false,
    });
    createdLabCodes.push(code);
  }

  return {
    episodeId,
    patientRefId,
    createdVisitCodes,
    createdLabCodes,
    skippedVisitCodes,
    skippedLabCodes,
  };
}
