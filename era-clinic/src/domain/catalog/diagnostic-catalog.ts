import { readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  CatalogAnalyteDef,
  CatalogFieldDef,
  DiagnosticCatalogGroup,
  DiagnosticCatalogItem,
  L10n,
} from "@/domain/catalog/diagnostic-catalog-shared";

export type {
  CatalogAnalyteDef,
  CatalogFieldDef,
  DiagnosticCatalogGroup,
  DiagnosticCatalogItem,
  L10n,
} from "@/domain/catalog/diagnostic-catalog-shared";

export {
  pickL10n,
  itemMatchesFavorites,
  filterAndSortCatalogItems,
  expandPackageCodes,
} from "@/domain/catalog/diagnostic-catalog-shared";

type RawCatalog = {
  version?: string;
  commonMetaFields?: CatalogFieldDef[];
  modalities: Array<{
    code: string;
    kind: string;
    title: L10n;
    templates: Array<{
      code: string;
      category: string;
      title: L10n;
      serviceCode?: string;
      fields: CatalogFieldDef[];
    }>;
  }>;
  labPanels: Array<{
    code: string;
    category: string;
    title: L10n;
    serviceCode?: string;
    analytes: CatalogAnalyteDef[];
  }>;
  visitTemplates?: Array<{
    code: string;
    specialty: string;
    title: L10n;
    fields: CatalogFieldDef[];
  }>;
  packages?: Array<{
    code: string;
    title: L10n;
    includes: string[];
  }>;
};

let cached: {
  version: string;
  metaFields: CatalogFieldDef[];
  items: DiagnosticCatalogItem[];
  groups: DiagnosticCatalogGroup[];
} | null = null;

function catalogPath(): string {
  return join(process.cwd(), "prisma", "seed-data", "diagnostic-lab-catalog.json");
}

export function loadDiagnosticCatalogRaw(): RawCatalog {
  return JSON.parse(readFileSync(catalogPath(), "utf8")) as RawCatalog;
}

export function getDiagnosticCatalog() {
  if (cached) return cached;
  const raw = loadDiagnosticCatalogRaw();
  const items: DiagnosticCatalogItem[] = [];
  const groupMap = new Map<string, DiagnosticCatalogGroup>();

  function ensureGroup(
    key: string,
    modality: string,
    category: string | null,
    kind: string,
    title: L10n,
  ) {
    let g = groupMap.get(key);
    if (!g) {
      g = { key, modality, category, kind, title, itemCodes: [] };
      groupMap.set(key, g);
    }
    return g;
  }

  for (const modality of raw.modalities) {
    const modGroup = ensureGroup(
      `mod:${modality.code}`,
      modality.code,
      null,
      modality.kind,
      modality.title,
    );
    for (const tpl of modality.templates) {
      items.push({
        code: tpl.code,
        kind: modality.kind,
        modality: modality.code,
        category: tpl.category,
        title: tpl.title,
        serviceCode: tpl.serviceCode ?? tpl.code,
        fields: tpl.fields,
      });
      modGroup.itemCodes.push(tpl.code);
      const catKey = `mod:${modality.code}:${tpl.category}`;
      const catGroup = ensureGroup(catKey, modality.code, tpl.category, modality.kind, {
        en: `${modality.title.en} · ${tpl.category}`,
        ru: `${modality.title.ru} · ${tpl.category}`,
        az: `${modality.title.az} · ${tpl.category}`,
      });
      catGroup.itemCodes.push(tpl.code);
    }
  }

  for (const panel of raw.labPanels) {
    items.push({
      code: panel.code,
      kind: "lab_panel",
      modality: "LAB",
      category: panel.category,
      title: panel.title,
      serviceCode: panel.serviceCode ?? panel.code,
      analytes: panel.analytes,
    });
    const labMod = ensureGroup("mod:LAB", "LAB", null, "lab_panel", {
      en: "Laboratory",
      ru: "Лаборатория",
      az: "Laboratoriya",
    });
    labMod.itemCodes.push(panel.code);
    const labCat = ensureGroup(`lab:${panel.category}`, "LAB", panel.category, "lab_panel", {
      en: panel.category,
      ru: panel.category,
      az: panel.category,
    });
    labCat.itemCodes.push(panel.code);
  }

  for (const pkg of raw.packages ?? []) {
    items.push({
      code: pkg.code,
      kind: "package",
      modality: "PACKAGE",
      category: "checkup",
      title: pkg.title,
      serviceCode: pkg.code,
      includes: pkg.includes,
    });
  }

  for (const visit of raw.visitTemplates ?? []) {
    items.push({
      code: visit.code,
      kind: "visit",
      modality: "VISIT",
      category: visit.specialty,
      title: visit.title,
      serviceCode: visit.code,
      fields: visit.fields,
    });
  }

  cached = {
    version: raw.version ?? "1.0.0",
    metaFields: raw.commonMetaFields ?? [],
    items,
    groups: [...groupMap.values()].sort((a, b) => a.key.localeCompare(b.key)),
  };
  return cached;
}

export function findCatalogItem(code: string): DiagnosticCatalogItem | undefined {
  const primary = code.split(",")[0]?.trim() ?? code;
  return getDiagnosticCatalog().items.find((i) => i.code === primary || i.serviceCode === primary);
}
