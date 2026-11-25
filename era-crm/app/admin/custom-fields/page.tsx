"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  CatalogField,
  Field,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";

type FieldDef = {
  id: string;
  entity: string;
  key: string;
  label: string;
  fieldType: string;
  optionsJson: string;
};

const FIELD_TYPES = ["TEXT", "NUMBER", "BOOL", "SELECT", "DATE"] as const;

export default function CustomFieldsAdminPage() {
  const t = useTranslations("customFields");
  const tc = useTranslations("common");
  const [items, setItems] = useState<FieldDef[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [fieldType, setFieldType] = useState<string>("TEXT");
  const [optionsRaw, setOptionsRaw] = useState("");

  const typeOptions = useMemo(
    () =>
      FIELD_TYPES.map((v) => ({
        value: v,
        label: t(`types.${v}`),
      })),
    [t],
  );

  async function load() {
    const res = await fetch("/api/custom-fields?entity=LEAD");
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Failed");
      return;
    }
    setItems(json.items ?? []);
    setError("");
  }

  useEffect(() => {
    void load();
  }, []);

  async function save() {
    if (!key.trim() || !label.trim()) return;
    setBusy(true);
    try {
      const options =
        fieldType === "SELECT"
          ? optionsRaw
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : [];
      const res = await fetch("/api/custom-fields", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: "LEAD",
          key: key.trim(),
          label: label.trim(),
          fieldType,
          options,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? tc("saveFailed"));
        return;
      }
      setKey("");
      setLabel("");
      setOptionsRaw("");
      setFieldType("TEXT");
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <PageHeader
        title={t("adminTitle")}
        subtitle={t("adminSubtitle")}
        actions={
          <Link href="/admin/settings" className={SECONDARY_BUTTON_CLASS}>
            {t("backSettings")}
          </Link>
        }
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <section className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
        <h2 className="font-medium">{t("addDef")}</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <Field
            label={t("key")}
            preset="code"
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
          <Field
            label={t("label")}
            preset="shortText"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <CatalogField
            kind="CLOSED_SMALL"
            label={t("fieldType")}
            value={fieldType}
            onChange={(v) => setFieldType(String(v))}
            options={typeOptions}
          />
          {fieldType === "SELECT" ? (
            <Field
              label={t("options")}
              preset="shortText"
              value={optionsRaw}
              onChange={(e) => setOptionsRaw(e.target.value)}
              placeholder={t("optionsHint")}
            />
          ) : null}
        </div>
        <button
          type="button"
          className={PRIMARY_BUTTON_CLASS}
          disabled={busy || !key.trim() || !label.trim()}
          onClick={() => void save()}
        >
          {tc("save")}
        </button>
      </section>

      <section className={`${CARD_CONTAINER_CLASS} p-4`}>
        <h2 className="mb-2 font-medium">{t("defsList")}</h2>
        <ul className="space-y-1 text-sm">
          {items.map((d) => (
            <li key={d.id}>
              <span className="font-mono text-[11px]">{d.key}</span>
              {" — "}
              {d.label} ({d.fieldType})
            </li>
          ))}
          {items.length === 0 ? (
            <li className="text-[#7F8C8D]">{t("emptyDefs")}</li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}
