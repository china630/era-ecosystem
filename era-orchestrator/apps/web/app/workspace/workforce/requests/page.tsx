"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  EraListWorkspace,
  LIST_PAGE_SHELL_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { useRequireAuth } from "../../../../lib/use-require-auth";
import {
  isWorkforceGate403,
  workforceFetch as wfFetch,
} from "../../../../lib/workforce-fetch";
import { WorkforceGate } from "../../../../components/workspace/workforce-gate";

type Queue = {
  absences: Array<{
    id: string;
    kind: string;
    startDate: string;
    endDate: string;
    employment: { id: string; globalPersonId: string };
  }>;
  hourly: Array<{
    id: string;
    workDate: string;
    startMinute: number;
    endMinute: number;
    paid: boolean;
    employment: { id: string; globalPersonId: string };
  }>;
  advances: Array<{
    id: string;
    amountAzn: string | number;
    note: string;
    employment: { id: string; globalPersonId: string };
  }>;
  persons?: Record<string, { displayName?: string | null }>;
};

export default function WorkforceRequestsPage() {
  const { ready } = useRequireAuth();
  const t = useTranslations("workforceRequests");
  const [data, setData] = useState<Queue | null>(null);
  const [notEntitled, setNotEntitled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const res = await wfFetch("/requests");
    if (await isWorkforceGate403(res)) {
      setNotEntitled(true);
      return;
    }
    if (!res.ok) {
      setError(await res.text());
      return;
    }
    setData(await res.json());
  }, []);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  async function act(path: string) {
    setBusy(true);
    try {
      const res = await wfFetch(path, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    setBusy(true);
    try {
      const res = await wfFetch("/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: announce }),
      });
      if (!res.ok) throw new Error(await res.text());
      setAnnounce("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return null;
  if (notEntitled) return <WorkforceGate />;

  const name = (gid: string) =>
    data?.persons?.[gid]?.displayName ?? gid.slice(0, 8);

  return (
    <div className={LIST_PAGE_SHELL_CLASS}>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      {error ? <p className="text-sm text-red-600 mb-2">{error}</p> : null}

      <EraListWorkspace>
        <h2 className="font-semibold mb-2">{t("absences")}</h2>
        {(data?.absences ?? []).map((a) => (
          <div key={a.id} className="flex flex-wrap items-center gap-2 border-b py-2 text-sm">
            <span>{name(a.employment.globalPersonId)}</span>
            <span>{a.kind}</span>
            <span>
              {String(a.startDate).slice(0, 10)} – {String(a.endDate).slice(0, 10)}
            </span>
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={busy}
              onClick={() => void act(`/requests/absence/${a.id}/approve`)}
            >
              {t("approve")}
            </button>
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              disabled={busy}
              onClick={() => void act(`/requests/absence/${a.id}/reject`)}
            >
              {t("reject")}
            </button>
          </div>
        ))}

        <h2 className="font-semibold mt-6 mb-2">{t("hourly")}</h2>
        {(data?.hourly ?? []).map((h) => (
          <div key={h.id} className="flex flex-wrap items-center gap-2 border-b py-2 text-sm">
            <span>{name(h.employment.globalPersonId)}</span>
            <span>{String(h.workDate).slice(0, 10)}</span>
            <span>
              {h.startMinute}–{h.endMinute}
            </span>
            <span>{h.paid ? t("paid") : t("unpaid")}</span>
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={busy}
              onClick={() => void act(`/requests/hourly/${h.id}/approve`)}
            >
              {t("approve")}
            </button>
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              disabled={busy}
              onClick={() => void act(`/requests/hourly/${h.id}/reject`)}
            >
              {t("reject")}
            </button>
          </div>
        ))}

        <h2 className="font-semibold mt-6 mb-2">{t("advances")}</h2>
        {(data?.advances ?? []).map((a) => (
          <div key={a.id} className="flex flex-wrap items-center gap-2 border-b py-2 text-sm">
            <span>{name(a.employment.globalPersonId)}</span>
            <span>{Number(a.amountAzn).toFixed(2)} AZN</span>
            <span>{a.note}</span>
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={busy}
              onClick={() => void act(`/requests/advance/${a.id}/approve`)}
            >
              {t("approve")}
            </button>
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              disabled={busy}
              onClick={() => void act(`/requests/advance/${a.id}/reject`)}
            >
              {t("reject")}
            </button>
          </div>
        ))}
      </EraListWorkspace>

      <section className="mt-8 space-y-2 max-w-lg">
        <h2 className="font-semibold">{t("announce")}</h2>
        <textarea
          className="w-full rounded border p-2 text-sm"
          rows={3}
          value={announce}
          onChange={(e) => setAnnounce(e.target.value)}
        />
        <button
          type="button"
          className={PRIMARY_BUTTON_CLASS}
          disabled={busy || !announce.trim()}
          onClick={() => void publish()}
        >
          {t("publish")}
        </button>
      </section>
    </div>
  );
}
