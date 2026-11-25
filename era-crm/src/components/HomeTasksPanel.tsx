"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { todayBakuYmd } from "@era/satellite-kit/time";

type TaskRow = {
  id: string;
  title: string;
  dueAt?: string | null;
  leadId?: string | null;
  type?: string;
};

export default function HomeTasksPanel() {
  const t = useTranslations("homeTasks");
  const [items, setItems] = useState<TaskRow[]>([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/tasks");
    const json = (await res.json()) as { items?: TaskRow[]; error?: string };
    if (!res.ok) {
      setError(json.error ?? t("loadFailed"));
      return;
    }
    setItems(json.items ?? []);
    setError("");
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const { overdue, today } = useMemo(() => {
    const now = new Date();
    const todayYmd = todayBakuYmd(now);
    const overdueList: TaskRow[] = [];
    const todayList: TaskRow[] = [];
    for (const row of items) {
      if (!row.dueAt) continue;
      const due = new Date(row.dueAt);
      const dueYmd = todayBakuYmd(due);
      if (dueYmd < todayYmd) overdueList.push(row);
      else if (dueYmd === todayYmd) todayList.push(row);
    }
    return { overdue: overdueList, today: todayList };
  }, [items]);

  async function complete(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/tasks/${id}/complete`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result: "DONE" }),
      });
      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        setError(json.error ?? t("completeFailed"));
        return;
      }
      await load();
    } finally {
      setBusyId(null);
    }
  }

  function renderList(rows: TaskRow[], emptyKey: "emptyToday" | "emptyOverdue") {
    if (!rows.length) {
      return <p className="text-sm text-[#7F8C8D]">{t(emptyKey)}</p>;
    }
    return (
      <ul className="space-y-2">
        {rows.map((row) => (
          <li
            key={row.id}
            className="flex flex-wrap items-center justify-between gap-2 border-b border-[#ECEFF1] pb-2 text-sm last:border-0"
          >
            <div>
              <div className="font-medium text-[#2C3E50]">{row.title}</div>
              <div className="text-xs text-[#7F8C8D]">
                {row.dueAt
                  ? new Date(row.dueAt).toLocaleString("en-GB", {
                      timeZone: "Asia/Baku",
                    })
                  : "—"}
                {row.leadId ? (
                  <>
                    {" · "}
                    <Link
                      href={`/leads/${row.leadId}`}
                      className="text-[#2980B9] hover:underline"
                    >
                      {t("openLead")}
                    </Link>
                  </>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              disabled={busyId === row.id}
              onClick={() => void complete(row.id)}
            >
              {t("complete")}
            </button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-medium text-[#2C3E50]">{t("overdueTitle")}</h2>
          <span className="text-xs text-[#7F8C8D]">{overdue.length}</span>
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {renderList(overdue, "emptyOverdue")}
      </section>
      <section className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-medium text-[#2C3E50]">{t("todayTitle")}</h2>
          <span className="text-xs text-[#7F8C8D]">{today.length}</span>
        </div>
        {renderList(today, "emptyToday")}
        <Link href="/leads" className={`${PRIMARY_BUTTON_CLASS} inline-flex`}>
          {t("goPipeline")}
        </Link>
      </section>
    </div>
  );
}
