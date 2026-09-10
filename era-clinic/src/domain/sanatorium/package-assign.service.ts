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
import { clampDailyPackageProcedureCap } from "@/domain/sanatorium/daily-package-cap";
import { getSchedulingSettings } from "@/domain/settings/scheduling-settings";
import {
  resolveMembersByBlock,
  parseEntitlementSnapshot,
} from "@/domain/sanatorium/program-template-admin";
import {
  isSeedProcedureCode,
  isWoProcedureCode,
} from "@/lib/import/seed-catalog-match";

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

export type PoolEligibleSku = { code: string; name: string };

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
 * Program-template quota codes that are not ProcedureType rows.
 * Assign resolves to a real SVC-* / WO-TR-* (e.g. gender-specific naftalan bath).
 */
export const PACKAGE_QUOTA_ALIAS_CODES = ["NAFTALAN_BATH"] as const;

/** Preferred catalog codes first; WO-TR-* are live Nafta cutover fallbacks when SVC seed missing. */
export const NAFTALAN_BATH_SKU_CANDIDATES = {
  MALE: ["SVC-NAFTALAN-VANNASI-KISI", "WO-TR-72"] as const,
  FEMALE: ["SVC-NAFTALAN-VANNASI-QADIN", "WO-TR-68"] as const,
};

export function isPackageQuotaAlias(code: string): boolean {
  const c = code.trim().toUpperCase();
  return (PACKAGE_QUOTA_ALIAS_CODES as readonly string[]).includes(c);
}

function sexNorm(sex: string | null | undefined): "MALE" | "FEMALE" | "UNKNOWN" {
  const s = String(sex ?? "")
    .trim()
    .toUpperCase();
  if (s === "MALE" || s === "M" || s === "KISI" || s === "KIŞI") return "MALE";
  if (s === "FEMALE" || s === "F" || s === "QADIN") return "FEMALE";
  return "UNKNOWN";
}

function isMaleBathSku(code: string, name: string): boolean {
  const hay = foldHay(`${code} ${name}`);
  if (/svc-naftalan-vannasi-kisi|wo-tr-72/.test(hay)) return true;
  return /naftalan/.test(hay) && /(kisi|kişi|male|\(m\)|men\b)/.test(hay);
}

function isFemaleBathSku(code: string, name: string): boolean {
  const hay = foldHay(`${code} ${name}`);
  if (/svc-naftalan-vannasi-qadin|wo-tr-68/.test(hay)) return true;
  return /naftalan/.test(hay) && /(qadin|qadın|female|\(f\)|women\b)/.test(hay);
}

/**
 * Real ProcedureTypes that may burn a NAFTALAN_BATH (or other quota-alias) balance line.
 * Prefers seeded SVC gender SKUs; falls back to WO-TR / name-matched baths when seed is missing.
 * When `sex` is MALE/FEMALE, only that gender's SKUs are returned (UNKNOWN → both for picker).
 */
export function eligibleSkusForQuotaAlias(
  quotaCode: string,
  types: Array<{ code: string; name: string; active?: boolean | null }>,
  sex?: string | null,
): PoolEligibleSku[] {
  const c = quotaCode.trim().toUpperCase();
  if (!isPackageQuotaAlias(c)) return [];
  const active = types.filter((t) => t.active !== false);
  const byCode = new Map(active.map((t) => [t.code.toUpperCase(), t]));

  const pickCandidates = (codes: readonly string[]): PoolEligibleSku[] => {
    const out: PoolEligibleSku[] = [];
    for (const code of codes) {
      const hit = byCode.get(code.toUpperCase());
      if (hit) out.push({ code: hit.code, name: hit.name });
    }
    return out;
  };

  let list: PoolEligibleSku[] = [];
  if (c === "NAFTALAN_BATH") {
    const male = pickCandidates(NAFTALAN_BATH_SKU_CANDIDATES.MALE);
    const female = pickCandidates(NAFTALAN_BATH_SKU_CANDIDATES.FEMALE);
    if (male.length || female.length) {
      const seen = new Set<string>();
      for (const s of [...female, ...male]) {
        const k = s.code.toUpperCase();
        if (seen.has(k)) continue;
        seen.add(k);
        list.push(s);
      }
    } else {
      list = active
        .filter((t) => isMaleBathSku(t.code, t.name) || isFemaleBathSku(t.code, t.name))
        .map((t) => ({ code: t.code, name: t.name }));
    }
  }

  const gender = sexNorm(sex);
  if (gender === "MALE") {
    return preferCanonicalPoolSkus(list.filter((s) => isMaleBathSku(s.code, s.name)));
  }
  if (gender === "FEMALE") {
    return preferCanonicalPoolSkus(list.filter((s) => isFemaleBathSku(s.code, s.name)));
  }
  return preferCanonicalPoolSkus(list);
}

/**
 * Map PDF/knot quota alias → bookable ProcedureType code.
 * Returns null when sex is UNKNOWN/empty and both genders exist — UI must pick.
 */
export function resolvePackageQuotaSku(
  quotaCode: string,
  sex: string | null | undefined,
  typeCodes: Iterable<string>,
  typeMeta?: Array<{ code: string; name: string; active?: boolean | null }>,
): string | null {
  const c = quotaCode.trim().toUpperCase();
  if (!isPackageQuotaAlias(c)) return null;

  const types =
    typeMeta ??
    [...typeCodes].map((code) => ({ code, name: code, active: true as boolean | null }));
  const eligible = eligibleSkusForQuotaAlias(c, types, sex);
  if (eligible.length === 0) return null;

  const gender = sexNorm(sex);
  const male = eligible.find((e) => isMaleBathSku(e.code, e.name));
  const female = eligible.find((e) => isFemaleBathSku(e.code, e.name));

  if (gender === "MALE" && male) return male.code;
  if (gender === "FEMALE" && female) return female.code;

  // Known sex but only opposite / untagged SKU present — take the only option.
  if (gender !== "UNKNOWN" && eligible.length === 1) return eligible[0].code;

  // UNKNOWN / empty sex: do not auto-pick when both genders exist (picker).
  if (gender === "UNKNOWN" && male && female) return null;
  if (male) return male.code;
  if (female) return female.code;
  return eligible[0]?.code ?? null;
}

/**
 * CLI-57 package assign left menu = treatment entitlements only.
 * Intake labs / doctor exams stay on ProgramProcedureBalance for quota truth but are out of scope
 * for this modal (ADR clinic-episode-procedure-assign-modal — intake on separate card blocks).
 */
export function isPackageAssignTreatmentLine(code: string, name?: string | null): boolean {
  const c = code.trim().toUpperCase();
  if (!c) return false;
  // Pool buckets stay visible — modal opens a SKU picker (eligibleSkusForPool).
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

/**
 * True when the balance line is an entitlement bucket (legacy *_POOL or configured members).
 */
export function isEntitlementBucket(
  code: string,
  configuredMemberCodes?: string[] | null,
): boolean {
  if (configuredMemberCodes && configuredMemberCodes.length > 0) return true;
  return isPackagePoolCode(code);
}

/**
 * Which real ProcedureTypes may burn a pool / entitlement-block balance line.
 * When `configuredMemberCodes` is non-empty → whitelist only (admin block membership).
 * Else legacy heuristic: PARAFFIN_POOL → paraffin; PHYSIO_POOL → needsSite/SVC* minus paraffin/dedicated.
 */
export function eligibleSkusForPool(
  poolCode: string,
  packageBalanceCodes: string[],
  types: Array<{ code: string; name: string; needsSite?: boolean | null; active?: boolean | null }>,
  configuredMemberCodes?: string[] | null,
): PoolEligibleSku[] {
  const active = types.filter((t) => t.active !== false);
  let list: PoolEligibleSku[];
  if (configuredMemberCodes && configuredMemberCodes.length > 0) {
    const want = new Set(configuredMemberCodes.map((c) => c.trim().toUpperCase()));
    list = active
      .filter((t) => want.has(t.code.toUpperCase()))
      .map((t) => ({ code: t.code, name: t.name }));
  } else {
    const dedicated = new Set(
      packageBalanceCodes.filter((c) => !isPackagePoolCode(c)),
    );
    if (poolCode === "PARAFFIN_POOL" || /paraffin/i.test(poolCode)) {
      list = active
        .filter((t) => isParaffinType(t.code, t.name))
        .map((t) => ({ code: t.code, name: t.name }));
    } else {
      list = active
        .filter((t) => {
          if (dedicated.has(t.code)) return false;
          if (isParaffinType(t.code, t.name)) return false;
          if (isPackagePoolCode(t.code)) return false;
          if (t.needsSite === true) return true;
          if (/^SVC-/i.test(t.code) && !/LAB|USM|ECG|ALT|AST|GLU|CBC|URINE/i.test(t.code)) {
            return true;
          }
          return false;
        })
        .map((t) => ({ code: t.code, name: t.name }));
    }
  }
  return preferCanonicalPoolSkus(list);
}

/**
 * Cutover imported WO-TR-* rows keep Russian Elektra names; Nafta seed SVC-* owns AZ/EN.
 * When both exist in a pool picker, keep the seed SKU so the list is not AZ+RU duplicates.
 */
export function preferCanonicalPoolSkus(skus: PoolEligibleSku[]): PoolEligibleSku[] {
  const hasSeed = skus.some((s) => isSeedProcedureCode(s.code));
  if (!hasSeed) return skus;
  const withoutCutover = skus.filter((s) => !isWoProcedureCode(s.code));
  return withoutCutover.length > 0 ? withoutCutover : skus;
}

function quotaCodeOf(o: { packageQuotaCode?: string | null; procedureCode: string }): string {
  return o.packageQuotaCode?.trim() || o.procedureCode;
}

function newBatchId(): string {
  return `batch_${randomBytes(8).toString("hex")}`;
}

export function paramsLinesFromOrder(o: {
  note?: string | null;
  bodyPart?: string | null;
  siteApplyMode?: string | null;
  physioFields?: unknown;
  sites?: Array<{
    siteId?: string;
    laterality?: string | null;
    site?: { titleEn?: string | null; titleRu?: string | null; titleAz?: string | null } | null;
  }>;
}): string[] {
  const parts: string[] = [];
  const siteNames = (o.sites ?? [])
    .map((s) => {
      const title = s.site?.titleEn || s.site?.titleRu || s.site?.titleAz;
      const lat = (s as { laterality?: string | null }).laterality;
      if (!title) return null;
      return lat ? `${title} (${lat})` : title;
    })
    .filter((x): x is string => Boolean(x));
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
  return parts;
}

export function paramsLabelFromOrder(
  o: Parameters<typeof paramsLinesFromOrder>[0],
): string {
  return paramsLinesFromOrder(o).join(" · ");
}

/** Unique param lines from one or more "a · b" labels (right-column cards). */
export function mergeParamLines(labels: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const lab of labels) {
    for (const part of lab.split(" · ")) {
      const p = part.trim();
      if (p && !seen.has(p)) {
        seen.add(p);
        out.push(p);
      }
    }
  }
  return out;
}

/** One right-column card per SKU + quota + lock, not per assign batch / param fingerprint. */
export function assignedAggGroupKey(o: {
  procedureCode: string;
  packageQuotaCode?: string | null;
  locked: boolean;
  consumed: boolean;
}): string {
  return `${quotaCodeOf(o)}:${o.procedureCode}:${o.locked ? "locked" : "active"}:${o.consumed ? "done" : "live"}`;
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
  /** True for NAFTALAN_BATH — pick gender SKU (or auto-resolve when sex known). */
  isQuotaAlias: boolean;
  /** When set, UI should open SKU picker (pool or unresolved quota alias). */
  needsSkuPicker: boolean;
  /**
   * False for intake labs/exams (fulfilled via LabOrder/Visit auto-apply).
   * Modal shows them read-only; only assignable rows open the picker.
   */
  assignable: boolean;
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
  /** Same as paramsLabel, one field per line for the assign card. */
  paramsLines: string[];
  /** Balance line burned (pool code or procedureCode). */
  packageQuotaCode: string;
};

/**
 * @param requireClinicalGates — CLI-55/56 anamnesis + care team.
 * GET snapshot must load without care-team/anamnesis gates (Nafta: many OPEN episodes still lack
 * care team; /sanatorium opens the modal without the patient-card gate). Mutations keep gates.
 * @param requireProgram — mutations need ProgramInstance; GET may soft-return without one.
 */
async function loadEpisodeForAssign(
  episodeId: string,
  opts?: { requireClinicalGates?: boolean; requireProgram?: boolean },
) {
  const requireClinicalGates = opts?.requireClinicalGates !== false;
  const requireProgram = opts?.requireProgram !== false;
  const episode = await prisma.clinicalEpisode.findUnique({
    where: { id: episodeId },
    include: {
      programInstance: {
        include: {
          procedureLines: true,
          template: { include: { procedures: true } },
        },
      },
      patientRef: true,
    },
  });
  if (!episode) throw new PackageAssignError("Episode not found", "NOT_FOUND", 404);
  if (episode.status !== "OPEN") {
    throw new PackageAssignError("Episode is not OPEN", "NOT_OPEN");
  }
  if (requireProgram && !episode.programInstance) {
    throw new PackageAssignError("No program instance", "NO_PROGRAM");
  }
  if (requireClinicalGates) {
    const anamnesisDenied = episodeAnamnesisDenied(episode.anamnesisText);
    if (anamnesisDenied) {
      throw new PackageAssignError(anamnesisDenied, ANAMNESIS_REQUIRED);
    }
    const careDenied = episodeCareTeamDenied(await countEpisodeCareDoctors(episodeId));
    if (careDenied) {
      throw new PackageAssignError(careDenied, CARE_TEAM_REQUIRED);
    }
  }
  return episode;
}

export async function getPackageAssignSnapshot(episodeId: string): Promise<{
  balances: PackageBalanceRow[];
  assigned: PackageAssignedAgg[];
  softWarnDay1: string | null;
  /** Present when balances cannot load yet (set package / open day-1). */
  blockReason: "NO_PROGRAM" | "NO_PROGRAM_CODE" | null;
  /** poolCode → eligible real SKUs for the picker */
  poolEligible: Record<string, PoolEligibleSku[]>;
  /** Pinned package identity for support (code + version). */
  packageCode: string | null;
  packageVersion: number | null;
  templateId: string | null;
}> {
  const episode = await loadEpisodeForAssign(episodeId, {
    requireClinicalGates: false,
    requireProgram: false,
  });

  if (!episode.programInstance) {
    const hasCode = Boolean(episode.programCode?.trim());
    return {
      balances: [],
      assigned: [],
      softWarnDay1: hasCode
        ? "Program code is set but package is not open yet — use Complete checkup / Day-1 to instantiate balances."
        : "No program code on this stay — set the package (Complete checkup & schedule) before assigning procedures.",
      blockReason: hasCode ? "NO_PROGRAM" : "NO_PROGRAM_CODE",
      poolEligible: {},
      packageCode: episode.programCode?.trim() || null,
      packageVersion: null,
      templateId: null,
    };
  }

  const instance = episode.programInstance;
  const snapMeta = parseEntitlementSnapshot(instance.entitlementSnapshot);
  const nameByCode = new Map(
    (instance.template?.procedures ?? []).map((p) => [p.procedureCode, p.procedureName]),
  );
  if (snapMeta) {
    for (const p of snapMeta.procedures) {
      if (!nameByCode.has(p.procedureCode)) nameByCode.set(p.procedureCode, p.procedureName);
    }
  }

  const blockMemberRows = await prisma.programTemplateBlockMember.findMany({
    where: { templateId: instance.templateId },
    select: { blockCode: true, procedureCode: true },
  });
  const membersByBlock = resolveMembersByBlock({
    entitlementSnapshot: instance.entitlementSnapshot,
    templateMembers: blockMemberRows,
  });

  const anamnesisDenied = episodeAnamnesisDenied(episode.anamnesisText);
  const careDenied = episodeCareTeamDenied(await countEpisodeCareDoctors(episodeId));
  const softWarnDay1 = careDenied ?? anamnesisDenied;

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

  const types = await prisma.procedureType.findMany({
    select: { code: true, name: true, needsSite: true },
  });
  const typeRows = types.map((t) => ({ ...t, active: true as boolean | null }));
  const patientSex = episode.patientRef?.sex ?? null;

  const balances: PackageBalanceRow[] = instance.procedureLines.map((line) => {
    const c = counts.get(line.procedureCode) ?? { circ: 0, consumed: 0 };
    const used = c.circ + c.consumed;
    const configured = membersByBlock.get(line.procedureCode) ?? [];
    const isPool = isEntitlementBucket(line.procedureCode, configured);
    const isQuotaAlias = isPackageQuotaAlias(line.procedureCode);
    const assignable = isPackageAssignTreatmentLine(
      line.procedureCode,
      nameByCode.get(line.procedureCode) ?? line.procedureCode,
    );
    let needsSkuPicker = false;
    if (assignable) {
      if (configured.length > 1) {
        needsSkuPicker = true;
      } else if (configured.length === 1) {
        needsSkuPicker = false;
      } else if (isPackagePoolCode(line.procedureCode)) {
        needsSkuPicker = true;
      } else if (isQuotaAlias) {
        const auto = resolvePackageQuotaSku(
          line.procedureCode,
          patientSex,
          types.map((t) => t.code),
          typeRows,
        );
        needsSkuPicker = auto == null;
      }
    }
    return {
      procedureCode: line.procedureCode,
      procedureName: nameByCode.get(line.procedureCode) ?? line.procedureCode,
      quotaTotal: line.quotaTotal,
      quotaUsed: line.quotaUsed,
      remaining: Math.max(0, line.quotaTotal - used),
      inCirculation: c.circ,
      consumed: c.consumed,
      isPool,
      isQuotaAlias,
      needsSkuPicker,
      assignable,
    };
  });

  const poolEligible: Record<string, PoolEligibleSku[]> = {};
  for (const b of balances) {
    const configured = membersByBlock.get(b.procedureCode) ?? [];
    if (configured.length > 0 || isPackagePoolCode(b.procedureCode)) {
      poolEligible[b.procedureCode] = eligibleSkusForPool(
        b.procedureCode,
        balanceCodes,
        typeRows,
        configured.length > 0 ? configured : null,
      );
    } else if (b.isQuotaAlias) {
      poolEligible[b.procedureCode] = eligibleSkusForQuotaAlias(
        b.procedureCode,
        typeRows,
        patientSex,
      );
    }
  }

  const batchMap = new Map<string, PackageAssignedAgg>();
  for (const o of orders) {
    const consumed = (CONSUMED as readonly string[]).includes(o.status);
    const locked = consumed || o.status === "CHECKED_IN";
    const key = assignedAggGroupKey({
      procedureCode: o.procedureCode,
      packageQuotaCode: quotaCodeOf(o),
      locked,
      consumed,
    });
    const prev = batchMap.get(key);
    const nextLines = mergeParamLines([
      prev?.paramsLabel ?? "",
      paramsLabelFromOrder(o),
    ]);
    if (prev) {
      prev.qty += 1;
      prev.paramsLabel = nextLines.join(" · ");
      prev.paramsLines = nextLines;
    } else {
      batchMap.set(key, {
        assignBatchId: o.assignBatchId,
        procedureCode: o.procedureCode,
        procedureName: o.procedureName,
        qty: 1,
        statusKind: consumed ? "consumed" : "active",
        locked,
        paramsLabel: nextLines.join(" · "),
        paramsLines: nextLines,
        packageQuotaCode: quotaCodeOf(o),
      });
    }
  }

  return {
    balances,
    assigned: [...batchMap.values()],
    softWarnDay1,
    blockReason: null,
    poolEligible,
    packageCode: instance.programCode,
    packageVersion:
      snapMeta?.version ??
      (instance.template as { version?: number } | null | undefined)?.version ??
      null,
    templateId: instance.templateId,
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
  const packageSnap = await getPackageAssignSnapshot(episodeId);
  const remByCode = new Map(packageSnap.balances.map((b) => [b.procedureCode, b]));
  const balanceCodes = packageSnap.balances.map((b) => b.procedureCode);

  const blockMemberRows = await prisma.programTemplateBlockMember.findMany({
    where: { templateId: instance.templateId },
    select: { blockCode: true, procedureCode: true },
  });
  const membersByBlock = resolveMembersByBlock({
    entitlementSnapshot: instance.entitlementSnapshot,
    templateMembers: blockMemberRows,
  });

  const types = await prisma.procedureType.findMany();
  const typeByCode = new Map(types.map((t) => [t.code, t]));

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
    const burnQuota = line.burnPoolCode?.trim() || null;
    let skuCode = line.procedureCode;
    let quotaCode = burnQuota || line.procedureCode;

    if (isPackageQuotaAlias(line.procedureCode) && !burnQuota) {
      // Alias sent without picker SKU — resolve by sex when unambiguous.
      quotaCode = line.procedureCode;
      const resolvedSku = resolvePackageQuotaSku(
        line.procedureCode,
        episode.patientRef?.sex,
        typeByCode.keys(),
        types.map((t) => ({ code: t.code, name: t.name, active: true })),
      );
      if (!resolvedSku) {
        throw new PackageAssignError(
          `Cannot resolve ${line.procedureCode} — patient sex is unknown/empty; pick male or female bath SKU`,
          "ALIAS_SKU_REQUIRED",
          400,
        );
      }
      skuCode = resolvedSku;
    } else if (burnQuota && isPackageQuotaAlias(burnQuota) && !(membersByBlock.get(burnQuota)?.length)) {
      quotaCode = burnQuota;
      const eligible = eligibleSkusForQuotaAlias(
        burnQuota,
        types.map((t) => ({ code: t.code, name: t.name, active: true })),
        episode.patientRef?.sex,
      );
      if (!eligible.some((e) => e.code === line.procedureCode)) {
        throw new PackageAssignError(
          `SKU ${line.procedureCode} is not eligible for alias ${burnQuota}`,
          "ALIAS_SKU_NOT_ELIGIBLE",
          400,
        );
      }
      skuCode = line.procedureCode;
    } else if (burnQuota) {
      const configured = membersByBlock.get(burnQuota) ?? [];
      if (!isEntitlementBucket(burnQuota, configured) && !isPackageQuotaAlias(burnQuota)) {
        throw new PackageAssignError(
          `burnPoolCode ${burnQuota} is not an entitlement block`,
          "INVALID",
          400,
        );
      }
      const eligible =
        configured.length > 0 || isPackagePoolCode(burnQuota)
          ? eligibleSkusForPool(
              burnQuota,
              balanceCodes,
              types.map((t) => ({
                code: t.code,
                name: t.name,
                needsSite: t.needsSite,
                active: true,
              })),
              configured.length > 0 ? configured : null,
            )
          : eligibleSkusForQuotaAlias(
              burnQuota,
              types.map((t) => ({ code: t.code, name: t.name, active: true })),
              episode.patientRef?.sex,
            );
      if (!eligible.some((e) => e.code === line.procedureCode)) {
        throw new PackageAssignError(
          `SKU ${line.procedureCode} is not eligible for pool ${burnQuota}`,
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
    resolved.push({ ...line, procedureCode: skuCode, quotaCode });
  }

  const packageCap = clampDailyPackageProcedureCap(
    (await getSchedulingSettings()).dailyPackageProcedureCap,
  );
  const distinctCodes = new Set(resolved.map((l) => l.procedureCode)).size;
  const softWarn =
    distinctCodes > packageCap
      ? `Daily in-package cap is ${packageCap} distinct codes; batch has ${distinctCodes} (remainder places from next work day)`
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

  if (placed < createdIds.length) {
    const stillProposed = await prisma.procedureOrder.findMany({
      where: { id: { in: createdIds }, status: "PROPOSED" },
      select: { id: true, procedureCode: true, procedureName: true },
    });
    if (stillProposed.length > 0) {
      const codes = [...new Set(stillProposed.map((o) => o.procedureCode))].join(", ");
      await prisma.procedureOrder.updateMany({
        where: { id: { in: stillProposed.map((o) => o.id) } },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancelReason: "place_failed_no_slot_or_resource",
        },
      });
      throw new PackageAssignError(
        `Could not place ${stillProposed.length} of ${createdIds.length} session(s) (${codes}). Check procedure resources, staff skills, and schedule capacity.`,
        "PLACE_FAILED",
        409,
      );
    }
  }

  const codes = [...new Set(resolved.map((l) => l.quotaCode))];
  for (const code of codes) {
    await syncQuotaUsed(instance.id, episodeId, code);
  }

  return { placed, softWarn, orderIds: createdIds };
}

async function syncQuotaUsed(instanceId: string, episodeId: string, quotaCode: string) {
  const { syncEntitlementUsage } = await import(
    "@/domain/sanatorium/entitlement-usage.service"
  );
  await syncEntitlementUsage({ instanceId, episodeId, quotaCode });
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
    const blockMemberRows = await prisma.programTemplateBlockMember.findMany({
      where: { templateId: instance.templateId },
      select: { blockCode: true, procedureCode: true },
    });
    const membersByBlock = resolveMembersByBlock({
      entitlementSnapshot: instance.entitlementSnapshot,
      templateMembers: blockMemberRows,
    });
    for (const pool of balanceCodes) {
      const configured = membersByBlock.get(pool) ?? [];
      if (!isEntitlementBucket(pool, configured) && !isPackageQuotaAlias(pool)) continue;
      const eligible =
        configured.length > 0 || isPackagePoolCode(pool)
          ? eligibleSkusForPool(
              pool,
              balanceCodes,
              types.map((t) => ({ ...t, active: true })),
              configured.length > 0 ? configured : null,
            )
          : eligibleSkusForQuotaAlias(
              pool,
              types.map((t) => ({ ...t, active: true })),
              episode.patientRef?.sex,
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
 * Day-1 auto: up to N distinct non-pool package codes with remaining > 0, qty 1 each.
 * N = Tenant.dailyPackageProcedureCap (default 3).
 */
export async function day1AutoAssign(
  episodeId: string,
  opts?: { confirmedByUserId?: string },
): Promise<{ placed: number; softWarn: string | null; orderIds: string[] }> {
  const packageCap = clampDailyPackageProcedureCap(
    (await getSchedulingSettings()).dailyPackageProcedureCap,
  );
  const snap = await getPackageAssignSnapshot(episodeId);
  const picks = snap.balances
    .filter((b) => !b.isPool && !b.isQuotaAlias && !b.needsSkuPicker && b.remaining > 0)
    .slice(0, packageCap);
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
