import { prisma } from "@/lib/prisma";
import { createLabOrderWithItems } from "@/domain/lab/lab-order-write.service";
import {
  parseEntitlementSnapshot,
  type EntitlementBlockAxes,
  type EntitlementSnapshot,
} from "@/domain/sanatorium/program-template-admin";
import {
  GYN_OR_URO_SLOT,
  resolveNaftaIntakeCode,
  type NaftaIntakeSlotCode,
} from "@/lib/import/nafta-intake-map";

export type AutoApplyTrigger = "OPEN" | "DAY1" | "MANUAL_RETRY" | "CARE_TEAM";

export type AutoApplyResult =
  | { skipped: "NO_PROGRAM" }
  | {
      episodeId: string;
      autoApplyState: string;
      createdVisitCodes: string[];
      createdLabCodes: string[];
      skippedVisitCodes: string[];
      skippedLabCodes: string[];
      skippedProcedureCodes: string[];
      pendingDoctor: boolean;
    };

type SnapshotProc = EntitlementSnapshot["procedures"][number];

const VISIT_TITLES: Record<string, string> = {
  "VISIT-SANATORIUM-INTAKE": "Sanatorium intake / doctor exam",
  "VISIT-GYN": "Gynecologist exam",
  "VISIT-URO": "Urologist exam",
};

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
      // A cancelled order must not block a retry (matches hasVisitLine).
      status: { not: "CANCELLED" },
      OR: [
        { testCode },
        { items: { some: { serviceCode: testCode } } },
      ],
    },
    select: { id: true },
  });
  return Boolean(byEpisode);
}

/** Resolve block entitlement code → bookable visit/lab SKU (sex for GYN-OR-URO). */
export function resolveAutoBlockServiceCode(
  blockCode: string,
  sex: string | null | undefined,
): string | null {
  const code = blockCode.trim();
  if (!code) return null;
  if (code === GYN_OR_URO_SLOT || code === "GYN" || code === "GYN_URO") {
    const resolved = resolveNaftaIntakeCode(
      GYN_OR_URO_SLOT as NaftaIntakeSlotCode,
      sex,
    );
    if (resolved === "GYN-OR-URO") return null;
    return resolved;
  }
  if (code === "THERAPIST" || code === "SANATORIUM-INTAKE") return "VISIT-SANATORIUM-INTAKE";
  if (code === "ECG" || code === "ECG-12") return "CARDIO-ECG";
  if (code === "GYN-VISIT") return "VISIT-GYN";
  if (code === "URO-VISIT") return "VISIT-URO";
  if (code === "USG") return "USG-ABD";
  return code;
}

/** Block codes whose Auto flag means a diagnostic order, even if fulfillment is still the procedure default. */
const DIAGNOSTIC_LAB_ALIASES = new Set(["CARDIO-ECG", "USG-ABD"]);

/**
 * LAB/EXAM kind wins over a stored PROCEDURE_ORDER default.
 * ECG/USG blocks saved as CUSTOM + procedure still book CARDIO-ECG / USG-ABD when Auto.
 */
export function effectiveAutoFulfillment(
  block: { kind?: string | null; fulfillment?: string | null; procedureCode: string },
  sex: string | null | undefined,
): "PROCEDURE_ORDER" | "LAB_ORDER" | "VISIT" {
  const base = fulfillmentRespectingStudyKind(block.kind, block.fulfillment);
  if (base !== "PROCEDURE_ORDER") return base;
  const resolved = resolveAutoBlockServiceCode(block.procedureCode, sex);
  if (resolved && DIAGNOSTIC_LAB_ALIASES.has(resolved)) return "LAB_ORDER";
  return "PROCEDURE_ORDER";
}

type TemplateAxisRow = {
  procedureCode: string;
  assignMode?: string | null;
  fulfillment?: string | null;
  kind?: string | null;
  requiresDoctor?: boolean | null;
};

/** Copy assign mode, kind, and fulfillment from the current template. Quotas stay on the course snapshot. */
export function overlayTemplateAxes(
  procedures: SnapshotProc[],
  current: TemplateAxisRow[],
): SnapshotProc[] {
  const byCode = new Map(current.map((row) => [row.procedureCode, row]));
  return procedures.map((row) => {
    const next = byCode.get(row.procedureCode);
    if (!next) return row;
    const axes = axesFromLegacyTemplateProc({
      procedureCode: row.procedureCode,
      procedureName: row.procedureName,
      quotaTotal: row.quotaTotal,
      sortOrder: row.sortOrder,
      kind: next.kind ?? row.kind,
      assignMode: next.assignMode,
      fulfillment: next.fulfillment,
      quotaBasis: row.quotaBasis,
      requiresDoctor: next.requiresDoctor,
    });
    return {
      ...row,
      ...axes,
      quotaTotal: row.quotaTotal,
      quotaBasis: row.quotaBasis,
      procedureName: row.procedureName,
    };
  });
}

function selectAutoBlocks(
  procedures: SnapshotProc[],
  trigger: AutoApplyTrigger,
  autoApplyState: string,
): SnapshotProc[] {
  if (trigger === "OPEN") {
    return procedures.filter((p) => p.assignMode === "AUTO_ON_OPEN");
  }
  if (trigger === "DAY1") {
    return procedures.filter(
      (p) =>
        p.assignMode === "AUTO_DAY1" ||
        (p.assignMode === "AUTO_ON_OPEN" && autoApplyState !== "APPLIED"),
    );
  }
  // First doctor and the super-admin retry both book every auto block.
  if (trigger === "MANUAL_RETRY" || trigger === "CARE_TEAM") {
    return procedures.filter(
      (p) => p.assignMode === "AUTO_ON_OPEN" || p.assignMode === "AUTO_DAY1",
    );
  }
  return [];
}

/**
 * A LAB/EXAM line stored with the default PROCEDURE_ORDER is still a study.
 * Explicit LAB_ORDER / VISIT is kept. Assign mode is not changed.
 */
export function fulfillmentRespectingStudyKind(
  kind: string | null | undefined,
  fulfillment: string | null | undefined,
): "PROCEDURE_ORDER" | "LAB_ORDER" | "VISIT" {
  if (fulfillment === "LAB_ORDER" || fulfillment === "VISIT") return fulfillment;
  if (kind === "LAB") return "LAB_ORDER";
  if (kind === "EXAM") return "VISIT";
  return "PROCEDURE_ORDER";
}

function axesFromLegacyTemplateProc(p: {
  assignMode?: string | null;
  fulfillment?: string | null;
  quotaBasis?: string | null;
  requiresDoctor?: boolean | null;
  kind?: string | null;
  procedureCode: string;
  procedureName: string;
  quotaTotal: number;
  sortOrder?: number | null;
}): SnapshotProc {
  const assignMode =
    p.assignMode === "AUTO_ON_OPEN" ||
    p.assignMode === "AUTO_DAY1" ||
    p.assignMode === "ON_INDICATION" ||
    p.assignMode === "MANUAL"
      ? p.assignMode
      : "MANUAL";
  const fulfillment = fulfillmentRespectingStudyKind(p.kind, p.fulfillment);
  const quotaBasis = p.quotaBasis === "PER_STAY" ? "PER_STAY" : "PER_NIGHTS";
  const axes: EntitlementBlockAxes = {
    assignMode,
    fulfillment,
    quotaBasis,
    requiresDoctor: Boolean(p.requiresDoctor),
  };
  return {
    procedureCode: p.procedureCode,
    procedureName: p.procedureName,
    quotaTotal: p.quotaTotal,
    kind: p.kind ?? null,
    sortOrder: p.sortOrder ?? 0,
    ...axes,
  };
}

/**
 * Apply ProgramTemplate auto blocks (VISIT / LAB_ORDER) for an episode.
 * PROCEDURE_ORDER blocks are never auto-created (manual package-assign).
 * Idempotent via existing visit/lab existence checks.
 */
export async function applyPackageAutoBlocks(
  episodeId: string,
  opts: { trigger: AutoApplyTrigger },
): Promise<AutoApplyResult> {
  const episode = await prisma.clinicalEpisode.findUnique({
    where: { id: episodeId },
    include: {
      patientRef: true,
      programInstance: {
        include: {
          procedureLines: true,
          template: { include: { procedures: true } },
        },
      },
    },
  });
  if (!episode?.patientRefId || !episode.patientRef) {
    throw new Error("Episode patient not found");
  }
  const instance = episode.programInstance;
  const programCode = (instance?.programCode ?? episode.programCode)?.trim() || "";
  if (!instance && (opts.trigger !== "CARE_TEAM" || !programCode)) {
    return { skipped: "NO_PROGRAM" };
  }

  const currentTemplate = await prisma.programTemplate.findFirst({
    where: {
      organizationId: episode.organizationId,
      code: programCode,
      isCurrent: true,
    },
    include: { procedures: true },
  });

  let snap =
    (instance ? parseEntitlementSnapshot(instance.entitlementSnapshot) : null) ??
    (instance
      ? ({
          version: instance.template?.version ?? 1,
          templateId: instance.templateId,
          code: instance.programCode,
          procedures: (instance.template?.procedures ?? []).map(axesFromLegacyTemplateProc),
          knots: [],
          members: [],
        } satisfies EntitlementSnapshot)
      : null);

  if (!snap) {
    if (!currentTemplate?.procedures.length) return { skipped: "NO_PROGRAM" };
    snap = {
      version: currentTemplate.version,
      templateId: currentTemplate.id,
      code: currentTemplate.code,
      procedures: currentTemplate.procedures.map(axesFromLegacyTemplateProc),
      knots: [],
      members: [],
    };
  }

  let axesRewritten = false;
  if (instance && opts.trigger === "MANUAL_RETRY") {
    if (currentTemplate?.procedures.length) {
      snap = {
        ...snap,
        procedures: overlayTemplateAxes(snap.procedures, currentTemplate.procedures),
      };
      axesRewritten = true;
    }
  }

  const sex = episode.patientRef.sex;
  const selected = selectAutoBlocks(
    snap.procedures.map((block) => ({
      ...block,
      fulfillment: effectiveAutoFulfillment(block, sex),
    })),
    opts.trigger,
    instance?.autoApplyState ?? "PENDING",
  );

  const patientRefId = episode.patientRefId;
  const organizationId = episode.organizationId;
  const practitionerId = await resolveCareTeamPractitioner(episodeId);

  const createdVisitCodes: string[] = [];
  const skippedVisitCodes: string[] = [];
  const createdLabCodes: string[] = [];
  const skippedLabCodes: string[] = [];
  const skippedProcedureCodes: string[] = [];
  let pendingDoctor = false;
  const quotaCodesTouched = new Set<string>();

  const { syncEntitlementUsage } = await import(
    "@/domain/sanatorium/entitlement-usage.service"
  );
  const { applyPriceMissingFallback, resolveEntitlementCharge } = await import(
    "@/domain/sanatorium/entitlement-charge.service"
  );
  const patientOrigin =
    episode.patientOrigin === "WALK_IN" ? "WALK_IN" : "IN_HOUSE";

  for (const block of selected) {
    if (block.fulfillment === "PROCEDURE_ORDER") {
      skippedProcedureCodes.push(block.procedureCode);
      continue;
    }

    // Visit.practitionerId is non-null in schema, so a VISIT block always needs a
    // doctor regardless of requiresDoctor (which only frees LAB_ORDER blocks).
    const needsDoctor = block.requiresDoctor || block.fulfillment === "VISIT";
    if (needsDoctor && !practitionerId) {
      pendingDoctor = true;
      if (block.fulfillment === "VISIT") {
        skippedVisitCodes.push(block.procedureCode);
      } else {
        skippedLabCodes.push(block.procedureCode);
      }
      continue;
    }

    const serviceCode = resolveAutoBlockServiceCode(block.procedureCode, sex);
    if (!serviceCode) {
      if (block.fulfillment === "VISIT") skippedVisitCodes.push(block.procedureCode);
      else skippedLabCodes.push(block.procedureCode);
      continue;
    }

    if (block.fulfillment === "LAB_ORDER") {
      if (await hasLabOrder(patientRefId, episodeId, serviceCode)) {
        skippedLabCodes.push(serviceCode);
        continue;
      }
      await createLabOrderWithItems({
        patientRefId,
        clinicalEpisodeId: episodeId,
        codes: [serviceCode],
        source: "IN_HOUSE",
        fasting: false,
        patientOrigin,
      });
      createdLabCodes.push(serviceCode);
      quotaCodesTouched.add(block.procedureCode);
      continue;
    }

    // VISIT
    if (await hasVisitLine(patientRefId, episodeId, serviceCode)) {
      skippedVisitCodes.push(serviceCode);
      continue;
    }

    const charge = applyPriceMissingFallback(
      await resolveEntitlementCharge({
        episodeId,
        patientOrigin,
        quotaCode: block.procedureCode,
        serviceCode,
        inPackage: true,
      }),
      { serviceCode, where: "auto-apply-visit" },
    );

    const visit = await prisma.visit.create({
      data: {
        organizationId,
        patientRefId,
        // Guaranteed by the needsDoctor guard above.
        practitionerId: practitionerId!,
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
        serviceCode,
        description: VISIT_TITLES[serviceCode] ?? block.procedureName ?? serviceCode,
        amount: charge.amountNet,
        inPackage: Boolean(instance),
        packageQuotaCode: instance ? block.procedureCode : null,
      },
    });
    createdVisitCodes.push(serviceCode);
    quotaCodesTouched.add(block.procedureCode);
  }

  if (instance) {
    for (const quotaCode of quotaCodesTouched) {
      await syncEntitlementUsage({
        instanceId: instance.id,
        episodeId,
        quotaCode,
      });
    }
  }

  const autoEligible = selected.filter((p) => p.fulfillment !== "PROCEDURE_ORDER");
  let autoApplyState: string;
  if (pendingDoctor) {
    autoApplyState = "PENDING_DOCTOR";
  } else if (
    autoEligible.length === 0 ||
    (createdVisitCodes.length === 0 &&
      createdLabCodes.length === 0 &&
      skippedVisitCodes.length + skippedLabCodes.length >= autoEligible.length)
  ) {
    // Nothing pending doctor and either nothing to do or all already present
    const anyCreated =
      createdVisitCodes.length > 0 || createdLabCodes.length > 0;
    const anySkipped =
      skippedVisitCodes.length > 0 || skippedLabCodes.length > 0;
    if (!anyCreated && !anySkipped && autoEligible.length === 0) {
      autoApplyState =
        !instance || instance.autoApplyState === "PENDING"
          ? "APPLIED"
          : instance.autoApplyState;
    } else if (anyCreated && anySkipped) {
      autoApplyState = "PARTIAL";
    } else {
      autoApplyState = "APPLIED";
    }
  } else if (
    createdVisitCodes.length + createdLabCodes.length > 0 &&
    skippedVisitCodes.length + skippedLabCodes.length > 0
  ) {
    autoApplyState = "PARTIAL";
  } else {
    autoApplyState = "APPLIED";
  }

  const noteParts = [
    `trigger=${opts.trigger}`,
    createdVisitCodes.length ? `visits+${createdVisitCodes.join(",")}` : null,
    createdLabCodes.length ? `labs+${createdLabCodes.join(",")}` : null,
    pendingDoctor ? "pending_doctor" : null,
  ].filter(Boolean);

  if (instance) {
    await prisma.programInstance.update({
      where: { id: instance.id },
      data: {
        autoApplyState,
        autoApplyAt: new Date(),
        autoApplyNote: noteParts.join("; ").slice(0, 500),
        ...(axesRewritten ? { entitlementSnapshot: snap } : {}),
      },
    });
  }

  return {
    episodeId,
    autoApplyState,
    createdVisitCodes,
    createdLabCodes,
    skippedVisitCodes,
    skippedLabCodes,
    skippedProcedureCodes,
    pendingDoctor,
  };
}

/**
 * Package open does not create studies. Orders made at the first doctor were
 * outside the quota; once the instance exists, mark those auto lines in-package.
 */
export async function linkExistingAutoOrdersToPackage(episodeId: string): Promise<void> {
  const episode = await prisma.clinicalEpisode.findUnique({
    where: { id: episodeId },
    include: { patientRef: true, programInstance: true },
  });
  const instance = episode?.programInstance;
  const snap = instance ? parseEntitlementSnapshot(instance.entitlementSnapshot) : null;
  if (!episode?.patientRef || !instance || !snap) return;

  const sex = episode.patientRef.sex;
  const selected = selectAutoBlocks(
    snap.procedures.map((block) => ({
      ...block,
      fulfillment: effectiveAutoFulfillment(block, sex),
    })),
    "CARE_TEAM",
    instance.autoApplyState,
  );
  const { syncEntitlementUsage } = await import(
    "@/domain/sanatorium/entitlement-usage.service"
  );

  for (const block of selected) {
    if (block.fulfillment === "PROCEDURE_ORDER") continue;
    const serviceCode = resolveAutoBlockServiceCode(block.procedureCode, sex);
    if (!serviceCode) continue;
    if (block.fulfillment === "LAB_ORDER") {
      await prisma.labOrderItem.updateMany({
        where: {
          inPackage: false,
          serviceCode,
          labOrder: {
            clinicalEpisodeId: episodeId,
            status: { not: "CANCELLED" },
          },
        },
        data: { inPackage: true, packageQuotaCode: block.procedureCode },
      });
    } else {
      await prisma.visitServiceLine.updateMany({
        where: {
          inPackage: false,
          serviceCode,
          visit: {
            clinicalEpisodeId: episodeId,
            status: { not: "CANCELLED" },
          },
        },
        data: { inPackage: true, packageQuotaCode: block.procedureCode },
      });
    }
    await syncEntitlementUsage({
      instanceId: instance.id,
      episodeId,
      quotaCode: block.procedureCode,
    });
  }
}
