"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../../lib/api-client";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { PageHeader } from "../../../components/layout/page-header";
import { EmptyState } from "../../../components/empty-state";
import {
  CARD_CONTAINER_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "../../../lib/design-system";

type Row = {
  id: string;
  businessDate: string;
  reference: string;
  errorMessage: string | null;
};

export default function HotelDayDocumentsPage() {
  const { t } = useTranslation();
  const { ready } = useRequireAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async () => {
    const res = await apiFetch("/api/inventory/day-documents");
    if (!res.ok) {
      setError(t("inventory.dayDocumentLoadError"));
      return;
    }
    const data = (await res.json()) as Row[];
    setRows(Array.isArray(data) ? data : []);
    setError("");
  }, [t]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  async function post(id: string) {
    setBusyId(id);
    setError("");
    try {
      const res = await apiFetch(`/api/inventory/day-documents/${id}/post`, { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { message?: string; meta?: { error?: string } };
      if (!res.ok || body.meta?.error) {
        const message = body.meta?.error ?? body.message ?? t("inventory.dayDocumentPostError");
        await load();
        setError(message);
        return;
      }
      await load();
    } finally {
      setBusyId("");
    }
  }

  if (!ready) return null;

  return (
    <>
      <PageHeader title={t("inventory.dayDocumentTitle")} subtitle={t("inventory.dayDocumentHint")} />
      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}
      <section className={`${CARD_CONTAINER_CLASS} p-6`}>
        {rows.length === 0 ? (
          error ? null : <EmptyState title={t("inventory.dayDocumentEmpty")} />
        ) : (
          <div className={DATA_TABLE_VIEWPORT_CLASS}>
            <table className={DATA_TABLE_CLASS}>
              <thead>
                <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("inventory.dayDocumentDate")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("inventory.dayDocumentError")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS} />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className={DATA_TABLE_TR_CLASS}>
                    <td className={DATA_TABLE_TD_CLASS}>{row.businessDate}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.errorMessage}</td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      <button
                        type="button"
                        className={PRIMARY_BUTTON_CLASS}
                        disabled={busyId === row.id}
                        onClick={() => void post(row.id)}
                      >
                        {t("inventory.dayDocumentPost")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
