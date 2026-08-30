/**
 * WO «İlkin diaqnostik prosedurlar (Check-up)» → ERA package / checklist slots.
 * Source: PatientDiagnostic groups on the patient card (not CheckUp #33/#34).
 */

export const PKG_NAFTA_INTAKE = "PKG-NAFTA-INTAKE";

/** Canonical checklist lines (package includesJson). */
export const NAFTA_INTAKE_SLOT_CODES = [
  "SANATORIUM-INTAKE",
  "GYN-OR-URO",
  "ECG-12",
  "USG-ABD",
] as const;

export type NaftaIntakeSlotCode = (typeof NAFTA_INTAKE_SLOT_CODES)[number];

/** Pseudo-slot resolved to GYN-VISIT or URO-VISIT by patient sex. */
export const GYN_OR_URO_SLOT = "GYN-OR-URO";

export type NaftaIntakeResolvedCode =
  | "SANATORIUM-INTAKE"
  | "GYN-VISIT"
  | "URO-VISIT"
  | "ECG-12"
  | "USG-ABD";

export type NaftaIntakeSlotKind = "visit" | "lab" | "imaging";

const TITLES: Record<
  NaftaIntakeSlotCode,
  { en: string; ru: string; az: string; woNames: string[] }
> = {
  "SANATORIUM-INTAKE": {
    en: "Doctor intake",
    ru: "Приём врача",
    az: "Həkim qəbulu",
    woNames: ["Həkim qəbulu", "Baş həkimin qəbulu"],
  },
  "GYN-OR-URO": {
    en: "Gynecologist / urologist exam",
    ru: "Осмотр гинеколога / уролога",
    az: "Ginekoloq/Uroloq müayinəsi",
    woNames: ["Ginekoloq/Uroloq müayinəsi", "Ginekoloq", "Uroloq"],
  },
  "ECG-12": {
    en: "ECG and cardiologist exam",
    ru: "ЭКГ и осмотр кардиолога",
    az: "EKQ və kardioloqun müayinəsi",
    woNames: ["EKQ və kardioloqun müayinəsi", "EKQ"],
  },
  "USG-ABD": {
    en: "Abdominal + pelvic ultrasound",
    ru: "УЗИ живота и малого таза",
    az: "Qarın boşluğu və kiçik çanaq tam USM",
    woNames: [
      "Qarın boşluğu və kiçik çanaq tam USM",
      "Qarın boşluğu və kiçik çanaq USM",
      "Tam USM",
    ],
  },
};

function fold(s: string): string {
  return String(s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ə/g, "e")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ğ/g, "g")
    .replace(/ş/g, "s")
    .replace(/ç/g, "c");
}

/** WO DiagnosticProcedureGroup name → Nafta intake package (or null). */
export function isNaftaIntakeGroupName(name: string): boolean {
  const n = fold(name);
  return /ilkin\s*diaqnostik/.test(n) || /initial\s*diagnostic/.test(n);
}

/** WO procedure line name → package slot code. */
export function mapWoIntakeProcedureName(procedureName: string): NaftaIntakeSlotCode | null {
  const n = fold(procedureName);
  if (!n.trim()) return null;
  if (/bas\s*hekim|hekim\s*qebul|hekim\s*qabul/.test(n) && !/ginek|uroloq|nevropatol|kardioloq/.test(n)) {
    return "SANATORIUM-INTAKE";
  }
  if (/ginek|uroloq/.test(n)) return "GYN-OR-URO";
  if (/ekq|ecg|kardioloq/.test(n)) return "ECG-12";
  if (/usm|usg|ultrason|qarin\s*bosl|ki[cç]ik\s*[cç]anaq/.test(n)) return "USG-ABD";
  return null;
}

export function naftaIntakeSlotTitle(code: NaftaIntakeSlotCode): {
  en: string;
  ru: string;
  az: string;
} {
  const t = TITLES[code];
  return { en: t.en, ru: t.ru, az: t.az };
}

export function naftaIntakeSlotKind(code: NaftaIntakeSlotCode): NaftaIntakeSlotKind {
  if (code === "ECG-12") return "lab";
  if (code === "USG-ABD") return "imaging";
  return "visit";
}

/** Resolve GYN-OR-URO (and pass-through other slots) by patient sex. */
export function resolveNaftaIntakeCode(
  slot: NaftaIntakeSlotCode,
  sex: "MALE" | "FEMALE" | "UNKNOWN" | string | null | undefined,
): NaftaIntakeResolvedCode | "GYN-OR-URO" {
  if (slot !== "GYN-OR-URO") return slot;
  const s = String(sex || "").toUpperCase();
  if (s === "MALE") return "URO-VISIT";
  if (s === "FEMALE") return "GYN-VISIT";
  return "GYN-OR-URO";
}

/** Codes that become LabOrder rows when instantiating the package. */
export function naftaIntakeLabOrderCodes(
  sex: "MALE" | "FEMALE" | "UNKNOWN" | string | null | undefined,
): Array<"ECG-12" | "USG-ABD"> {
  void sex;
  return ["ECG-12", "USG-ABD"];
}

/** Visit template codes to create (excluding unresolved GYN-OR-URO). */
export function naftaIntakeVisitCodes(
  sex: "MALE" | "FEMALE" | "UNKNOWN" | string | null | undefined,
): Array<"SANATORIUM-INTAKE" | "GYN-VISIT" | "URO-VISIT"> {
  const resolved = resolveNaftaIntakeCode("GYN-OR-URO", sex);
  const out: Array<"SANATORIUM-INTAKE" | "GYN-VISIT" | "URO-VISIT"> = ["SANATORIUM-INTAKE"];
  if (resolved === "GYN-VISIT" || resolved === "URO-VISIT") out.push(resolved);
  return out;
}

export function printSpecialtyForIntakeSlot(code: NaftaIntakeSlotCode): string {
  if (code === "SANATORIUM-INTAKE") return "therapist";
  if (code === "GYN-OR-URO") return "gynecologist";
  if (code === "ECG-12") return "cardiologist";
  return "usm";
}
