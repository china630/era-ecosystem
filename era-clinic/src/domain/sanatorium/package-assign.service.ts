/**
 * CLI-57 — package lazy-assign from ProgramProcedureBalance (ADR clinic-episode-procedure-assign-modal).
 */
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";
import { placeConfirmedProcedures } from "@/lib/treatment-planner.service";
import { episodeAnamnesisDenied, ANAMNESIS_REQUIRED } from "@/domain/sanatorium/episode-gates";
import {
  CARE_TEAM_REQUIRED,
  episodeCareTeamDenied,
} from "@/domain/sanatorium/episode-care-team-gates";
import { countEpisodeCareDoctors } from "@/domain/sanatorium/episode-care-team.service";
import { DAY1_SOFT_CONFIRM_CAP } from "@/lib/sanatorium-day1";

export class PackageAssignError extends Error {
  constructor(
    message: string,
    public code: string,
    public status = 409,
  ) {
    super(message);
    this.name = "PackageAssignError";
  }
}

const IN_CIRCULATION = ["SCHEDULED", "CHECKED_IN"] as const;
const CONSUMED = ["COMPLETED", "NO_SHOW"] as const;

/** Nafta PDF bucket codes — entitlement only, never ProcedureOrder.procedureCode. */
export const PACKAGE_POOL_CODES = ["PHYSIO_POOL", "PARAFFIN_POOL"] as const;
export type PackagePoolCode = (typeof PACKAGE_POOL_CODES)[number];

export function isPackagePoolCode(code: string): boolean {
  return (PACKAGE_POOL_CODES as readonly string[]).includes(code) || /_POOL$/i.test(code);
}

function foldHay(s: string): string {
  return s
    .toLowerCase()
    .replace(/ə/g, "e")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g");
}

/**
 * CLI-57 package assign left menu = treatment entitlements only.
 * Intake labs / doctor exams stay on ProgramProcedureBalance for quota truth but are out of scope
 * for this modal (ADR clinic-episode-procedure-assign-modal — intake on separate card blocks).
 */
export function isPackageAssignTreatmentLine(code: string, name?: string | null): boolean {
  const c = code.trim().toUpperCase();
  if (!c) return false;
  if (isPackagePoolCode(c)) return true;
  if (c.startsWith("WO-TR-") || c.startsWith("SVC-")) return true;
  if (c.includes("NAFTALAN") || c === "PHYSIO_PAID") return true;

  // Explicit PDF / knot intake + lab + visit codes
  const intakeExact = new Set([
    "ALT",
    "AST",
    "GLU",
    "ECG",
    "ECG-12",
    "USG",
    "USG-ABD",
    "THERAPIST",
    "NEURO",
    "GYN",
    "URO",
    "GYN-OR-URO",
    "GYN-VISIT",
    "URO-VISIT",
    "SANATORIUM-INTAKE",
    "LAB_PAID",
    "LAB-CBC",
    "LAB-URINE",
    "LAB-SEROLOGY-CARD",
  ]);
  if (intakeExact.has(c)) return false;
  if (c.startsWith("LAB-") || c.startsWith("LAB_")) return false;
  if (c.startsWith("VISIT-") || c.endsWith("-VISIT")) return false;

  const hay = foldHay(`${c} ${name ?? ""}`);
  if (
    /muayin|analiz|alat|asat|sekar|sidik|ekq|usm|kardiolog|ginekolog|urolog|nevropatolog|hekim\b|hbsag|serolog/.test(
      hay,
    )
  ) {
    return false;
  }

  // Unknown PDF-* leftovers: only keep if not clearly intake-shaped
  if (c.startsWith("PDF-")) return false;

  // Conservative: do not surface OTHER/DIAGNOSTIC/LAB-shaped codes in the assign menu
  return false;
}

function isParaffinType(code: string, name: string): boolean {
  const hay = foldHay(`${code} ${name}`);
  return /parafin|paraffin/.test(hay);
}

export type PoolEligibleSku = { code: string; name: string };

/**
 * Which real ProcedureTypes may burn a pool balance line.
 * PARAFFIN_POOL → paraffin SKUs only.
 * PHYSIO_POOL → needsSite (or SVC-*) minus paraffin and minus codes that already have their own non-pool package line.
 */
export function eligibleSkusForPool(
  poolCode: string,
  packageBalanceCodes: string[],
  types: Array<{ code: string; name: string; needsSite?: boolean | null; active?: boolean | null }>,
): PoolEligibleSku[] {
  const dedicated = new Set(
    packageBalanceCodes.filter((c) => !isPackagePoolCode(c)),
  );
  const active = types.filter((t) => t.active !== false);
  if (poolCode === "PARAFFIN_POOL" || /paraffin/i.test(poolCode)) {
    return active
      .filter((t) => isParaffinType(t.code, t.name))
      .map((t) => ({ code: t.code, name: t.name }));
  }
  // PHYSIO_POOL and other *_POOL catch-alls
  return active
    .filter((t) => {
      if (dedicated.has(t.code)) return false;
      if (isParaffinType(t.code, t.name)) return false;
      if (isPackagePoolCode(t.code)) return false;
      if (t.needsSite === true) return true;
      // Broad physio/treatment SVC catalog (Nafta seed)
      if (/^SVC-/i.test(t.code) && !/LAB|USM|ECG|ALT|AST|GLU|CBC|URINE/i.test(t.code)) {
        return true;
      }
      return false;
    })
    .map((t) => ({ code: t.code, name: t.name }));
}

function quotaCodeOf(o: { packageQuotaCode?: string | null; procedureCode: string }): string {
  return o.packageQuotaCode?.trim() || o.procedureCode;
}

function newBatchId(): string {
  return `batch_${randomBytes(8).toString("hex")}`;
}

export function paramsLabelFromOrder(o: {
  note?: string | null;
  bodyPart?: string | null;
  siteApplyMode?: string | null;
  physioFields?: unknown;
  sites?: Array<{
    siteId?: string;
    laterality?: string | null;
    site?: { titleEn?: string | null; titleRu?: string | null; titleAz?: string | null } | null;
  }>;
}): string {
  const parts: string[] = [];
  const siteNames = (o.sites ?? [])
    .map((s) => {
      const title = s.site?.titleEn || s.site?.titleRu || s.site?.titleAz;
      const lat = (s as { laterality?: string | null }).laterality;
      if (!title) return null;
      return lat ? `${title} (${lat})` : title;
    })
    .filter(Boolean);
  if (siteNames.length) parts.push(siteNames.join(", "));
  if (o.siteApplyMode) parts.push(String(o.siteApplyMode));
  if (o.bodyPart) parts.push(o.bodyPart);
  if (o.physioFields && typeof o.physioFields === "object") {
    const pf = o.physioFields as Record<string, unknown>;
    for (const [k, v] of Object.entries(pf)) {
      if (v != null && String(v).trim()) parts.push(`${k}: ${String(v)}`);
    }
  }
  if (o.note?.trim()) parts.push(o.note.trim());
  return parts.join(" · ");
}

function fingerprintParams(o: {
  note?: string | null;
  bodyPart?: string | null;
  siteApplyMode?: string | null;
  physioFields?: unknown;
  sites?: Array<{ siteId?: string; laterality?: string | null }>;
}): string {
  const siteIds = (o.sites ?? [])
    .map((s) => `${s.siteId ?? ""}:${s.laterality ?? ""}`)
    .filter(Boolean)
    .sort()
    .join(",");
  return JSON.stringify({
    note: o.note ?? "",
    bodyPart: o.bodyPart ?? "",
    siteApplyMode: o.siteApplyMode ?? "",
    physioFields: o.physioFields ?? null,
    siteIds,
  });
}

/** Baku calendar day key YYYY-MM-DD from a Date (UTC instant interpreted in Asia/Baku). */
export function bakuDayKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Baku",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export type PackageBalanceRow = {
  procedureCode: string;
  procedureName: string;
  quotaTotal: number;
  quotaUsed: number;
  remaining: number;
  inCirculation: number;
  consumed: number;
  /** True for PHYSIO_POOL / PARAFFIN_POOL — not a bookable SKU. */
  isPool: boolean;
};

export type PackageAssignedAgg = {
  assignBatchId: string | null;
  procedureCode: string;
  procedureName: string;
  qty: number;
  statusKind: "active" | "consumed";
  locked: boolean;
  /** Human-readable physio / clinical params under the title. */
  paramsLabel: string;
  /** Balance line burned (pool code or procedureCode). */
  packageQuotaCode: string;
};

async function loadEpisodeForAssign(episodeId: string) {
  const episode = await prisma.clinicalEpisode.findUnique({
    where: { id: episodeId },
    include: {
      programInstance: { include: { procedureLines: true, template: { include: { procedures: true } } } },
      patientRef: true,
    },
  });
  if (!episode) throw new PackageAssignError("Episode not found", "NOT_FOUND", 404);
  if (episode.status !== "OPEN") {
    throw new PackageAssignError("Episode is not OPEN", "NOT_OPEN");
  }
  if (!episode.programInstance) {
    throw new PackageAssignError("No program instance", "NO_PROGRAM");
  }
  const anamnesisDenied = episodeAnamnesisDenied(episode.anamnesisText);
  if (anamnesisDenied) {
    throw new PackageAssignError(anamnesisDenied, ANAMNESIS_REQUIRED);
  }
  const careDenied = episodeCareTeamDenied(await countEpisodeCareDoctors(episodeId));
  if (careDenied) {
    throw new PackageAssignError(careDenied, CARE_TEAM_REQUIRED);
  }
  return episode;
}

export async function getPackageAssignSnapshot(episodeId: string): Promise<{
  balances: PackageBalanceRow[];
  assigned: PackageAssignedAgg[];
  softWarnDay1: string | null;
  /** poolCode → eligible real SKUs for the picker */
  poolEligible: Record<string, PoolEligibleSku[]>;
}> {
  const episode = await loadEpisodeForAssign(episodeId);
  const instance = episode.programInstance!;
  const nameByCode = new Map(
    (instance.template?.procedures ?? []).map((p) => [p.procedureCode, p.procedureName]),
  );

  const orders = await prisma.procedureOrder.findMany({
    where: {
      clinicalEpisodeId: episodeId,
      status: { in: [...IN_CIRCULATION, ...CONSUMED] },
      inPackage: true,
    },
    select: {
      procedureCode: true,
      procedureName: true,
      packageQuotaCode: true,
      status: true,
      assignBatchId: true,
      note: true,
      bodyPart: true,
      siteApplyMode: true,
      physioFields: true,
      sites: {
        select: {
          siteId: true,
          laterality: true,
          site: { select: { titleEn: true, titleRu: true, titleAz: true } },
        },
      },
    },
  });

  const counts = new Map<string, { circ: number; consumed: number }>();
  for (const o of orders) {
    const q = quotaCodeOf(o);
    const row = counts.get(q) ?? { circ: 0, consumed: 0 };
    if ((IN_CIRCULATION as readonly string[]).includes(o.status)) row.circ += 1;
    else row.consumed += 1;
    counts.set(q, row);
  }

  const balanceCodes = instance.procedureLines.map((l) => l.procedureCode);
  const balances: PackageBalanceRow[] = instance.procedureLines
    .filter((line) =>
      isPackageAssignTreatmentLine(
        line.procedureCode,
        nameByCode.get(line.procedureCode) ?? line.procedureCode,
      ),
    )
    .map((line) => {
    const c = counts.get(line.procedureCode) ?? { circ: 0, consumed: 0 };
    const used = c.circ + c.consumed;
    return {
      procedureCode: line.procedureCode,
      procedureName: nameByCode.get(line.procedureCode) ?? line.procedureCode,
      quotaTotal: line.quotaTotal,
      quotaUsed: line.quotaUsed,
      remaining: Math.max(0, line.quotaTotal - used),
      inCirculation: c.circ,
      consumed: c.consumed,
      isPool: isPackagePoolCode(line.procedureCode),
    };
  });

  const types = await prisma.procedureType.findMany({
    select: { code: true, name: true, needsSite: true },
  });
  const poolEligible: Record<string, PoolEligibleSku[]> = {};
  for (const b of balances) {
    if (!b.isPool) continue;
    poolEligible[b.procedureCode] = eligibleSkusForPool(
      b.procedureCode,
      balanceCodes,
      types.map((t) => ({ ...t, active: true })),
    );
  }

  const batchMap = new Map<string, PackageAssignedAgg>();
  for (const o of orders) {
    const consumed = (CONSUMED as readonly string[]).includes(o.status);
    const locked = consumed || o.status === "CHECKED_IN";
    const fp = fingerprintParams(o);
    const key = `${o.assignBatchId ?? o.procedureCode}:${quotaCodeOf(o)}:${fp}:${locked ? "locked" : "active"}:${consumed ? "done" : "live"}`;
    const prev = batchMap.get(key);
    if (prev) {
      prev.qty += 1;
    } else {
      batchMap.set(key, {
        assignBatchId: o.assignBatchId,
        procedureCode: o.procedureCode,
        procedureName: o.procedureName,
        qty: 1,
        statusKind: consumed ? "consumed" : "active",
        locked,
        paramsLabel: paramsLabelFromOrder(o),
        packageQuotaCode: quotaCodeOf(o),
      });
    }
  }

  return {
    balances,
    assigned: [...batchMap.values()],
    softWarnDay1: null,
    poolEligible,
  };
}

export type AssignLineInput = {
  /** Real ProcedureType code (never a *_POOL bucket). */
  procedureCode: string;
  qty: number;
  note?: string | null;
  bodyPart?: string | null;
  physioFields?: Record<string, unknown> | null;
  siteIds?: string[];
  siteApplyMode?: "TURN" | "TOGETHER" | null;
  /** siteId → LEFT | RIGHT | BOTH */
  siteLaterality?: Record<string, "LEFT" | "RIGHT" | "BOTH" | null>;
  /** When set, burn this package balance line (PHYSIO_POOL / PARAFFIN_POOL). */
  burnPoolCode?: string | null;
};

/**
 * Create PROPOSED orders for delta qty, place onto resources, burn quotaUsed to match circulation.
 */
export async function assignPackageProcedures(
  episodeId: string,
  lines: AssignLineInput[],
  opts?: { confirmedByUserId?: string; softWarnOnly?: boolean },
): Promise<{ placed: number; softWarn: string | null; orderIds: string[] }> {
  const episode = await loadEpisodeForAssign(episodeId);
  const instance = episode.programInstance!;
  const snap = await getPackageAssignSnapshot(episodeId);
  const remByCode = new Map(snap.balances.map((b) => [b.procedureCode, b]));
  const balanceCodes = snap.balances.map((b) => b.procedureCode);

  const types = await prisma.procedureType.findMany();
  const typeByCode = new Map(types.map((t) => [t.code, t]));

  let totalQty = 0;
  const resolved: Array<AssignLineInput & { quotaCode: string }> = [];

  for (const line of lines) {
    if (line.qty < 1) continue;
    if (isPackagePoolCode(line.procedureCode)) {
      throw new PackageAssignError(
        `Pool code ${line.procedureCode} is not assignable — pick a real procedure`,
        "POOL_NOT_ASSIGNABLE",
        400,
      );
    }
    const burnPool = line.burnPoolCode?.trim() || null;
    const quotaCode = burnPool || line.procedureCode;
    if (burnPool) {
      if (!isPackagePoolCode(burnPool)) {
        throw new PackageAssignError(
          `burnPoolCode ${burnPool} is not a pool`,
          "INVALID",
          400,
        );
      }
      const eligible = eligibleSkusForPool(
        burnPool,
        balanceCodes,
        types.map((t) => ({ code: t.code, name: t.name, needsSite: t.needsSite, active: true })),
      );
      if (!eligible.some((e) => e.code === line.procedureCode)) {
        throw new PackageAssignError(
          `SKU ${line.procedureCode} is not eligible for pool ${burnPool}`,
          "POOL_SKU_NOT_ELIGIBLE",
          400,
        );
      }
    }
    const bal = remByCode.get(quotaCode);
    if (!bal) {
      throw new PackageAssignError(
        `Code ${quotaCode} not in package`,
        "NOT_IN_PACKAGE",
        400,
      );
    }
    if (line.qty > bal.remaining) {
      throw new PackageAssignError(
        `Qty ${line.qty} exceeds remaining ${bal.remaining} for ${quotaCode}`,
        "QUOTA_EXCEEDED",
        400,
      );
    }
    // Reserve remaining for multi-line same batch
    remByCode.set(quotaCode, {
      ...bal,
      remaining: bal.remaining - line.qty,
    });
    totalQty += line.qty;
    resolved.push({ ...line, quotaCode });
  }

  const softWarn =
    totalQty > DAY1_SOFT_CONFIRM_CAP
      ? `Day-1 soft cap: Nafta default is ${DAY1_SOFT_CONFIRM_CAP}; batch has ${totalQty}`
      : null;

  const orgId = requestOrganizationId();
  const workStart = new Date();
  workStart.setHours(8, 0, 0, 0);

  const createdIds: string[] = [];
  let seq = 0;

  for (const line of resolved) {
    const pt = typeByCode.get(line.procedureCode);
    if (!pt) {
      throw new PackageAssignError(
        `Unknown procedure type ${line.procedureCode}`,
        "UNKNOWN_TYPE",
        400,
      );
    }
    const batchId = newBatchId();
    const duration = pt.durationMin ?? 30;
    for (let i = 0; i < line.qty; i++) {
      const scheduledAt = new Date(workStart.getTime() + seq * 60_000);
      const order = await prisma.procedureOrder.create({
        data: {
          organizationId: orgId,
          patientRefId: episode.patientRefId,
          clinicalEpisodeId: episodeId,
          procedureTypeId: pt.id,
          procedureCode: line.procedureCode,
          procedureName: pt.name,
          scheduledAt,
          endsAt: new Date(scheduledAt.getTime() + duration * 60_000),
          sequenceIndex: seq++,
          bodyPart: line.bodyPart ?? pt.bodyPart ?? undefined,
          status: "PROPOSED",
          note: line.note ?? undefined,
          physioFields: line.physioFields ?? undefined,
          assignBatchId: batchId,
          inPackage: true,
          packageQuotaCode: line.quotaCode,
          patientOrigin: episode.patientOrigin,
          reservationId: episode.reservationId ?? undefined,
          amountNet: 0,
          siteApplyMode: line.siteApplyMode ?? undefined,
        },
      });
      if (line.siteIds?.length) {
        await prisma.procedureOrderSite.createMany({
          data: line.siteIds.map((siteId, sortOrder) => ({
            organizationId: orgId,
            procedureOrderId: order.id,
            siteId,
            sortOrder,
            laterality: line.siteLaterality?.[siteId] ?? undefined,
          })),
        });
      }
      createdIds.push(order.id);
    }
  }

  const placed = await placeConfirmedProcedures(createdIds, {
    confirmedByUserId: opts?.confirmedByUserId,
  });

  const codes = [...new Set(resolved.map((l) => l.quotaCode))];
  for (const code of codes) {
    await syncQuotaUsed(instance.id, episodeId, code);
  }

  return { placed, softWarn, orderIds: createdIds };
}

async function syncQuotaUsed(instanceId: string, episodeId: string, quotaCode: string) {
  const used = await prisma.procedureOrder.count({
    where: {
      clinicalEpisodeId: episodeId,
      inPackage: true,
      status: { in: [...IN_CIRCULATION, ...CONSUMED] },
      OR: [
        { packageQuotaCode: quotaCode },
        { packageQuotaCode: null, procedureCode: quotaCode },
      ],
    },
  });
  await prisma.programProcedureBalance.updateMany({
    where: { instanceId, procedureCode: quotaCode },
    data: { quotaUsed: used },
  });
}

/**
 * Increase active qty for an existing batch (same physio params) by delta.
 */
export async function increasePackageAssignQty(
  episodeId: string,
  input: {
    procedureCode: string;
    assignBatchId?: string | null;
    addQty: number;
    note?: string | null;
    bodyPart?: string | null;
    physioFields?: Record<string, unknown> | null;
    siteIds?: string[];
    siteApplyMode?: "TURN" | "TOGETHER" | null;
    siteLaterality?: Record<string, "LEFT" | "RIGHT" | "BOTH" | null>;
  },
  opts?: { confirmedByUserId?: string },
): Promise<{ placed: number; softWarn: string | null; orderIds: string[] }> {
  if (input.addQty < 1) {
    throw new PackageAssignError("addQty must be >= 1", "INVALID", 400);
  }
  return assignPackageProcedures(
    episodeId,
    [
      {
        procedureCode: input.procedureCode,
        qty: input.addQty,
        note: input.note,
        bodyPart: input.bodyPart,
        physioFields: input.physioFields,
        siteIds: input.siteIds,
        siteApplyMode: input.siteApplyMode,
        siteLaterality: input.siteLaterality,
      },
    ],
    opts,
  );
}

/**
 * Replace qty of in-package active sessions with another code.
 * If newCode is not in package template → create PENDING_PAY extras (antifraud); cancel old; return quota.
 * Manager-only for out-of-package is enforced at route layer.
 */
export async function replacePackageProcedures(
  episodeId: string,
  input: {
    fromCode: string;
    toCode: string;
    qty: number;
    assignBatchId?: string | null;
    note?: string | null;
  },
  opts?: { confirmedByUserId?: string; allowOutOfPackage?: boolean },
): Promise<{
  cancelled: number;
  mode: "in_package" | "extra_pending_pay";
  orderIds: string[];
}> {
  if (input.qty < 1) {
    throw new PackageAssignError("qty must be >= 1", "INVALID", 400);
  }
  const episode = await loadEpisodeForAssign(episodeId);
  const instance = episode.programInstance!;
  const packageCodes = new Set(instance.procedureLines.map((l) => l.procedureCode));
  const balanceCodes = [...packageCodes];

  if (isPackagePoolCode(input.toCode)) {
    throw new PackageAssignError(
      `Pool code ${input.toCode} is not assignable — pick a real procedure`,
      "POOL_NOT_ASSIGNABLE",
      400,
    );
  }

  let burnPoolCode: string | null = null;
  let inPackageTarget = packageCodes.has(input.toCode);
  if (!inPackageTarget) {
    const types = await prisma.procedureType.findMany({
      select: { code: true, name: true, needsSite: true },
    });
    for (const pool of balanceCodes.filter(isPackagePoolCode)) {
      const eligible = eligibleSkusForPool(
        pool,
        balanceCodes,
        types.map((t) => ({ ...t, active: true })),
      );
      if (eligible.some((e) => e.code === input.toCode)) {
        inPackageTarget = true;
        burnPoolCode = pool;
        break;
      }
    }
  }

  if (!inPackageTarget && !opts?.allowOutOfPackage) {
    throw new PackageAssignError(
      "Out-of-package replace requires manager approval (paid extra path)",
      "OUT_OF_PACKAGE_FORBIDDEN",
      403,
    );
  }

  const active = await prisma.procedureOrder.findMany({
    where: {
      clinicalEpisodeId: episodeId,
      procedureCode: input.fromCode,
      status: "SCHEDULED",
      inPackage: true,
      ...(input.assignBatchId ? { assignBatchId: input.assignBatchId } : {}),
    },
    orderBy: { scheduledAt: "desc" },
    take: input.qty,
  });
  if (active.length < input.qty) {
    throw new PackageAssignError(
      `Only ${active.length} active sessions to replace`,
      "INSUFFICIENT_ACTIVE",
      400,
    );
  }

  const fromQuotaCodes = [...new Set(active.map((o) => quotaCodeOf(o)))];

  await prisma.procedureOrder.updateMany({
    where: { id: { in: active.map((o) => o.id) } },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancelReason: "package_replace",
    },
  });
  for (const code of fromQuotaCodes) {
    await syncQuotaUsed(instance.id, episodeId, code);
  }

  if (inPackageTarget) {
    const result = await assignPackageProcedures(
      episodeId,
      [
        {
          procedureCode: input.toCode,
          qty: input.qty,
          note: input.note,
          burnPoolCode,
        },
      ],
      opts,
    );
    return {
      cancelled: active.length,
      mode: "in_package",
      orderIds: result.orderIds,
    };
  }

  // Out of package → PENDING_PAY extras (antifraud: never free)
  const { prescribeExtras } = await import("@/domain/sanatorium/extras-assign.service");
  const prescribed = await prescribeExtras(episodeId, [
    { procedureCode: input.toCode, qty: input.qty, note: input.note },
  ]);
  return {
    cancelled: active.length,
    mode: "extra_pending_pay",
    orderIds: prescribed.orderIds,
  };
}

/**
 * Day-1 auto: up to 3 distinct non-pool package codes with remaining > 0, qty 1 each.
 */
export async function day1AutoAssign(
  episodeId: string,
  opts?: { confirmedByUserId?: string },
): Promise<{ placed: number; softWarn: string | null; orderIds: string[] }> {
  const snap = await getPackageAssignSnapshot(episodeId);
  const picks = snap.balances
    .filter((b) => !b.isPool && b.remaining > 0)
    .slice(0, DAY1_SOFT_CONFIRM_CAP);
  if (picks.length === 0) {
    throw new PackageAssignError("No remaining package quota", "EMPTY_REMAINING", 400);
  }
  return assignPackageProcedures(
    episodeId,
    picks.map((p) => ({ procedureCode: p.procedureCode, qty: 1 })),
    opts,
  );
}

/**
 * Cancel non-consumed package sessions for a code/batch; return quota. COMPLETED stays.
 */
export async function adjustPackageAssign(
  episodeId: string,
  input: {
    procedureCode: string;
    assignBatchId?: string | null;
    /** Target active (non-completed) qty; excess SCHEDULED cancelled. */
    targetActiveQty?: number;
    /** If true, cancel all active for code/batch. */
    cancelAllActive?: boolean;
  },
): Promise<{ cancelled: number }> {
  const episode = await loadEpisodeForAssign(episodeId);
  const instance = episode.programInstance!;

  const where = {
    clinicalEpisodeId: episodeId,
    procedureCode: input.procedureCode,
    status: { in: [...IN_CIRCULATION] },
    inPackage: true,
    ...(input.assignBatchId ? { assignBatchId: input.assignBatchId } : {}),
  };

  const active = await prisma.procedureOrder.findMany({
    where,
    orderBy: { scheduledAt: "desc" },
  });

  // CHECKED_IN never cancelled from modal; only SCHEDULED may shrink.
  const scheduled = active.filter((o) => o.status === "SCHEDULED");
  const checkedInCount = active.length - scheduled.length;

  let cancellable = scheduled;
  if (!input.cancelAllActive && input.targetActiveQty != null) {
    const keepTotal = Math.max(0, input.targetActiveQty);
    const keepScheduled = Math.max(0, keepTotal - checkedInCount);
    if (scheduled.length <= keepScheduled) return { cancelled: 0 };
    cancellable = scheduled.slice(0, scheduled.length - keepScheduled);
  }

  if (cancellable.length === 0) {
    if (checkedInCount > 0 && scheduled.length === 0) {
      throw new PackageAssignError(
        "Checked-in procedures cannot be removed from the assign modal",
        "CHECKED_IN_LOCKED",
      );
    }
    return { cancelled: 0 };
  }

  await prisma.procedureOrder.updateMany({
    where: { id: { in: cancellable.map((o) => o.id) } },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancelReason: "package_assign_adjust",
    },
  });

  const syncCodes = [...new Set(cancellable.map((o) => quotaCodeOf(o)))];
  for (const code of syncCodes) {
    await syncQuotaUsed(instance.id, episodeId, code);
  }
  return { cancelled: cancellable.length };
}

/**
 * Cancel future SCHEDULED (not CHECKED_IN/COMPLETED) past endsOn; sync quotas.
 */
export async function cancelFutureScheduledPastEnd(
  instanceId: string,
  endsOn: Date,
): Promise<number> {
  const instance = await prisma.programInstance.findUnique({
    where: { id: instanceId },
    select: { episodeId: true, procedureLines: true },
  });
  if (!instance) return 0;

  const result = await prisma.procedureOrder.updateMany({
    where: {
      clinicalEpisodeId: instance.episodeId,
      status: "SCHEDULED",
      scheduledAt: { gte: endsOn },
    },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancelReason: "stay_shortened",
    },
  });

  for (const line of instance.procedureLines) {
    await syncQuotaUsed(instanceId, instance.episodeId, line.procedureCode);
  }
  return result.count;
}
