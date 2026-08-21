"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  MODAL_INPUT_CLASS,
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

type RevRow = {
  id: string;
  title: string;
  status: string;
  createdAt?: string;
};

export default function StaffSchedulePage() {
  const { ready } = useRequireAuth();
  const t = useTranslations("workforceStaffSchedule");
  const [rows, setRows] = useState<RevRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [gated, setGated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await workforceFetch("staff-schedule");
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
    const data = (await res.json()) as RevRow[] | { items?: RevRow[] };
    setRows(Array.isArray(data) ? data : (data.items ?? []));
    setLoading(false);
  }, [t]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await workforceFetch("staff-schedule", {
        method: "POST",
        body: JSON.stringify({ title: title.trim() || t("defaultTitle") }),
      });
      if (!res.ok) {
        setError(t("createFailed"));
        return;
      }
      setTitle("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function act(id: string, action: "submit" | "approve") {
    setBusy(true);
    try {
      const res = await workforceFetch(`staff-schedule/${id}/${action}`, {
        method: "POST",
      });
      if (!res.ok) {
        setError(t("actionFailed"));
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function downloadPdf(id: string) {
    const res = await workforceFetch(`staff-schedule/${id}/pdf`);
    if (!res.ok) {
      setError(t("pdfFailed"));
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `staff-schedule-${id.slice(0, 8)}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!ready) return null;
  if (gated) return <WorkforceGate onEnabled={() => void load()} />;

  return (
    <div className="space-y-4">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className={`${CARD_CONTAINER_CLASS} flex flex-wrap gap-2 p-4`}>
        <input
          className={`${MODAL_INPUT_CLASS} min-w-[16rem] flex-1`}
          placeholder={t("titlePlaceholder")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <button
          type="button"
          className={PRIMARY_BUTTON_CLASS}
          disabled={busy}
          onClick={() => void create()}
        >
          {t("create")}
        </button>
      </div>
      <div className={CARD_CONTAINER_CLASS}>
        {loading ? (
          <p className="p-4 text-sm text-[#7F8C8D]">{t("loading")}</p>
        ) : (
          <ul className="divide-y divide-[#EBEDF0]">
            {rows.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
              >
                <span>
                  {r.title} · {r.status}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={SECONDARY_BUTTON_CLASS}
                    disabled={busy}
                    onClick={() => void act(r.id, "submit")}
                  >
                    {t("submit")}
                  </button>
                  <button
                    type="button"
                    className={SECONDARY_BUTTON_CLASS}
                    disabled={busy}
                    onClick={() => void act(r.id, "approve")}
                  >
                    {t("approve")}
                  </button>
                  <button
                    type="button"
                    className={SECONDARY_BUTTON_CLASS}
                    onClick={() => void downloadPdf(r.id)}
                  >
                    PDF
                  </button>
                </div>
              </li>
            ))}
            {rows.length === 0 ? (
              <li className="p-4 text-sm text-[#7F8C8D]">{t("empty")}</li>
            ) : null}
          </ul>
        )}
      </div>
    </div>
  );
}
