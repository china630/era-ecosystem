import { prisma } from "@/lib/prisma";
import { nightsBetween, applyQuotaRecalc } from "@/lib/program-quota";
import {
  resolveBlockQuotaTotal,
  recalcProgramQuotas,
} from "@/lib/sanatorium-scheduler.service";
import {
  findCurrentProgramTemplate,
  programTemplateInclude,
  saveProgramTemplatePatch,
} from "@/domain/sanatorium/program-template-admin";
import { resolveQuotaMode } from "@/lib/program-quota";

export type RecalcPreviewLine = {
  instanceId: string;
  episodeId: string;
  programCode: string;
  patientLabel: string;
  procedureCode: string;
  procedureName: string;
  quotaUsed: number;
  quotaTotalBefore: number;
  quotaTotalAfter: number;
  flooredAtUsed: boolean;
};

export type RecalcPreviewResult = {
  code: string;
  templateId: string;
  quotaMode: "FIXED" | "DAILY_RATE";
  openCourseCount: number;
  lines: RecalcPreviewLine[];
};

async function openInstancesForCode(code: string) {
  return prisma.programInstance.findMany({
    where: {
      programCode: code,
      episode: { status: "OPEN" },
    },
    include: {
      procedureLines: true,
      episode: {
        select: {
          id: true,
          patientRef: {
            select: { firstName: true, lastName: true, middleName: true },
          },
        },
      },
    },
    orderBy: { startsOn: "asc" },
  });
}

function patientLabel(row: {
  firstName?: string | null;
  lastName?: string | null;
  middleName?: string | null;
}): string {
  return [row.lastName, row.firstName, row.middleName]
    .map((p) => (p ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

/** Preview adopt-current daily-rate totals for open courses of this package code. */
export async function previewOpenCourseQuotaRecalc(
  templateId: string,
): Promise<RecalcPreviewResult> {
  const current = await prisma.programTemplate.findUnique({
    where: { id: templateId },
    include: programTemplateInclude,
  });
  if (!current || !current.isCurrent) {
    const err = new Error("NOT_CURRENT");
    (err as Error & { code?: string }).code = "NOT_CURRENT";
    throw err;
  }
  const live = await findCurrentProgramTemplate(current.code);
  if (!live) {
    const err = new Error("TEMPLATE_NOT_FOUND");
    (err as Error & { code?: string }).code = "TEMPLATE_NOT_FOUND";
    throw err;
  }
  const quotaMode = resolveQuotaMode(live.quotaMode);
  const countSunday = Boolean(live.countSunday);
  const instances = await openInstancesForCode(live.code);
  const nameByCode = new Map(
    live.procedures.map((p: { procedureCode: string; procedureName: string }) => [
      p.procedureCode,
      p.procedureName,
    ]),
  );
  const lines: RecalcPreviewLine[] = [];
  for (const inst of instances) {
    const nights =
      nightsBetween(inst.startsOn, inst.endsOn) || live.durationDays;
    const byCode = new Map(inst.procedureLines.map((l) => [l.procedureCode, l]));
    for (const p of live.procedures) {
      const computed = resolveBlockQuotaTotal({
        quotaMode,
        countSunday,
        nights,
        checkIn: inst.startsOn,
        endsOn: inst.endsOn,
        procedure: p,
        knots: live.quotaKnots,
        minNights: live.minNights,
        maxNights: live.maxNights,
      });
      const existing = byCode.get(p.procedureCode);
      const used = existing?.quotaUsed ?? 0;
      const before = existing?.quotaTotal ?? 0;
      const { quotaTotal } = applyQuotaRecalc(used, computed);
      lines.push({
        instanceId: inst.id,
        episodeId: inst.episodeId,
        programCode: inst.programCode,
        patientLabel: patientLabel(inst.episode.patientRef ?? {}),
        procedureCode: p.procedureCode,
        procedureName: nameByCode.get(p.procedureCode) ?? p.procedureCode,
        quotaUsed: used,
        quotaTotalBefore: before,
        quotaTotalAfter: quotaTotal,
        flooredAtUsed: quotaTotal > computed,
      });
    }
  }
  return {
    code: live.code,
    templateId: live.id,
    quotaMode,
    openCourseCount: instances.length,
    lines,
  };
}

/** Apply adopt-current recalc to every open course of this package code. */
export async function applyOpenCourseQuotaRecalc(templateId: string): Promise<{
  updated: number;
  code: string;
}> {
  const preview = await previewOpenCourseQuotaRecalc(templateId);
  if (preview.quotaMode !== "DAILY_RATE") {
    const err = new Error("NOT_DAILY_RATE");
    (err as Error & { code?: string }).code = "NOT_DAILY_RATE";
    throw err;
  }
  const instances = await openInstancesForCode(preview.code);
  let updated = 0;
  for (const inst of instances) {
    const nights =
      nightsBetween(inst.startsOn, inst.endsOn) ||
      (
        await prisma.programTemplate.findUnique({
          where: { id: preview.templateId },
          select: { durationDays: true },
        })
      )?.durationDays ||
      1;
    await recalcProgramQuotas(inst.id, {
      nights,
      startsOn: inst.startsOn,
      endsOn: inst.endsOn,
      reservationId: inst.reservationId,
      adoptCurrentVersion: true,
    });
    updated += 1;
  }
  return { updated, code: preview.code };
}

/**
 * Publish a FIXED package as a new DAILY_RATE version of the same code.
 * Per-block modes: DAILY_RATE (fractional ceil), WEEKLY, PER_STAY.
 * Open courses stay on the retired version until recalc.
 */
export async function publishFixedAsDailyRate(
  templateId: string,
  opts?: {
    countSunday?: boolean;
    blocks?: Array<{
      procedureCode: string;
      blockQuotaMode?: "DAILY_RATE" | "WEEKLY" | "PER_STAY";
      quotaPerNight?: number;
      quotaPerWeek?: number | null;
      dailyUseCap?: number | null;
      quotaTotal?: number;
    }>;
  },
) {
  const { defaultBlockQuotaMode } = await import("@/lib/program-quota");
  const existing = await prisma.programTemplate.findUnique({
    where: { id: templateId },
    include: programTemplateInclude,
  });
  if (!existing || !existing.isCurrent) {
    const err = new Error("NOT_CURRENT");
    (err as Error & { code?: string }).code = "NOT_CURRENT";
    throw err;
  }
  if (existing.quotaMode === "DAILY_RATE") {
    const err = new Error("ALREADY_DAILY_RATE");
    (err as Error & { code?: string }).code = "ALREADY_DAILY_RATE";
    throw err;
  }
  const override = new Map(
    (opts?.blocks ?? []).map((b) => [b.procedureCode, b]),
  );
  const procedures = existing.procedures.map((p) => {
    const members = existing.blockMembers
      .filter((m) => m.blockCode === p.procedureCode)
      .map((m) => m.procedureCode);
    const fromCap =
      p.dailyDistinctCap != null && p.dailyDistinctCap >= 1
        ? p.dailyDistinctCap
        : 1;
    const o = override.get(p.procedureCode);
    const kind = (p.kind as
      | "PHYSIO"
      | "BATH"
      | "PARAFFIN"
      | "LAB"
      | "EXAM"
      | "CUSTOM"
      | null) ?? null;
    const blockQuotaMode =
      o?.blockQuotaMode ??
      defaultBlockQuotaMode({
        kind,
        quotaBasis: p.quotaBasis,
      });
    const quotaPerNight =
      blockQuotaMode === "DAILY_RATE"
        ? (o?.quotaPerNight ?? fromCap)
        : (o?.quotaPerNight ?? null);
    const quotaPerWeek =
      blockQuotaMode === "WEEKLY"
        ? (o?.quotaPerWeek ?? 1)
        : (o?.quotaPerWeek ?? null);
    const stayTotal =
      blockQuotaMode === "PER_STAY"
        ? Math.max(1, o?.quotaTotal ?? (p.quotaTotal || 1))
        : Math.max(1, p.quotaTotal || Math.ceil(Number(quotaPerNight) || 1));
    const dailyUseCap =
      blockQuotaMode === "DAILY_RATE"
        ? (o?.dailyUseCap ??
          Math.max(1, Math.ceil(Number(quotaPerNight) || 1)))
        : (o?.dailyUseCap ?? null);
    return {
      procedureCode: p.procedureCode,
      procedureName: p.procedureName,
      quotaTotal: stayTotal,
      avoidAfterHour: p.avoidAfterHour ?? undefined,
      kind,
      blockQuotaMode,
      dailyDistinctCap: p.dailyDistinctCap ?? null,
      quotaPerNight,
      quotaPerWeek,
      dailyUseCap,
      sortOrder: p.sortOrder,
      showInProcedures: p.showInProcedures === true,
      procedureOrder: p.procedureOrder,
      memberCodes: members,
      assignMode: p.assignMode as
        | "AUTO_ON_OPEN"
        | "AUTO_DAY1"
        | "ON_INDICATION"
        | "MANUAL"
        | undefined,
      fulfillment: p.fulfillment as
        | "PROCEDURE_ORDER"
        | "LAB_ORDER"
        | "VISIT"
        | undefined,
      fulfillmentExplicit: p.fulfillmentExplicit === true,
      quotaBasis: p.quotaBasis as "PER_NIGHTS" | "PER_STAY" | undefined,
      requiresDoctor: p.requiresDoctor === true,
    };
  });
  return saveProgramTemplatePatch(templateId, {
    quotaMode: "DAILY_RATE",
    countSunday: opts?.countSunday ?? false,
    procedures, // saveProgramTemplatePatch normalizes block modes for DAILY_RATE
    knots: [],
  });
}
