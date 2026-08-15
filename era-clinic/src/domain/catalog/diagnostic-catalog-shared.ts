export type L10n = { en: string; ru: string; az: string };

export type CatalogFieldDef = {
  key: string;
  type: string;
  label: L10n;
  unit?: string;
  options?: string[];
  required?: boolean;
};

export type CatalogAnalyteValueOption = {
  code: string;
  label: L10n;
};

export type CatalogAnalyteDef = {
  code: string;
  unit?: string;
  label: L10n;
  refMin?: string;
  refMax?: string;
  section?: string;
  valueType?: "NUMERIC" | "QUALITATIVE";
  valueOptions?: CatalogAnalyteValueOption[];
};

export type DiagnosticCatalogItem = {
  code: string;
  kind: string;
  modality: string;
  category: string;
  title: L10n;
  serviceCode: string;
  fields?: CatalogFieldDef[];
  analytes?: CatalogAnalyteDef[];
  includes?: string[];
};

export type DiagnosticCatalogGroup = {
  key: string;
  modality: string;
  category: string | null;
  kind: string;
  title: L10n;
  itemCodes: string[];
};

export function pickL10n(label: L10n, locale: string): string {
  if (locale.startsWith("ru")) return label.ru;
  if (locale.startsWith("az")) return label.az;
  return label.en;
}

/** Favorite keys: mod:USG | mod:USG:abdomen | lab:hematology | code:LAB-CBC */
export function itemMatchesFavorites(
  item: Pick<DiagnosticCatalogItem, "code" | "modality" | "category" | "kind">,
  favoriteKeys: string[],
): boolean {
  if (favoriteKeys.length === 0) return false;
  const set = new Set(favoriteKeys);
  if (set.has(`code:${item.code}`)) return true;
  if (set.has(`mod:${item.modality}`)) return true;
  if (set.has(`mod:${item.modality}:${item.category}`)) return true;
  if (item.kind === "lab_panel" && set.has(`lab:${item.category}`)) return true;
  return false;
}

export function filterAndSortCatalogItems(
  items: DiagnosticCatalogItem[],
  favoriteKeys: string[],
  mode: "first" | "only",
  opts?: { kinds?: string[]; search?: string; modality?: string },
): DiagnosticCatalogItem[] {
  let list = items;
  if (opts?.kinds?.length) {
    const kinds = new Set(opts.kinds);
    list = list.filter((i) => kinds.has(i.kind));
  }
  if (opts?.modality) {
    list = list.filter((i) => i.modality === opts.modality);
  }
  if (opts?.search?.trim()) {
    const q = opts.search.trim().toLowerCase();
    list = list.filter(
      (i) =>
        i.code.toLowerCase().includes(q) ||
        i.title.en.toLowerCase().includes(q) ||
        i.title.ru.toLowerCase().includes(q) ||
        i.title.az.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q),
    );
  }

  if (favoriteKeys.length === 0) return list;

  const fav = list.filter((i) => itemMatchesFavorites(i, favoriteKeys));
  const rest = list.filter((i) => !itemMatchesFavorites(i, favoriteKeys));
  if (mode === "only") return fav.length > 0 ? fav : list;
  return [...fav, ...rest];
}

export function expandPackageCodes(
  codes: string[],
  items: DiagnosticCatalogItem[],
): string[] {
  const byCode = new Map(items.map((i) => [i.code, i]));
  const out: string[] = [];
  for (const code of codes) {
    const item = byCode.get(code);
    if (item?.kind === "package" && item.includes?.length) {
      for (const child of item.includes) {
        if (!out.includes(child)) out.push(child);
      }
    } else if (!out.includes(code)) {
      out.push(code);
    }
  }
  return out;
}
