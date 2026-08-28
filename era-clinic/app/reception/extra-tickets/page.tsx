"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CARD_CONTAINER_CLASS, PRIMARY_BUTTON_CLASS } from "@era/satellite-kit/ui";
import { PageHeader } from "@era/satellite-kit/ui";

type ExtraRow = {
  id: string;
  procedureName: string;
  amountNet: number;
  patientOrigin: string;
  scheduledAt: string;
  patientName: string;
  refCode: string;
};

export default function ExtraTicketsPage() {
  const t = useTranslations("extraTickets");
  const [dualRun, setDualRun] = useState(false);
  const [rows, setRows] = useState<ExtraRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/procedures/issue-ticket");
    const d = await res.json();
    const payload = d.data ?? d;
    setDualRun(!!payload.dualRun);
    setRows((payload.orders ?? []) as ExtraRow[]);
  }

  useEffect(() => {
    void load();
  }, []);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function issue() {
    if (!selected.size) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/procedures/issue-ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds: [...selected] }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || t("issueFailed"));
        return;
      }
      const payload = d.data ?? d;
      const printPaths = (payload.printPaths as string[] | undefined) ?? [];
      const printPath = (payload.printPath as string | undefined) ?? printPaths[0];
      for (const path of printPaths.length ? printPaths : printPath ? [printPath] : []) {
        window.open(path, "_blank");
      }
      setSelected(new Set());
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title={t("title")} subtitle={dualRun ? t("dualRunOn") : t("dualRunOff")} />
      <div className={CARD_CONTAINER_CLASS}>
        {error ? <p className="mb-2 text-sm text-red-600">{error}</p> : null}
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={busy || selected.size === 0}
            onClick={() => void issue()}
          >
            {t("issue")}
          </button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="p-2" />
              <th className="p-2">{t("patient")}</th>
              <th className="p-2">{t("procedure")}</th>
              <th className="p-2">{t("amount")}</th>
              <th className="p-2">{t("origin")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-slate-100">
                <td className="p-2">
                  <input
                    type="checkbox"
                    checked={selected.has(row.id)}
                    onChange={() => toggle(row.id)}
                  />
                </td>
                <td className="p-2">
                  {row.patientName} <span className="text-slate-400">{row.refCode}</span>
                </td>
                <td className="p-2">{row.procedureName}</td>
                <td className="p-2">{Number(row.amountNet).toFixed(2)} AZN</td>
                <td className="p-2">{row.patientOrigin}</td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td className="p-4 text-slate-500" colSpan={5}>
                  {t("empty")}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
