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

function catalogTitle(
  locale: string,
  row: { titleAz?: string | null; titleRu?: string | null; titleEn?: string | null; code?: string | null },
  localeOnly: boolean,
): string {
  const en = row.titleEn?.trim() ?? "";
  const local =
    (locale.startsWith("ru") ? row.titleRu : locale.startsWith("en") ? row.titleEn : row.titleAz)?.trim() ||
    en ||
    row.code?.trim() ||
    "";
  if (!localeOnly && local && en && local !== en) return `${local} (${en})`;
  return local;
}

const APPLY_MODE: Record<"en" | "az" | "ru", Record<string, string>> = {
  en: { TURN: "in turn", TOGETHER: "together" },
  az: { TURN: "növbəli", TOGETHER: "eyni vaxtda" },
  ru: { TURN: "по очереди", TOGETHER: "одновременно" },
};

/** Draft / card line for package assign: UI language only (no Latin echo in parentheses). */
export function paramsLabelFromPhysio(
  p: PhysioChipsValue,
  catalog: PhysioCatalogSite[],
  locale: string,
  lists?: { programs?: PhysioCatalogListItem[]; substances?: PhysioCatalogListItem[] },
  opts?: { localeOnly?: boolean },
): string {
  const lang = uiLang(locale);
  const localeOnly = opts?.localeOnly !== false;
  const parts: string[] = [];
  const byId = new Map(catalog.map((s) => [s.id, s]));
  const siteNames = (p.hideSitePicker ? [] : p.siteIds ?? [])
    .map((id) => {
      const site = byId.get(id);
      return site ? catalogTitle(locale, site, localeOnly) : "";
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
        program: program ? catalogTitle(locale, program, localeOnly) : null,
        substance: substance ? catalogTitle(locale, substance, localeOnly) : null,
      }),
    );
  }
  if (p.note?.trim()) parts.push(p.note.trim());
  return parts.join(" · ");
}

/** Strip legacy `local (English)` echoes already stored on cards (supports nested parens). */
export function stripLatinParamEcho(label: string): string {
  return label
    .split(" · ")
    .map((part) => {
      let s = part.trim();
      for (;;) {
        const open = s.indexOf(" (");
        if (open < 0) break;
        let depth = 0;
        let end = -1;
        for (let i = open + 1; i < s.length; i++) {
          if (s[i] === "(") depth += 1;
          else if (s[i] === ")") {
            depth -= 1;
            if (depth === 0) {
              end = i;
              break;
            }
          }
        }
        if (end < 0) break;
        const inner = s.slice(open + 2, end);
        if (/[A-Za-z]{3,}/.test(inner) && /^[\sA-Za-z0-9 /.,'()/-]+$/.test(inner)) {
          s = `${s.slice(0, open)}${s.slice(end + 1)}`.replace(/\s+/g, " ").trim();
          continue;
        }
        break;
      }
      return s;
    })
    .filter(Boolean)
    .join(" · ");
}
