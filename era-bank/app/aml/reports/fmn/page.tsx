"use client";

import { useState } from "react";
import {
  CARD_CONTAINER_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";

export default function FmnReportPage() {
  const [periodFrom, setPeriodFrom] = useState("2026-01-01");
  const [periodTo, setPeriodTo] = useState("2026-01-31");
  const [reportId, setReportId] = useState<string | null>(null);
  const [raw, setRaw] = useState("");

  async function generate() {
    const res = await fetch("/api/aml/reports/fmn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ periodFrom, periodTo }),
    });
    const text = await res.text();
    setRaw(text);
    try {
      const json = JSON.parse(text) as { id?: string };
      if (json.id) setReportId(json.id);
    } catch {
      /* ignore */
    }
  }

  function download(format: "json" | "xml") {
    if (!reportId) return;
    window.open(`/api/aml/reports/fmn/${reportId}/export?format=${format}`, "_blank");
  }

  return (
    <div className="space-y-6">
      <PageHeader title="FMN report" subtitle="Suspicious transaction export (test schema)" />
      <div className={CARD_CONTAINER_CLASS}>
        <div className="mb-3 grid gap-2 sm:grid-cols-2">
          <input
            type="date"
            className="rounded border px-3 py-2 text-sm"
            value={periodFrom}
            onChange={(e) => setPeriodFrom(e.target.value)}
          />
          <input
            type="date"
            className="rounded border px-3 py-2 text-sm"
            value={periodTo}
            onChange={(e) => setPeriodTo(e.target.value)}
          />
        </div>
        <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void generate()}>
          Generate FMN report
        </button>
        {reportId && (
          <div className="mt-4 flex gap-2">
            <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => download("json")}>
              Download JSON
            </button>
            <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => download("xml")}>
              Download XML
            </button>
          </div>
        )}
        {raw && <pre className="mt-4 overflow-auto text-xs">{raw}</pre>}
      </div>
    </div>
  );
}
