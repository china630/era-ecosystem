import {
  effectiveBoundKind,
  parseZonesJson,
  resolveNumericBounds,
  type AnalyteBoundKind,
  type AnalyteNormSource,
  type PatientSexLike,
} from "@/lib/lab-analyte-norms";

export type ResultLineInput = {
  code: string;
  value: string;
  unit?: string;
  refMin?: string;
  refMax?: string;
  /** Blank sentence snapshot (print). */
  normTextEn?: string;
  normTextRu?: string;
  normTextAz?: string;
  boundKind?: AnalyteBoundKind;
  /** Sex-aware dual ranges when guest sex is UNKNOWN. */
  refMinFemale?: string;
  refMaxFemale?: string;
  refMinMale?: string;
  refMaxMale?: string;
  zonesJson?: string;
  valueType?: string;
  /** Expected qualitative option code (e.g. NEGATIVE). */
  expectedOptionCode?: string;
  sex?: PatientSexLike;
  flag?: "NORMAL" | "HIGH" | "LOW" | "CRITICAL";
};

function parseNum(v?: string | null): number {
  if (v == null || v === "") return NaN;
  return parseFloat(String(v).trim().replace(",", "."));
}

function flagInterval(
  num: number,
  min: number,
  max: number,
): ResultLineInput["flag"] {
  if (!Number.isNaN(min) && num < min) {
    return num < min * 0.5 ? "CRITICAL" : "LOW";
  }
  if (!Number.isNaN(max) && num > max) {
    return num > max * 1.5 ? "CRITICAL" : "HIGH";
  }
  return "NORMAL";
}

function flagUpperOnly(num: number, max: number): ResultLineInput["flag"] {
  if (Number.isNaN(max)) return "NORMAL";
  if (num > max) return "HIGH";
  return "NORMAL";
}

function flagLowerOnly(num: number, min: number): ResultLineInput["flag"] {
  if (Number.isNaN(min)) return "NORMAL";
  if (num < min) return "LOW";
  return "NORMAL";
}

function flagUnknownDual(
  num: number,
  female: { refMin?: string; refMax?: string },
  male: { refMin?: string; refMax?: string },
  kind: AnalyteBoundKind,
): ResultLineInput["flag"] {
  const fMin = parseNum(female.refMin);
  const fMax = parseNum(female.refMax);
  const mMin = parseNum(male.refMin);
  const mMax = parseNum(male.refMax);

  if (kind === "UPPER_ONLY") {
    const maxBoth = Math.max(
      Number.isNaN(fMax) ? -Infinity : fMax,
      Number.isNaN(mMax) ? -Infinity : mMax,
    );
    if (maxBoth === -Infinity) return "NORMAL";
    return num > maxBoth ? "HIGH" : "NORMAL";
  }
  if (kind === "LOWER_ONLY") {
    const minBoth = Math.min(
      Number.isNaN(fMin) ? Infinity : fMin,
      Number.isNaN(mMin) ? Infinity : mMin,
    );
    if (minBoth === Infinity) return "NORMAL";
    return num < minBoth ? "LOW" : "NORMAL";
  }

  const belowBoth =
    !Number.isNaN(fMin) && !Number.isNaN(mMin) && num < fMin && num < mMin;
  const aboveBoth =
    !Number.isNaN(fMax) && !Number.isNaN(mMax) && num > fMax && num > mMax;
  if (belowBoth) {
    const minBoth = Math.min(fMin, mMin);
    return num < minBoth * 0.5 ? "CRITICAL" : "LOW";
  }
  if (aboveBoth) {
    const maxBoth = Math.max(fMax, mMax);
    return num > maxBoth * 1.5 ? "CRITICAL" : "HIGH";
  }
  /** Inside the union / overlap — do not invent a sex-specific flag. */
  return "NORMAL";
}

function flagZones(num: number, zonesJson?: string): ResultLineInput["flag"] {
  const zones = parseZonesJson(zonesJson);
  if (!zones.length || Number.isNaN(num)) return "NORMAL";
  const inRange = zones.find((z) => z.inRange);
  if (inRange) {
    const min = parseNum(inRange.min);
    const max = parseNum(inRange.max);
    if (!Number.isNaN(min) && num < min) return "LOW";
    if (!Number.isNaN(max) && num > max) return "HIGH";
    return "NORMAL";
  }
  return "NORMAL";
}

/** An explicit dash is not a result: no norm and no flag. An empty cell is still unfilled. */
export function isUnsetLabValue(value: string | null | undefined): boolean {
  const trimmed = (value ?? "").trim();
  return trimmed === "—" || trimmed === "-" || trimmed === "–";
}

function enrichOne(line: ResultLineInput): ResultLineInput {
  if (isUnsetLabValue(line.value)) {
    return {
      ...line,
      flag: undefined,
      refMin: undefined,
      refMax: undefined,
      normTextEn: undefined,
      normTextRu: undefined,
      normTextAz: undefined,
    };
  }
  if (line.flag === "CRITICAL") return line;

  const src: AnalyteNormSource = {
    boundKind: line.boundKind,
    refMin: line.refMin,
    refMax: line.refMax,
    refMinFemale: line.refMinFemale,
    refMaxFemale: line.refMaxFemale,
    refMinMale: line.refMinMale,
    refMaxMale: line.refMaxMale,
    zonesJson: line.zonesJson,
    valueType: line.valueType,
  };
  const kind = effectiveBoundKind(src);

  if (kind === "QUALITATIVE") {
    const expected = (line.expectedOptionCode ?? "").trim();
    if (!expected) return { ...line, flag: line.flag ?? "NORMAL" };
    const match = line.value.trim().toLowerCase() === expected.toLowerCase();
    return { ...line, flag: match ? "NORMAL" : "HIGH" };
  }

  const num = parseNum(line.value);
  if (Number.isNaN(num)) return { ...line, flag: line.flag ?? "NORMAL" };

  if (kind === "ZONES") {
    return { ...line, flag: flagZones(num, line.zonesJson) };
  }

  const resolved = resolveNumericBounds(src, line.sex);
  if (resolved.unknownSexDual && resolved.female && resolved.male) {
    return {
      ...line,
      refMin: undefined,
      refMax: undefined,
      flag: flagUnknownDual(num, resolved.female, resolved.male, kind),
    };
  }

  const min = parseNum(resolved.refMin);
  const max = parseNum(resolved.refMax);

  let flag: ResultLineInput["flag"] = "NORMAL";
  if (kind === "UPPER_ONLY") flag = flagUpperOnly(num, max);
  else if (kind === "LOWER_ONLY") flag = flagLowerOnly(num, min);
  else flag = flagInterval(num, min, max);

  return {
    ...line,
    refMin: resolved.refMin,
    refMax: resolved.refMax,
    flag,
  };
}

export function enrichResultLines(lines: ResultLineInput[]): ResultLineInput[] {
  return lines.map(enrichOne);
}

export function hasCriticalFlag(lines: ResultLineInput[]): boolean {
  return lines.some((l) => l.flag === "CRITICAL");
}

/** Merge catalog analyte fields into a result line before enrich. */
export function applyAnalyteNormToLine(
  line: ResultLineInput,
  analyte: AnalyteNormSource & {
    expectedOptionCode?: string;
  },
  sex?: PatientSexLike,
): ResultLineInput {
  return {
    ...line,
    boundKind: analyte.boundKind ?? line.boundKind,
    refMin: line.refMin ?? analyte.refMin ?? undefined,
    refMax: line.refMax ?? analyte.refMax ?? undefined,
    refMinFemale: analyte.refMinFemale ?? undefined,
    refMaxFemale: analyte.refMaxFemale ?? undefined,
    refMinMale: analyte.refMinMale ?? undefined,
    refMaxMale: analyte.refMaxMale ?? undefined,
    zonesJson: analyte.zonesJson ?? undefined,
    valueType: analyte.valueType ?? line.valueType,
    normTextEn: line.normTextEn ?? analyte.normTextEn ?? undefined,
    normTextRu: line.normTextRu ?? analyte.normTextRu ?? undefined,
    normTextAz: line.normTextAz ?? analyte.normTextAz ?? undefined,
    expectedOptionCode: line.expectedOptionCode ?? analyte.expectedOptionCode,
    sex: sex ?? line.sex,
  };
}
