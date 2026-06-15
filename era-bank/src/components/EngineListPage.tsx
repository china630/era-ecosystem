"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CARD_CONTAINER_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";

type EngineListPageProps = {
  title: string;
  subtitle: string;
  apiPath: string;
  engineNote?: string;
  emptyLabel?: string;
  refreshLabel?: string;
  errorLabel?: string;
  loadingLabel?: string;
};

function formatCell(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function EngineListPage({
  title,
  subtitle,
  apiPath,
  engineNote,
  emptyLabel = "No records",
  refreshLabel = "Refresh",
  errorLabel = "Request failed",
  loadingLabel = "Loading…",
}: EngineListPageProps) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [raw, setRaw] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiPath, { cache: "no-store" });
      const text = await res.text();
      setRaw(text);
      if (!res.ok) {
        setError(`${errorLabel} (${res.status})`);
        setRows([]);
        return;
      }
      let data: unknown = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        setError(errorLabel);
        return;
      }
      const list = Array.isArray(data)
        ? data
        : typeof data === "object" &&
            data &&
            Array.isArray((data as { items?: unknown[] }).items)
          ? (data as { items: Record<string, unknown>[] }).items
          : typeof data === "object" && data
            ? [data as Record<string, unknown>]
            : [];
      setRows(list);
      const keys = new Set<string>();
      for (const row of list.slice(0, 20)) {
        Object.keys(row).forEach((k) => keys.add(k));
      }
      setColumns(Array.from(keys).slice(0, 8));
    } catch {
      setError(errorLabel);
    } finally {
      setLoading(false);
    }
  }, [apiPath, errorLabel]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <div className={`${CARD_CONTAINER_CLASS} space-y-4 p-6`}>
        {engineNote ? (
          <p className="text-[12px] text-[#7F8C8D]">{engineNote}</p>
        ) : null}
        <div className="flex gap-2">
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            onClick={() => void load()}
          >
            {refreshLabel}
          </button>
        </div>
        {loading ? (
          <p className="text-[13px] text-[#7F8C8D]">{loadingLabel}</p>
        ) : null}
        {error ? (
          <p className="rounded border border-[#E74C3C]/30 bg-[#FDEDEC] px-3 py-2 text-[13px] text-[#C0392B]">
            {error}
          </p>
        ) : null}
        {!loading && !error && rows.length === 0 ? (
          <p className="text-[13px] text-[#7F8C8D]">{emptyLabel}</p>
        ) : null}
        {rows.length > 0 && columns.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-[12px]">
              <thead>
                <tr className="border-b border-[#D5DBDB] bg-[#F4F6F7]">
                  {columns.map((col) => (
                    <th key={col} className="px-3 py-2 font-semibold">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={idx} className="border-b border-[#ECF0F1]">
                    {columns.map((col) => (
                      <td key={col} className="px-3 py-2 align-top">
                        {formatCell(row[col])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {!loading && raw && rows.length <= 1 ? (
          <details className="text-[11px] text-[#7F8C8D]">
            <summary className="cursor-pointer">Raw engine JSON</summary>
            <pre className="mt-2 max-h-48 overflow-auto rounded bg-[#F8F9FA] p-2">
              {raw}
            </pre>
          </details>
        ) : null}
      </div>
    </>
  );
}

export function EngineActionPanel({
  title,
  subtitle,
  apiPath,
  method = "POST",
  defaultBody,
  engineNote,
  actionLabel = "Submit",
}: {
  title: string;
  subtitle: string;
  apiPath: string;
  method?: string;
  defaultBody?: string;
  engineNote?: string;
  actionLabel?: string;
}) {
  const [body, setBody] = useState(
    defaultBody ?? '{\n  "demo": true\n}',
  );
  const [result, setResult] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      const res = await fetch(apiPath, {
        method,
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body,
      });
      const text = await res.text();
      setResult(`${res.status}\n${text}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <div className={`${CARD_CONTAINER_CLASS} space-y-4 p-6`}>
        {engineNote ? (
          <p className="text-[12px] text-[#7F8C8D]">{engineNote}</p>
        ) : null}
        <textarea
          className="h-40 w-full rounded border border-[#D5DBDB] bg-white p-3 font-mono text-[12px]"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <button
          type="button"
          className={PRIMARY_BUTTON_CLASS}
          disabled={busy}
          onClick={() => void submit()}
        >
          {actionLabel}
        </button>
        {result ? (
          <pre className="max-h-64 overflow-auto rounded bg-[#F8F9FA] p-3 text-[11px]">
            {result}
          </pre>
        ) : null}
      </div>
    </>
  );
}
