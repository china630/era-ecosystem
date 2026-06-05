"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { PageHeader } from "../../../components/layout/page-header";
import { ListPaginationFooter } from "../../../components/list-pagination-footer";
import { CreatePrepaidExpenseModal } from "../../../components/finance/modals/CreatePrepaidExpenseModal";
import { apiFetch } from "../../../lib/api-client";
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "../../../lib/design-system";
import { useRequireAuth } from "../../../lib/use-require-auth";

type Schedule = {
  id: string;
  period: string;
  amount: unknown;
  status: string;
};

type Row = {
  id: string;
  description: string | null;
  totalAmount: unknown;
  currency: string;
  startDate: string;
  endDate: string;
  status: string;
  expenseAccountCode: string;
  prepaidAccountCode: string;
  schedules: Schedule[];
};

export default function PrepaidExpensesPage() {
  const { t } = useTranslation();
  const { token, ready } = useRequireAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [periodById, setPeriodById] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!token) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const res = await apiFetch("/api/prepaid-expenses");
    if (!res.ok) {
      toast.error(await res.text());
      setRows([]);
    } else {
      setRows((await res.json()) as Row[]);
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [ready, load]);

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const visible = rows.slice((page - 1) * pageSize, page * pageSize);

  async function postMonth(id: string) {
    const period = periodById[id]?.trim();
    if (!period) {
      toast.error(t("prepaid.periodRequired", { defaultValue: "Dövr seçin" }));
      return;
    }
    const res = await apiFetch(`/api/prepaid-expenses/${id}/post-month`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ period }),
    });
    if (!res.ok) {
      toast.error(await res.text());
      return;
    }
    toast.success(t("common.save"));
    await load();
  }

  return (
    <div className="w-full max-w-none space-y-6">
      <PageHeader
        title={t("prepaid.title", { defaultValue: "RBP" })}
        actions={
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setModalOpen(true)}>
            + {t("prepaid.createBtn", { defaultValue: "Yarat" })}
          </button>
        }
      />

      {loading ? (
        <p>{t("common.loading")}</p>
      ) : (
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TD_CLASS}>{t("prepaid.description", { defaultValue: "Təsvir" })}</th>
                <th className={DATA_TABLE_TD_CLASS}>{t("prepaid.periodCol", { defaultValue: "Dövr" })}</th>
                <th className={DATA_TABLE_TD_CLASS}>{t("prepaid.total", { defaultValue: "Məbləğ" })}</th>
                <th className={DATA_TABLE_TD_CLASS}>{t("prepaid.statusCol", { defaultValue: "Status" })}</th>
                <th className={DATA_TABLE_TD_CLASS}>{t("common.actions", { defaultValue: "Əməliyyat" })}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.id} className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS}>{row.description ?? "—"}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {row.startDate.slice(0, 10)} — {row.endDate.slice(0, 10)}
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {String(row.totalAmount)} {row.currency}
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>{row.status}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="month"
                        className="h-8 rounded border px-2 text-sm"
                        value={periodById[row.id] ?? ""}
                        onChange={(e) =>
                          setPeriodById((m) => ({ ...m, [row.id]: e.target.value }))
                        }
                      />
                      <button
                        type="button"
                        className={SECONDARY_BUTTON_CLASS}
                        onClick={() => void postMonth(row.id)}
                      >
                        {t("prepaid.postMonth", { defaultValue: "Aya köçür" })}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ListPaginationFooter
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={setPage}
        onPageSizeChange={(n) => {
          setPageSize(n);
          setPage(1);
        }}
        loading={loading}
      />

      <CreatePrepaidExpenseModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={() => void load()}
      />
    </div>
  );
}
