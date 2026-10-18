/**
 * CLI-57 — package lazy-assign from ProgramProcedureBalance (ADR clinic-episode-procedure-assign-modal).
 */
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";
import { placeConfirmedProcedures } from "@/lib/treatment-planner.service";
import { releaseProcedureOccupancy } from "@/domain/procedure/procedure-allocation.service";
import { episodeAnamnesisDenied, ANAMNESIS_REQUIRED } from "@/domain/sanatorium/episode-gates";
import {
  CARE_TEAM_REQUIRED,
  episodeCareTeamDenied,
} from "@/domain/sanatorium/episode-care-team-gates";
import { countEpisodeCareDoctors } from "@/domain/sanatorium/episode-care-team.service";
import { clampDailyPackageProcedureCap } from "@/domain/sanatorium/daily-package-cap";
import {
  defaultBathModeFromSettings,
  getSchedulingSettings,
} from "@/domain/settings/scheduling-settings";
import {
  resolveMembersByBlock,
  parseEntitlementSnapshot,
} from "@/domain/sanatorium/program-template-admin";
import {
  isSeedProcedureCode,
  isWoProcedureCode,
} from "@/lib/import/seed-catalog-match";
import { parseBakuDateTime, todayBakuYmd } from "@/lib/baku-day";
import {
  blockedProcedureCodesForGuest,
  procedureFitsGuestSex,
} from "@/domain/procedure/procedure-sex-gate";
import {
  formatLateralityLabel,
  formatPhysioFieldsPrint,
  type PhysioOrderFields,
} from "@/domain/physio/physio-order-fields";

export class PackageAssignError extends Error {
  constructor(
    message: string,
    public code: string,
    public status = 409,
    public misses: Array<{
      ymd: string;
      procedureCode: string;
      reason: string;
      procedureName?: string;
    }> = [],
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
    "CARDIO-ECG",
    "USG",
    "USG-ABD",
    "THERAPIST",
    "NEURO",
    "GYN",
    "URO",
    "GYN-OR-URO",
    "GYN-VISIT",
    "URO-VISIT",
    "VISIT-GYN",
    "VISIT-URO",
    "SANATORIUM-INTAKE",
    "VISIT-SANATORIUM-INTAKE",
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

function uiLang(locale: string | undefined): "en" | "az" | "ru" {
  if (locale?.startsWith("ru")) return "ru";
  if (locale?.startsWith("en")) return "en";
  return "az";
}

function bilingualTitle(
  lang: "en" | "az" | "ru",
  row: { titleEn?: string | null; titleRu?: string | null; titleAz?: string | null; code?: string | null },
): string {
  const en = row.titleEn?.trim() ?? "";
  const local =
    (lang === "ru" ? row.titleRu : lang === "en" ? row.titleEn : row.titleAz)?.trim() ||
    en ||
    row.code?.trim() ||
    "";
  if (local && en && local !== en) return `${local} (${en})`;
  return local;
}

const APPLY_MODE_LABEL: Record<"en" | "az" | "ru", Record<string, string>> = {
  en: { TURN: "in turn", TOGETHER: "together" },
  az: { TURN: "növbəli", TOGETHER: "eyni vaxtda" },
  ru: { TURN: "по очереди", TOGETHER: "одновременно" },
};

export function paramsLinesFromOrder(
  o: {
    note?: string | null;
    bodyPart?: string | null;
    siteApplyMode?: string | null;
    physioFields?: unknown;
    sites?: Array<{
      siteId?: string;
      laterality?: string | null;
      site?: { titleEn?: string | null; titleRu?: string | null; titleAz?: string | null } | null;
    }>;
  },
  opts?: {
    locale?: string;
    /** PhysioListItem id → titles, for deviceProgramId / substanceId. */
    listTitles?: Map<string, { titleEn?: string | null; titleRu?: string | null; titleAz?: string | null }>;
  },
): string[] {
  const lang = uiLang(opts?.locale);
  const parts: string[] = [];
  const siteNames = (o.sites ?? [])
    .map((s) => {
      const title = s.site ? bilingualTitle(lang, s.site) : "";
      const lat = (s as { laterality?: string | null }).laterality;
      if (!title) return null;
      const side = lat ? formatLateralityLabel(lang, lat === "LEFT" || lat === "RIGHT" || lat === "BOTH" ? lat : null) : "";
      return side ? `${title}, ${side}` : title;
    })
    .filter((x): x is string => Boolean(x));
  if (siteNames.length) parts.push(siteNames.join(", "));
  if (o.siteApplyMode) {
    parts.push(APPLY_MODE_LABEL[lang][o.siteApplyMode] ?? String(o.siteApplyMode));
  }
  if (o.bodyPart) parts.push(o.bodyPart);
  if (o.physioFields && typeof o.physioFields === "object" && !Array.isArray(o.physioFields)) {
    const pf = { ...(o.physioFields as Record<string, unknown>) };
    if (pf.dayBlock != null) pf.dayBlock = String(pf.dayBlock);
    const programId = typeof pf.deviceProgramId === "string" ? pf.deviceProgramId : "";
    const substanceId = typeof pf.substanceId === "string" ? pf.substanceId : "";
    const program = programId ? opts?.listTitles?.get(programId) : undefined;
    const substance = substanceId ? opts?.listTitles?.get(substanceId) : undefined;
    parts.push(
      ...formatPhysioFieldsPrint(lang, pf as PhysioOrderFields, {
        program: program ? bilingualTitle(lang, program) : null,
        substance: substance ? bilingualTitle(lang, substance) : null,
      }),
    );
  }
  if (o.note?.trim()) parts.push(o.note.trim());
  return parts;
}

export function paramsLabelFromOrder(
  o: Parameters<typeof paramsLinesFromOrder>[0],
  opts?: Parameters<typeof paramsLinesFromOrder>[1],
): string {
  return paramsLinesFromOrder(o, opts).join(" · ");
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
  /** First order in the group, copied onto a paid overflow line. */
  note?: string;
  physioFields?: Record<string, unknown> | null;
  siteIds?: string[];
  siteApplyMode?: "TURN" | "TOGETHER" | null;
  siteLaterality?: Record<string, "LEFT" | "RIGHT" | "BOTH" | null>;
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
          template: { include: { procedures: { orderBy: [{ sortOrder: "asc" }, { procedureCode: "asc" }] } } },
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

export async function getPackageAssignSnapshot(
  episodeId: string,
  locale = "az",
): Promise<{
  balances: PackageBalanceRow[];
  assigned: PackageAssignedAgg[];
  softWarnDay1: string | null;
  /**
   * Why balances are empty. Anamnesis, a complaint, and a care-team doctor stay the lock.
   * Ultrasound, gynecology, cardiology, and labs are not reasons.
   */
  blockReason:
    | "NO_PROGRAM"
    | "NO_PROGRAM_CODE"
    | "NO_ANAMNESIS"
    | "NO_COMPLAINT"
    | "NO_DIAGNOSIS"
    | "NO_CARE_TEAM"
    | "INSTANTIATE_FAILED"
    | null;
  /** poolCode → eligible real SKUs for the picker */
  poolEligible: Record<string, PoolEligibleSku[]>;
  /** Pinned package identity for support (code + version). */
  packageCode: string | null;
  packageVersion: number | null;
  templateId: string | null;
  /** SKUs whose cabins are all the other sex. */
  sexBlockedCodes: string[];
}> {
  let episode = await loadEpisodeForAssign(episodeId, {
    requireClinicalGates: false,
    requireProgram: false,
  });

  if (!episode.programInstance) {
    const hasCode = Boolean(episode.programCode?.trim());
    if (!hasCode) {
      return {
        balances: [],
        assigned: [],
        softWarnDay1: null,
        blockReason: "NO_PROGRAM_CODE",
        poolEligible: {},
        packageCode: null,
        packageVersion: null,
        templateId: null,
        sexBlockedCodes: [],
      };
    }
    const { tryOpenProgramAfterTherapistStage } = await import(
      "@/domain/sanatorium/open-program-after-therapist.service"
    );
    const opened = await tryOpenProgramAfterTherapistStage(episodeId);
    if (opened.opened || opened.reason === "ALREADY_OPEN") {
      episode = await loadEpisodeForAssign(episodeId, {
        requireClinicalGates: false,
        requireProgram: false,
      });
    }
    if (!episode.programInstance) {
      const reason = opened.opened
        ? "INSTANTIATE_FAILED"
        : opened.reason === "NO_ANAMNESIS" ||
            opened.reason === "NO_COMPLAINT" ||
            opened.reason === "NO_DIAGNOSIS" ||
            opened.reason === "NO_CARE_TEAM" ||
            opened.reason === "INSTANTIATE_FAILED"
          ? opened.reason
          : "NO_PROGRAM";
      return {
        balances: [],
        assigned: [],
        softWarnDay1: null,
        blockReason: reason,
        poolEligible: {},
        packageCode: episode.programCode?.trim() || null,
        packageVersion: null,
        templateId: null,
        sexBlockedCodes: [],
      };
    }
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

  const { foldBathQuotaCards } = await import("@/domain/planning/bath-calendar.service");
  await foldBathQuotaCards(episodeId);

  const orders = await prisma.procedureOrder.findMany({
    where: {
      clinicalEpisodeId: episodeId,
      status: { in: ["PROPOSED", ...IN_CIRCULATION, ...CONSUMED] },
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
    if (o.status === "PROPOSED" || (IN_CIRCULATION as readonly string[]).includes(o.status)) row.circ += 1;
    else row.consumed += 1;
    counts.set(q, row);
  }

  const balanceCodes = instance.procedureLines.map((l) => l.procedureCode);

  const types = await prisma.procedureType.findMany({
    select: { code: true, name: true, needsSite: true },
  });
  const { loadCatalogDisplayNameMap } = await import(
    "@/domain/catalog/catalog-display-name.service"
  );
  const catalogNames = await loadCatalogDisplayNameMap(
    [...types.map((t) => t.code), ...orders.map((o) => o.procedureCode)],
    locale,
  );
  const typeRows = types.map((t) => ({
    ...t,
    name: catalogNames.get(t.code) || t.name,
    active: true as boolean | null,
  }));
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

  const listIds = new Set<string>();
  for (const o of orders) {
    const pf = o.physioFields;
    if (!pf || typeof pf !== "object" || Array.isArray(pf)) continue;
    const rec = pf as Record<string, unknown>;
    if (typeof rec.deviceProgramId === "string") listIds.add(rec.deviceProgramId);
    if (typeof rec.substanceId === "string") listIds.add(rec.substanceId);
  }
  const listTitles = new Map<string, { titleEn: string; titleRu: string; titleAz: string }>();
  if (listIds.size > 0) {
    const items = await prisma.physioListItem.findMany({
      where: { id: { in: [...listIds] } },
      select: { id: true, titleEn: true, titleRu: true, titleAz: true },
    });
    for (const item of items) listTitles.set(item.id, item);
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
      paramsLabelFromOrder(o, { locale, listTitles }),
    ]);
    if (prev) {
      prev.qty += 1;
      prev.paramsLabel = nextLines.join(" · ");
      prev.paramsLines = nextLines;
    } else {
      batchMap.set(key, {
        assignBatchId: o.assignBatchId,
        procedureCode: o.procedureCode,
        procedureName: catalogNames.get(o.procedureCode) || o.procedureName,
        qty: 1,
        statusKind: consumed ? "consumed" : "active",
        locked,
        paramsLabel: nextLines.join(" · "),
        paramsLines: nextLines,
        packageQuotaCode: quotaCodeOf(o),
        note: o.note ?? "",
        physioFields:
          o.physioFields && typeof o.physioFields === "object" && !Array.isArray(o.physioFields)
            ? (o.physioFields as Record<string, unknown>)
            : null,
        siteIds: o.sites.map((s) => s.siteId),
        siteApplyMode:
          o.siteApplyMode === "TURN" || o.siteApplyMode === "TOGETHER" ? o.siteApplyMode : null,
        siteLaterality: Object.fromEntries(
          o.sites.map((s) => [
            s.siteId,
            s.laterality === "LEFT" || s.laterality === "RIGHT" || s.laterality === "BOTH"
              ? s.laterality
              : null,
          ]),
        ),
      });
    }
  }

  const templateOrder = new Map(
    (instance.template?.procedures ?? []).map((row, index) => [row.procedureCode, index]),
  );
  balances.sort(
    (a, b) =>
      (templateOrder.get(a.procedureCode) ?? 10_000) -
      (templateOrder.get(b.procedureCode) ?? 10_000),
  );
  const sexBlocked = await blockedProcedureCodesForGuest(episode.patientRef?.sex);

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
    sexBlockedCodes: [...sexBlocked],
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

/** Drop new rows that did not seat. Already seated siblings in this save stay. */
async function abandonCreatedPackageOrders(ids: string[]) {
  if (ids.length === 0) return;
  await prisma.procedureOrderSite.deleteMany({ where: { procedureOrderId: { in: ids } } });
  await prisma.procedureAllocation.deleteMany({ where: { procedureOrderId: { in: ids } } });
  await prisma.resourceBooking.deleteMany({ where: { procedureOrderId: { in: ids } } });
  await prisma.procedureOrder.deleteMany({ where: { id: { in: ids } } });
}

/**
 * Create PROPOSED orders for delta qty, place onto resources, burn quotaUsed to match circulation.
 */
export async function assignPackageProcedures(
  episodeId: string,
  lines: AssignLineInput[],
  opts?: { confirmedByUserId?: string; softWarnOnly?: boolean; startAt?: Date | null },
): Promise<{
  placed: number;
  softWarn: string | null;
  orderIds: string[];
  misses?: Array<{ ymd: string; procedureCode: string; procedureName: string; reason: string }>;
}> {
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
    if (!(await procedureFitsGuestSex(skuCode, episode.patientRef?.sex))) {
      throw new PackageAssignError(
        "Cabin sex does not match the guest",
        "CABIN_SEX",
        409,
      );
    }
    resolved.push({ ...line, procedureCode: skuCode, quotaCode });
  }

  const settings = await getSchedulingSettings();
  const defaultBathMode = defaultBathModeFromSettings(settings);
  const packageCap = clampDailyPackageProcedureCap(settings.dailyPackageProcedureCap);
  const distinctCodes = new Set(resolved.map((l) => l.procedureCode)).size;
  let softWarn =
    distinctCodes > packageCap
      ? `Daily in-package cap is ${packageCap} distinct codes; batch has ${distinctCodes} (remainder places from next work day)`
      : null;

  const orgId = requestOrganizationId();
  const workStart = parseBakuDateTime(todayBakuYmd(), "08:00");

  const createdIds: string[] = [];
  const nameByCode = new Map<string, string>();
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
    nameByCode.set(line.procedureCode, pt.name);
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
          physioFields: {
            ...(line.physioFields ?? {}),
            dayBlock:
              typeof line.physioFields?.dayBlock === "string" && line.physioFields.dayBlock.trim()
                ? String(line.physioFields.dayBlock).trim().toUpperCase()
                : defaultBathMode,
          },
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

  const { seatBathSeriesOrders } = await import("@/domain/planning/bath-calendar.service");
  const bathSeat = await seatBathSeriesOrders(createdIds);
  const genericIds = createdIds.filter((id) => !bathSeat.handledIds.includes(id));
  const placement = await placeConfirmedProcedures(genericIds, {
    confirmedByUserId: opts?.confirmedByUserId,
    scheduleBefore: instance.endsOn,
    startAt: opts?.startAt,
  });
  const misses = [
    ...bathSeat.missed.map((miss) => ({
      ymd: miss.ymd,
      procedureCode: miss.procedureCode,
      procedureName: nameByCode.get(miss.procedureCode) || miss.procedureName || miss.procedureCode,
      reason: miss.reason,
    })),
    ...placement.failures.map((row) => ({
      ymd: row.ymd ?? "",
      procedureCode: row.procedureCode,
      procedureName: row.procedureName,
      reason: row.reason,
    })),
  ];
  const kept = new Set([...bathSeat.placedIds, ...placement.placedIds]);
  const leftover = createdIds.filter((id) => !kept.has(id));
  if (leftover.length > 0) await abandonCreatedPackageOrders(leftover);
  const placed = kept.size;
  if (placed < 1 && (misses.length > 0 || leftover.length > 0)) {
    const onlyMissingCabin =
      bathSeat.missed.length === 0 &&
      placement.failures.length > 0 &&
      placement.failures.every((row) => row.reason === "no_cabin");
    if (onlyMissingCabin) {
      throw new PackageAssignError(placement.missingCabinNames.join(", "), "NO_CABIN", 409);
    }
    if (misses.length > 0 && misses.every((row) => row.reason === "cabin_sex")) {
      throw new PackageAssignError(
        misses.map((miss) => miss.procedureName || miss.procedureCode).join(", "),
        "CABIN_SEX",
        409,
        misses,
      );
    }
    throw new PackageAssignError(
      misses.map((miss) => miss.procedureName || miss.procedureCode).join(", "),
      "PLACE_FAILED",
      409,
      misses,
    );
  }
  const codes = [...new Set(resolved.map((l) => l.quotaCode))];
  for (const code of codes) {
    await syncQuotaUsed(instance.id, episodeId, code);
  }

  return {
    placed,
    softWarn,
    orderIds: createdIds.filter((id) => kept.has(id)),
    ...(misses.length > 0 ? { misses } : {}),
  };
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

  if (!inPackageTarget) {
    const { remainingPackageQuotaCode } = await import(
      "@/domain/sanatorium/extras-assign.service"
    );
    const openQuota = await remainingPackageQuotaCode(episodeId, input.toCode);
    if (openQuota) {
      inPackageTarget = true;
      if (openQuota !== input.toCode) burnPoolCode = openQuota;
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
  await releaseProcedureOccupancy(active.map((o) => o.id));
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
): Promise<{
  placed: number;
  softWarn: string | null;
  orderIds: string[];
  misses?: Array<{ ymd: string; procedureCode: string; procedureName: string; reason: string }>;
}> {
  const packageCap = clampDailyPackageProcedureCap(
    (await getSchedulingSettings()).dailyPackageProcedureCap,
  );
  const snap = await getPackageAssignSnapshot(episodeId);
  if (snap.blockReason) {
    throw new PackageAssignError(snap.blockReason, snap.blockReason, 409);
  }
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

const ADJUSTABLE = ["PROPOSED", "SCHEDULED"] as const;

/**
 * Modal qty includes PROPOSED + SCHEDULED + CHECKED_IN.
 * Shrink cancels PROPOSED first (unseated leftovers), then SCHEDULED. CHECKED_IN stays.
 */
export function pickAdjustCancellations<
  T extends { id: string; status: string; scheduledAt: Date },
>(
  active: T[],
  input: { targetActiveQty?: number; cancelAllActive?: boolean },
): T[] {
  const checkedInCount = active.filter((o) => o.status === "CHECKED_IN").length;
  const drop = active
    .filter((o) => (ADJUSTABLE as readonly string[]).includes(o.status))
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "PROPOSED" ? -1 : 1;
      return b.scheduledAt.getTime() - a.scheduledAt.getTime();
    });
  if (input.cancelAllActive) return drop;
  if (input.targetActiveQty == null) return [];
  const keepTotal = Math.max(0, input.targetActiveQty);
  const keepAdjustable = Math.max(0, keepTotal - checkedInCount);
  if (drop.length <= keepAdjustable) return [];
  return drop.slice(0, drop.length - keepAdjustable);
}

/**
 * Cancel non-consumed package sessions for a code/batch; return quota. COMPLETED stays.
 */
export async function adjustPackageAssign(
  episodeId: string,
  input: {
    procedureCode: string;
    assignBatchId?: string | null;
    /** Target active (non-completed) qty; excess PROPOSED then SCHEDULED cancelled. */
    targetActiveQty?: number;
    /** If true, cancel all PROPOSED/SCHEDULED for code/batch. */
    cancelAllActive?: boolean;
  },
): Promise<{ cancelled: number }> {
  const episode = await loadEpisodeForAssign(episodeId);
  const instance = episode.programInstance!;

  const where = {
    clinicalEpisodeId: episodeId,
    procedureCode: input.procedureCode,
    status: { in: ["PROPOSED", ...IN_CIRCULATION] },
    inPackage: true,
    ...(input.assignBatchId ? { assignBatchId: input.assignBatchId } : {}),
  };

  const active = await prisma.procedureOrder.findMany({
    where,
    orderBy: { scheduledAt: "desc" },
  });

  const cancellable = pickAdjustCancellations(active, input);
  const checkedInCount = active.filter((o) => o.status === "CHECKED_IN").length;

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
  await releaseProcedureOccupancy(cancellable.map((o) => o.id));

  const syncCodes = [...new Set(cancellable.map((o) => quotaCodeOf(o)))];
  for (const code of syncCodes) {
    await syncQuotaUsed(instance.id, episodeId, code);
  }
  return { cancelled: cancellable.length };
}

/**
 * After a package version lowers a quota, cancel the latest SCHEDULED/PROPOSED
 * sessions until planned + realized fits the new total. CHECKED_IN and COMPLETED stay.
 */
export async function cancelExcessPlannedSessions(instanceId: string): Promise<number> {
  const instance = await prisma.programInstance.findUnique({
    where: { id: instanceId },
    select: { episodeId: true, procedureLines: { select: { procedureCode: true, quotaTotal: true } } },
  });
  if (!instance) return 0;
  let cancelled = 0;
  for (const line of instance.procedureLines) {
    const codeWhere = {
      clinicalEpisodeId: instance.episodeId,
      inPackage: true,
      OR: [
        { packageQuotaCode: line.procedureCode },
        { packageQuotaCode: null, procedureCode: line.procedureCode },
      ],
    };
    const locked = await prisma.procedureOrder.count({
      where: { ...codeWhere, status: { in: ["COMPLETED", "CHECKED_IN"] } },
    });
    const keepPlanned = Math.max(0, line.quotaTotal - locked);
    const planned = await prisma.procedureOrder.findMany({
      where: { ...codeWhere, status: { in: ["SCHEDULED", "PROPOSED"] } },
      orderBy: { scheduledAt: "desc" },
      select: { id: true },
    });
    const drop = planned.slice(0, Math.max(0, planned.length - keepPlanned));
    if (drop.length === 0) continue;
    await prisma.procedureOrder.updateMany({
      where: { id: { in: drop.map((row) => row.id) } },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelReason: "package_quota_shrunk",
      },
    });
    await releaseProcedureOccupancy(drop.map((row) => row.id));
    cancelled += drop.length;
  }
  return cancelled;
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

  const doomed = await prisma.procedureOrder.findMany({
    where: {
      clinicalEpisodeId: instance.episodeId,
      status: "SCHEDULED",
      scheduledAt: { gte: endsOn },
    },
    select: { id: true },
  });
  if (doomed.length === 0) return 0;
  const result = await prisma.procedureOrder.updateMany({
    where: { id: { in: doomed.map((row) => row.id) } },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancelReason: "stay_shortened",
    },
  });
  await releaseProcedureOccupancy(doomed.map((row) => row.id));

  for (const line of instance.procedureLines) {
    await syncQuotaUsed(instanceId, instance.episodeId, line.procedureCode);
  }
  return result.count;
}
