import {
  formatPhysioFieldsPrint,
  type PhysioOrderFields,
} from "@/domain/physio/physio-order-fields";
import type {
  PhysioCatalogListItem,
  PhysioCatalogSite,
  PhysioChipsValue,
} from "@/components/physio/PhysioSiteChips";

function uiLang(locale: string): "en" | "az" | "ru" {
  if (locale.startsWith("ru")) return "ru";
  if (locale.startsWith("en")) return "en";
  return "az";
}

function bilingualCatalogTitle(
  locale: string,
  row: { titleAz?: string | null; titleRu?: string | null; titleEn?: string | null; code?: string | null },
): string {
  const en = row.titleEn?.trim() ?? "";
  const local =
    (locale.startsWith("ru") ? row.titleRu : locale.startsWith("en") ? row.titleEn : row.titleAz)?.trim() ||
    en ||
    row.code?.trim() ||
    "";
  if (local && en && local !== en) return `${local} (${en})`;
  return local;
}

const APPLY_MODE: Record<"en" | "az" | "ru", Record<string, string>> = {
  en: { TURN: "in turn", TOGETHER: "together" },
  az: { TURN: "növbəli", TOGETHER: "eyni vaxtda" },
  ru: { TURN: "по очереди", TOGETHER: "одновременно" },
};

/** Draft card line: site in the UI language plus English, catalog names instead of ids. */
export function paramsLabelFromPhysio(
  p: PhysioChipsValue,
  catalog: PhysioCatalogSite[],
  locale: string,
  lists?: { programs?: PhysioCatalogListItem[]; substances?: PhysioCatalogListItem[] },
): string {
  const lang = uiLang(locale);
  const parts: string[] = [];
  const byId = new Map(catalog.map((s) => [s.id, s]));
  const siteNames = (p.hideSitePicker ? [] : p.siteIds ?? [])
    .map((id) => {
      const site = byId.get(id);
      return site ? bilingualCatalogTitle(locale, site) : "";
    })
    .filter(Boolean);
  if (siteNames.length) parts.push(siteNames.join(", "));
  if (p.siteApplyMode && !p.hideSitePicker) {
    parts.push(APPLY_MODE[lang][p.siteApplyMode] ?? p.siteApplyMode);
  }
  if (p.physioFields && typeof p.physioFields === "object") {
    const program = lists?.programs?.find((row) => row.id === p.physioFields?.deviceProgramId);
    const substance = lists?.substances?.find((row) => row.id === p.physioFields?.substanceId);
    parts.push(
      ...formatPhysioFieldsPrint(lang, p.physioFields as PhysioOrderFields, {
        program: program ? bilingualCatalogTitle(locale, program) : null,
        substance: substance ? bilingualCatalogTitle(locale, substance) : null,
      }),
    );
  }
  if (p.note?.trim()) parts.push(p.note.trim());
  return parts.join(" · ");
}
