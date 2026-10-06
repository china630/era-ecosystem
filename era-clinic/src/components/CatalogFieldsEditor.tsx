"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Pencil, Trash2 } from "lucide-react";
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  Field,
  FieldRow,
  FieldSelect,
  FieldTextarea,
  MODAL_CHECKBOX_CLASS,
  ModalFooter,
  ModalShell,
  SECONDARY_BUTTON_CLASS,
  TABLE_ROW_ICON_BTN_CLASS,
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
  columnTitle: string;
  unit: string;
  required: string;
  options: string;
  optionsHint: string;
  moveUp: string;
  moveDown: string;
  empty: string;
  remove: string;
  actions: string;
  edit: string;
  add: string;
  cancel: string;
  save: string;
  close: string;
};

type Props = {
  value: CatalogFieldDef[];
  onChange: (next: CatalogFieldDef[]) => void;
  labels: Labels;
  locale: string;
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

function localeLabel(label: L10n, locale: string): string {
  if (locale.startsWith("ru")) return label.ru || label.en || label.az;
  if (locale.startsWith("az")) return label.az || label.en || label.ru;
  return label.en || label.ru || label.az;
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

export function CatalogFieldsEditor({ value, onChange, labels, locale }: Props) {
  const [editOpen, setEditOpen] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<CatalogFieldDef>(emptyField());

  function openAdd() {
    setEditIndex(null);
    setDraft(emptyField());
    setEditOpen(true);
  }

  function openEdit(index: number) {
    const row = value[index];
    if (!row) return;
    setEditIndex(index);
    setDraft({
      ...row,
      label: ensureL10n(row.label),
      options: row.options ? [...row.options] : undefined,
    });
    setEditOpen(true);
  }

  function commitDraft() {
    const nextRow: CatalogFieldDef = {
      ...draft,
      key: draft.key.trim(),
      label: ensureL10n(draft.label),
      unit: draft.unit?.trim() || undefined,
      options:
        draft.type === "select"
          ? (draft.options ?? []).map((item) => item.trim()).filter(Boolean)
          : undefined,
    };
    if (editIndex == null) onChange([...value, nextRow]);
    else onChange(value.map((row, index) => (index === editIndex ? nextRow : row)));
    setEditOpen(false);
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

  const draftLabel = ensureL10n(draft.label);

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex shrink-0 justify-end">
          <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={openAdd}>
            {labels.addField}
          </button>
        </div>
        {value.length === 0 ? (
          <p className={`text-[13px] ${TEXT_MUTED_CLASS}`}>{labels.empty}</p>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto">
            <table className={DATA_TABLE_CLASS}>
              <thead>
                <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{labels.key}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{labels.type}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{labels.columnTitle}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{labels.unit}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{labels.required}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{labels.actions}</th>
                </tr>
              </thead>
              <tbody>
                {value.map((field, index) => {
                  const label = ensureL10n(field.label);
                  return (
                    <tr key={`${field.key}-${index}`} className={DATA_TABLE_TR_CLASS}>
                      <td className={DATA_TABLE_TD_CLASS}>{field.key || "—"}</td>
                      <td className={DATA_TABLE_TD_CLASS}>{field.type}</td>
                      <td className={DATA_TABLE_TD_CLASS}>{localeLabel(label, locale) || "—"}</td>
                      <td className={DATA_TABLE_TD_CLASS}>{field.unit || "—"}</td>
                      <td className={DATA_TABLE_TD_CLASS}>{field.required ? "✓" : "—"}</td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            className={TABLE_ROW_ICON_BTN_CLASS}
                            aria-label={labels.moveUp}
                            disabled={index === 0}
                            onClick={() => move(index, -1)}
                          >
                            <ChevronUp className="h-3.5 w-3.5" aria-hidden />
                          </button>
                          <button
                            type="button"
                            className={TABLE_ROW_ICON_BTN_CLASS}
                            aria-label={labels.moveDown}
                            disabled={index === value.length - 1}
                            onClick={() => move(index, 1)}
                          >
                            <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                          </button>
                          <button
                            type="button"
                            className={TABLE_ROW_ICON_BTN_CLASS}
                            aria-label={labels.edit}
                            onClick={() => openEdit(index)}
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden />
                          </button>
                          <button
                            type="button"
                            className={TABLE_ROW_ICON_BTN_CLASS}
                            aria-label={labels.remove}
                            onClick={() => onChange(value.filter((_, i) => i !== index))}
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <ModalShell
        open={editOpen}
        title={editIndex == null ? labels.add : labels.edit}
        closeLabel={labels.close}
        onClose={() => setEditOpen(false)}
        maxWidthClass="max-w-4xl w-full"
      >
        <div className="space-y-4">
          <FieldRow cols={3}>
            <Field
              label={labels.key}
              preset="code"
              value={draft.key}
              onChange={(e) => setDraft({ ...draft, key: e.target.value })}
            />
            <FieldSelect
              label={labels.type}
              preset="select"
              value={draft.type}
              onChange={(e) => setDraft({ ...draft, type: e.target.value })}
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
              value={draft.unit ?? ""}
              onChange={(e) => setDraft({ ...draft, unit: e.target.value || undefined })}
            />
          </FieldRow>
          <FieldRow cols={3}>
            <Field
              label={labels.labelEn}
              preset="shortText"
              value={draftLabel.en}
              onChange={(e) =>
                setDraft({ ...draft, label: { ...draftLabel, en: e.target.value } })
              }
            />
            <Field
              label={labels.labelRu}
              preset="shortText"
              value={draftLabel.ru}
              onChange={(e) =>
                setDraft({ ...draft, label: { ...draftLabel, ru: e.target.value } })
              }
            />
            <Field
              label={labels.labelAz}
              preset="shortText"
              value={draftLabel.az}
              onChange={(e) =>
                setDraft({ ...draft, label: { ...draftLabel, az: e.target.value } })
              }
            />
          </FieldRow>
          {draft.type === "select" ? (
            <FieldTextarea
              label={labels.options}
              hint={labels.optionsHint}
              rows={2}
              value={(draft.options ?? []).join("\n")}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  options: e.target.value
                    .split("\n")
                    .map((item) => item.trim())
                    .filter(Boolean),
                })
              }
            />
          ) : null}
          <label className="flex items-center gap-2 text-[13px]">
            <input
              className={MODAL_CHECKBOX_CLASS}
              type="checkbox"
              checked={!!draft.required}
              onChange={(e) => setDraft({ ...draft, required: e.target.checked })}
            />
            {labels.required}
          </label>
        </div>
        <ModalFooter
          onCancel={() => setEditOpen(false)}
          cancelLabel={labels.cancel}
          onSubmit={commitDraft}
          submitLabel={labels.save}
        />
      </ModalShell>
    </>
  );
}
