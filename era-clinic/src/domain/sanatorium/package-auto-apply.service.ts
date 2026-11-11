import { lookupHotelStayWindow } from "@/lib/hotel-stay-person";
import { prisma } from "@/lib/prisma";
import { nightsBetween } from "@/lib/program-quota";
import { createLabOrderWithItems } from "@/domain/lab/lab-order-write.service";
import {
  parseEntitlementSnapshot,
  type EntitlementBlockAxes,
  type EntitlementSnapshot,
} from "@/domain/sanatorium/program-template-admin";
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

function stayNightsForAdopt(startsOn: unknown, endsOn: unknown): number | null {
  if (startsOn == null || endsOn == null) return null;
  const start = startsOn instanceof Date ? startsOn : new Date(String(startsOn));
  const end = endsOn instanceof Date ? endsOn : new Date(String(endsOn));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return nightsBetween(start, end) || 1;
}

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

/** Ensure a study block row exists so diagnostics modal studyBalances + stamp resolve. */
async function ensureStudyQuotaLine(input: {
  instanceId: string;
  organizationId: string;
  procedureCode: string;
  quotaTotal: number;
  existingCodes: Set<string>;
}): Promise<void> {
  if (input.existingCodes.has(input.procedureCode)) return;
  await prisma.programProcedureBalance.create({
    data: {
      organizationId: input.organizationId,
      instanceId: input.instanceId,
      procedureCode: input.procedureCode,
      quotaTotal: Math.max(1, input.quotaTotal || 1),
      quotaUsed: 0,
    },
  });
  input.existingCodes.add(input.procedureCode);
}

/**
 * Heal auto labs/diagnostics created without package stamp (inPackage false,
 * unpaid) so DiagnosticsAssignModal assignedStudies can list them.
 */
export async function healUnstampedPackageAutoLabs(input: {
  episodeId: string;
  instanceId: string;
  organizationId: string;
  autoLabBlocks: Array<{ procedureCode: string; quotaTotal: number; serviceCode: string }>;
}): Promise<{ healed: number }> {
  if (input.autoLabBlocks.length === 0) return { healed: 0 };
  const { syncEntitlementUsage } = await import(
    "@/domain/sanatorium/entitlement-usage.service"
  );
  const existingLines = await prisma.programProcedureBalance.findMany({
    where: { instanceId: input.instanceId },
    select: { procedureCode: true },
  });
  const existingCodes = new Set(existingLines.map((row) => row.procedureCode));
  let healed = 0;
  const touchedQuota = new Set<string>();

  for (const block of input.autoLabBlocks) {
    await ensureStudyQuotaLine({
      instanceId: input.instanceId,
      organizationId: input.organizationId,
      procedureCode: block.procedureCode,
      quotaTotal: block.quotaTotal,
      existingCodes,
    });
    const orders = await prisma.labOrder.findMany({
      where: {
        clinicalEpisodeId: input.episodeId,
        inPackage: false,
        settledAt: null,
        status: { not: "CANCELLED" },
        OR: [
          { testCode: block.serviceCode },
          { items: { some: { serviceCode: block.serviceCode } } },
        ],
      },
      select: { id: true, amountNet: true },
    });
    const line = await prisma.programProcedureBalance.findFirst({
      where: {
        instanceId: input.instanceId,
        procedureCode: block.procedureCode,
      },
      select: { quotaTotal: true, quotaUsed: true },
    });
    let remaining = line
      ? Math.max(0, line.quotaTotal - line.quotaUsed)
      : 0;
    for (const order of orders) {
      // No package slot left: keep unstamped rows as extras (paid or free duplicates).
      if (remaining <= 0) continue;
      await prisma.$transaction([
        prisma.labOrder.update({
          where: { id: order.id },
          data: {
            inPackage: true,
            packageQuotaCode: block.procedureCode,
            amountNet: 0,
          },
        }),
        prisma.labOrderItem.updateMany({
          where: { labOrderId: order.id },
          data: {
            inPackage: true,
            packageQuotaCode: block.procedureCode,
            amountNet: 0,
          },
        }),
      ]);
      healed += 1;
      remaining -= 1;
      touchedQuota.add(block.procedureCode);
    }
  }
  for (const quotaCode of touchedQuota) {
    await syncEntitlementUsage({
      instanceId: input.instanceId,
      episodeId: input.episodeId,
      quotaCode,
    });
  }
  return { healed };
}

/**
 * Catalog SKUs attached to a quota block. The block code is only the quota key
 * and is never itself a bookable service.
 */
export function resolveAutoBlockServiceCodes(
  blockCode: string,
  members: ReadonlyArray<{ blockCode: string; procedureCode: string }>,
): string[] {
  const code = blockCode.trim();
  if (!code) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const member of members) {
    if (member.blockCode !== code) continue;
    const sku = member.procedureCode.trim();
    if (!sku || seen.has(sku)) continue;
    seen.add(sku);
    out.push(sku);
  }
  return out;
}

/**
 * LAB/EXAM kind wins over a stored PROCEDURE_ORDER default.
 * A procedure block stays a procedure: auto booking uses block members, not the quota key.
 */
export function effectiveAutoFulfillment(
  block: {
    kind?: string | null;
    fulfillment?: string | null;
    fulfillmentExplicit?: boolean | null;
    procedureCode: string;
  },
  _sex?: string | null,
): "PROCEDURE_ORDER" | "LAB_ORDER" | "VISIT" {
  return fulfillmentRespectingStudyKind(
    block.kind,
    block.fulfillment,
    block.fulfillmentExplicit === true,
  );
}

/** Catalog codes that can become a lab order. Unknown strings are not bookable. */
async function catalogLabCodes(codes: string[]): Promise<Set<string>> {
  if (codes.length === 0) return new Set();
  const rows = await prisma.diagnosticService.findMany({
    where: { OR: [{ code: { in: codes } }, { serviceCode: { in: codes } }] },
    select: { code: true, serviceCode: true, active: true },
  });
  const known = new Set<string>();
  for (const row of rows) {
    if (row.active === false) continue;
    known.add(row.code);
    if (row.serviceCode) known.add(row.serviceCode);
  }
  return new Set(codes.filter((code) => known.has(code)));
}

type TemplateAxisRow = {
  procedureCode: string;
  assignMode?: string | null;
  fulfillment?: string | null;
  fulfillmentExplicit?: boolean | null;
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
      fulfillmentExplicit: next.fulfillmentExplicit,
      quotaBasis: row.quotaBasis,
      requiresDoctor: next.requiresDoctor,
      showInProcedures: row.showInProcedures,
      procedureOrder: row.procedureOrder,
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
  explicit = false,
): "PROCEDURE_ORDER" | "LAB_ORDER" | "VISIT" {
  if (
    explicit &&
    (fulfillment === "LAB_ORDER" || fulfillment === "VISIT" || fulfillment === "PROCEDURE_ORDER")
  ) {
    return fulfillment;
  }
  if (fulfillment === "LAB_ORDER" || fulfillment === "VISIT") return fulfillment;
  if (kind === "LAB") return "LAB_ORDER";
  if (kind === "EXAM") return "VISIT";
  return "PROCEDURE_ORDER";
}

function axesFromLegacyTemplateProc(p: {
  assignMode?: string | null;
  fulfillment?: string | null;
  fulfillmentExplicit?: boolean | null;
  quotaBasis?: string | null;
  requiresDoctor?: boolean | null;
  kind?: string | null;
  procedureCode: string;
  procedureName: string;
  quotaTotal: number;
  sortOrder?: number | null;
  showInProcedures?: boolean | null;
  procedureOrder?: number | null;
}): SnapshotProc {
  const assignMode =
    p.assignMode === "AUTO_ON_OPEN" ||
    p.assignMode === "AUTO_DAY1" ||
    p.assignMode === "ON_INDICATION" ||
    p.assignMode === "MANUAL"
      ? p.assignMode
      : "MANUAL";
  const fulfillment = fulfillmentRespectingStudyKind(
    p.kind,
    p.fulfillment,
    p.fulfillmentExplicit === true,
  );
  const quotaBasis = p.quotaBasis === "PER_STAY" ? "PER_STAY" : "PER_NIGHTS";
  const axes: EntitlementBlockAxes = {
    assignMode,
    fulfillment,
    fulfillmentExplicit: p.fulfillmentExplicit === true,
    quotaBasis,
    requiresDoctor: Boolean(p.requiresDoctor),
  };
  return {
    procedureCode: p.procedureCode,
    procedureName: p.procedureName,
    quotaTotal: p.quotaTotal,
    kind: p.kind ?? null,
    sortOrder: p.sortOrder ?? 0,
    showInProcedures: p.showInProcedures === true,
    procedureOrder: p.procedureOrder ?? p.sortOrder ?? 0,
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
          template: { include: { procedures: true, blockMembers: true } },
        },
      },
    },
  });
  if (!episode?.patientRefId || !episode.patientRef) {
    throw new Error("Episode patient not found");
  }
  const { seedAutoPaidLabs } = await import("@/domain/sanatorium/auto-paid-lab.service");
  await seedAutoPaidLabs(episodeId);
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
    include: { procedures: true, blockMembers: true },
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
          members: (instance.template?.blockMembers ?? []).map((member) => ({
            blockCode: member.blockCode,
            procedureCode: member.procedureCode,
          })),
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
      members: (currentTemplate.blockMembers ?? []).map((member) => ({
        blockCode: member.blockCode,
        procedureCode: member.procedureCode,
      })),
    };
  }

  let axesRewritten = false;
  if (instance && opts.trigger === "MANUAL_RETRY") {
    const hotel = episode.reservationId
      ? await lookupHotelStayWindow(episode.reservationId)
      : null;
    const stayStart = hotel ? new Date(hotel.checkInDate) : instance.startsOn;
    const stayEnd = hotel ? new Date(hotel.checkOutDate) : instance.endsOn;
    const nights = stayNightsForAdopt(stayStart, stayEnd);
    if (nights != null) {
      const { recalcProgramQuotas } = await import("@/lib/sanatorium-scheduler.service");
      await recalcProgramQuotas(instance.id, {
        nights,
        adoptCurrentVersion: true,
        ...(hotel ? { startsOn: stayStart, endsOn: stayEnd } : {}),
      });
      const refreshed = await prisma.programInstance.findUnique({
        where: { id: instance.id },
        select: {
          entitlementSnapshot: true,
          procedureLines: true,
          template: { include: { procedures: true } },
        },
      });
      if (refreshed?.procedureLines) {
        instance.procedureLines = refreshed.procedureLines;
      }
      const refreshedSnap = refreshed
        ? parseEntitlementSnapshot(refreshed.entitlementSnapshot)
        : null;
      if (refreshedSnap) {
        snap = refreshedSnap;
        axesRewritten = true;
      }
    }
    if (!axesRewritten && currentTemplate?.procedures.length) {
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
  const lineCodes = new Set(
    (instance?.procedureLines ?? []).map((row) => row.procedureCode),
  );
  const autoLabBlocksForHeal: Array<{
    procedureCode: string;
    quotaTotal: number;
    serviceCode: string;
  }> = [];

  const { syncEntitlementUsage } = await import(
    "@/domain/sanatorium/entitlement-usage.service"
  );
  const patientOrigin =
    episode.patientOrigin === "WALK_IN" ? "WALK_IN" : "IN_HOUSE";
  const { freshBroughtInCodes } = await import("@/domain/lab/brought-in-result");
  const broughtInFresh = await freshBroughtInCodes(episodeId);

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

    const serviceCodes = resolveAutoBlockServiceCodes(block.procedureCode, snap.members);
    if (serviceCodes.length === 0) {
      if (block.fulfillment === "VISIT") skippedVisitCodes.push(block.procedureCode);
      else skippedLabCodes.push(block.procedureCode);
      continue;
    }

    const quotaTotal = Math.max(Number(block.quotaTotal) || 1, serviceCodes.length);
    if (instance) {
      await ensureStudyQuotaLine({
        instanceId: instance.id,
        organizationId: episode.organizationId,
        procedureCode: block.procedureCode,
        quotaTotal,
        existingCodes: lineCodes,
      });
      await prisma.programProcedureBalance.updateMany({
        where: {
          instanceId: instance.id,
          procedureCode: block.procedureCode,
          quotaTotal: { lt: quotaTotal },
        },
        data: { quotaTotal },
      });
    }

    if (block.fulfillment === "LAB_ORDER") {
      const catalog = await catalogLabCodes(serviceCodes);
      for (const serviceCode of serviceCodes) {
        if (instance) {
          autoLabBlocksForHeal.push({
            procedureCode: block.procedureCode,
            quotaTotal,
            serviceCode,
          });
        }
        if (!catalog.has(serviceCode)) {
          skippedLabCodes.push(serviceCode);
          continue;
        }
        if (await hasLabOrder(patientRefId, episodeId, serviceCode)) {
          skippedLabCodes.push(serviceCode);
          continue;
        }
        if (broughtInFresh.has(serviceCode)) {
          skippedLabCodes.push(serviceCode);
          continue;
        }
        try {
          await createLabOrderWithItems({
            patientRefId,
            clinicalEpisodeId: episodeId,
            codes: [serviceCode],
            source: "IN_HOUSE",
            fasting: false,
            patientOrigin,
            packageStamp: instance
              ? { packageQuotaCode: block.procedureCode }
              : null,
          });
        } catch (err) {
          console.warn("[package-auto-apply] lab member skipped", serviceCode, err);
          skippedLabCodes.push(serviceCode);
          continue;
        }
        createdLabCodes.push(serviceCode);
        quotaCodesTouched.add(block.procedureCode);
      }
      continue;
    }

    for (const serviceCode of serviceCodes) {
      if (await hasVisitLine(patientRefId, episodeId, serviceCode)) {
        skippedVisitCodes.push(serviceCode);
        continue;
      }

      // Package auto visits are entitlement burns — never stamp list price here.
      const visit = await prisma.visit.create({
        data: {
          organizationId,
          patientRefId,
          practitionerId: practitionerId!,
          clinicalEpisodeId: episodeId,
          status: "IN_PROGRESS",
          patientOrigin: episode.patientOrigin,
          reservationId: episode.reservationId,
          roomNumber: episode.roomNumber,
          amountNet: 0,
        },
      });
      await prisma.visitServiceLine.create({
        data: {
          visitId: visit.id,
          serviceCode,
          description: VISIT_TITLES[serviceCode] ?? block.procedureName ?? serviceCode,
          amount: 0,
          inPackage: Boolean(instance),
          packageQuotaCode: instance ? block.procedureCode : null,
        },
      });
      createdVisitCodes.push(serviceCode);
      quotaCodesTouched.add(block.procedureCode);
    }
  }

  if (instance) {
    await healUnstampedPackageAutoLabs({
      episodeId,
      instanceId: instance.id,
      organizationId: episode.organizationId,
      autoLabBlocks: autoLabBlocksForHeal,
    });

    for (const quotaCode of quotaCodesTouched) {
      await syncEntitlementUsage({
        instanceId: instance.id,
        episodeId,
        quotaCode,
      });
    }
  }

  const releaseServices = await prisma.diagnosticService.findMany({
    where: {
      organizationId,
      active: true,
      guestBlankRelease: "AFTER_PAYMENT",
    },
    select: { code: true, serviceCode: true },
  });
  for (const service of releaseServices) {
    if (
      broughtInFresh.has(service.code) ||
      broughtInFresh.has(service.serviceCode) ||
      (await hasLabOrder(patientRefId, episodeId, service.code)) ||
      (service.serviceCode !== service.code &&
        (await hasLabOrder(patientRefId, episodeId, service.serviceCode)))
    ) {
      continue;
    }
    const inPackage = lineCodes.has(service.code) || lineCodes.has(service.serviceCode);
    let amount = 0;
    if (!inPackage) {
      const { resolveEntitlementCharge } = await import(
        "@/domain/sanatorium/entitlement-charge.service"
      );
      const charge = await resolveEntitlementCharge({
        patientOrigin: "WALK_IN",
        serviceCode: service.serviceCode,
      });
      if (charge.priceMissing || !(charge.amountNet > 0)) {
        console.warn("[package-auto-apply] release lab has no price", service.code);
        continue;
      }
      amount = charge.amountNet;
    }
    try {
      await createLabOrderWithItems({
        patientRefId,
        clinicalEpisodeId: episodeId,
        codes: [service.code],
        source: "IN_HOUSE",
        fasting: false,
        patientOrigin,
        ...(inPackage
          ? { packageStamp: { packageQuotaCode: service.code } }
          : {
              forcePaid: true,
              amountNet: amount,
              amountsByCode: { [service.code]: amount, [service.serviceCode]: amount },
            }),
      });
      createdLabCodes.push(service.code);
    } catch (err) {
      console.warn("[package-auto-apply] release lab seed failed", service.code, err);
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
 * Stamp auto orders that already exist onto the new course.
 * Missing labs and visits are created by applyPackageAutoBlocks when the
 * course is saved, not here. Labs go through healUnstampedPackageAutoLabs so
 * LabOrder header + items + amountNet stay aligned (assignedStudies filters
 * header inPackage).
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

  const autoLabBlocks: Array<{
    procedureCode: string;
    quotaTotal: number;
    serviceCode: string;
  }> = [];

  for (const block of selected) {
    if (block.fulfillment === "PROCEDURE_ORDER") continue;
    const serviceCodes = resolveAutoBlockServiceCodes(block.procedureCode, snap.members);
    const quotaTotal = Math.max(Number(block.quotaTotal) || 1, serviceCodes.length);
    if (block.fulfillment === "LAB_ORDER") {
      for (const serviceCode of serviceCodes) {
        autoLabBlocks.push({
          procedureCode: block.procedureCode,
          quotaTotal,
          serviceCode,
        });
      }
      continue;
    }
    for (const serviceCode of serviceCodes) {
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
      await syncEntitlementUsage({
        instanceId: instance.id,
        episodeId,
        quotaCode: block.procedureCode,
      });
    }
  }

  await healUnstampedPackageAutoLabs({
    episodeId,
    instanceId: instance.id,
    organizationId: episode.organizationId,
    autoLabBlocks,
  });
}
