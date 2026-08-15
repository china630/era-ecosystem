import { prisma } from "@/lib/prisma";
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

/** Static catalog schema version; bump when the seed data shape changes materially. */
const CATALOG_VERSION = "1.1.0";

type DiagnosticCatalog = {
  version: string;
  metaFields: CatalogFieldDef[];
  items: DiagnosticCatalogItem[];
  groups: DiagnosticCatalogGroup[];
};

let cached: DiagnosticCatalog | null = null;
let inflight: Promise<DiagnosticCatalog> | null = null;

export function invalidateDiagnosticCatalogCache(): void {
  cached = null;
  inflight = null;
}

function ensureGroup(
  groupMap: Map<string, DiagnosticCatalogGroup>,
  key: string,
  modality: string,
  category: string | null,
  kind: string,
  title: L10n,
): DiagnosticCatalogGroup {
  let g = groupMap.get(key);
  if (!g) {
    g = { key, modality, category, kind, title, itemCodes: [] };
    groupMap.set(key, g);
  }
  return g;
}

async function loadDiagnosticCatalogFromDb(): Promise<DiagnosticCatalog> {
  const [modalities, metaFieldRows] = await Promise.all([
    prisma.modality.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      include: {
        services: {
          where: { active: true },
          orderBy: { sortOrder: "asc" },
          include: { analytes: { orderBy: { sortOrder: "asc" }, include: { valueOptions: { orderBy: { sortOrder: "asc" } } } } },
        },
      },
    }),
    prisma.diagnosticMetaField.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  const items: DiagnosticCatalogItem[] = [];
  const groupMap = new Map<string, DiagnosticCatalogGroup>();

  for (const modality of modalities) {
    const modTitle: L10n = { en: modality.titleEn, ru: modality.titleRu, az: modality.titleAz };
    const isLabKind = modality.kind === "lab_panel";
    const isGroupless = modality.kind === "package" || modality.kind === "visit";

    const modGroup =
      !isLabKind && !isGroupless
        ? ensureGroup(groupMap, `mod:${modality.code}`, modality.code, null, modality.kind, modTitle)
        : null;

    for (const svc of modality.services) {
      const title: L10n = { en: svc.titleEn, ru: svc.titleRu, az: svc.titleAz };
      const item: DiagnosticCatalogItem = {
        code: svc.code,
        kind: svc.kind,
        modality: modality.code,
        category: svc.category,
        title,
        serviceCode: svc.serviceCode,
      };
      if (svc.fieldsJson) {
        item.fields = JSON.parse(svc.fieldsJson) as CatalogFieldDef[];
      }
      if (svc.includesJson) {
        item.includes = JSON.parse(svc.includesJson) as string[];
      }
      if (svc.analytes.length > 0) {
        item.analytes = svc.analytes.map((a): CatalogAnalyteDef => ({
          code: a.code,
          unit: a.unit ?? undefined,
          label: { en: a.labelEn, ru: a.labelRu, az: a.labelAz },
          refMin: a.refMin ?? undefined,
          refMax: a.refMax ?? undefined,
          section: a.section ?? undefined,
          valueType: a.valueType === "QUALITATIVE" ? "QUALITATIVE" : "NUMERIC",
          valueOptions: (a.valueOptions ?? []).map((o) => ({
            code: o.code,
            label: { en: o.labelEn, ru: o.labelRu, az: o.labelAz },
          })),
        }));
      }
      items.push(item);

      if (isLabKind) {
        const labMod = ensureGroup(groupMap, "mod:LAB", modality.code, null, svc.kind, modTitle);
        labMod.itemCodes.push(svc.code);
        const labCat = ensureGroup(groupMap, `lab:${svc.category}`, modality.code, svc.category, svc.kind, {
          en: svc.category,
          ru: svc.category,
          az: svc.category,
        });
        labCat.itemCodes.push(svc.code);
      } else if (!isGroupless && modGroup) {
        modGroup.itemCodes.push(svc.code);
        const catGroup = ensureGroup(
          groupMap,
          `mod:${modality.code}:${svc.category}`,
          modality.code,
          svc.category,
          svc.kind,
          {
            en: `${modTitle.en} · ${svc.category}`,
            ru: `${modTitle.ru} · ${svc.category}`,
            az: `${modTitle.az} · ${svc.category}`,
          },
        );
        catGroup.itemCodes.push(svc.code);
      }
    }
  }

  const metaFields: CatalogFieldDef[] = metaFieldRows.map((f) => ({
    key: f.key,
    type: f.fieldType,
    label: { en: f.labelEn, ru: f.labelRu, az: f.labelAz },
    unit: f.unit ?? undefined,
    options: f.optionsJson ? (JSON.parse(f.optionsJson) as string[]) : undefined,
    required: f.required,
  }));

  return {
    version: CATALOG_VERSION,
    metaFields,
    items,
    groups: [...groupMap.values()].sort((a, b) => a.key.localeCompare(b.key)),
  };
}

export async function getDiagnosticCatalog(): Promise<DiagnosticCatalog> {
  if (cached) return cached;
  if (!inflight) {
    inflight = loadDiagnosticCatalogFromDb()
      .then((result) => {
        cached = result;
        return result;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export async function findCatalogItem(code: string): Promise<DiagnosticCatalogItem | undefined> {
  const primary = code.split(",")[0]?.trim() ?? code;
  const catalog = await getDiagnosticCatalog();
  return catalog.items.find((i) => i.code === primary || i.serviceCode === primary);
}
