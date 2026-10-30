/**
 * CLI-57 — package lazy-assign from ProgramProcedureBalance (ADR clinic-episode-procedure-assign-modal).
 */
import { randomBytes } from "crypto";
import type { Prisma } from "@prisma/client";
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
import { bakuDateKey, parseBakuDateTime, todayBakuYmd } from "@/lib/baku-day";
import {
  dailyCapForQuota,
  loadEpisodeDailyCaps,
} from "@/domain/sanatorium/block-daily-cap";
import {
  blockedProcedureCodesForGuest,
  procedureFitsGuestSex,
} from "@/domain/procedure/procedure-sex-gate";
import {
  formatLateralityLabel,
  formatPhysioFieldsPrint,
  type PhysioOrderFields,
} from "@/domain/physio/physio-order-fields";
import {
  BATH_TRANSFER_PREFIX,
  bathTransferQuotaCode,
  bathTransferSku,
  foldHay,
  isBathQuotaLine,
  isBathTransferQuota,
  isReplaceableQuotaLine,
  transferQuotaCode,
} from "@/domain/sanatorium/package-assign-quota";

export {
  BATH_TRANSFER_PREFIX,
  bathTransferQuotaCode,
  bathTransferSku,
  isBathQuotaLine,
  isBathTransferQuota,
} from "@/domain/sanatorium/package-assign-quota";

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
 * Procedure assign list. The block checkbox and the course snapshot decide.
 * A transferred bath/paraffin remainder stays on the list. A balance with no snapshot block does not.
 */
export function showsInProcedureMenu(row: {
  isTransfer: boolean;
  inSnapshot: boolean;
  showInProcedures: boolean;
}): boolean {
  if (row.isTransfer) return true;
  return row.inSnapshot && row.showInProcedures;
}

/**
 * SKU picker and burn-pool auto-bind. A leftover *_POOL that is no longer on
 * the procedure list stays in the database and must not steal the save.
 */
export function procedurePickerBalances<T extends { assignable: boolean }>(rows: T[]): T[] {
  return rows.filter((row) => row.assignable);
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
   * Checkbox on the quota block, frozen in the course snapshot.
   * Transfers stay assignable. Balances missing from the snapshot do not.
   */
  assignable: boolean;
  /** What Hamısı / + creates for this block. */
  fulfillment?: "PROCEDURE_ORDER" | "LAB_ORDER" | "VISIT";
  /** Order in the procedure list. */
  procedureOrder?: number;
  /** Quota moved from unused baths or paraffin — not auto-seated. */
  isTransfer?: boolean;
  transfers?: Array<{ createdAt: string; qty: number; reason: string; fromCode: string }>;
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
          quotaTransfers: { orderBy: { createdAt: "asc" } },
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
  /** procedureCode → masseurs skilled for it. Empty means the line is not massage. */
  masseurOptions: Record<string, Array<{ id: string; fullName: string }>>;
  /** Unstarted sessions of this code, when they all name the same person. */
  masseurByCode: Record<string, string | null>;
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
        masseurOptions: {},
        masseurByCode: {},
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
        masseurOptions: {},
        masseurByCode: {},
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
  const snapByCode = new Map(
    (snapMeta?.procedures ?? []).map((row) => [row.procedureCode, row]),
  );
  const tplByCode = new Map(
    (instance.template?.procedures ?? []).map((row) => [row.procedureCode, row]),
  );

  const balances: PackageBalanceRow[] = instance.procedureLines.map((line) => {
    const c = counts.get(line.procedureCode) ?? { circ: 0, consumed: 0 };
    const used = c.circ + c.consumed;
    const configured = membersByBlock.get(line.procedureCode) ?? [];
    const isPool = isEntitlementBucket(line.procedureCode, configured);
    const isQuotaAlias = isPackageQuotaAlias(line.procedureCode);
    const displayCode = isBathTransferQuota(line.procedureCode)
      ? bathTransferSku(line.procedureCode)
      : line.procedureCode;
    const displayName =
      nameByCode.get(displayCode) ??
      catalogNames.get(displayCode) ??
      nameByCode.get(line.procedureCode) ??
      line.procedureCode;
    const snapRow = snapByCode.get(line.procedureCode);
    const tplRow = tplByCode.get(line.procedureCode);
    const inSnapshot = snapMeta ? Boolean(snapRow) : Boolean(tplRow);
    const showFlag = snapRow?.showInProcedures ?? tplRow?.showInProcedures ?? false;
    const procedureOrder =
      snapRow?.procedureOrder ?? tplRow?.procedureOrder ?? tplRow?.sortOrder ?? 0;
    const rawFulfillment = snapRow?.fulfillment ?? tplRow?.fulfillment ?? "PROCEDURE_ORDER";
    const fulfillment =
      rawFulfillment === "LAB_ORDER" || rawFulfillment === "VISIT"
        ? rawFulfillment
        : "PROCEDURE_ORDER";
    const assignable = showsInProcedureMenu({
      isTransfer: isBathTransferQuota(line.procedureCode),
      inSnapshot,
      showInProcedures: showFlag === true,
    });
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
      procedureName: displayName,
      quotaTotal: line.quotaTotal,
      quotaUsed: line.quotaUsed,
      remaining: Math.max(0, line.quotaTotal - used),
      inCirculation: c.circ,
      consumed: c.consumed,
      isPool,
      isQuotaAlias,
      needsSkuPicker,
      assignable,
      fulfillment,
      procedureOrder,
      isTransfer: isBathTransferQuota(line.procedureCode),
      transfers: (instance.quotaTransfers ?? [])
        .filter((row) => row.toQuotaCode === line.procedureCode)
        .map((row) => ({
          createdAt: row.createdAt.toISOString(),
          qty: row.qty,
          reason: row.reason,
          fromCode: row.fromCode,
        })),
    };
  });

  const poolEligible: Record<string, PoolEligibleSku[]> = {};
  for (const b of procedurePickerBalances(balances)) {
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

  const menuBalances = balances
    .filter((row) => row.assignable)
    .sort(
      (a, b) =>
        (a.procedureOrder ?? 0) - (b.procedureOrder ?? 0) ||
        a.procedureName.localeCompare(b.procedureName),
    );
  const sexBlocked = await blockedProcedureCodesForGuest(episode.patientRef?.sex);

  return {
    balances: menuBalances,
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
    masseurOptions: await loadMasseurOptions(),
    masseurByCode: await loadMasseurByCode(episodeId),
  };
}

async function loadMasseurOptions(): Promise<Record<string, Array<{ id: string; fullName: string }>>> {
  const skills = await prisma.practitionerSkill.findMany({
    where: { active: true, practitioner: { active: true, staffKind: "MASSAGE" } },
    select: {
      procedureType: { select: { code: true } },
      practitioner: { select: { id: true, fullName: true } },
    },
    orderBy: { practitioner: { fullName: "asc" } },
  });
  const out: Record<string, Array<{ id: string; fullName: string }>> = {};
  for (const skill of skills) {
    const code = skill.procedureType.code;
    const list = out[code] ?? [];
    if (!list.some((row) => row.id === skill.practitioner.id)) list.push(skill.practitioner);
    out[code] = list;
  }
  return out;
}

async function loadMasseurByCode(episodeId: string): Promise<Record<string, string | null>> {
  const rows = await prisma.procedureOrder.findMany({
    where: {
      clinicalEpisodeId: episodeId,
      status: { in: ["PROPOSED", "SCHEDULED", "PENDING_PAY"] },
    },
    select: { procedureCode: true, preferredPractitionerId: true },
  });
  const grouped = new Map<string, Set<string | null>>();
  for (const row of rows) {
    const set = grouped.get(row.procedureCode) ?? new Set();
    set.add(row.preferredPractitionerId ?? null);
    grouped.set(row.procedureCode, set);
  }
  const out: Record<string, string | null> = {};
  for (const [code, set] of grouped) {
    out[code] = set.size === 1 ? ([...set][0] ?? null) : null;
  }
  return out;
}

export async function resolveMasseurId(
  procedureTypeId: string,
  practitionerId: string | null | undefined,
): Promise<string | null> {
  const id = practitionerId?.trim() || null;
  if (!id) return null;
  const skill = await prisma.practitionerSkill.findFirst({
    where: {
      procedureTypeId,
      practitionerId: id,
      active: true,
      practitioner: { active: true, staffKind: "MASSAGE" },
    },
    select: { id: true },
  });
  if (!skill) {
    throw new PackageAssignError(
      "Masseur is not skilled for this procedure",
      "MASSEUR_NOT_SKILLED",
      400,
    );
  }
  return id;
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
  /** Masseur for this procedure. Null or omitted keeps whoever is already stored. */
  preferredPractitionerId?: string | null;
};

/** Drop new rows that did not seat. Already seated siblings in this save stay. */
async function abandonCreatedPackageOrders(ids: string[]) {
  if (ids.length === 0) return;
  await prisma.procedureOrderSite.deleteMany({ where: { procedureOrderId: { in: ids } } });
  await prisma.procedureAllocation.deleteMany({ where: { procedureOrderId: { in: ids } } });
  await prisma.resourceBooking.deleteMany({ where: { procedureOrderId: { in: ids } } });
  await prisma.procedureOrder.deleteMany({ where: { id: { in: ids } } });
}

/** One modal line → the order ids created for it, in add order. */
export function chunkCreatedIdsByLine(
  createdIds: string[],
  lines: Array<{ qty: number; procedureCode: string }>,
): Array<{ procedureCode: string; ids: string[] }> {
  const out: Array<{ procedureCode: string; ids: string[] }> = [];
  let offset = 0;
  for (const line of lines) {
    const qty = Math.max(0, Math.floor(Number(line.qty) || 0));
    out.push({ procedureCode: line.procedureCode, ids: createdIds.slice(offset, offset + qty) });
    offset += qty;
  }
  return out;
}

export type RedispatchedBlockTail = {
  /** Cap-block key → unfinished order ids (sequence order), OPEN vs FIXED. */
  byKey: Map<string, { openIds: string[]; fixedIds: string[] }>;
};

/**
 * Unseat unfinished same-block SCHEDULED rows from today onward so Saxla can refill
 * daily-cap holes with new modal lines. CHECKED_IN / COMPLETED stay. Baths excluded.
 */
export async function unseatUnfinishedBlockTail(
  episodeId: string,
  quotaCodes: string[],
  opts?: { excludeIds?: Set<string>; bathCodes?: Set<string> },
): Promise<RedispatchedBlockTail> {
  const empty: RedispatchedBlockTail = { byKey: new Map() };
  if (quotaCodes.length === 0) return empty;
  const caps = await loadEpisodeDailyCaps(episodeId);
  const touched = new Set<string>();
  for (const code of quotaCodes) {
    const { quotaKey, dailyCap } = dailyCapForQuota(caps, code, code);
    if (dailyCap == null) continue;
    touched.add(quotaKey);
  }
  if (touched.size === 0) return empty;

  const today = todayBakuYmd();
  const unfinished = await prisma.procedureOrder.findMany({
    where: {
      clinicalEpisodeId: episodeId,
      inPackage: true,
      status: "SCHEDULED",
      ...(opts?.excludeIds?.size
        ? { id: { notIn: [...opts.excludeIds] } }
        : {}),
    },
    orderBy: [{ sequenceIndex: "asc" }, { scheduledAt: "asc" }],
    select: {
      id: true,
      procedureCode: true,
      packageQuotaCode: true,
      schedulingMode: true,
      scheduledAt: true,
    },
  });

  const byKey = new Map<string, { openIds: string[]; fixedIds: string[] }>();
  const toUnseat: string[] = [];
  for (const row of unfinished) {
    if (opts?.bathCodes?.has(row.procedureCode)) continue;
    if (bakuDateKey(row.scheduledAt) < today) continue;
    const { quotaKey, dailyCap } = dailyCapForQuota(
      caps,
      row.packageQuotaCode,
      row.procedureCode,
    );
    if (dailyCap == null || !touched.has(quotaKey)) continue;
    const bucket = byKey.get(quotaKey) ?? { openIds: [], fixedIds: [] };
    if (row.schedulingMode === "OPEN") bucket.openIds.push(row.id);
    else bucket.fixedIds.push(row.id);
    byKey.set(quotaKey, bucket);
    toUnseat.push(row.id);
  }
  if (toUnseat.length === 0) return { byKey };

  await releaseProcedureOccupancy(toUnseat);
  await prisma.procedureOrder.updateMany({
    where: { id: { in: toUnseat } },
    data: { status: "PROPOSED", resourceId: null },
  });
  return { byKey };
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
  misses?: Array<{
    ymd: string;
    procedureCode: string;
    procedureName: string;
    reason: string;
    staffName?: string;
  }>;
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
    } else if (burnQuota && isBathTransferQuota(burnQuota)) {
      if (bathTransferSku(burnQuota) !== line.procedureCode) {
        throw new PackageAssignError(
          `SKU ${line.procedureCode} is not the transfer target for ${burnQuota}`,
          "TRANSFER_SKU_MISMATCH",
          400,
        );
      }
      quotaCode = burnQuota;
      skuCode = line.procedureCode;
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
    if (!bal.assignable) {
      throw new PackageAssignError(
        `Block ${quotaCode} is not on the procedure list`,
        "NOT_IN_PROCEDURES",
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
  const softWarn: string | null = null;

  const orgId = requestOrganizationId();
  const workStart =
    opts?.startAt && !Number.isNaN(opts.startAt.getTime())
      ? opts.startAt
      : parseBakuDateTime(todayBakuYmd(), `${String(settings.dayStartHour).padStart(2, "0")}:00`);

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
    const preferredPractitionerId =
      line.preferredPractitionerId === undefined
        ? null
        : await resolveMasseurId(pt.id, line.preferredPractitionerId);
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
          preferredPractitionerId,
          schedulingMode: pt.openAttendance === true ? "OPEN" : "FIXED",
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

  const { seatBathSeriesOrders, bathSeriesProcedureCodes } = await import(
    "@/domain/planning/bath-calendar.service"
  );
  const bathCodes = await bathSeriesProcedureCodes();
  const episodeCaps = await loadEpisodeDailyCaps(episodeId);
  const redispatched = await unseatUnfinishedBlockTail(
    episodeId,
    resolved.map((line) => line.quotaCode),
    { excludeIds: new Set(createdIds), bathCodes },
  );
  const redispatchedOpenUsed = new Set<string>();
  const redispatchedFixedUsed = new Set<string>();
  const misses: Array<{
    ymd: string;
    procedureCode: string;
    procedureName: string;
    reason: string;
    staffName?: string;
  }> = [];
  const placedIds: string[] = [];
  const missingCabinNames: string[] = [];
  let genericCabinOnly = true;
  let genericTried = false;
  const { pinOpenAttendanceOrders } = await import(
    "@/domain/procedure/open-attendance"
  );
  const chunks = chunkCreatedIdsByLine(createdIds, resolved);
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]!;
    const line = resolved[i]!;
    if (chunk.ids.length === 0) continue;
    const chunkType = typeByCode.get(chunk.procedureCode);
    const { quotaKey } = dailyCapForQuota(
      episodeCaps,
      line.quotaCode,
      line.procedureCode,
    );
    const tail = redispatched.byKey.get(quotaKey);
    if (chunkType?.openAttendance === true) {
      await prisma.procedureOrder.updateMany({
        where: { id: { in: chunk.ids } },
        data: { schedulingMode: "OPEN" },
      });
      const openTail =
        tail && !redispatchedOpenUsed.has(quotaKey)
          ? (redispatchedOpenUsed.add(quotaKey), tail.openIds)
          : [];
      const openSeat = await pinOpenAttendanceOrders([...openTail, ...chunk.ids], {
        confirmedByUserId: opts?.confirmedByUserId,
        scheduleBefore: instance.endsOn ?? undefined,
        startAt: opts?.startAt ?? undefined,
      });
      misses.push(
        ...openSeat.failures.map((row) => ({
          ymd: row.ymd ?? "",
          procedureCode: row.procedureCode,
          procedureName: row.procedureName,
          reason: row.reason,
        })),
      );
      placedIds.push(...openSeat.placedIds);
      continue;
    }
    if (bathCodes.has(chunk.procedureCode)) {
      const bathSeat = await seatBathSeriesOrders(chunk.ids, { startAt: opts?.startAt });
      genericCabinOnly = false;
      misses.push(
        ...bathSeat.missed.map((miss) => ({
          ymd: miss.ymd,
          procedureCode: miss.procedureCode,
          procedureName: nameByCode.get(miss.procedureCode) || miss.procedureName || miss.procedureCode,
          reason: miss.reason,
        })),
      );
      placedIds.push(...bathSeat.placedIds);
      continue;
    }
    genericTried = true;
    const fixedTail =
      tail && !redispatchedFixedUsed.has(quotaKey)
        ? (redispatchedFixedUsed.add(quotaKey), tail.fixedIds)
        : [];
    const placement = await placeConfirmedProcedures([...fixedTail, ...chunk.ids], {
      confirmedByUserId: opts?.confirmedByUserId,
      scheduleBefore: instance.endsOn,
      startAt: opts?.startAt,
    });
    missingCabinNames.push(...placement.missingCabinNames);
    if (placement.failures.some((row) => row.reason !== "no_cabin")) genericCabinOnly = false;
    misses.push(
      ...placement.failures.map((row) => ({
        ymd: row.ymd ?? "",
        procedureCode: row.procedureCode,
        procedureName: row.procedureName,
        reason: row.reason,
        staffName: row.staffName,
      })),
    );
    placedIds.push(...placement.placedIds);
  }
  // Re-seat unfinished tails that never joined a matching OPEN/FIXED chunk this save.
  for (const [quotaKey, tail] of redispatched.byKey) {
    if (!redispatchedOpenUsed.has(quotaKey) && tail.openIds.length > 0) {
      redispatchedOpenUsed.add(quotaKey);
      const openSeat = await pinOpenAttendanceOrders(tail.openIds, {
        confirmedByUserId: opts?.confirmedByUserId,
        scheduleBefore: instance.endsOn ?? undefined,
        startAt: opts?.startAt ?? undefined,
      });
      placedIds.push(...openSeat.placedIds);
      misses.push(
        ...openSeat.failures.map((row) => ({
          ymd: row.ymd ?? "",
          procedureCode: row.procedureCode,
          procedureName: row.procedureName,
          reason: row.reason,
        })),
      );
    }
    if (!redispatchedFixedUsed.has(quotaKey) && tail.fixedIds.length > 0) {
      redispatchedFixedUsed.add(quotaKey);
      genericTried = true;
      const placement = await placeConfirmedProcedures(tail.fixedIds, {
        confirmedByUserId: opts?.confirmedByUserId,
        scheduleBefore: instance.endsOn,
        startAt: opts?.startAt,
      });
      missingCabinNames.push(...placement.missingCabinNames);
      if (placement.failures.some((row) => row.reason !== "no_cabin")) {
        genericCabinOnly = false;
      }
      placedIds.push(...placement.placedIds);
      misses.push(
        ...placement.failures.map((row) => ({
          ymd: row.ymd ?? "",
          procedureCode: row.procedureCode,
          procedureName: row.procedureName,
          reason: row.reason,
        })),
      );
    }
  }
  const kept = new Set(placedIds);
  const leftover = createdIds.filter((id) => !kept.has(id));
  if (leftover.length > 0) await abandonCreatedPackageOrders(leftover);
  const placed = kept.size;
  if (placed < 1 && (misses.length > 0 || leftover.length > 0)) {
    const onlyMissingCabin = genericTried && genericCabinOnly && misses.every((row) => row.reason === "no_cabin");
    if (onlyMissingCabin) {
      throw new PackageAssignError([...new Set(missingCabinNames)].join(", "), "NO_CABIN", 409);
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
  const balanceCodes = instance.procedureLines.map((l) => l.procedureCode);

  if (isPackagePoolCode(input.toCode)) {
    throw new PackageAssignError(
      `Pool code ${input.toCode} is not assignable — pick a real procedure`,
      "POOL_NOT_ASSIGNABLE",
      400,
    );
  }

  let burnPoolCode: string | null = null;
  const snapMeta = parseEntitlementSnapshot(instance.entitlementSnapshot);
  const snapByCode = new Map(
    (snapMeta?.procedures ?? []).map((row) => [row.procedureCode, row]),
  );
  const tplByCode = new Map(
    (instance.template?.procedures ?? []).map((row) => [row.procedureCode, row]),
  );
  const pickerCodes = new Set(
    instance.procedureLines
      .filter((line) => {
        const snapRow = snapByCode.get(line.procedureCode);
        const tplRow = tplByCode.get(line.procedureCode);
        const showFlag = snapRow?.showInProcedures ?? tplRow?.showInProcedures ?? false;
        return showsInProcedureMenu({
          isTransfer: isBathTransferQuota(line.procedureCode),
          inSnapshot: snapMeta ? Boolean(snapRow) : Boolean(tplRow),
          showInProcedures: showFlag === true,
        });
      })
      .map((line) => line.procedureCode),
  );
  let inPackageTarget = pickerCodes.has(input.toCode);
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
      if (!pickerCodes.has(pool)) continue;
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
    if (openQuota && pickerCodes.has(openQuota)) {
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
  const prescribed = await prescribeExtras(
    episodeId,
    [{ procedureCode: input.toCode, qty: input.qty, note: input.note }],
    opts?.confirmedByUserId,
  );
  return {
    cancelled: active.length,
    mode: "extra_pending_pay",
    orderIds: prescribed.orderIds,
  };
}

/**
 * Move unused bath quota onto another treatment SKU as in-package remaining.
 * Does not seat the new SKU. COMPLETED / CHECKED_IN baths stay.
 */
export async function transferBathQuota(
  episodeId: string,
  input: {
    fromCode: string;
    toCode: string;
    qty: number;
    reason: string;
  },
): Promise<{ transferred: number; quotaCode: string; contraindicationId: string }> {
  const qty = input.qty;
  const reason = input.reason.trim();
  if (qty < 1) {
    throw new PackageAssignError("qty must be >= 1", "INVALID", 400);
  }
  if (reason.length < 2) {
    throw new PackageAssignError("Contraindication reason is required", "REASON_REQUIRED", 400);
  }
  if (isPackagePoolCode(input.toCode) || isBathTransferQuota(input.toCode)) {
    throw new PackageAssignError(
      `Pool code ${input.toCode} is not a replacement SKU`,
      "POOL_NOT_ASSIGNABLE",
      400,
    );
  }

  const episode = await loadEpisodeForAssign(episodeId);
  const instance = episode.programInstance!;
  const fromLine = instance.procedureLines.find((l) => l.procedureCode === input.fromCode);
  if (!fromLine) {
    throw new PackageAssignError(`No package line ${input.fromCode}`, "NOT_IN_PACKAGE", 400);
  }
  const { loadCatalogDisplayNameMap } = await import(
    "@/domain/catalog/catalog-display-name.service"
  );
  const names = await loadCatalogDisplayNameMap([input.fromCode, input.toCode], "az");
  const fromName = names.get(input.fromCode) ?? input.fromCode;
  const toName = names.get(input.toCode) ?? input.toCode;
  if (!isReplaceableQuotaLine(input.fromCode, fromName)) {
    throw new PackageAssignError(
      "Only unused bath or paraffin quota can be transferred",
      "NOT_REPLACEABLE",
      400,
    );
  }
  if (isReplaceableQuotaLine(input.toCode, toName)) {
    throw new PackageAssignError(
      "Replacement must be a physio procedure",
      "TARGET_NOT_PHYSIO",
      400,
    );
  }

  const live = await prisma.procedureOrder.findMany({
    where: {
      clinicalEpisodeId: episodeId,
      inPackage: true,
      OR: [
        { procedureCode: input.fromCode },
        { packageQuotaCode: input.fromCode },
      ],
      status: { in: ["PROPOSED", "SCHEDULED", "CHECKED_IN", "COMPLETED", "NO_SHOW"] },
    },
    orderBy: { scheduledAt: "desc" },
    select: { id: true, status: true, scheduledAt: true, procedureCode: true, packageQuotaCode: true },
  });
  const consumed = live.filter((o) => o.status === "COMPLETED" || o.status === "NO_SHOW").length;
  const checkedIn = live.filter((o) => o.status === "CHECKED_IN").length;
  const transferable = fromLine.quotaTotal - consumed - checkedIn;
  if (qty > transferable) {
    throw new PackageAssignError(
      `Only ${Math.max(0, transferable)} unused bath sessions can be transferred`,
      "INSUFFICIENT_UNUSED",
      400,
    );
  }

  const remaining = Math.max(0, fromLine.quotaTotal - live.length);
  const cancelNeed = Math.max(0, qty - remaining);
  const drop = live
    .filter((o) => o.status === "PROPOSED" || o.status === "SCHEDULED")
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "PROPOSED" ? -1 : 1;
      return b.scheduledAt.getTime() - a.scheduledAt.getTime();
    });
  const cancel = drop.slice(0, cancelNeed);
  const quotaCode = transferQuotaCode(input.fromCode, input.toCode);

  const contra = await prisma.$transaction(async (tx) => {
    if (cancel.length > 0) {
      await tx.procedureOrder.updateMany({
        where: { id: { in: cancel.map((o) => o.id) } },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancelReason: "bath_quota_transfer",
        },
      });
    }
    await tx.programProcedureBalance.update({
      where: { id: fromLine.id },
      data: { quotaTotal: fromLine.quotaTotal - qty },
    });
    const existing = await tx.programProcedureBalance.findUnique({
      where: {
        instanceId_procedureCode: { instanceId: instance.id, procedureCode: quotaCode },
      },
    });
    if (existing) {
      await tx.programProcedureBalance.update({
        where: { id: existing.id },
        data: { quotaTotal: existing.quotaTotal + qty },
      });
    } else {
      await tx.programProcedureBalance.create({
        data: {
          instanceId: instance.id,
          procedureCode: quotaCode,
          quotaTotal: qty,
          quotaUsed: 0,
          organizationId: instance.organizationId,
        },
      });
    }
    await tx.programQuotaTransfer.create({
      data: {
        organizationId: instance.organizationId,
        instanceId: instance.id,
        episodeId,
        fromCode: input.fromCode,
        toQuotaCode: quotaCode,
        qty,
        reason,
      },
    });
    return tx.patientContraindication.create({
      data: {
        patientRefId: episode.patientRefId,
        episodeId,
        bodyPart: "FULL_BODY",
        note: reason,
        organizationId: episode.organizationId,
      },
    });
  });

  if (cancel.length > 0) {
    await releaseProcedureOccupancy(cancel.map((o) => o.id));
  }
  await syncQuotaUsed(instance.id, episodeId, input.fromCode);
  await syncQuotaUsed(instance.id, episodeId, quotaCode);
  return { transferred: qty, quotaCode, contraindicationId: contra.id };
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

  const where: Prisma.ProcedureOrderWhereInput = {
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
  const scheduled = active.filter((o) => o.status === "SCHEDULED");

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

/**
 * Seat package rows that stayed PROPOSED because the stay days were full.
 * Only the checkout calendar day, and only until 12:00.
 */
export async function placeProposedOnCheckoutMorning(
  episodeId: string,
  confirmedByUserId?: string,
): Promise<{
  placed: number;
  misses: Array<{ ymd: string; procedureCode: string; procedureName: string; reason: string }>;
}> {
  const episode = await prisma.clinicalEpisode.findUnique({
    where: { id: episodeId },
    select: { programInstance: { select: { endsOn: true } } },
  });
  const endsOn = episode?.programInstance?.endsOn ?? null;
  if (!endsOn) return { placed: 0, misses: [] };
  const orders = await prisma.procedureOrder.findMany({
    where: { clinicalEpisodeId: episodeId, status: "PROPOSED", inPackage: true },
    select: { id: true, procedureType: { select: { openAttendance: true } } },
  });
  const cabinIds = orders.filter((row) => row.procedureType?.openAttendance !== true).map((row) => row.id);
  if (cabinIds.length === 0) return { placed: 0, misses: [] };
  const { placeConfirmedProcedures } = await import("@/lib/treatment-planner.service");
  const placement = await placeConfirmedProcedures(cabinIds, { confirmedByUserId, scheduleBefore: endsOn, checkoutMorning: true },
  );
  return {
    placed: placement.placed,
    misses: placement.failures.map((row) => ({
      ymd: row.ymd ?? "",
      procedureCode: row.procedureCode,
      procedureName: row.procedureName,
      reason: row.reason,
    })),
  };
}

/**
 * Menu Save. Procedure blocks keep the cabin planner. Lab and visit blocks
 * create the document their fulfillment already names.
 */
const LIVE_MASSEUR_STATUS = ["PROPOSED", "SCHEDULED", "PENDING_PAY"] as const;

/** Point every not-yet-started session of these procedures at the masseur, then seat them again. */
export async function applyPreferredMasseurs(
  episodeId: string,
  prefs: Array<{ procedureCode: string; practitionerId: string | null }>,
  opts?: { confirmedByUserId?: string; startAt?: Date | null },
): Promise<{
  misses: Array<{
    ymd: string;
    procedureCode: string;
    procedureName: string;
    reason: string;
    staffName?: string;
  }>;
}> {
  await loadEpisodeForAssign(episodeId);
  const misses: Array<{
    ymd: string;
    procedureCode: string;
    procedureName: string;
    reason: string;
    staffName?: string;
  }> = [];
  const episode = await prisma.clinicalEpisode.findUnique({
    where: { id: episodeId },
    select: { programInstance: { select: { endsOn: true } } },
  });
  const endsOn = episode?.programInstance?.endsOn ?? undefined;
  for (const pref of prefs) {
    const code = pref.procedureCode.trim();
    if (!code) continue;
    const pt = await prisma.procedureType.findFirst({ where: { code } });
    if (!pt) {
      throw new PackageAssignError(`Unknown procedure type ${code}`, "UNKNOWN_TYPE", 400);
    }
    const wanted = await resolveMasseurId(pt.id, pref.practitionerId);
    await prisma.procedureOrder.updateMany({
      where: {
        clinicalEpisodeId: episodeId,
        procedureCode: code,
        status: { in: [...LIVE_MASSEUR_STATUS] },
        schedulingMode: "OPEN",
        ...(wanted
          ? { OR: [{ preferredPractitionerId: null }, { preferredPractitionerId: { not: wanted } }] }
          : { preferredPractitionerId: { not: null } }),
      },
      data: { preferredPractitionerId: wanted },
    });
    const orders = await prisma.procedureOrder.findMany({
      where: {
        clinicalEpisodeId: episodeId,
        procedureCode: code,
        status: { in: [...LIVE_MASSEUR_STATUS] },
        schedulingMode: { not: "OPEN" },
      },
      select: { id: true, preferredPractitionerId: true, inPackage: true, status: true },
    });
    const changed = orders.filter((row) => (row.preferredPractitionerId ?? null) !== wanted);
    if (changed.length === 0) continue;
    const ids = changed.map((row) => row.id);
    await prisma.procedureAllocation.deleteMany({ where: { procedureOrderId: { in: ids } } });
    await prisma.resourceBooking.deleteMany({ where: { procedureOrderId: { in: ids } } });
    await prisma.procedureOrder.updateMany({
      where: { id: { in: ids } },
      data: { preferredPractitionerId: wanted, resourceId: null, status: "PROPOSED" },
    });
    const { placeConfirmedProcedures } = await import("@/lib/treatment-planner.service");
    const placement = await placeConfirmedProcedures(ids, {
      confirmedByUserId: opts?.confirmedByUserId,
      scheduleBefore: endsOn,
      startAt: opts?.startAt,
    });
    misses.push(
      ...placement.failures.map((row) => ({
        ymd: row.ymd ?? "",
        procedureCode: row.procedureCode,
        procedureName: row.procedureName,
        reason: row.reason,
        staffName: row.staffName,
      })),
    );
    const extraIds = changed.filter((row) => row.status === "PENDING_PAY" && !row.inPackage).map((row) => row.id);
    if (extraIds.length > 0) {
      await prisma.procedureOrder.updateMany({
        where: { id: { in: extraIds }, status: { in: ["PROPOSED", "SCHEDULED"] } },
        data: { status: "PENDING_PAY" },
      });
    }
  }
  return { misses };
}

export async function assignPackageMenuLines(
  episodeId: string,
  lines: AssignLineInput[],
  opts?: { confirmedByUserId?: string; softWarnOnly?: boolean; startAt?: Date | null },
): Promise<{
  placed: number;
  softWarn: string | null;
  orderIds: string[];
  misses?: Array<{
    ymd: string;
    procedureCode: string;
    procedureName: string;
    reason: string;
    staffName?: string;
  }>;
}> {
  const snap = await getPackageAssignSnapshot(episodeId);
  const byCode = new Map(snap.balances.map((row) => [row.procedureCode, row]));
  const procedures: AssignLineInput[] = [];
  const studies: Array<AssignLineInput & { fulfillment: "LAB_ORDER" | "VISIT" }> = [];
  for (const line of lines) {
    if (line.qty < 1) continue;
    const quota = line.burnPoolCode?.trim() || line.procedureCode;
    const block = byCode.get(quota);
    if (!block?.assignable) {
      throw new PackageAssignError(
        `Block ${quota} is not on the procedure list`,
        "NOT_IN_PROCEDURES",
        400,
      );
    }
    if (block.fulfillment === "LAB_ORDER" || block.fulfillment === "VISIT") {
      studies.push({ ...line, fulfillment: block.fulfillment });
    } else {
      procedures.push(line);
    }
  }

  let placed = 0;
  let softWarn: string | null = null;
  const orderIds: string[] = [];
  const misses: Array<{
    ymd: string;
    procedureCode: string;
    procedureName: string;
    reason: string;
    staffName?: string;
  }> =
    [];
  if (procedures.length > 0) {
    const result = await assignPackageProcedures(episodeId, procedures, opts);
    placed += result.placed;
    softWarn = result.softWarn;
    orderIds.push(...result.orderIds);
    if (result.misses) misses.push(...result.misses);
  }
  if (studies.length > 0) {
    placed += await assignPackageStudies(episodeId, studies);
  }
  return { placed, softWarn, orderIds, misses };
}

async function assignPackageStudies(
  episodeId: string,
  lines: Array<AssignLineInput & { fulfillment: "LAB_ORDER" | "VISIT" }>,
): Promise<number> {
  const episode = await loadEpisodeForAssign(episodeId);
  const instance = episode.programInstance!;
  const patientRefId = episode.patientRefId;
  if (!patientRefId) {
    throw new PackageAssignError("Episode has no patient", "NOT_FOUND", 404);
  }
  const blockMemberRows = await prisma.programTemplateBlockMember.findMany({
    where: { templateId: instance.templateId },
    select: { blockCode: true, procedureCode: true },
  });
  const membersByBlock = resolveMembersByBlock({
    entitlementSnapshot: instance.entitlementSnapshot,
    templateMembers: blockMemberRows,
  });
  const doctor = await prisma.episodeCareDoctor.findFirst({
    where: { episodeId },
    orderBy: { assignedAt: "asc" },
    select: { practitionerId: true },
  });
  const { createLabOrderWithItems } = await import("@/domain/lab/lab-order-write.service");
  const { LAB_ALREADY_OPEN } = await import("@/domain/lab/lab-order-conflict.service");
  const { applyPriceMissingFallback, resolveEntitlementCharge } = await import(
    "@/domain/sanatorium/entitlement-charge.service"
  );
  const { syncEntitlementUsage } = await import("@/domain/sanatorium/entitlement-usage.service");
  const origin = episode.patientOrigin === "WALK_IN" ? "WALK_IN" : "IN_HOUSE";
  const touched = new Set<string>();
  let placed = 0;

  for (const line of lines) {
    const quota = line.burnPoolCode?.trim() || line.procedureCode;
    const members = membersByBlock.get(quota) ?? [];
    const picked = line.procedureCode !== quota ? line.procedureCode : "";
    const serviceCode =
      (picked && (members.length === 0 || members.includes(picked)) ? picked : "") ||
      (members.length === 1 ? members[0] : "") ||
      (members.includes(line.procedureCode) ? line.procedureCode : "") ||
      (members.length === 0 && !quota.startsWith("BLK-") ? quota : "");
    if (!serviceCode || serviceCode.startsWith("BLK-")) {
      throw new PackageAssignError(
        `Block ${quota} has no catalog service to book`,
        "NO_SERVICE",
        400,
      );
    }
    if (line.fulfillment === "LAB_ORDER" && line.qty > 1) {
      throw new PackageAssignError(
        "A lab block books one open order at a time",
        "LAB_ONE",
        400,
      );
    }
    if (line.fulfillment === "VISIT" && !doctor?.practitionerId) {
      throw new PackageAssignError(
        "A care-team doctor is required to book a visit",
        "NO_CARE_TEAM",
        409,
      );
    }
    for (let n = 0; n < line.qty; n += 1) {
      if (line.fulfillment === "LAB_ORDER") {
        try {
          await createLabOrderWithItems({
            patientRefId,
            clinicalEpisodeId: episodeId,
            codes: [serviceCode],
            source: "IN_HOUSE",
            fasting: false,
            confirmRepeat: true,
            patientOrigin: origin,
          });
        } catch (err) {
          const code = (err as { code?: string }).code;
          if (code === LAB_ALREADY_OPEN) {
            throw new PackageAssignError(
              "An open lab order already exists for this study",
              "LAB_ALREADY_OPEN",
              409,
            );
          }
          throw err;
        }
      } else {
        const charge = applyPriceMissingFallback(
          await resolveEntitlementCharge({
            episodeId,
            patientOrigin: origin,
            quotaCode: quota,
            serviceCode,
            inPackage: true,
          }),
          { serviceCode, where: "package-assign-visit" },
        );
        const visit = await prisma.visit.create({
          data: {
            organizationId: episode.organizationId,
            patientRefId,
            practitionerId: doctor!.practitionerId,
            clinicalEpisodeId: episodeId,
            status: "IN_PROGRESS",
            patientOrigin: origin,
            reservationId: episode.reservationId,
            roomNumber: episode.roomNumber,
            amountNet: charge.amountNet,
          },
        });
        await prisma.visitServiceLine.create({
          data: {
            visitId: visit.id,
            serviceCode,
            description: line.procedureCode,
            amount: charge.amountNet,
            inPackage: true,
            packageQuotaCode: quota,
          },
        });
      }
      placed += 1;
    }
    touched.add(quota);
  }

  for (const quotaCode of touched) {
    await syncEntitlementUsage({
      instanceId: instance.id,
      episodeId,
      quotaCode,
    });
  }
  return placed;
}
