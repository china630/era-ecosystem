import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { SatelliteTransactionClient } from "@era/satellite-kit/tenancy";
import { defaultBlockQuotaMode } from "@/lib/program-quota";

const assignModeSchema = z.enum([
  "AUTO_ON_OPEN",
  "AUTO_DAY1",
  "ON_INDICATION",
  "MANUAL",
]);
const fulfillmentSchema = z.enum(["PROCEDURE_ORDER", "LAB_ORDER", "VISIT"]);
const quotaBasisSchema = z.enum(["PER_NIGHTS", "PER_STAY"]);
const quotaModeSchema = z.enum(["FIXED", "DAILY_RATE"]);
const blockQuotaModeSchema = z.enum(["DAILY_RATE", "WEEKLY", "PER_STAY"]);

const procedureSchema = z
  .object({
    procedureCode: z.string().min(1),
    procedureName: z.string().min(1),
    quotaTotal: z.number().int().positive(),
    avoidAfterHour: z.number().int().optional(),
    kind: z
      .enum(["PHYSIO", "BATH", "PARAFFIN", "LAB", "EXAM", "CUSTOM"])
      .nullable()
      .optional(),
    blockQuotaMode: blockQuotaModeSchema.nullable().optional(),
    dailyDistinctCap: z.number().int().min(1).max(12).nullable().optional(),
    /** Fractional nightly rate (e.g. 0.55 massage). */
    quotaPerNight: z.number().min(0).max(12).nullable().optional(),
    quotaPerWeek: z.number().int().min(1).max(21).nullable().optional(),
    dailyUseCap: z.number().int().min(1).max(12).nullable().optional(),
    sortOrder: z.number().int().nonnegative().optional(),
    showInProcedures: z.boolean().optional(),
    allowReplace: z.boolean().optional(),
    procedureOrder: z.number().int().nonnegative().optional(),
    memberCodes: z.array(z.string().min(1)).optional(),
    assignMode: assignModeSchema.optional(),
    autoStep: z.enum(["CHECKIN", "DOCTOR", "CLINICAL"]).nullable().optional(),
    includedInPackage: z.boolean().optional(),
    fulfillment: fulfillmentSchema.optional(),
    fulfillmentExplicit: z.boolean().optional(),
    quotaBasis: quotaBasisSchema.optional(),
    requiresDoctor: z.boolean().optional(),
  })
  .superRefine((p, ctx) => {
    if (p.blockQuotaMode === "WEEKLY" && (p.quotaPerWeek == null || p.quotaPerWeek < 1)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "quotaPerWeek required when blockQuotaMode is WEEKLY",
        path: ["quotaPerWeek"],
      });
    }
    if (
      p.blockQuotaMode === "DAILY_RATE" &&
      (p.quotaPerNight == null || p.quotaPerNight <= 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "quotaPerNight > 0 required when blockQuotaMode is DAILY_RATE",
        path: ["quotaPerNight"],
      });
    }
  });

const knotSchema = z.object({
  nights: z.number().int().positive(),
  procedureCode: z.string().min(1),
  qty: z.number().int().nonnegative(),
});

/** Calendar date `YYYY-MM-DD`; empty string clears the bound. */
const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .or(z.literal(""))
  .nullable()
  .optional();

export const programTemplateWriteSchema = z.object({
  code: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  durationDays: z.number().int().positive().optional(),
  minNights: z.number().int().positive().nullable().optional(),
  maxNights: z.number().int().positive().nullable().optional(),
  quotaMode: quotaModeSchema.optional(),
  countSunday: z.boolean().optional(),
  effectiveFrom: dateOnlySchema,
  effectiveTo: dateOnlySchema,
  procedures: z.array(procedureSchema).optional(),
  knots: z.array(knotSchema).optional(),
});

export const programTemplateCreateSchema = programTemplateWriteSchema.extend({
  code: z.string().min(1),
  name: z.string().min(1),
  durationDays: z.number().int().positive(),
  quotaMode: quotaModeSchema.default("FIXED"),
  countSunday: z.boolean().default(false),
  procedures: z.array(procedureSchema).default([]),
});

export type ProgramProcedureInput = z.infer<typeof procedureSchema>;
export type ProgramKnotInput = z.infer<typeof knotSchema>;

/** Persist coherent per-block fields for the package quotaMode. */
export function normalizeProceduresForQuotaMode(
  procedures: ProgramProcedureInput[],
  quotaMode: "FIXED" | "DAILY_RATE",
): ProgramProcedureInput[] {
  if (quotaMode !== "DAILY_RATE") {
    return procedures.map((p) => ({
      ...p,
      blockQuotaMode: null,
      quotaPerNight: null,
      quotaPerWeek: null,
      dailyUseCap: null,
    }));
  }
  return procedures.map((p) => {
    const mode =
      p.blockQuotaMode ??
      defaultBlockQuotaMode({ kind: p.kind, quotaBasis: p.quotaBasis });
    return {
      ...p,
      blockQuotaMode: mode,
      quotaPerNight: mode === "DAILY_RATE" ? p.quotaPerNight : null,
      quotaPerWeek: mode === "WEEKLY" ? (p.quotaPerWeek ?? 1) : null,
      dailyUseCap: mode === "DAILY_RATE" ? p.dailyUseCap : null,
    };
  });
}

export const programTemplateInclude = {
  procedures: { orderBy: [{ sortOrder: "asc" as const }, { procedureCode: "asc" as const }] },
  quotaKnots: true,
  blockMembers: true,
};

export type EntitlementBlockAxes = {
  assignMode: "AUTO_ON_OPEN" | "AUTO_DAY1" | "ON_INDICATION" | "MANUAL";
  fulfillment: "PROCEDURE_ORDER" | "LAB_ORDER" | "VISIT";
  fulfillmentExplicit: boolean;
  quotaBasis: "PER_NIGHTS" | "PER_STAY";
  requiresDoctor: boolean;
  autoStep?: "CHECKIN" | "DOCTOR" | "CLINICAL" | null;
  includedInPackage?: boolean;
};

export type EntitlementSnapshot = {
  version: number;
  templateId: string;
  code: string;
  quotaMode?: "FIXED" | "DAILY_RATE";
  countSunday?: boolean;
  procedures: Array<{
    procedureCode: string;
    procedureName: string;
    quotaTotal: number;
    kind?: string | null;
    sortOrder?: number;
    blockQuotaMode?: "DAILY_RATE" | "WEEKLY" | "PER_STAY" | null;
    dailyDistinctCap?: number | null;
    quotaPerNight?: number | null;
    quotaPerWeek?: number | null;
    dailyUseCap?: number | null;
    showInProcedures?: boolean;
    allowReplace?: boolean;
    procedureOrder?: number;
  } & EntitlementBlockAxes>;
  knots: Array<{ nights: number; procedureCode: string; qty: number }>;
  members: Array<{ blockCode: string; procedureCode: string }>;
};

function normalizeBlockAxes(p: {
  assignMode?: string | null;
  fulfillment?: string | null;
  fulfillmentExplicit?: boolean | null;
  quotaBasis?: string | null;
  requiresDoctor?: boolean | null;
}): EntitlementBlockAxes {
  const assignMode = assignModeSchema.safeParse(p.assignMode);
  const fulfillment = fulfillmentSchema.safeParse(p.fulfillment);
  const quotaBasis = quotaBasisSchema.safeParse(p.quotaBasis);
  return {
    assignMode: assignMode.success ? assignMode.data : "MANUAL",
    fulfillment: fulfillment.success ? fulfillment.data : "PROCEDURE_ORDER",
    fulfillmentExplicit: p.fulfillmentExplicit === true,
    quotaBasis: quotaBasis.success ? quotaBasis.data : "PER_NIGHTS",
    requiresDoctor: Boolean(p.requiresDoctor),
  };
}

export function shapeProgramTemplate<
  T extends {
    procedures: Array<{
      procedureCode: string;
      procedureName: string;
      quotaTotal: number;
      avoidAfterHour?: number | null;
      kind?: string | null;
      sortOrder?: number;
    }>;
    quotaKnots?: unknown;
    blockMembers: Array<{ blockCode: string; procedureCode: string }>;
    openInstanceCount?: number;
    pinInstanceCount?: number;
  },
>(row: T): T & {
  procedures: Array<
    T["procedures"][number] & { memberCodes: string[] }
  >;
} {
  const membersByBlock = new Map<string, string[]>();
  for (const m of row.blockMembers) {
    const arr = membersByBlock.get(m.blockCode) ?? [];
    arr.push(m.procedureCode);
    membersByBlock.set(m.blockCode, arr);
  }
  return {
    ...row,
    procedures: row.procedures.map((p) => {
      const raw = p as typeof p & {
        quotaPerNight?: unknown;
        blockQuotaMode?: string | null;
        quotaPerWeek?: number | null;
      };
      return {
        ...p,
        quotaPerNight: snapshotQuotaRate(raw.quotaPerNight),
        blockQuotaMode: snapshotBlockMode(raw.blockQuotaMode),
        quotaPerWeek: raw.quotaPerWeek ?? null,
        memberCodes: membersByBlock.get(p.procedureCode) ?? [],
      };
    }),
  };
}

type Tx = SatelliteTransactionClient;

const BAKU_TZ = "Asia/Baku";

/** Calendar date in Asia/Baku as `YYYY-MM-DD` (validity is a business day, not an instant). */
export function bakuDateOnly(at: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BAKU_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

/** `YYYY-MM-DD` → UTC midnight for a `@db.Date` column; blank / malformed → null. */
export function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Baku calendar day as UTC midnight — comparison anchor for `@db.Date` bounds. */
export function bakuDayUtc(at: Date = new Date()): Date {
  return new Date(`${bakuDateOnly(at)}T00:00:00.000Z`);
}

export function dateOnlyString(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

/**
 * Sales window check. Both bounds inclusive; null bound = open on that side.
 * Legacy rows without `effectiveFrom` stay sellable (no backfill required).
 */
export function isWithinValidity(
  row: { effectiveFrom?: Date | null; effectiveTo?: Date | null },
  onYmd: string = bakuDateOnly(),
): boolean {
  const from = dateOnlyString(row.effectiveFrom ?? null);
  const to = dateOnlyString(row.effectiveTo ?? null);
  if (from && onYmd < from) return false;
  if (to && onYmd > to) return false;
  return true;
}

/** Validity is admin metadata — it must never trigger a version bump. */
export function validityChanged(
  existing: { effectiveFrom: Date | null; effectiveTo: Date | null },
  next: { effectiveFrom: Date | null; effectiveTo: Date | null },
): boolean {
  return (
    dateOnlyString(existing.effectiveFrom) !== dateOnlyString(next.effectiveFrom) ||
    dateOnlyString(existing.effectiveTo) !== dateOnlyString(next.effectiveTo)
  );
}

/**
 * Prisma filter for «sellable today»: the current version, inside its validity window.
 * Use for every new-check-in lookup and package picker so an expired package cannot be chosen.
 */
export function sellableTemplateWhere(asOf: Date = new Date()) {
  const day = bakuDayUtc(asOf);
  return {
    isCurrent: true,
    retiredAt: null,
    AND: [
      { OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: day } }] },
      { OR: [{ effectiveTo: null }, { effectiveTo: { gte: day } }] },
    ],
  };
}

/** Current (sellable) template for a product code — new check-ins. */
export async function findCurrentProgramTemplate(
  code: string,
  tx: Tx | typeof prisma = prisma,
  asOf: Date = new Date(),
) {
  return tx.programTemplate.findFirst({
    where: { code, ...sellableTemplateWhere(asOf) },
    include: programTemplateInclude,
    orderBy: { version: "desc" },
  });
}

function snapshotQuotaRate(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "object" && raw !== null && "toNumber" in raw) {
    const n = (raw as { toNumber: () => number }).toNumber();
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function snapshotBlockMode(
  raw: string | null | undefined,
): "DAILY_RATE" | "WEEKLY" | "PER_STAY" | null {
  if (raw === "DAILY_RATE" || raw === "WEEKLY" || raw === "PER_STAY") return raw;
  return null;
}

export function buildEntitlementSnapshot(input: {
  templateId: string;
  code: string;
  version: number;
  quotaMode?: string | null;
  countSunday?: boolean | null;
  procedures: Array<{
    procedureCode: string;
    procedureName: string;
    quotaTotal: number;
    kind?: string | null;
    sortOrder?: number;
    blockQuotaMode?: string | null;
    dailyDistinctCap?: number | null;
    quotaPerNight?: unknown;
    quotaPerWeek?: number | null;
    dailyUseCap?: number | null;
    showInProcedures?: boolean;
    allowReplace?: boolean;
    procedureOrder?: number;
    assignMode?: string | null;
    fulfillment?: string | null;
    quotaBasis?: string | null;
    requiresDoctor?: boolean | null;
    autoStep?: string | null;
    includedInPackage?: boolean | null;
  }>;
  knots: Array<{ nights: number; procedureCode: string; qty: number }>;
  members: Array<{ blockCode: string; procedureCode: string }>;
}): EntitlementSnapshot {
  return {
    version: input.version,
    templateId: input.templateId,
    code: input.code,
    quotaMode: input.quotaMode === "DAILY_RATE" ? "DAILY_RATE" : "FIXED",
    countSunday: Boolean(input.countSunday),
    procedures: input.procedures.map((p) => ({
      procedureCode: p.procedureCode,
      procedureName: p.procedureName,
      quotaTotal: p.quotaTotal,
      kind: p.kind ?? null,
      sortOrder: p.sortOrder ?? 0,
      blockQuotaMode: snapshotBlockMode(p.blockQuotaMode),
      dailyDistinctCap: p.dailyDistinctCap ?? null,
      quotaPerNight: snapshotQuotaRate(p.quotaPerNight),
      quotaPerWeek: p.quotaPerWeek ?? null,
      dailyUseCap: p.dailyUseCap ?? null,
      showInProcedures: p.showInProcedures === true,
      allowReplace: p.allowReplace === true,
      procedureOrder: p.procedureOrder ?? p.sortOrder ?? 0,
      autoStep:
        p.autoStep === "CHECKIN" || p.autoStep === "DOCTOR" || p.autoStep === "CLINICAL"
          ? p.autoStep
          : null,
      includedInPackage: p.includedInPackage !== false,
      ...normalizeBlockAxes(p),
    })),
    knots: input.knots.map((k) => ({
      nights: k.nights,
      procedureCode: k.procedureCode,
      qty: k.qty,
    })),
    members: input.members.map((m) => ({
      blockCode: m.blockCode,
      procedureCode: m.procedureCode,
    })),
  };
}

export function parseEntitlementSnapshot(raw: unknown): EntitlementSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.version !== "number") return null;
  if (!Array.isArray(o.members) || !Array.isArray(o.procedures)) return null;
  return raw as EntitlementSnapshot;
}

/** Prefer snapshot whenever present (including empty members = frozen heuristic/empty whitelist). */
export function resolveMembersByBlock(input: {
  entitlementSnapshot: unknown;
  templateMembers: Array<{ blockCode: string; procedureCode: string }>;
}): Map<string, string[]> {
  const snap = parseEntitlementSnapshot(input.entitlementSnapshot);
  if (snap) return membersMapFromSnapshot(snap);
  const map = new Map<string, string[]>();
  for (const m of input.templateMembers) {
    const arr = map.get(m.blockCode) ?? [];
    arr.push(m.procedureCode);
    map.set(m.blockCode, arr);
  }
  return map;
}

export function membersMapFromSnapshot(
  snap: EntitlementSnapshot | null,
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  if (!snap) return map;
  for (const m of snap.members) {
    const arr = map.get(m.blockCode) ?? [];
    arr.push(m.procedureCode);
    map.set(m.blockCode, arr);
  }
  return map;
}

export async function replaceTemplateProceduresAndKnots(
  tx: Tx,
  templateId: string,
  procedures: ProgramProcedureInput[],
  knots: ProgramKnotInput[] | undefined,
) {
  await tx.programTemplateBlockMember.deleteMany({ where: { templateId } });
  await tx.programTemplateProcedure.deleteMany({ where: { templateId } });
  if (procedures.length > 0) {
    await tx.programTemplateProcedure.createMany({
      data: procedures.map((p, i) => {
        const axes = normalizeBlockAxes(p);
        return {
          templateId,
          procedureCode: p.procedureCode,
          procedureName: p.procedureName,
          quotaTotal: p.quotaTotal,
          avoidAfterHour: p.avoidAfterHour ?? null,
          kind: p.kind ?? null,
          sortOrder: p.sortOrder ?? i,
          showInProcedures: p.showInProcedures === true,
          allowReplace: p.allowReplace === true,
          procedureOrder: p.procedureOrder ?? p.sortOrder ?? i,
          assignMode: axes.assignMode,
          fulfillment: axes.fulfillment,
          fulfillmentExplicit: axes.fulfillmentExplicit,
          quotaBasis: axes.quotaBasis,
          requiresDoctor: axes.requiresDoctor,
          autoStep:
            p.autoStep === "CHECKIN" || p.autoStep === "DOCTOR" || p.autoStep === "CLINICAL"
              ? p.autoStep
              : null,
          includedInPackage: p.includedInPackage !== false,
          blockQuotaMode: p.blockQuotaMode ?? null,
          dailyDistinctCap: p.dailyDistinctCap ?? null,
          quotaPerNight:
            p.quotaPerNight != null ? new Prisma.Decimal(p.quotaPerNight) : null,
          quotaPerWeek: p.quotaPerWeek ?? null,
          dailyUseCap: p.dailyUseCap ?? null,
        };
      }),
    });
    const memberRows: Array<{ templateId: string; blockCode: string; procedureCode: string }> =
      [];
    for (const p of procedures) {
      for (const code of p.memberCodes ?? []) {
        memberRows.push({
          templateId,
          blockCode: p.procedureCode,
          procedureCode: code,
        });
      }
    }
    if (memberRows.length > 0) {
      await tx.programTemplateBlockMember.createMany({ data: memberRows });
    }
  }
  if (knots) {
    await tx.programTemplateQuotaKnot.deleteMany({ where: { templateId } });
    if (knots.length > 0) {
      await tx.programTemplateQuotaKnot.createMany({
        data: knots.map((k) => ({
          templateId,
          nights: k.nights,
          procedureCode: k.procedureCode,
          qty: k.qty,
        })),
      });
    }
  }
}

function compositionFingerprint(
  procedures: ProgramProcedureInput[],
  knots: ProgramKnotInput[] | undefined,
): string {
  const procs = [...procedures]
    .map((p) => {
      const axes = normalizeBlockAxes(p);
      return {
        procedureCode: p.procedureCode,
        procedureName: p.procedureName,
        quotaTotal: p.quotaTotal,
        kind: p.kind ?? null,
        sortOrder: p.sortOrder ?? 0,
        showInProcedures: p.showInProcedures === true,
        allowReplace: p.allowReplace === true,
        procedureOrder: p.procedureOrder ?? p.sortOrder ?? 0,
        memberCodes: [...(p.memberCodes ?? [])].sort(),
        blockQuotaMode: p.blockQuotaMode ?? null,
        dailyDistinctCap: p.dailyDistinctCap ?? null,
        quotaPerNight: p.quotaPerNight ?? null,
        quotaPerWeek: p.quotaPerWeek ?? null,
        dailyUseCap: p.dailyUseCap ?? null,
        ...axes,
      };
    })
    .sort((a, b) => a.procedureCode.localeCompare(b.procedureCode));
  const ks = [...(knots ?? [])]
    .map((k) => ({ nights: k.nights, procedureCode: k.procedureCode, qty: k.qty }))
    .sort((a, b) =>
      `${a.nights}:${a.procedureCode}`.localeCompare(`${b.nights}:${b.procedureCode}`),
    );
  return JSON.stringify({ procs, ks });
}

export function compositionChanged(
  existing: {
    procedures: Array<{
      procedureCode: string;
      procedureName: string;
      quotaTotal: number;
      kind?: string | null;
      sortOrder?: number;
      memberCodes?: string[];
      assignMode?: string | null;
      fulfillment?: string | null;
      quotaBasis?: string | null;
      requiresDoctor?: boolean | null;
      showInProcedures?: boolean | null;
      allowReplace?: boolean | null;
      procedureOrder?: number | null;
    }>;
    quotaKnots: Array<{ nights: number; procedureCode: string; qty: number }>;
    blockMembers: Array<{ blockCode: string; procedureCode: string }>;
  },
  procedures: ProgramProcedureInput[],
  knots: ProgramKnotInput[] | undefined,
): boolean {
  const shaped = shapeProgramTemplate(existing);
  const before = compositionFingerprint(
    shaped.procedures.map((p) => {
      const axes = normalizeBlockAxes(p as {
        assignMode?: string | null;
        fulfillment?: string | null;
        quotaBasis?: string | null;
        requiresDoctor?: boolean | null;
      });
      const row = p as ProgramProcedureInput & {
        blockQuotaMode?: string | null;
        dailyDistinctCap?: number | null;
        quotaPerNight?: unknown;
        quotaPerWeek?: number | null;
        dailyUseCap?: number | null;
      };
      return {
        procedureCode: p.procedureCode,
        procedureName: p.procedureName,
        quotaTotal: p.quotaTotal,
        kind: (p.kind as ProgramProcedureInput["kind"]) ?? null,
        sortOrder: p.sortOrder,
        showInProcedures: p.showInProcedures === true,
        allowReplace: p.allowReplace === true,
        procedureOrder: p.procedureOrder ?? p.sortOrder ?? 0,
        memberCodes: p.memberCodes,
        blockQuotaMode: snapshotBlockMode(row.blockQuotaMode),
        dailyDistinctCap: row.dailyDistinctCap ?? null,
        quotaPerNight: snapshotQuotaRate(row.quotaPerNight),
        quotaPerWeek: row.quotaPerWeek ?? null,
        dailyUseCap: row.dailyUseCap ?? null,
        ...axes,
      };
    }),
    existing.quotaKnots,
  );
  const after = compositionFingerprint(procedures, knots ?? existing.quotaKnots);
  return before !== after;
}

/** Name / duration / min-max / quota mode — contract fields that must not mutate a pinned row. */
export function contractMetaChanged(
  existing: {
    name: string;
    durationDays: number;
    minNights: number | null;
    maxNights: number | null;
    quotaMode?: string | null;
    countSunday?: boolean | null;
  },
  body: {
    name?: string;
    durationDays?: number;
    minNights?: number | null;
    maxNights?: number | null;
    quotaMode?: "FIXED" | "DAILY_RATE";
    countSunday?: boolean;
  },
): boolean {
  if (body.name !== undefined && body.name !== existing.name) return true;
  if (body.durationDays !== undefined && body.durationDays !== existing.durationDays) return true;
  if (body.minNights !== undefined && body.minNights !== existing.minNights) return true;
  if (body.maxNights !== undefined && body.maxNights !== existing.maxNights) return true;
  if (
    body.quotaMode !== undefined &&
    body.quotaMode !== (existing.quotaMode === "DAILY_RATE" ? "DAILY_RATE" : "FIXED")
  ) {
    return true;
  }
  if (
    body.countSunday !== undefined &&
    Boolean(body.countSunday) !== Boolean(existing.countSunday)
  ) {
    return true;
  }
  return false;
}

export async function countOpenInstancesForTemplate(templateId: string, tx: Tx | typeof prisma = prisma) {
  return tx.programInstance.count({
    where: {
      templateId,
      episode: { status: "OPEN" },
    },
  });
}

export async function countAnyInstancesForTemplate(templateId: string, tx: Tx | typeof prisma = prisma) {
  return tx.programInstance.count({ where: { templateId } });
}

function proceduresFromExisting(existing: {
  procedures: Array<{
    procedureCode: string;
    procedureName: string;
    quotaTotal: number;
    avoidAfterHour?: number | null;
    kind?: string | null;
    sortOrder?: number;
    assignMode?: string | null;
    fulfillment?: string | null;
    quotaBasis?: string | null;
    requiresDoctor?: boolean | null;
    blockQuotaMode?: string | null;
    dailyDistinctCap?: number | null;
    quotaPerNight?: unknown;
    quotaPerWeek?: number | null;
    dailyUseCap?: number | null;
    showInProcedures?: boolean | null;
    allowReplace?: boolean | null;
    procedureOrder?: number | null;
  }>;
  blockMembers: Array<{ blockCode: string; procedureCode: string }>;
}): ProgramProcedureInput[] {
  const membersByBlock = new Map<string, string[]>();
  for (const m of existing.blockMembers) {
    const arr = membersByBlock.get(m.blockCode) ?? [];
    arr.push(m.procedureCode);
    membersByBlock.set(m.blockCode, arr);
  }
  return existing.procedures.map((p) => {
    const axes = normalizeBlockAxes(p);
    return {
      procedureCode: p.procedureCode,
      procedureName: p.procedureName,
      quotaTotal: p.quotaTotal,
      avoidAfterHour: p.avoidAfterHour ?? undefined,
      kind: (p.kind as ProgramProcedureInput["kind"]) ?? null,
      sortOrder: p.sortOrder,
      memberCodes: membersByBlock.get(p.procedureCode) ?? [],
      blockQuotaMode: snapshotBlockMode(p.blockQuotaMode),
      dailyDistinctCap: p.dailyDistinctCap ?? null,
      quotaPerNight: snapshotQuotaRate(p.quotaPerNight),
      quotaPerWeek: p.quotaPerWeek ?? null,
      dailyUseCap: p.dailyUseCap ?? null,
      showInProcedures: p.showInProcedures === true,
      allowReplace: p.allowReplace === true,
      procedureOrder: p.procedureOrder ?? p.sortOrder ?? 0,
      ...axes,
    };
  });
}

async function bumpTemplateVersion(
  tx: Tx,
  existing: {
    id: string;
    code: string;
    name: string;
    durationDays: number;
    minNights: number | null;
    maxNights: number | null;
    quotaMode?: string | null;
    countSunday?: boolean | null;
    version: number;
  },
  next: {
    name: string;
    durationDays: number;
    minNights: number | null;
    maxNights: number | null;
    quotaMode: "FIXED" | "DAILY_RATE";
    countSunday: boolean;
    effectiveFrom: Date | null;
    effectiveTo: Date | null;
    procedures: ProgramProcedureInput[];
    knots: ProgramKnotInput[];
  },
) {
  await tx.programTemplate.update({
    where: { id: existing.id },
    data: { isCurrent: false, retiredAt: new Date() },
  });
  const created = await tx.programTemplate.create({
    data: {
      code: existing.code,
      name: next.name,
      durationDays: next.durationDays,
      minNights: next.minNights,
      maxNights: next.maxNights,
      quotaMode: next.quotaMode,
      countSunday: next.countSunday,
      effectiveFrom: next.effectiveFrom,
      effectiveTo: next.effectiveTo,
      version: existing.version + 1,
      isCurrent: true,
      retiredAt: null,
      supersedesId: existing.id,
    },
  });
  await replaceTemplateProceduresAndKnots(tx, created.id, next.procedures, next.knots);
  return tx.programTemplate.findUniqueOrThrow({
    where: { id: created.id },
    include: programTemplateInclude,
  });
}

/**
 * If the current template has any ProgramInstance pins, clone to a new version
 * before mutating composition (seed / cutover import safety).
 */
export async function ensureWritableCurrentTemplate(
  tx: Tx,
  templateId: string,
): Promise<string> {
  const existing = await tx.programTemplate.findUnique({
    where: { id: templateId },
    include: programTemplateInclude,
  });
  if (!existing) throw new Error(`Program template ${templateId} not found`);
  if (!existing.isCurrent) {
    throw new Error(`Program template ${templateId} is not current`);
  }
  const pinned = await countAnyInstancesForTemplate(templateId, tx);
  if (pinned === 0) return templateId;

  const procs = proceduresFromExisting(existing);
  const knots = existing.quotaKnots.map(
    (k: { nights: number; procedureCode: string; qty: number }) => ({
      nights: k.nights,
      procedureCode: k.procedureCode,
      qty: k.qty,
    }),
  );
  const created = await bumpTemplateVersion(tx, existing, {
    name: existing.name,
    durationDays: existing.durationDays,
    minNights: existing.minNights,
    maxNights: existing.maxNights,
    quotaMode: existing.quotaMode === "DAILY_RATE" ? "DAILY_RATE" : "FIXED",
    countSunday: Boolean(existing.countSunday),
    effectiveFrom: existing.effectiveFrom,
    effectiveTo: existing.effectiveTo,
    procedures: procs,
    knots,
  });
  return created.id;
}

/**
 * Apply admin PATCH.
 * - Any guest pin on this template version → bump to a new current version
 *   (open stays keep the retired row).
 * - Zero pins → in-place mutate (bootstrap / fill empty quotas without v+1).
 */
export async function saveProgramTemplatePatch(
  id: string,
  body: z.infer<typeof programTemplateWriteSchema>,
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.programTemplate.findUnique({
      where: { id },
      include: programTemplateInclude,
    });
    if (!existing) {
      const err = new Error("NOT_FOUND");
      (err as Error & { code?: string }).code = "NOT_FOUND";
      throw err;
    }
    if (!existing.isCurrent || existing.retiredAt) {
      const err = new Error("RETIRED_TEMPLATE");
      (err as Error & { code?: string }).code = "RETIRED_TEMPLATE";
      throw err;
    }

    if (body.knots && !body.procedures) {
      const err = new Error("COMPOSITION_REQUIRES_PROCEDURES");
      (err as Error & { code?: string }).code = "COMPOSITION_REQUIRES_PROCEDURES";
      throw err;
    }

    const metaChanged = contractMetaChanged(existing, body);
    const nextName = body.name ?? existing.name;
    const nextDuration = body.durationDays ?? existing.durationDays;
    const nextMin = body.minNights !== undefined ? body.minNights : existing.minNights;
    const nextMax = body.maxNights !== undefined ? body.maxNights : existing.maxNights;
    const nextQuotaMode =
      body.quotaMode ??
      (existing.quotaMode === "DAILY_RATE" ? "DAILY_RATE" : "FIXED");
    const nextCountSunday =
      body.countSunday !== undefined ? body.countSunday : Boolean(existing.countSunday);
    const nextFrom =
      body.effectiveFrom !== undefined
        ? parseDateOnly(body.effectiveFrom)
        : existing.effectiveFrom;
    const nextTo =
      body.effectiveTo !== undefined ? parseDateOnly(body.effectiveTo) : existing.effectiveTo;
    if (nextFrom && nextTo && nextTo < nextFrom) {
      const err = new Error("INVALID_VALIDITY_RANGE");
      (err as Error & { code?: string }).code = "INVALID_VALIDITY_RANGE";
      throw err;
    }
    const datesChanged = validityChanged(existing, {
      effectiveFrom: nextFrom,
      effectiveTo: nextTo,
    });

    const existingProcs = proceduresFromExisting(existing);
    const existingKnots = existing.quotaKnots.map(
      (k: { nights: number; procedureCode: string; qty: number }) => ({
        nights: k.nights,
        procedureCode: k.procedureCode,
        qty: k.qty,
      }),
    );

    let nextProcs = existingProcs;
    let nextKnots = existingKnots;
    let compChanged = false;

    if (body.procedures) {
      nextProcs = normalizeProceduresForQuotaMode(body.procedures, nextQuotaMode);
      nextKnots = nextQuotaMode === "DAILY_RATE" ? [] : (body.knots ?? existingKnots);
      compChanged = compositionChanged(existing, nextProcs, nextKnots);
    }

    if (!metaChanged && !compChanged && !datesChanged) {
      return existing;
    }

    const pinned = await countAnyInstancesForTemplate(existing.id, tx);
    /** Validity is a sales window, not a contract term — it edits the pinned row directly. */
    if (pinned === 0 || (!metaChanged && !compChanged)) {
      await tx.programTemplate.update({
        where: { id: existing.id },
        data: {
          name: nextName,
          durationDays: nextDuration,
          minNights: nextMin,
          maxNights: nextMax,
          quotaMode: nextQuotaMode,
          countSunday: nextCountSunday,
          effectiveFrom: nextFrom,
          effectiveTo: nextTo,
        },
      });
      if (pinned === 0 && body.procedures) {
        await replaceTemplateProceduresAndKnots(tx, existing.id, nextProcs, nextKnots);
      }
      return tx.programTemplate.findUniqueOrThrow({
        where: { id: existing.id },
        include: programTemplateInclude,
      });
    }

    return bumpTemplateVersion(tx, existing, {
      name: nextName,
      durationDays: nextDuration,
      minNights: nextMin,
      maxNights: nextMax,
      quotaMode: nextQuotaMode,
      countSunday: nextCountSunday,
      effectiveFrom: nextFrom,
      effectiveTo: nextTo,
      procedures: nextProcs,
      knots: nextKnots,
    });
  });
}

/**
 * Admin «delete» for a package that guests already pinned: close the sales window instead
 * of erasing history. Open stays keep their entitlement snapshot; new check-ins stop resolving it.
 */
export async function closeProgramTemplateValidity(
  id: string,
  onYmd: string = bakuDateOnly(),
): Promise<{ effectiveTo: string }> {
  const effectiveTo = parseDateOnly(onYmd);
  if (!effectiveTo) throw new Error(`Invalid validity date ${onYmd}`);
  const existing = await prisma.programTemplate.findUnique({
    where: { id },
    select: { effectiveFrom: true },
  });
  if (!existing) {
    const err = new Error("NOT_FOUND");
    (err as Error & { code?: string }).code = "NOT_FOUND";
    throw err;
  }
  await prisma.programTemplate.update({
    where: { id },
    data: {
      effectiveTo,
      // Keep the from-bound sane when an admin closes a package on its very first day.
      ...(existing.effectiveFrom && existing.effectiveFrom > effectiveTo
        ? { effectiveFrom: effectiveTo }
        : {}),
      isCurrent: false,
      retiredAt: new Date(),
    },
  });
  return { effectiveTo: onYmd };
}

/** Delete retired versions that no guest instance pins (optional age filter). */
export async function purgeRetiredTemplatesWithoutInstances(opts?: {
  olderThanDays?: number;
}): Promise<{ deleted: number; ids: string[] }> {
  const olderThanDays = opts?.olderThanDays ?? 0;
  const cutoff =
    olderThanDays > 0
      ? new Date(Date.now() - olderThanDays * 86400000)
      : null;

  const retired = await prisma.programTemplate.findMany({
    where: {
      isCurrent: false,
      ...(cutoff ? { retiredAt: { lte: cutoff } } : { retiredAt: { not: null } }),
    },
    select: { id: true },
  });
  const ids: string[] = [];
  for (const row of retired) {
    const n = await countAnyInstancesForTemplate(row.id);
    if (n === 0) {
      await prisma.programTemplate.delete({ where: { id: row.id } });
      ids.push(row.id);
    }
  }
  return { deleted: ids.length, ids };
}

/** Backfill entitlementSnapshot for instances that still lack one. */
export async function backfillEntitlementSnapshots(): Promise<{ updated: number }> {
  const missing = await prisma.programInstance.findMany({
    where: { entitlementSnapshot: { equals: Prisma.DbNull } },
    select: { id: true, templateId: true },
  });
  let updated = 0;
  for (const row of missing) {
    const template = await prisma.programTemplate.findUnique({
      where: { id: row.templateId },
      include: programTemplateInclude,
    });
    if (!template) continue;
    const snapshot = buildEntitlementSnapshot({
      templateId: template.id,
      code: template.code,
      version: template.version,
      quotaMode: template.quotaMode,
      countSunday: template.countSunday,
      procedures: template.procedures,
      knots: template.quotaKnots,
      members: template.blockMembers,
    });
    await prisma.programInstance.update({
      where: { id: row.id },
      data: { entitlementSnapshot: snapshot },
    });
    updated += 1;
  }
  return { updated };
}

export async function listSellableProgramTemplatesForPicker() {
  return prisma.programTemplate.findMany({
    where: sellableTemplateWhere(),
    orderBy: { code: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      durationDays: true,
      version: true,
    },
  });
}

export async function listProgramTemplatesForAdmin(includeRetired: boolean) {
  const rows = await prisma.programTemplate.findMany({
    where: includeRetired ? undefined : { isCurrent: true },
    orderBy: [{ code: "asc" }, { version: "desc" }],
    include: programTemplateInclude,
  });
  const shaped = [];
  for (const row of rows) {
    const [openInstanceCount, pinInstanceCount] = await Promise.all([
      countOpenInstancesForTemplate(row.id),
      countAnyInstancesForTemplate(row.id),
    ]);
    shaped.push(
      shapeProgramTemplate({
        ...row,
        openInstanceCount,
        pinInstanceCount,
      }),
    );
  }
  return shaped;
}

/** Admin create: template row + procedures/knots in one transaction. */
export async function createProgramTemplateFromAdmin(
  body: z.infer<typeof programTemplateCreateSchema>,
) {
  const effectiveFrom =
    parseDateOnly(body.effectiveFrom ?? null) ?? parseDateOnly(bakuDateOnly());
  const effectiveTo = parseDateOnly(body.effectiveTo ?? null);
  return prisma.$transaction(async (tx) => {
    const created = await tx.programTemplate.create({
      data: {
        code: body.code,
        name: body.name,
        durationDays: body.durationDays,
        quotaMode: body.quotaMode ?? "FIXED",
        countSunday: body.countSunday ?? false,
        version: 1,
        isCurrent: true,
        effectiveFrom,
        effectiveTo,
        ...(body.minNights !== undefined ? { minNights: body.minNights } : {}),
        ...(body.maxNights !== undefined ? { maxNights: body.maxNights } : {}),
      },
    });
    const quotaMode = body.quotaMode ?? "FIXED";
    await replaceTemplateProceduresAndKnots(
      tx,
      created.id,
      normalizeProceduresForQuotaMode(body.procedures, quotaMode),
      quotaMode === "DAILY_RATE" ? [] : body.knots,
    );
    return tx.programTemplate.findUniqueOrThrow({
      where: { id: created.id },
      include: programTemplateInclude,
    });
  });
}

export async function findCurrentProgramTemplateByCode(code: string) {
  return prisma.programTemplate.findFirst({
    where: { code, isCurrent: true },
  });
}

export async function deleteProgramTemplateAdmin(id: string): Promise<
  | { deleted: true; closed: false }
  | { deleted: false; closed: true; effectiveTo: string; pinnedInstances: number }
> {
  const pinned = await prisma.programInstance.count({ where: { templateId: id } });
  if (pinned > 0) {
    const { effectiveTo } = await closeProgramTemplateValidity(id);
    return { deleted: false, closed: true, effectiveTo, pinnedInstances: pinned };
  }
  await prisma.programTemplate.delete({ where: { id } });
  return { deleted: true, closed: false };
}

export { procedureSchema, knotSchema };
