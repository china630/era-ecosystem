const fs = require("fs");
const content = `"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import {
  Field,
  FieldSelect,
  FieldTextarea,
  FORM_STACK_CLASS,
  MODAL_CHECKBOX_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  MODAL_INPUT_CLASS,
  TEXT_MUTED_CLASS,
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

type ImagingPhraseRow = {
  id: string;
  organKey: string;
  code: string;
  textEn: string;
  textRu: string;
  textAz: string;
};

type Props = {
  item: DiagnosticCatalogItem | null;
  metaFields?: CatalogFieldDef[];
  metaValues: Record<string, string>;
  onMetaChange: (key: string, value: string) => void;
  lines: ResultLineState[];
  onLinesChange: (lines: ResultLineState[]) => void;
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

const ROW_CLASS =
  "grid grid-cols-[minmax(10rem,1fr)_minmax(8rem,14rem)] items-start gap-x-3 gap-y-1";

function FieldInput({
  field,
  value,
  onChange,
  locale,
  phrases,
}: {
  field: CatalogFieldDef;
  value: string;
  onChange: (v: string) => void;
  locale: string;
  phrases?: ImagingPhraseRow[];
}) {
  const label = pickL10n(field.label as L10n, locale);
  const labelText = \`\${label}\${field.unit ? \` (\${field.unit})\` : ""}\`;
  const organPhrases = (phrases ?? []).filter((p) => p.organKey === field.key);

  if (
    organPhrases.length > 0 &&
    (field.type === "textarea" || field.type === "text" || !field.type)
  ) {
    return (
      <div className={ROW_CLASS}>
        <span className={MODAL_FIELD_LABEL_CLASS}>
          {labelText}
          {field.required ? <span className="text-[#E74C3C]"> *</span> : null}
        </span>
        <FieldSelect
          label={labelText}
          preset="select"
          className="!mt-0 [&>label]:sr-only"
          required={field.required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">—</option>
          {organPhrases.map((p) => (
            <option key={p.code} value={p.code}>
              {pickL10n({ en: p.textEn, ru: p.textRu, az: p.textAz }, locale).slice(0, 120)}
            </option>
          ))}
        </FieldSelect>
      </div>
    );
  }

  if (field.type === "boolean") {
    return (
      <label className={\`\${ROW_CLASS} text-[13px]\`}>
        <span className={MODAL_FIELD_LABEL_CLASS}>{labelText}</span>
        <input
          type="checkbox"
          className={\`\${MODAL_CHECKBOX_CLASS} mt-1\`}
          checked={value === "true"}
          onChange={(e) => onChange(e.target.checked ? "true" : "false")}
        />
      </label>
    );
  }

  if (field.type === "select" && field.options?.length) {
    return (
      <div className={ROW_CLASS}>
        <span className={MODAL_FIELD_LABEL_CLASS}>
          {labelText}
          {field.required ? <span className="text-[#E74C3C]"> *</span> : null}
        </span>
        <FieldSelect
          label={labelText}
          preset="select"
          className="!mt-0 [&>label]:sr-only"
          required={field.required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">—</option>
          {field.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </FieldSelect>
      </div>
    );
  }

  if (field.type === "textarea") {
    return (
      <div className={ROW_CLASS}>
        <span className={MODAL_FIELD_LABEL_CLASS}>
          {labelText}
          {field.required ? <span className="text-[#E74C3C]"> *</span> : null}
        </span>
        <FieldTextarea
          label={labelText}
          className="!mt-0 [&>label]:sr-only"
          required={field.required}
          rows={2}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  }

  return (
    <div className={ROW_CLASS}>
      <span className={MODAL_FIELD_LABEL_CLASS}>
        {labelText}
        {field.required ? <span className="text-[#E74C3C]"> *</span> : null}
      </span>
      <Field
        label={labelText}
        preset={field.type === "number" ? "count" : field.type === "date" ? "date" : "shortText"}
        className="!mt-0 [&>label]:sr-only"
        required={field.required}
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
  const [phrases, setPhrases] = useState<ImagingPhraseRow[]>([]);

  useEffect(() => {
    if (!item || item.kind === "lab_panel") return;
    void fetch("/api/imaging-phrases")
      .then((r) => r.json())
      .then((d) => {
        const rows = (d.data ?? d) as ImagingPhraseRow[];
        setPhrases(Array.isArray(rows) ? rows : []);
      })
      .catch(() => setPhrases([]));
  }, [item]);

  if (!item) {
    return <p className={\`text-[13px] \${TEXT_MUTED_CLASS}\`}>{labels.noTemplate}</p>;
  }

  const isLab = item.kind === "lab_panel" && (item.analytes?.length ?? 0) > 0;
  const fields = item.fields ?? [];

  return (
    <div className={FORM_STACK_CLASS}>
      {metaFields.length > 0 && !isLab && (
        <div className="space-y-2">
          <p className={\`text-[12px] font-medium \${TEXT_MUTED_CLASS}\`}>{labels.meta}</p>
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
          <div className={ROW_CLASS}>
            <p className={\`m-0 text-[12px] font-medium \${TEXT_MUTED_CLASS}\`}>{labels.analytes}</p>
            <p className={\`m-0 text-[12px] font-medium \${TEXT_MUTED_CLASS}\`}>{labels.value}</p>
          </div>
          {(item.analytes as CatalogAnalyteDef[]).map((a) => {
            const line = lines.find((l) => l.code === a.code) ?? {
              code: a.code,
              value: "",
              unit: a.unit,
              refMin: a.refMin,
              refMax: a.refMax,
            };
            const lineIdx = lines.findIndex((l) => l.code === a.code);
            const name = \`\${pickL10n(a.label, locale)}\${a.unit ? \` (\${a.unit})\` : ""}\`;
            const setValue = (value: string) => {
              const next = [...lines];
              const row: ResultLineState = {
                code: a.code,
                value,
                unit: a.unit,
                refMin: a.refMin,
                refMax: a.refMax,
              };
              if (lineIdx >= 0) next[lineIdx] = row;
              else next.push(row);
              onLinesChange(next);
            };
            const isQual = a.valueType === "QUALITATIVE" && (a.valueOptions?.length ?? 0) > 0;
            return (
              <div key={a.code} className={ROW_CLASS}>
                <div>
                  <p className="m-0 text-[13px] font-medium">{name}</p>
                  <p className={\`m-0 text-[11px] \${TEXT_MUTED_CLASS}\`}>{a.code}</p>
                </div>
                {isQual ? (
                  <FieldSelect
                    label={name}
                    preset="select"
                    className="!mt-0 [&>label]:sr-only"
                    value={line.value}
                    onChange={(e) => setValue(e.target.value)}
                  >
                    <option value="">—</option>
                    {a.valueOptions!.map((o) => (
                      <option key={o.code} value={o.code}>
                        {pickL10n(o.label, locale)}
                      </option>
                    ))}
                  </FieldSelect>
                ) : (
                  <input
                    type="text"
                    className={MODAL_INPUT_CLASS}
                    aria-label={name}
                    value={line.value}
                    onChange={(e) => setValue(e.target.value)}
                  />
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          <p className={\`text-[12px] font-medium \${TEXT_MUTED_CLASS}\`}>{labels.fields}</p>
          {fields.map((f) => (
            <FieldInput
              key={f.key}
              field={f}
              value={fieldValues[f.key] ?? ""}
              onChange={(v) => onFieldChange(f.key, v)}
              locale={locale}
              phrases={phrases}
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
  const phraseKeys = new Set(
    (input.item.fields ?? [])
      .filter((f) => f.type === "textarea" || f.type === "text" || !f.type)
      .map((f) => f.key),
  );
  const lines: ResultLineState[] = [];
  for (const [k, v] of Object.entries(input.metaValues)) {
    if (v.trim()) lines.push({ code: \`meta.\${k}\`, value: v });
  }
  for (const [k, v] of Object.entries(input.fieldValues)) {
    if (!v.trim()) continue;
    if (phraseKeys.has(k) && !/\\s/.test(v)) {
      lines.push({ code: \`phrase.\${k}\`, value: v });
    } else {
      lines.push({ code: k, value: v });
    }
  }
  return { lines };
}
`;

fs.writeFileSync("era-clinic/src/components/TemplateResultForm.tsx", content, "utf8");
console.log("TemplateResultForm rewritten");
