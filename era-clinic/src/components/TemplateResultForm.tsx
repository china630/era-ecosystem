"use client";

import { useLocale } from "next-intl";
import {
  FORM_FIELD_GROUP_CLASS,
  FORM_STACK_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  MODAL_INPUT_CLASS,
} from "@era/satellite-kit/ui";
import type {
  CatalogAnalyteDef,
  CatalogFieldDef,
  DiagnosticCatalogItem,
  L10n,
} from "@/domain/catalog/diagnostic-catalog-shared";
import { pickL10n } from "@/domain/catalog/diagnostic-catalog-shared";

export type ResultLineState = {
  code: string;
  value: string;
  unit?: string;
  refMin?: string;
  refMax?: string;
};

type Props = {
  item: DiagnosticCatalogItem | null;
  metaFields?: CatalogFieldDef[];
  metaValues: Record<string, string>;
  onMetaChange: (key: string, value: string) => void;
  /** Lab analyte lines */
  lines: ResultLineState[];
  onLinesChange: (lines: ResultLineState[]) => void;
  /** Imaging/visit structured field values */
  fieldValues: Record<string, string>;
  onFieldChange: (key: string, value: string) => void;
  labels: {
    meta: string;
    fields: string;
    analytes: string;
    value: string;
    noTemplate: string;
  };
};

function FieldInput({
  field,
  value,
  onChange,
  locale,
}: {
  field: CatalogFieldDef;
  value: string;
  onChange: (v: string) => void;
  locale: string;
}) {
  const label = pickL10n(field.label as L10n, locale);
  if (field.type === "select" && field.options?.length) {
    return (
      <div className={FORM_FIELD_GROUP_CLASS}>
        <label className={MODAL_FIELD_LABEL_CLASS}>
          {label}
          {field.required ? " *" : ""}
        </label>
        <select className={MODAL_INPUT_CLASS} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">—</option>
          {field.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
    );
  }
  if (field.type === "boolean") {
    return (
      <label className="flex items-center gap-2 text-[13px]">
        <input
          type="checkbox"
          checked={value === "true"}
          onChange={(e) => onChange(e.target.checked ? "true" : "false")}
        />
        {label}
      </label>
    );
  }
  if (field.type === "textarea") {
    return (
      <div className={FORM_FIELD_GROUP_CLASS}>
        <label className={MODAL_FIELD_LABEL_CLASS}>
          {label}
          {field.required ? " *" : ""}
        </label>
        <textarea
          className={MODAL_INPUT_CLASS}
          rows={2}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  }
  return (
    <div className={FORM_FIELD_GROUP_CLASS}>
      <label className={MODAL_FIELD_LABEL_CLASS}>
        {label}
        {field.unit ? ` (${field.unit})` : ""}
        {field.required ? " *" : ""}
      </label>
      <input
        className={MODAL_INPUT_CLASS}
        type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function TemplateResultForm({
  item,
  metaFields = [],
  metaValues,
  onMetaChange,
  lines,
  onLinesChange,
  fieldValues,
  onFieldChange,
  labels,
}: Props) {
  const locale = useLocale();

  if (!item) {
    return <p className="text-[13px] text-[#7F8C8D]">{labels.noTemplate}</p>;
  }

  const isLab = item.kind === "lab_panel" && (item.analytes?.length ?? 0) > 0;
  const fields = item.fields ?? [];

  return (
    <div className={FORM_STACK_CLASS}>
      {metaFields.length > 0 && !isLab && (
        <div className="space-y-2">
          <p className="text-[12px] font-medium text-[#7F8C8D]">{labels.meta}</p>
          {metaFields.map((f) => (
            <FieldInput
              key={f.key}
              field={f}
              value={metaValues[f.key] ?? ""}
              onChange={(v) => onMetaChange(f.key, v)}
              locale={locale}
            />
          ))}
        </div>
      )}

      {isLab ? (
        <div className="space-y-2">
          <p className="text-[12px] font-medium text-[#7F8C8D]">{labels.analytes}</p>
          {(item.analytes as CatalogAnalyteDef[]).map((a, idx) => {
            const line = lines.find((l) => l.code === a.code) ?? {
              code: a.code,
              value: "",
              unit: a.unit,
              refMin: a.refMin,
              refMax: a.refMax,
            };
            const lineIdx = lines.findIndex((l) => l.code === a.code);
            return (
              <div key={a.code} className="grid grid-cols-[1fr_8rem] gap-2">
                <div className={FORM_FIELD_GROUP_CLASS}>
                  <label className={MODAL_FIELD_LABEL_CLASS}>
                    {pickL10n(a.label, locale)}
                    {a.unit ? ` (${a.unit})` : ""}
                  </label>
                  <div className="text-[11px] text-[#7F8C8D]">{a.code}</div>
                </div>
                <div className={FORM_FIELD_GROUP_CLASS}>
                  <label className={MODAL_FIELD_LABEL_CLASS}>{labels.value}</label>
                  <input
                    className={MODAL_INPUT_CLASS}
                    value={line.value}
                    onChange={(e) => {
                      const next = [...lines];
                      const row: ResultLineState = {
                        code: a.code,
                        value: e.target.value,
                        unit: a.unit,
                        refMin: a.refMin,
                        refMax: a.refMax,
                      };
                      if (lineIdx >= 0) next[lineIdx] = row;
                      else next.push(row);
                      onLinesChange(next);
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-[12px] font-medium text-[#7F8C8D]">{labels.fields}</p>
          {fields.map((f) => (
            <FieldInput
              key={f.key}
              field={f}
              value={fieldValues[f.key] ?? ""}
              onChange={(v) => onFieldChange(f.key, v)}
              locale={locale}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function linesFromAnalytes(analytes: CatalogAnalyteDef[]): ResultLineState[] {
  return analytes.map((a) => ({
    code: a.code,
    value: "",
    unit: a.unit,
    refMin: a.refMin,
    refMax: a.refMax,
  }));
}

export function structuredResultPayload(input: {
  item: DiagnosticCatalogItem;
  metaValues: Record<string, string>;
  fieldValues: Record<string, string>;
  lines: ResultLineState[];
}): { lines: ResultLineState[] } {
  if (input.item.kind === "lab_panel") {
    return { lines: input.lines.filter((l) => l.value.trim() !== "") };
  }
  const lines: ResultLineState[] = [];
  for (const [k, v] of Object.entries(input.metaValues)) {
    if (v.trim()) lines.push({ code: `meta.${k}`, value: v });
  }
  for (const [k, v] of Object.entries(input.fieldValues)) {
    if (v.trim()) lines.push({ code: k, value: v });
  }
  return { lines };
}
