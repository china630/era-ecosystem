"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { useRequireAuth } from "../../../../lib/use-require-auth";
import {
  isWorkforceGate403,
  workforceFetch,
} from "../../../../lib/workforce-fetch";
import { WorkforceGate } from "../../../../components/workspace/workforce-gate";

type DraftRow = {
  id: string;
  employmentId?: string;
  workDate?: string;
  hours?: number;
  status?: string;
};

export default function TimesheetsPage() {
  const { ready } = useRequireAuth();
  const t = useTranslations("workforceTimesheets");
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [gated, setGated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await workforceFetch("timesheets/draft");
    if (await isWorkforceGate403(res)) {
      setGated(true);
      setLoading(false);
      return;
    }
    setGated(false);
    if (!res.ok) {
      setError(t("loadFailed"));
      setRows([]);
      setLoading(false);
      return;
    }
    const data = (await res.json()) as DraftRow[] | { items?: DraftRow[] };
    setRows(Array.isArray(data) ? data : (data.items ?? []));
    setSelected(new Set());
    setLoading(false);
  }, [t]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function approveSelected() {
    if (selected.size === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await workforceFetch("timesheets/approve", {
        method: "POST",
        body: JSON.stringify({ entryIds: Array.from(selected) }),
      });
      if (!res.ok) {
        setError(t("approveFailed"));
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return null;
  if (gated) return <WorkforceGate onEnabled={() => void load()} />;

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={busy || selected.size === 0}
            onClick={() => void approveSelected()}
          >
            {t("approveSelected")}
          </button>
        }
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className={CARD_CONTAINER_CLASS}>
        {loading ? (
          <p className="p-4 text-sm text-[#7F8C8D]">{t("loading")}</p>
        ) : (
          <ul className="divide-y divide-[#EBEDF0]">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <input
                  type="checkbox"
                  checked={selected.has(r.id)}
                  onChange={() => toggle(r.id)}
                />
                <span className="flex-1">
                  {r.workDate?.slice?.(0, 10) ?? "—"} · {r.hours ?? "—"}h ·{" "}
                  <code className="text-xs">{r.employmentId?.slice(0, 8) ?? r.id.slice(0, 8)}</code>
                </span>
              </li>
            ))}
            {rows.length === 0 ? (
              <li className="p-4 text-sm text-[#7F8C8D]">{t("empty")}</li>
            ) : null}
          </ul>
        )}
      </div>
      <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void load()}>
        {t("refresh")}
      </button>
    </div>
  );
}
