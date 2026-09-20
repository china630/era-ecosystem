"use client";

import { CatalogField } from "@era/satellite-kit/ui";
import type { CatalogFieldKind } from "@era/satellite-kit/ui";
import { useTranslation } from "react-i18next";
import { MODAL_FIELD_LABEL_CLASS, MODAL_INPUT_CLASS } from "../../lib/design-system";

export type ExtraFieldDefRow = {
  id: string;
  key: string;
  valueKind: "TEXT" | "NUMBER" | "DATE" | "BOOLEAN" | "SELECT";
  catalogFieldKind: CatalogFieldKind;
  labelAz: string;
  labelEn: string;
  labelRu: string;
  required: boolean;
  active: boolean;
  optionsJson?: Array<{
    value: string;
    labelAz?: string;
    labelEn?: string;
    labelRu?: string;
  }> | null;
};

export function missingRequiredExtraKeys(
  defs: ExtraFieldDefRow[],
  values: Record<string, unknown>,
): string[] {
  return defs
    .filter((d) => d.active && d.required)
    .filter((d) => {
      const val = values[d.key];
      if (val === undefined || val === null) return true;
      if (typeof val === "string" && val.trim() === "") return true;
      return false;
    })
    .map((d) => d.key);
}

function labelFor(
  row: ExtraFieldDefRow,
  lang: string,
): string {
  if (lang.startsWith("az")) return row.labelAz || row.labelEn;
  if (lang.startsWith("en")) return row.labelEn || row.labelAz;
  return row.labelRu || row.labelEn || row.labelAz;
}

export function ExtraAttributesBlock({
  defs,
  values,
  onChange,
  disabled,
}: {
  defs: ExtraFieldDefRow[];
  values: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  disabled?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const active = defs.filter((d) => d.active);
  if (active.length === 0) return null;

  const lang = i18n.language ?? "az";

  function setKey(key: string, v: unknown) {
    const next = { ...values };
    if (v === "" || v === undefined) delete next[key];
    else next[key] = v;
    onChange(next);
  }

  return (
    <div className="space-y-3 rounded-lg border border-[#D5DADF] bg-white p-3">
      <p className="m-0 text-sm font-semibold text-[#34495E]">
        {t("extraFields.blockTitle")}
      </p>
      {active.map((d) => {
        const label = labelFor(d, lang);
        const raw = values[d.key];
        if (d.valueKind === "SELECT") {
          const opts = (d.optionsJson ?? []).map((o) => ({
            value: o.value,
            label: labelFor(
              {
                ...d,
                labelAz: o.labelAz ?? o.value,
                labelEn: o.labelEn ?? o.value,
                labelRu: o.labelRu ?? o.value,
              },
              lang,
            ),
          }));
          return (
            <CatalogField
              key={d.key}
              kind="CLOSED_SMALL"
              label={label}
              required={d.required}
              value={typeof raw === "string" ? raw : ""}
              onChange={(next) => setKey(d.key, typeof next === "string" ? next : "")}
              options={opts}
              disabled={disabled}
            />
          );
        }
        if (d.valueKind === "BOOLEAN") {
          return (
            <CatalogField
              key={d.key}
              kind="CLOSED_SMALL"
              label={label}
              required={d.required}
              value={raw === true ? "true" : raw === false ? "false" : ""}
              onChange={(next) => {
                if (next === "true") setKey(d.key, true);
                else if (next === "false") setKey(d.key, false);
                else setKey(d.key, undefined);
              }}
              options={[
                { value: "true", label: t("extraFields.yes") },
                { value: "false", label: t("extraFields.no") },
              ]}
              disabled={disabled}
            />
          );
        }
        if (d.valueKind === "NUMBER") {
          return (
            <label key={d.key} className="block">
              <span className={MODAL_FIELD_LABEL_CLASS}>
                {label}
                {d.required ? <span className="text-[#E74C3C]"> *</span> : null}
              </span>
              <input
                type="number"
                step="any"
                disabled={disabled}
                className={MODAL_INPUT_CLASS}
                value={raw == null ? "" : String(raw)}
                onChange={(e) =>
                  setKey(d.key, e.target.value === "" ? undefined : e.target.value)
                }
              />
            </label>
          );
        }
        if (d.valueKind === "DATE") {
          return (
            <label key={d.key} className="block">
              <span className={MODAL_FIELD_LABEL_CLASS}>
                {label}
                {d.required ? <span className="text-[#E74C3C]"> *</span> : null}
              </span>
              <input
                type="date"
                disabled={disabled}
                className={MODAL_INPUT_CLASS}
                value={typeof raw === "string" ? raw : ""}
                onChange={(e) => setKey(d.key, e.target.value)}
              />
            </label>
          );
        }
        return (
          <CatalogField
            key={d.key}
            kind="FREE_TEXT"
            label={label}
            required={d.required}
            value={raw == null ? "" : String(raw)}
            onChange={(next) =>
              setKey(d.key, typeof next === "string" ? next : "")
            }
            options={[]}
            disabled={disabled}
          />
        );
      })}
    </div>
  );
}
