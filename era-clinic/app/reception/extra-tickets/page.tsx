"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  PRIMARY_BUTTON_CLASS,
  MODAL_INPUT_CLASS,
  TEXT_MUTED_CLASS,
} from "@era/satellite-kit/ui";
import { PageHeader } from "@era/satellite-kit/ui";

type ExtraRow = {
  id: string;
  procedureName: string;
  amountNet: number;
  patientOrigin: string;
  scheduledAt: string;
  patientName: string;
  refCode: string;
  status?: string;
};

export default function ExtraTicketsPage() {
  const t = useTranslations("extraTickets");
  const [dualRun, setDualRun] = useState(false);
  const [rows, setRows] = useState<ExtraRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receiptRef, setReceiptRef] = useState("");

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

  const selectedTotal = useMemo(() => {
    return rows
      .filter((r) => selected.has(r.id))
      .reduce((s, r) => s + Number(r.amountNet || 0), 0);
  }, [rows, selected]);

  async function issue() {
    if (!selected.size) return;
    if (!receiptRef.trim()) {
      setError(t("receiptRequired", { defaultValue: "Enter payment receipt / cheque reference" }));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/procedures/issue-ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderIds: [...selected],
          paymentReceiptRef: receiptRef.trim(),
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || t("issueFailed"));
        return;
      }
      const payload = d.data ?? d;
      const printPaths = (payload.printPaths as string[] | undefined) ?? [];
      const printPath = (payload.printPath as string | undefined) ?? printPaths[0];
      // CLI-57 field: 3 noisy windows per procedure (1 sheet each).
      for (const path of printPaths.length ? printPaths : printPath ? [printPath] : []) {
        const base = path.includes("?") ? `${path}&sheets=1` : `${path}?sheets=1`;
        for (let i = 0; i < 3; i++) {
          window.open(`${base}&copy=${i + 1}`, `_blank_ticket_${Date.now()}_${i}`);
        }
      }
      setSelected(new Set());
      setReceiptRef("");
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
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <label className="text-[12px]">
            {t("receiptRef", { defaultValue: "Payment receipt / cheque #" })}
            <input
              className={`${MODAL_INPUT_CLASS} mt-1 min-w-[16rem]`}
              value={receiptRef}
              onChange={(e) => setReceiptRef(e.target.value)}
              placeholder={t("receiptPlaceholder", { defaultValue: "Required before Pay" })}
            />
          </label>
          <div className="flex flex-col items-end gap-1">
            {selected.size > 0 ? (
              <p className={`text-[12px] ${TEXT_MUTED_CLASS}`}>
                {t("selectedTotal", { defaultValue: "Selected total" })}:{" "}
                {selectedTotal.toFixed(2)} AZN
              </p>
            ) : null}
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={busy || selected.size === 0}
              onClick={() => void issue()}
            >
              {t("pay", { defaultValue: "Pay" })}
            </button>
          </div>
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
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="p-2">
                  <input
                    type="checkbox"
                    checked={selected.has(r.id)}
                    onChange={() => toggle(r.id)}
                  />
                </td>
                <td className="p-2">
                  {r.patientName}
                  <div className={`text-[11px] ${TEXT_MUTED_CLASS}`}>{r.refCode}</div>
                </td>
                <td className="p-2">{r.procedureName}</td>
                <td className="p-2">{Number(r.amountNet).toFixed(2)}</td>
                <td className="p-2">{r.patientOrigin}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
