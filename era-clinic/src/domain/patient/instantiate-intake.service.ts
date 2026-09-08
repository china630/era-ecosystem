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

/** Prefer first care-team doctor (CLI-56). Do not invent “first DOCTOR by code”. */
async function resolveCareTeamPractitioner(
  episodeId: string,
): Promise<string | null> {
  const row = await prisma.episodeCareDoctor.findFirst({
    where: { episodeId },
    orderBy: { assignedAt: "asc" },
    select: { practitionerId: true },
  });
  return row?.practitionerId ?? null;
}

async function hasVisitLine(
  patientRefId: string,
  clinicalEpisodeId: string,
  serviceCode: string,
): Promise<boolean> {
  const row = await prisma.visitServiceLine.findFirst({
    where: {
      serviceCode,
      visit: {
        patientRefId,
        clinicalEpisodeId,
        status: { not: "CANCELLED" },
      },
    },
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
  return Boolean(byEpisode);
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
 * Stamps inPackage + packageQuotaCode when a ProgramInstance balance matches (W1).
 * Prices lines via resolveEntitlementCharge (W3) — no silent hardcoded zeros for paid paths.
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
  const patientOrigin =
    episode.patientOrigin === "WALK_IN" ? "WALK_IN" : "IN_HOUSE";

  const createdVisitCodes: string[] = [];
  const skippedVisitCodes: string[] = [];
  const createdLabCodes: string[] = [];
  const skippedLabCodes: string[] = [];

  const practitionerId = await resolveCareTeamPractitioner(episodeId);
  const visitCodes = naftaIntakeVisitCodes(sex);

  const {
    resolvePackageStampForEpisode,
    resolveEntitlementInstance,
    syncEntitlementUsage,
  } = await import("@/domain/sanatorium/entitlement-usage.service");
  const { applyPriceMissingFallback, resolveEntitlementCharge } = await import(
    "@/domain/sanatorium/entitlement-charge.service"
  );
  const quotaCodesTouched = new Set<string>();

  for (const code of visitCodes) {
    if (await hasVisitLine(patientRefId, episodeId, code)) {
      skippedVisitCodes.push(code);
      continue;
    }

    // CLI-56: no care-team doctor yet → skip intake visits (labs still ok).
    if (!practitionerId) {
      skippedVisitCodes.push(code);
      continue;
    }

    const stamp = await resolvePackageStampForEpisode({
      episodeId,
      serviceCode: code,
    });
    const charge = applyPriceMissingFallback(
      await resolveEntitlementCharge({
        episodeId,
        patientOrigin,
        quotaCode: stamp?.packageQuotaCode,
        serviceCode: code,
        inPackage: Boolean(stamp),
      }),
      { serviceCode: code, where: "intake-visit" },
    );

    const visit = await prisma.visit.create({
      data: {
        organizationId,
        patientRefId,
        practitionerId,
        clinicalEpisodeId: episodeId,
        status: "IN_PROGRESS",
        patientOrigin: episode.patientOrigin,
        reservationId: episode.reservationId,
        roomNumber: episode.roomNumber,
        amountNet: charge.amountNet,
      },
    });
    await prisma.visitServiceLine.create({
      data: {
        visitId: visit.id,
        serviceCode: code,
        description: VISIT_TITLES[code] ?? code,
        amount: charge.amountNet,
        inPackage: stamp?.inPackage ?? false,
        packageQuotaCode: stamp?.packageQuotaCode ?? null,
      },
    });
    // Visit.amountNet = sum of service line amounts (single line here; keep in sync).
    await prisma.visit.update({
      where: { id: visit.id },
      data: { amountNet: charge.amountNet },
    });
    if (stamp?.packageQuotaCode) quotaCodesTouched.add(stamp.packageQuotaCode);
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
      patientOrigin,
    });
    createdLabCodes.push(code);
  }

  if (quotaCodesTouched.size > 0) {
    const instance = await resolveEntitlementInstance(episodeId);
    if (instance) {
      for (const quotaCode of quotaCodesTouched) {
        await syncEntitlementUsage({
          instanceId: instance.id,
          episodeId,
          quotaCode,
        });
      }
    }
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
