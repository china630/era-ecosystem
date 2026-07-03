"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { CARD_CONTAINER_CLASS, FieldSelect, PRIMARY_BUTTON_CLASS, PageHeader } from "@era/satellite-kit/ui";

type ImportReport = {
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; message: string }[];
};

export default function AdminImportPage() {
  const t = useTranslations("import");
  const tc = useTranslations("common");
  const tNav = useTranslations("nav");
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<"upsert" | "create-only">("upsert");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [batchId, setBatchId] = useState<string | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);

  async function runImport() {
    if (!file) {
      setMessage(t("fileRequired"));
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/leads/import?mode=${mode}`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      setBatchId(data.batchId);
      setReport(data.report);
      setMessage(t("importDone", { batchId: data.batchId.slice(0, 8) }));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <Link href="/leads" className={PRIMARY_BUTTON_CLASS}>
            {tNav("leads")}
          </Link>
        }
      />
      <div className={`${CARD_CONTAINER_CLASS} p-6 space-y-4 max-w-xl`}>
        <p className="text-[13px] text-[#7F8C8D]">{t("hint")}</p>
        <label className="block text-[13px]">
          {t("fileLabel")}
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            className="mt-1 block w-full text-[13px]"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <FieldSelect
          label={t("mode")}
          preset="selectWide"
          value={mode}
          onChange={(e) => setMode(e.target.value as "upsert" | "create-only")}
        >
          <option value="upsert">{t("modeUpsert")}</option>
          <option value="create-only">{t("modeCreateOnly")}</option>
        </FieldSelect>
        <button
          type="button"
          className={PRIMARY_BUTTON_CLASS}
          disabled={busy || !file}
          onClick={() => void runImport()}
        >
          {busy ? tc("loading") : t("runImport")}
        </button>
        {message && <p className="text-[13px]">{message}</p>}
        {report && (
          <div className="rounded border p-3 text-[13px] space-y-2">
            <p>
              {t("reportCreated")}: {report.created} · {t("reportUpdated")}:{" "}
              {report.updated} · {t("reportSkipped")}: {report.skipped}
            </p>
            {report.errors.length > 0 && (
              <ul className="text-[12px] text-[#C0392B] max-h-40 overflow-auto">
                {report.errors.slice(0, 20).map((e) => (
                  <li key={`${e.row}-${e.message}`}>
                    Row {e.row}: {e.message}
                  </li>
                ))}
              </ul>
            )}
            {batchId && (
              <Link href={`/admin/import?batch=${batchId}`} className="text-[#2980B9] underline">
                {t("viewBatch")}
              </Link>
            )}
          </div>
        )}
      </div>
    </>
  );
}
