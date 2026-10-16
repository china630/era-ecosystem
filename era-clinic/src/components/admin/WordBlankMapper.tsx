"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  CatalogField,
  Field,
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TABLE_ROW_ICON_BTN_CLASS,
  showApiError,
  showSuccess,
} from "@era/satellite-kit/ui";
import { URINE_BLANK_ROWS } from "@/domain/lab/urine-blank-rows";

type Row = { label: string; value: string; norm: string; analyteCode: string };
type BlankProfile = {
  id: string;
  name: string;
  kind: "TABLE" | "NARRATIVE";
  serviceCode: string | null;
  rows: Array<{ sourceLabel: string; analyteCode: string }>;
};

export function WordBlankMapper() {
  const t = useTranslations("labOrdersDetail");
  const tc = useTranslations("common");
  const [profiles, setProfiles] = useState<BlankProfile[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState("TABLE");
  const [serviceCode, setServiceCode] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [options, setOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/lab-blank-profiles");
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      showApiError(json, tc("loadingFailed"));
      return;
    }
    const body = (json.data ?? json) as {
      profiles?: BlankProfile[];
      analyteOptions?: Array<{ value: string; label: string }>;
    };
    setProfiles(Array.isArray(body.profiles) ? body.profiles : []);
    setOptions(Array.isArray(body.analyteOptions) ? body.analyteOptions : []);
  }, [tc]);

  useEffect(() => {
    void load();
  }, [load]);

  function openProfile(profile: BlankProfile) {
    setEditingId(profile.id);
    setName(profile.name);
    setKind(profile.kind);
    setServiceCode(profile.serviceCode);
    setRows(
      profile.rows.map((row) => ({
        label: row.sourceLabel,
        value: "",
        norm: "",
        analyteCode: row.analyteCode,
      })),
    );
  }

  function startNew() {
    setEditingId(null);
    setName("");
    setKind("TABLE");
    setServiceCode(null);
    setRows([]);
  }

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
      const known = new Map(rows.map((row) => [row.label.trim().toLowerCase(), row.analyteCode]));
      for (const row of URINE_BLANK_ROWS) known.set(row.label.toLowerCase(), known.get(row.label.toLowerCase()) || row.code);
      setRows(
        parsed.map((row) => ({
          ...row,
          analyteCode: known.get(row.label.trim().toLowerCase()) ?? "",
        })),
      );
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
          id: editingId ?? undefined,
          name,
          kind,
          serviceCode,
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
      const saved = (json.data ?? json) as BlankProfile;
      if (saved?.id) openProfile(saved);
      showSuccess(tc("saved"));
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm(t("confirmDeleteBlank"))) return;
    const res = await fetch(`/api/admin/lab-blank-profiles?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      showApiError(json, tc("failed"));
      return;
    }
    if (editingId === id) startNew();
    showSuccess(t("blankDeleted"));
    await load();
  }

  return (
    <section className="mt-4 space-y-3 rounded-lg border border-[#D5DADF] bg-white p-4">
      <h2 className="text-sm font-medium">{t("savedBlanks")}</h2>
      {profiles.length === 0 ? <p className="text-sm text-[#7F8C8D]">{t("blankEmpty")}</p> : null}
      <ul className="space-y-2">
        {profiles.map((profile) => (
          <li key={profile.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="font-medium">{profile.name}</span>
            <span className="flex gap-1">
              <button
                type="button"
                className={TABLE_ROW_ICON_BTN_CLASS}
                aria-label={tc("edit")}
                onClick={() => openProfile(profile)}
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden />
              </button>
              <button
                type="button"
                className={TABLE_ROW_ICON_BTN_CLASS}
                aria-label={tc("delete")}
                onClick={() => void remove(profile.id)}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
              </button>
            </span>
          </li>
        ))}
      </ul>
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
        {editingId ? (
          <button type="button" className={SECONDARY_BUTTON_CLASS} disabled={busy} onClick={startNew}>
            {tc("add")}
          </button>
        ) : null}
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
