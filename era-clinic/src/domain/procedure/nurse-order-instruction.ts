import {
  formatLateralityLabel,
  formatPhysioFieldsPrint,
  readPhysioFields,
  type PhysioLateralityCode,
} from "@/domain/physio/physio-order-fields";

export type NurseInstruction = {
  bodyPart: string | null;
  sites: string[];
  applyMode: string | null;
  fields: string[];
  note: string | null;
};

type TitleRow = { titleAz: string; titleRu: string; titleEn: string; titleLa?: string | null };

function printLang(locale: string): "az" | "ru" | "en" {
  if (locale === "ru" || locale.startsWith("ru")) return "ru";
  if (locale === "az" || locale.startsWith("az")) return "az";
  return "en";
}

function localTitle(lang: "az" | "ru" | "en", row: TitleRow): string {
  const local =
    lang === "ru" ? row.titleRu : lang === "az" ? row.titleAz : row.titleEn;
  const latin = row.titleLa?.trim() ?? "";
  return [local?.trim(), latin].filter(Boolean).join(" / ");
}

function applyModeLabel(lang: "az" | "ru" | "en", mode: string | null): string | null {
  if (mode === "TURN") {
    return lang === "ru" ? "по очереди" : lang === "az" ? "növbəli" : "in turn";
  }
  if (mode === "TOGETHER") {
    return lang === "ru" ? "вместе" : lang === "az" ? "birlikdə" : "together";
  }
  return null;
}

function asLaterality(value: string | null | undefined): PhysioLateralityCode | null {
  if (value === "LEFT" || value === "RIGHT" || value === "BOTH") return value;
  return null;
}

/** Localized doctor order for the nurse card modal. Empty strings are omitted. */
export function buildNurseInstruction(input: {
  locale: string;
  bodyPartName: string | null;
  siteApplyMode: string | null;
  note: string | null;
  physioFields: unknown;
  sites: Array<{
    laterality: string | null;
    site: TitleRow;
  }>;
  listTitles: Map<string, TitleRow>;
}): NurseInstruction {
  const lang = printLang(input.locale);
  const fields = readPhysioFields(input.physioFields);
  const program = fields.deviceProgramId
    ? input.listTitles.get(fields.deviceProgramId)
    : undefined;
  const substance = fields.substanceId
    ? input.listTitles.get(fields.substanceId)
    : undefined;
  const sites = input.sites
    .map((row) => {
      const title = localTitle(lang, row.site);
      const side = formatLateralityLabel(lang, asLaterality(row.laterality));
      if (!title && !side) return "";
      return side ? `${title} (${side})` : title;
    })
    .filter(Boolean);
  const note = input.note?.trim() || null;
  const bodyPart = input.bodyPartName?.trim() || null;
  return {
    bodyPart,
    sites,
    applyMode: applyModeLabel(lang, input.siteApplyMode),
    fields: formatPhysioFieldsPrint(lang, fields, {
      program: program ? localTitle(lang, program) : null,
      substance: substance ? localTitle(lang, substance) : null,
    }),
    note,
  };
}
