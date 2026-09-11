import type {
  CatalogAnalyteDef,
  CatalogFieldDef,
  DiagnosticCatalogItem,
  L10n,
} from "@/domain/catalog/diagnostic-catalog-shared";
import { pickL10n } from "@/domain/catalog/diagnostic-catalog-shared";
import type { ResultLineState } from "@/components/TemplateResultForm";
import type { PrintLang } from "@/domain/print/print-types";

export type CpoeValueOptionSnap = {
  code: string;
  label: L10n;
};

export type CpoeFieldDefSnap = {
  key: string;
  label: L10n;
  unit?: string;
  /** Plain select options (value === display) or coded options */
  options?: CpoeValueOptionSnap[];
};

export type CpoeLineSnap = {
  code: string;
  value: string;
  unit?: string;
  refMin?: string;
  refMax?: string;
  label: L10n;
  valueOptions?: CpoeValueOptionSnap[];
};

/** Persisted CPOE payload — labels snapshotted for archival print. */
export type CpoePayloadV1 = {
  v: 1;
  templateCode: string;
  title: L10n;
  fields: Record<string, string>;
  fieldDefs: CpoeFieldDefSnap[];
  meta: Record<string, string>;
  lines: CpoeLineSnap[];
};

function asL10n(raw: L10n | string | undefined, fallback: string): L10n {
  if (!raw) return { en: fallback, ru: fallback, az: fallback };
  if (typeof raw === "string") return { en: raw, ru: raw, az: raw };
  return {
    en: raw.en || fallback,
    ru: raw.ru || raw.en || fallback,
    az: raw.az || raw.en || fallback,
  };
}

function fieldOptionsSnap(field: CatalogFieldDef): CpoeValueOptionSnap[] | undefined {
  if (!field.options?.length) return undefined;
  return field.options.map((opt) => ({
    code: opt,
    label: { en: opt, ru: opt, az: opt },
  }));
}

function analyteOptionsSnap(a: CatalogAnalyteDef): CpoeValueOptionSnap[] | undefined {
  if (!a.valueOptions?.length) return undefined;
  return a.valueOptions.map((o) => ({
    code: o.code,
    label: asL10n(o.label, o.code),
  }));
}

export function buildCpoePayloadSnapshot(input: {
  item: DiagnosticCatalogItem;
  fieldValues: Record<string, string>;
  metaValues: Record<string, string>;
  lines: ResultLineState[];
}): CpoePayloadV1 {
  const { item, fieldValues, metaValues, lines } = input;
  const analytes = (item.analytes ?? []) as CatalogAnalyteDef[];
  const analyteByCode = new Map(analytes.map((a) => [a.code, a]));

  const fieldDefs: CpoeFieldDefSnap[] = (item.fields ?? []).map((f) => ({
    key: f.key,
    label: asL10n(f.label, f.key),
    unit: f.unit,
    options: fieldOptionsSnap(f),
  }));

  const lineSnaps: CpoeLineSnap[] = lines
    .filter((l) => String(l.value ?? "").trim() !== "")
    .map((l) => {
      const a = analyteByCode.get(l.code);
      return {
        code: l.code,
        value: l.value,
        unit: l.unit ?? a?.unit,
        refMin: l.refMin ?? a?.refMin,
        refMax: l.refMax ?? a?.refMax,
        label: a ? asL10n(a.label, l.code) : { en: l.code, ru: l.code, az: l.code },
        valueOptions: a ? analyteOptionsSnap(a) : undefined,
      };
    });

  return {
    v: 1,
    templateCode: item.code,
    title: asL10n(item.title as L10n, item.code),
    fields: { ...fieldValues },
    fieldDefs,
    meta: { ...metaValues },
    lines: lineSnaps,
  };
}

export function parseCpoePayload(raw: string): Partial<CpoePayloadV1> & {
  templateCode?: string;
  title?: L10n | string;
  fields?: Record<string, string>;
  meta?: Record<string, string>;
  lines?: Array<{
    code: string;
    value: string;
    unit?: string;
    refMin?: string;
    refMax?: string;
    label?: L10n | string;
    valueOptions?: CpoeValueOptionSnap[];
  }>;
  fieldDefs?: CpoeFieldDefSnap[];
} {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as ReturnType<typeof parseCpoePayload>;
  } catch {
    return {};
  }
}

export function resolvePrintedValue(
  raw: string,
  options: CpoeValueOptionSnap[] | undefined,
  lang: PrintLang,
): string {
  if (!options?.length) return raw;
  const opt = options.find((o) => o.code === raw);
  if (!opt) return raw;
  return pickL10n(opt.label, lang) || raw;
}

export function pickPayloadTitle(
  payload: ReturnType<typeof parseCpoePayload>,
  lang: PrintLang,
  fallback: string,
): string {
  const t = payload.title;
  if (!t) return fallback;
  if (typeof t === "string") return t || fallback;
  return pickL10n(t, lang) || fallback;
}
