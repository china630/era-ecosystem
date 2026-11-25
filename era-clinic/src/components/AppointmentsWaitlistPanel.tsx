"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CARD_CONTAINER_CLASS, TEXT_MUTED_CLASS } from "@era/satellite-kit/ui";

type WaitlistRow = {
  id: string;
  patientName: string;
  patientRefCode: string;
  serviceCode: string | null;
  preferredFrom: string | null;
  status: string;
};

export function AppointmentsWaitlistPanel() {
  const t = useTranslations("waitlist");
  const [rows, setRows] = useState<WaitlistRow[]>([]);

  const load = useCallback(async () => {
    const res = await fetch("/api/waitlist");
    const data = await res.json();
    setRows((data.items ?? []) as WaitlistRow[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className={`${CARD_CONTAINER_CLASS} p-4`}>
      <h2 className="mb-2 text-sm font-semibold text-slate-800">{t("panelTitle")}</h2>
      {rows.length === 0 ? (
        <p className={`text-sm ${TEXT_MUTED_CLASS}`}>{t("empty")}</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {rows.slice(0, 8).map((r) => (
            <li key={r.id} className="flex flex-wrap justify-between gap-2 border-b border-slate-100 py-1">
              <span>
                {r.patientName} · {r.patientRefCode}
              </span>
              <span className={TEXT_MUTED_CLASS}>
                {r.serviceCode ?? "—"} · {r.preferredFrom ?? "—"} · {r.status}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-slate-500">
        <a href="/admin/waitlist" className="underline">
          {t("adminLink")}
        </a>
      </p>
    </section>
  );
}