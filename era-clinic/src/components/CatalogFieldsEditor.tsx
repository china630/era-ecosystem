"use client";

import {
  Field,
  FieldSelect,
  FieldTextarea,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TEXT_MUTED_CLASS,
} from "@era/satellite-kit/ui";
import type { CatalogFieldDef, L10n } from "@/domain/catalog/diagnostic-catalog-shared";

const FIELD_TYPES = ["text", "textarea", "number", "select", "boolean", "date"] as const;

type Labels = {
  fieldsTitle: string;
  addField: string;
  key: string;
  type: string;
  labelEn: string;
  labelRu: string;
  labelAz: string;
  unit: string;
  required: string;
  options: string;
  optionsHint: string;
  moveUp: string;
  moveDown: string;
  empty: string;
  remove: string;
};

type Props = {
  value: CatalogFieldDef[];
  onChange: (next: CatalogFieldDef[]) => void;
  labels: Labels;
};

function emptyField(): CatalogFieldDef {
  return {
    key: "",
    type: "text",
    label: { en: "", ru: "", az: "" },
    required: false,
  };
}

function ensureL10n(label: L10n | undefined): L10n {
  return {
    en: label?.en ?? "",
    ru: label?.ru ?? "",
    az: label?.az ?? "",
  };
}

export function parseCatalogFieldsJson(raw: string | null | undefined): CatalogFieldDef[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((row) => {
      const r = row as CatalogFieldDef;
      return {
        key: String(r.key ?? ""),
        type: String(r.type ?? "text"),
        label: ensureL10n(r.label),
        unit: r.unit,
        required: !!r.required,
        options: Array.isArray(r.options) ? r.options.map(String) : undefined,
      };
    });
  } catch {
    return [];
  }
}

export function CatalogFieldsEditor({ value, onChange, labels }: Props) {
  function updateAt(index: number, patch: Partial<CatalogFieldDef>, labelPatch?: Partial<L10n>) {
    onChange(
      value.map((f, i) => {
        if (i !== index) return f;
        const label = { ...ensureL10n(f.label), ...(labelPatch ?? {}) };
        return { ...f, ...patch, label };
      }),
    );
  }

  function move(index: number, dir: -1 | 1) {
    const j = index + dir;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    const tmp = next[index]!;
    next[index] = next[j]!;
    next[j] = tmp;
    onChange(next);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className={`text-[12px] font-medium ${TEXT_MUTED_CLASS}`}>{labels.fieldsTitle}</p>
        <button
          type="button"
          className={SECONDARY_BUTTON_CLASS}
          onClick={() => onChange([...value, emptyField()])}
        >
          {labels.addField}
        </button>
      </div>
      {value.length === 0 ? (
        <p className={`text-[12px] ${TEXT_MUTED_CLASS}`}>{labels.empty}</p>
      ) : (
        value.map((field, index) => {
          const label = ensureL10n(field.label);
          return (
            <div key={index} className="space-y-2 rounded border p-3">
              <div className="flex flex-wrap gap-2">
                <Field
                  label={labels.key}
                  preset="code"
                  value={field.key}
                  onChange={(e) => updateAt(index, { key: e.target.value })}
                />
                <FieldSelect
                  label={labels.type}
                  preset="select"
                  value={field.type}
                  onChange={(e) => updateAt(index, { type: e.target.value })}
                >
                  {FIELD_TYPES.map((ty) => (
                    <option key={ty} value={ty}>
                      {ty}
                    </option>
                  ))}
                </FieldSelect>
                <Field
                  label={labels.unit}
                  preset="shortText"
                  value={field.unit ?? ""}
                  onChange={(e) => updateAt(index, { unit: e.target.value || undefined })}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Field
                  label={labels.labelEn}
                  preset="shortText"
                  value={label.en}
                  onChange={(e) => updateAt(index, {}, { en: e.target.value })}
                />
                <Field
                  label={labels.labelRu}
                  preset="shortText"
                  value={label.ru}
                  onChange={(e) => updateAt(index, {}, { ru: e.target.value })}
                />
                <Field
                  label={labels.labelAz}
                  preset="shortText"
                  value={label.az}
                  onChange={(e) => updateAt(index, {}, { az: e.target.value })}
                />
              </div>
              {field.type === "select" && (
                <FieldTextarea
                  label={labels.options}
                  hint={labels.optionsHint}
                  rows={2}
                  value={(field.options ?? []).join("\n")}
                  onChange={(e) =>
                    updateAt(index, {
                      options: e.target.value
                        .split("\n")
                        .map((x) => x.trim())
                        .filter(Boolean),
                    })
                  }
                />
              )}
              <label className="flex items-center gap-2 text-[13px]">
                <input
                  type="checkbox"
                  checked={!!field.required}
                  onChange={(e) => updateAt(index, { required: e.target.checked })}
                />
                {labels.required}
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => move(index, -1)}>
                  {labels.moveUp}
                </button>
                <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => move(index, 1)}>
                  {labels.moveDown}
                </button>
                <button
                  type="button"
                  className={PRIMARY_BUTTON_CLASS}
                  onClick={() => onChange(value.filter((_, i) => i !== index))}
                >
                  {labels.remove}
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
