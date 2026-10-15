/**
 * Narrative ultrasound Word blanks.
 * A heading is an organ name. The sentences under it fill that panel field.
 * Study title, date, and the sample radiologist line are not results.
 */

export type UsmBlankKind = "abdomen" | "thyroid";

type Heading = { pattern: RegExp; key: string; label: string };

const ABDOMEN: Heading[] = [
  { pattern: /^qaraciyer$/, key: "liver", label: "Qaraciyər" },
  { pattern: /^od kisesi$/, key: "gallbladder", label: "Öd kisəsi" },
  { pattern: /^pankreas$/, key: "pancreas", label: "Pankreas" },
  { pattern: /^dalaq$/, key: "spleen", label: "Dalaq" },
  { pattern: /^sag boyrek$/, key: "rightKidney", label: "Sağ böyrək" },
  { pattern: /^sol boyrek$/, key: "leftKidney", label: "Sol böyrək" },
  { pattern: /^sidik kisesi$/, key: "bladder", label: "Sidik kisəsi" },
  { pattern: /^uterus$/, key: "uterus", label: "Uterus" },
  { pattern: /^sag over$/, key: "ovaries", label: "Sağ over" },
  { pattern: /^sol over$/, key: "ovaries", label: "Sol over" },
  { pattern: /^prostat\b/, key: "prostate", label: "Prostat vəzi" },
  { pattern: /^netice$/, key: "conclusion", label: "Nəticə" },
];

const THYROID: Heading[] = [
  { pattern: /^isthmus$/, key: "isthmus", label: "İsthmus" },
  { pattern: /^sag lob$/, key: "rightLobe", label: "Sağ lob" },
  { pattern: /^sol lob\b/, key: "leftLobe", label: "Sol lob" },
  { pattern: /^limfa duyunu$/, key: "lymphNodes", label: "Limfa düyünü" },
  { pattern: /^netice$/, key: "conclusion", label: "Nəticə" },
];

const SKIP_HEADING = /^(muayine adi|tarix)$/;
const DOCTOR_LINE = /^dr\.?\s*radioloq\b/;

function fold(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .replace(/İ/g, "i")
    .replace(/I/g, "i")
    .toLowerCase()
    .replace(/ı/g, "i")
    .replace(/ə/g, "e")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ç/g, "c");
}

const FEMALE_ONLY = new Set(["uterus", "ovaries"]);
const MALE_ONLY = new Set(["prostate"]);

export function usmBlankKind(serviceCode: string): UsmBlankKind | null {
  const code = serviceCode.trim().toUpperCase();
  if (code === "USG-THYROID") return "thyroid";
  if (code === "USG-ABD" || code === "USG" || code === "USM") return "abdomen";
  return null;
}

/** Organs the other sex's blank must not leave on the form. */
export function usmFieldsOmitted(sex?: "MALE" | "FEMALE" | "UNKNOWN" | null): string[] {
  if (sex === "FEMALE") return ["prostate"];
  if (sex === "MALE") return ["uterus", "ovaries"];
  return [];
}

export function parseUsmSections(
  paragraphs: string[],
  input: { kind: UsmBlankKind; sex?: "MALE" | "FEMALE" | "UNKNOWN" | null },
): Record<string, string> {
  const headings = input.kind === "thyroid" ? THYROID : ABDOMEN;
  const blocked =
    input.sex === "FEMALE" ? MALE_ONLY : input.sex === "MALE" ? FEMALE_ONLY : new Set<string>();
  const parts = new Map<string, string[]>();
  let current: Heading | null = null;

  for (const raw of paragraphs) {
    const line = raw.replace(/\s+/g, " ").trim();
    const folded = fold(line);
    if (!line || DOCTOR_LINE.test(folded)) {
      current = null;
      continue;
    }
    if (SKIP_HEADING.test(folded)) {
      current = null;
      continue;
    }
    const heading = headings.find((row) => row.pattern.test(folded));
    if (heading) {
      current = blocked.has(heading.key) ? null : heading;
      continue;
    }
    if (!current || blocked.has(current.key)) continue;
    const bucket = parts.get(current.key) ?? [];
    const text = current.key === "ovaries" ? `${current.label}: ${line}` : line;
    bucket.push(text);
    parts.set(current.key, bucket);
  }

  const fields: Record<string, string> = {};
  for (const [key, lines] of parts) {
    const value = lines.join("\n").trim();
    if (value) fields[key] = value;
  }
  return fields;
}
