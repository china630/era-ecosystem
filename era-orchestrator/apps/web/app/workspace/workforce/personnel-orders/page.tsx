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

type OrderRow = {
  id: string;
  type: string;
  status: string;
  employmentId: string;
  effectiveDate: string;
  orderNumber?: string | null;
};

export default function PersonnelOrdersPage() {
  const { ready } = useRequireAuth();
  const t = useTranslations("workforceOrders");
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [gated, setGated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [employmentId, setEmploymentId] = useState("");
  const [type, setType] = useState("HIRE");
  const [effectiveDate, setEffectiveDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await workforceFetch("personnel-orders");
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
    const data = (await res.json()) as OrderRow[] | { items?: OrderRow[] };
    setRows(Array.isArray(data) ? data : (data.items ?? []));
    setLoading(false);
  }, [t]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  async function createOrder() {
    setBusy(true);
    setError(null);
    try {
      const res = await workforceFetch("personnel-orders", {
        method: "POST",
        body: JSON.stringify({
          employmentId: employmentId.trim(),
          type,
          effectiveDate,
          issue: false,
        }),
      });
      if (!res.ok) {
        setError(t("createFailed"));
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function issue(id: string) {
    setBusy(true);
    try {
      const res = await workforceFetch(`personnel-orders/${id}/issue`, {
        method: "POST",
      });
      if (!res.ok) {
        setError(t("issueFailed"));
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function downloadPdf(id: string) {
    const res = await workforceFetch(`personnel-orders/${id}/pdf`);
    if (!res.ok) {
      setError(t("pdfFailed"));
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `personnel-order-${id.slice(0, 8)}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!ready) return null;
  if (gated) return <WorkforceGate onEnabled={() => void load()} />;

  return (
    <div className="space-y-4">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
        <div className="flex flex-wrap gap-2">
          <input
            className={MODAL_INPUT_CLASS}
            placeholder={t("employmentId")}
            value={employmentId}
            onChange={(e) => setEmploymentId(e.target.value)}
          />
          <select
            className={MODAL_INPUT_CLASS}
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="HIRE">HIRE</option>
            <option value="TRANSFER">TRANSFER</option>
            <option value="TERMINATE">TERMINATE</option>
          </select>
          <input
            className={MODAL_INPUT_CLASS}
            type="date"
            value={effectiveDate}
            onChange={(e) => setEffectiveDate(e.target.value)}
          />
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={busy || !employmentId}
            onClick={() => void createOrder()}
          >
            {t("create")}
          </button>
        </div>
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
                  {r.type} · {r.status} · {r.effectiveDate.slice(0, 10)}
                  {r.orderNumber ? ` · ${r.orderNumber}` : ""}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={SECONDARY_BUTTON_CLASS}
                    disabled={busy}
                    onClick={() => void issue(r.id)}
                  >
                    {t("issue")}
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
