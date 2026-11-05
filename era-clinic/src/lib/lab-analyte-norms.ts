export type AnalyteBoundKind =
  | "INTERVAL"
  | "UPPER_ONLY"
  | "LOWER_ONLY"
  | "QUALITATIVE"
  | "ZONES";

export type PatientSexLike = "MALE" | "FEMALE" | "UNKNOWN" | string | null | undefined;

export type NormZone = {
  code: string;
  min?: string | null;
  max?: string | null;
  labelEn?: string;
  labelRu?: string;
  labelAz?: string;
  /** When true this zone is the "in range" / NORMAL band. */
  inRange?: boolean;
};

export type AnalyteNormSource = {
  boundKind?: AnalyteBoundKind | null;
  refMin?: string | null;
  refMax?: string | null;
  refMinFemale?: string | null;
  refMaxFemale?: string | null;
  refMinMale?: string | null;
  refMaxMale?: string | null;
  normTextEn?: string | null;
  normTextRu?: string | null;
  normTextAz?: string | null;
  unit?: string | null;
  zonesJson?: string | null;
  valueType?: "NUMERIC" | "QUALITATIVE" | string | null;
};

export type ResolvedNumericBounds = {
  refMin?: string;
  refMax?: string;
  /** True when sex is UNKNOWN and both sex pairs exist — flag only outside both. */
  unknownSexDual?: boolean;
  female?: { refMin?: string; refMax?: string };
  male?: { refMin?: string; refMax?: string };
};

function trimOrUndef(v?: string | null): string | undefined {
  const t = (v ?? "").trim();
  return t || undefined;
}

export function hasSexSpecificBounds(src: AnalyteNormSource): boolean {
  return Boolean(
    trimOrUndef(src.refMinFemale) ||
      trimOrUndef(src.refMaxFemale) ||
      trimOrUndef(src.refMinMale) ||
      trimOrUndef(src.refMaxMale),
  );
}

export function parseZonesJson(raw?: string | null): NormZone[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((z): z is NormZone => z != null && typeof z === "object");
  } catch {
    return [];
  }
}

/** Pick the numeric pair for this guest. UNKNOWN leaves dual ranges for flag logic. */
export function resolveNumericBounds(
  src: AnalyteNormSource,
  sex?: PatientSexLike,
): ResolvedNumericBounds {
  const sharedMin = trimOrUndef(src.refMin);
  const sharedMax = trimOrUndef(src.refMax);
  const female = {
    refMin: trimOrUndef(src.refMinFemale) ?? sharedMin,
    refMax: trimOrUndef(src.refMaxFemale) ?? sharedMax,
  };
  const male = {
    refMin: trimOrUndef(src.refMinMale) ?? sharedMin,
    refMax: trimOrUndef(src.refMaxMale) ?? sharedMax,
  };
  const dual = hasSexSpecificBounds(src);

  if (sex === "FEMALE" && dual) {
    return { refMin: female.refMin, refMax: female.refMax };
  }
  if (sex === "MALE" && dual) {
    return { refMin: male.refMin, refMax: male.refMax };
  }
  if (dual) {
    return {
      refMin: undefined,
      refMax: undefined,
      unknownSexDual: true,
      female,
      male,
    };
  }
  return { refMin: sharedMin, refMax: sharedMax };
}

export function pickNormSentence(
  src: Pick<AnalyteNormSource, "normTextEn" | "normTextRu" | "normTextAz">,
  lang: "en" | "ru" | "az" = "az",
): string {
  const byLang =
    lang === "en"
      ? src.normTextEn
      : lang === "ru"
        ? src.normTextRu
        : src.normTextAz;
  return (
    trimOrUndef(byLang) ||
    trimOrUndef(src.normTextAz) ||
    trimOrUndef(src.normTextEn) ||
    trimOrUndef(src.normTextRu) ||
    ""
  );
}

/**
 * Display string for blanks / tables.
 * When a norm sentence exists, return it as-is (do not append unit).
 * Else fall back to min–max (+ unit for legacy rows).
 */
function compactNorm(value: string): string {
  return value.replace(/\s+/g, "").replace(/–/g, "-").toLowerCase();
}

/** A result cell that repeats the catalog range is not a measurement. */
export function isCatalogNormEcho(
  value: string | null | undefined,
  src: AnalyteNormSource,
): boolean {
  const raw = (value ?? "").trim();
  if (!raw || !/\d\s*[-–]\s*\d/.test(raw)) return false;
  const forms = [
    pickNormSentence(src, "az"),
    pickNormSentence(src, "ru"),
    pickNormSentence(src, "en"),
    formatNormDisplay(src, { lang: "az" }),
  ];
  const min = trimOrUndef(src.refMin);
  const max = trimOrUndef(src.refMax);
  const unit = trimOrUndef(src.unit);
  if (min && max) {
    forms.push(`${min}-${max}`);
    if (unit) forms.push(`${min}-${max} ${unit}`);
  }
  const compact = compactNorm(raw);
  return forms.some((form) => form && compactNorm(form) === compact);
}

export function formatNormDisplay(
  src: AnalyteNormSource,
  opts?: { lang?: "en" | "ru" | "az"; chosen?: { refMin?: string; refMax?: string } },
): string {
  const sentence = pickNormSentence(src, opts?.lang ?? "az");
  if (sentence) return sentence;

  const a = trimOrUndef(opts?.chosen?.refMin ?? src.refMin) ?? "";
  const b = trimOrUndef(opts?.chosen?.refMax ?? src.refMax) ?? "";
  let n = "";
  if (a && b) n = `${a}-${b}`;
  else if (a) n = a;
  else if (b) n = b;
  const unit = trimOrUndef(src.unit);
  if (unit && n) return `${n} ${unit}`;
  return n || unit || "";
}

export function effectiveBoundKind(src: AnalyteNormSource): AnalyteBoundKind {
  if (src.boundKind) return src.boundKind;
  if (src.valueType === "QUALITATIVE") return "QUALITATIVE";
  return "INTERVAL";
}
