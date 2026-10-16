"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CatalogField,
  Field,
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from "@era/satellite-kit/ui";
import { URINE_BLANK_ROWS } from "@/domain/lab/urine-blank-rows";

type Row = { label: string; value: string; norm: string; analyteCode: string };

export function WordBlankMapper() {
  const t = useTranslations("labOrdersDetail");
  const tc = useTranslations("common");
  const [name, setName] = useState("");
  const [kind, setKind] = useState("TABLE");
  const [rows, setRows] = useState<Row[]>([]);
  const [options, setOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/admin/lab-blank-profiles");
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        showApiError(json, tc("loadingFailed"));
        return;
      }
      const list = (json.data?.analyteOptions ?? json.analyteOptions ?? []) as Array<{ value: string; label: string }>;
      setOptions(list);
    })();
  }, [tc]);

  async function readFile(file: File) {
    setBusy(true);
    try {
      const body = new FormData();
      body.set("file", file);
      const res = await fetch("/api/admin/lab-blank-profiles", { method: "PUT", body });
      const json = await res.json();
      if (!res.ok) {
        showApiError(json, t("loadWord"));
        return;
      }
      const parsed = (json.data?.rows ?? json.rows ?? []) as Array<{ label: string; value: string; norm: string }>;
      const known = new Map(URINE_BLANK_ROWS.map((row) => [row.label.toLowerCase(), row.code]));
      setRows(parsed.map((row) => ({ ...row, analyteCode: known.get(row.label.trim().toLowerCase()) ?? "" })));
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/lab-blank-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          kind,
          rows: rows
            .filter((row) => row.analyteCode.trim())
            .map((row) => ({ sourceLabel: row.label, analyteCode: row.analyteCode.trim() })),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        showApiError(json, tc("saveFailed"));
        return;
      }
      showSuccess(tc("saved"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-4 space-y-3 rounded-lg border border-[#D5DADF] bg-white p-4">
      <h2 className="text-sm font-medium">{t("loadWord")}</h2>
      <div className="flex flex-wrap items-end gap-2">
        <Field preset="shortText" label={tc("name")} value={name} onChange={(e) => setName(e.target.value)} />
        <CatalogField
          kind="CLOSED_SMALL"
          label={t("loadWord")}
          value={kind}
          onChange={(value) => setKind(String(value ?? "TABLE"))}
          options={[
            { value: "TABLE", label: "TABLE" },
            { value: "NARRATIVE", label: "NARRATIVE" },
          ]}
        />
        <button type="button" className={SECONDARY_BUTTON_CLASS} disabled={busy} onClick={() => fileRef.current?.click()}>
          {t("loadWord")}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".docx"
          className={`hidden ${MODAL_INPUT_CLASS}`}
          aria-label={t("loadWord")}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void readFile(file);
          }}
        />
      </div>
      <ul className="space-y-1">
        {rows.map((row, index) => (
          <li key={`${row.label}-${index}`} className="grid grid-cols-[1fr_16rem] items-center gap-2 text-sm">
            <span>{row.label}</span>
            <CatalogField
              kind="SEARCHABLE"
              label={row.label}
              value={row.analyteCode}
              onChange={(value) =>
                setRows((current) =>
                  current.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, analyteCode: String(value ?? "") } : item,
                  ),
                )
              }
              options={options}
            />
          </li>
        ))}
      </ul>
      <button type="button" className={PRIMARY_BUTTON_CLASS} disabled={busy || !name || rows.length === 0} onClick={() => void save()}>
        {tc("save")}
      </button>
    </section>
  );
}
