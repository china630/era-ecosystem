import { PhysioCatalogError } from "./physio-catalog";

/** Type-gated order fields (canon §4). SEQUENCE_* is W2 siteApplyMode. Bleed/cut are not doctor fields. */
export const PHYSIO_ORDER_FIELD_CODES = [
  "LATERALITY",
  "AMPLIPULS_WORK_KIND",
  "DEVICE_PROGRAM",
  "ELECTRODE_COUNT",
  "DEVICE_PARAMS",
  "NO_ADDITIVE",
  "APPLICATION_SURFACE",
  "SUBSTANCE_OR_ADDITIVE",
  "EXTRA_OIL",
  "HOLD_OR_STOP",
  "SPINE_LEVEL",
  "DAY_BLOCK",
  "BATH_SEQUENCE",
  "INTENSITY",
  "SMEAR",
] as const;

export type PhysioOrderFieldCode = (typeof PHYSIO_ORDER_FIELD_CODES)[number];

const FIELD_SET = new Set<string>(PHYSIO_ORDER_FIELD_CODES);

export const PHYSIO_LATERALITY_CODES = ["LEFT", "RIGHT", "BOTH"] as const;
export type PhysioLateralityCode = (typeof PHYSIO_LATERALITY_CODES)[number];

export const AMPLIPULS_WORK_KINDS = ["I", "II", "III", "IV", "V"] as const;
export const ELECTRODE_COUNTS = ["2", "4"] as const;
export const DEVICE_PARAM_CODES = [
  "FREQ_1_MHZ",
  "FREQ_1_5_MHZ",
  "FREQ_3_MHZ",
  "PULSED",
  "CONTINUOUS",
  "LOW_FREQ",
  "WATER_BEFORE",
] as const;
export const APPLICATION_SURFACE_CODES = ["FRONT_BACK", "UPPER", "LOWER"] as const;
export const DAY_BLOCK_CODES = ["3", "5", "ALTERNATING", "5_THEN"] as const;
export const BATH_SEQUENCE_CODES = ["SITZ_THEN_FULL"] as const;
export const INTENSITY_CODES = ["LIGHT", "WEAK", "NOT_HOT", "MEDIUM", "MORE"] as const;
export const SPINE_LEVEL_CODES = [
  "C3-C4",
  "C3-C5",
  "C4-C5",
  "C5-C6",
  "C6-C7",
  "C3-C7",
  "L1-L2",
  "L2-L3",
  "L3-L4",
  "L4-L5",
  "L5-S1",
  "L1-L5",
] as const;

const JSON_KEY_TO_FIELD: Record<string, PhysioOrderFieldCode> = {
  amplipulsWorkKind: "AMPLIPULS_WORK_KIND",
  deviceProgramId: "DEVICE_PROGRAM",
  electrodeCount: "ELECTRODE_COUNT",
  deviceParam: "DEVICE_PARAMS",
  noAdditive: "NO_ADDITIVE",
  applicationSurface: "APPLICATION_SURFACE",
  substanceId: "SUBSTANCE_OR_ADDITIVE",
  extraOil: "EXTRA_OIL",
  holdOrStop: "HOLD_OR_STOP",
  spineLevel: "SPINE_LEVEL",
  dayBlock: "DAY_BLOCK",
  bathSequence: "BATH_SEQUENCE",
  intensity: "INTENSITY",
  smear: "SMEAR",
};

export type PhysioOrderFields = {
  amplipulsWorkKind?: (typeof AMPLIPULS_WORK_KINDS)[number] | null;
  deviceProgramId?: string | null;
  electrodeCount?: (typeof ELECTRODE_COUNTS)[number] | null;
  deviceParam?: (typeof DEVICE_PARAM_CODES)[number] | null;
  noAdditive?: boolean | null;
  applicationSurface?: (typeof APPLICATION_SURFACE_CODES)[number] | null;
  substanceId?: string | null;
  extraOil?: boolean | null;
  holdOrStop?: boolean | null;
  spineLevel?: (typeof SPINE_LEVEL_CODES)[number] | null;
  dayBlock?: (typeof DAY_BLOCK_CODES)[number] | null;
  bathSequence?: (typeof BATH_SEQUENCE_CODES)[number] | null;
  intensity?: (typeof INTENSITY_CODES)[number] | null;
  smear?: boolean | null;
};

function inSet<T extends string>(allowed: readonly T[], raw: string): T {
  if ((allowed as readonly string[]).includes(raw)) return raw as T;
  throw new PhysioCatalogError(`Invalid value: ${raw}`);
}

function asOptionalString(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  if (typeof raw !== "string") throw new PhysioCatalogError("Expected string field");
  return raw.trim() || null;
}

function asOptionalBool(raw: unknown): boolean | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "boolean") return raw;
  if (raw === "true" || raw === "YES") return true;
  if (raw === "false" || raw === "NO") return false;
  throw new PhysioCatalogError("Expected boolean field");
}

export function isPhysioOrderFieldCode(raw: string): raw is PhysioOrderFieldCode {
  return FIELD_SET.has(raw);
}

export function parsePhysioOrderFields(raw: string[]): PhysioOrderFieldCode[] {
  const out: PhysioOrderFieldCode[] = [];
  for (const item of raw) {
    const code = item.trim().toUpperCase();
    if (!code) continue;
    if (!isPhysioOrderFieldCode(code)) {
      throw new PhysioCatalogError(`Unknown physio order field: ${code}`);
    }
    if (!out.includes(code)) out.push(code);
  }
  return out;
}

export function parseLaterality(raw: string | null | undefined): PhysioLateralityCode | null {
  if (raw == null || raw === "") return null;
  const code = raw.trim().toUpperCase();
  if (code === "LEFT" || code === "RIGHT" || code === "BOTH") return code;
  throw new PhysioCatalogError("laterality must be LEFT, RIGHT, or BOTH");
}

function parseIncomingValue(key: string, raw: unknown): unknown {
  switch (key) {
    case "amplipulsWorkKind": {
      const s = asOptionalString(raw);
      return s ? inSet(AMPLIPULS_WORK_KINDS, s) : null;
    }
    case "deviceProgramId":
    case "substanceId":
      return asOptionalString(raw);
    case "electrodeCount": {
      const s = asOptionalString(raw);
      return s ? inSet(ELECTRODE_COUNTS, s) : null;
    }
    case "deviceParam": {
      const s = asOptionalString(raw);
      return s ? inSet(DEVICE_PARAM_CODES, s) : null;
    }
    case "applicationSurface": {
      const s = asOptionalString(raw);
      return s ? inSet(APPLICATION_SURFACE_CODES, s) : null;
    }
    case "spineLevel": {
      const s = asOptionalString(raw);
      return s ? inSet(SPINE_LEVEL_CODES, s) : null;
    }
    case "dayBlock": {
      const s = asOptionalString(raw);
      return s ? inSet(DAY_BLOCK_CODES, s) : null;
    }
    case "bathSequence": {
      const s = asOptionalString(raw);
      return s ? inSet(BATH_SEQUENCE_CODES, s) : null;
    }
    case "intensity": {
      const s = asOptionalString(raw);
      return s ? inSet(INTENSITY_CODES, s) : null;
    }
    case "noAdditive":
    case "extraOil":
    case "holdOrStop":
    case "smear":
      return asOptionalBool(raw);
    default:
      throw new PhysioCatalogError(`Unknown physio field: ${key}`);
  }
}

function pruneToAllowed(fields: PhysioOrderFields, allowed: readonly string[]): PhysioOrderFields {
  const allow = new Set(allowed);
  const out: PhysioOrderFields = {};
  for (const [key, field] of Object.entries(JSON_KEY_TO_FIELD) as Array<
    [keyof PhysioOrderFields, PhysioOrderFieldCode]
  >) {
    if (!allow.has(field)) continue;
    const value = fields[key];
    if (value !== undefined) (out as Record<string, unknown>)[key] = value;
  }
  return out;
}

function asFields(raw: unknown): PhysioOrderFields {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const obj = raw as Record<string, unknown>;
  const out: PhysioOrderFields = {};
  for (const key of Object.keys(JSON_KEY_TO_FIELD)) {
    if (!(key in obj)) continue;
    try {
      (out as Record<string, unknown>)[key] = parseIncomingValue(key, obj[key]);
    } catch {
      /* stored junk: skip */
    }
  }
  return out;
}

/** Read path: strip unknown keys, do not throw. */
export function readPhysioFields(raw: unknown): PhysioOrderFields {
  return asFields(raw);
}

/**
 * Write path: merge incoming onto existing, reject keys the type does not allow.
 * Negative path for W3 Scaffold — extra field → 400, not silent strip.
 */
export function sanitizePhysioFields(
  allowed: readonly string[],
  incoming: unknown,
  existing: PhysioOrderFields | null,
): PhysioOrderFields {
  if (incoming === undefined) {
    return pruneToAllowed(existing ?? {}, allowed);
  }
  if (incoming === null) {
    return {};
  }
  if (typeof incoming !== "object" || Array.isArray(incoming)) {
    throw new PhysioCatalogError("physioFields must be an object");
  }
  const raw = incoming as Record<string, unknown>;
  for (const key of Object.keys(raw)) {
    const field = JSON_KEY_TO_FIELD[key];
    if (!field) throw new PhysioCatalogError(`Unknown physio field: ${key}`);
    if (!allowed.includes(field)) {
      throw new PhysioCatalogError(`Field ${field} is not allowed for this procedure type`);
    }
  }
  const parsed: PhysioOrderFields = {};
  for (const key of Object.keys(raw)) {
    (parsed as Record<string, unknown>)[key] = parseIncomingValue(key, raw[key]);
  }
  return pruneToAllowed({ ...(existing ?? {}), ...parsed }, allowed);
}

export function parseSiteLateralityMap(
  raw: unknown,
): Record<string, PhysioLateralityCode | null> {
  if (raw === undefined) return {};
  if (raw === null) return {};
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new PhysioCatalogError("siteLaterality must be an object");
  }
  const out: Record<string, PhysioLateralityCode | null> = {};
  for (const [siteId, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!siteId.trim()) continue;
    if (value == null || value === "") {
      out[siteId] = null;
      continue;
    }
    if (typeof value !== "string") throw new PhysioCatalogError("laterality must be a string");
    out[siteId] = parseLaterality(value);
  }
  return out;
}

export function assertLateralityAllowed(
  allowedFields: readonly string[],
  sites: Array<{ id: string; laterality: boolean }>,
  requested: Record<string, PhysioLateralityCode | null>,
): void {
  const hasAny = Object.values(requested).some((v) => v != null);
  if (hasAny && !allowedFields.includes("LATERALITY")) {
    throw new PhysioCatalogError("Field LATERALITY is not allowed for this procedure type");
  }
  const byId = new Map(sites.map((s) => [s.id, s]));
  for (const [siteId, value] of Object.entries(requested)) {
    if (value == null) continue;
    const site = byId.get(siteId);
    if (!site) throw new PhysioCatalogError("Unknown physio site");
    if (!site.laterality) {
      throw new PhysioCatalogError(`Laterality is not allowed on site ${siteId}`);
    }
  }
}

export function lateralityBySiteId(
  sites: Array<{ siteId: string; laterality: PhysioLateralityCode | null }>,
): Record<string, PhysioLateralityCode | null> {
  const out: Record<string, PhysioLateralityCode | null> = {};
  for (const row of sites) out[row.siteId] = row.laterality;
  return out;
}

const PRINT_FIELD_LABEL: Record<string, Record<"en" | "az" | "ru", string>> = {
  I: { en: "I", az: "I", ru: "I" },
  II: { en: "II", az: "II", ru: "II" },
  III: { en: "III", az: "III", ru: "III" },
  IV: { en: "IV", az: "IV", ru: "IV" },
  V: { en: "V", az: "V", ru: "V" },
  "2": { en: "2 pads", az: "2 lövhə", ru: "2 электрода" },
  "4": { en: "4 pads", az: "4 lövhə", ru: "4 электрода" },
  FRONT_BACK: { en: "front/back", az: "ön/arxa", ru: "перёд/зад" },
  UPPER: { en: "upper", az: "yuxarı", ru: "верх" },
  LOWER: { en: "lower", az: "aşağı", ru: "низ" },
  LIGHT: { en: "light", az: "yüngül", ru: "лёгкий" },
  WEAK: { en: "weak", az: "zəif", ru: "слабый" },
  NOT_HOT: { en: "not hot", az: "isti olmasın", ru: "не горячо" },
  MEDIUM: { en: "medium", az: "orta", ru: "средний" },
  MORE: { en: "more", az: "daha", ru: "сильнее" },
  "3": { en: "3 days", az: "3 gün", ru: "3 дня" },
  "5": { en: "5 days", az: "5 gün", ru: "5 дней" },
  ALTERNATING: { en: "every other day", az: "günaşırı", ru: "через день" },
  "5_THEN": { en: "5 days then", az: "5 gün ardından", ru: "5 дней затем" },
  SITZ_THEN_FULL: { en: "sitz then full", az: "oturaq sonra tam", ru: "сидячая, затем полная" },
  FREQ_1_MHZ: { en: "1 MHz", az: "1 MHz", ru: "1 МГц" },
  FREQ_1_5_MHZ: { en: "1.5 MHz", az: "1.5 MHz", ru: "1.5 МГц" },
  FREQ_3_MHZ: { en: "3 MHz", az: "3 MHz", ru: "3 МГц" },
  PULSED: { en: "pulsed", az: "kəsikli", ru: "импульс" },
  CONTINUOUS: { en: "continuous", az: "fasiləsiz", ru: "непрерывный" },
  LOW_FREQ: { en: "low freq", az: "aşağı tezlik", ru: "низкая частота" },
  WATER_BEFORE: { en: "water before", az: "öncə su", ru: "вода до" },
};

function loc(lang: "en" | "az" | "ru", code: string): string {
  return PRINT_FIELD_LABEL[code]?.[lang] ?? code;
}

export function formatLateralityLabel(
  lang: "en" | "az" | "ru",
  laterality: PhysioLateralityCode | null,
): string {
  if (!laterality) return "";
  if (laterality === "LEFT") return lang === "ru" ? "слева" : lang === "az" ? "sol" : "left";
  if (laterality === "RIGHT") return lang === "ru" ? "справа" : lang === "az" ? "sağ" : "right";
  return lang === "ru" ? "обе" : lang === "az" ? "hər iki" : "both";
}

export function formatPhysioFieldsPrint(
  lang: "en" | "az" | "ru",
  fields: PhysioOrderFields,
  labels?: { program?: string | null; substance?: string | null },
): string[] {
  const bits: string[] = [];
  if (fields.amplipulsWorkKind) bits.push(loc(lang, fields.amplipulsWorkKind));
  if (labels?.program) bits.push(labels.program);
  if (fields.electrodeCount) bits.push(loc(lang, fields.electrodeCount));
  if (fields.deviceParam) bits.push(loc(lang, fields.deviceParam));
  if (fields.noAdditive) bits.push(lang === "ru" ? "без добавки" : lang === "az" ? "sadə" : "no additive");
  if (fields.applicationSurface) bits.push(loc(lang, fields.applicationSurface));
  if (labels?.substance) bits.push(labels.substance);
  if (fields.extraOil) bits.push(lang === "ru" ? "больше масла" : lang === "az" ? "bol yağ" : "extra oil");
  if (fields.holdOrStop) bits.push(lang === "ru" ? "стоп" : lang === "az" ? "dayandırılsın" : "hold/stop");
  if (fields.spineLevel) bits.push(fields.spineLevel);
  if (fields.dayBlock) bits.push(loc(lang, fields.dayBlock));
  if (fields.bathSequence) bits.push(loc(lang, fields.bathSequence));
  if (fields.intensity) bits.push(loc(lang, fields.intensity));
  if (fields.smear) bits.push(lang === "ru" ? "смазать" : lang === "az" ? "sürtülsün" : "smear");
  return bits;
}
