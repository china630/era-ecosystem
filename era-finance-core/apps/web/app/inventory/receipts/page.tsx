"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../../lib/api-client";
import { parsePaginatedList } from "../../../lib/paginated-list";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { subscribeListRefresh } from "../../../lib/list-refresh-bus";
import { PageHeader } from "../../../components/layout/page-header";
import { FinanceEmptyTableRow } from "../../../components/finance-empty-table-row";
import { ListPaginationFooter } from "../../../components/list-pagination-footer";
import { CreateReceiptModal } from "../../../components/inventory/create-receipt-modal";
import { bakuDateDisplay, bakuDateTimeDisplay } from "@era/satellite-kit/time";
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TD_RIGHT_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TH_RIGHT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "../../../lib/design-system";

type Movement = {
  id: string;
  type: string;
  reason: string;
  quantity: unknown;
  createdAt: string;
  documentDate?: string;
  note: string | null;
  product: { name: string; sku?: string };
  warehouse: { name: string };
  bin?: { code: string } | null;
};

function fmtQty(v: unknown): string {
  if (v == null) return "вЂ”";
  if (typeof v === "object" && v !== null && "toString" in v) {
    return String((v as { toString(): string }).toString());
  }
  return String(v);
}

function rowDate(m: Movement): string {
  if (m.documentDate) {
    return bakuDateDisplay(String(m.documentDate).slice(0, 10));
  }
  return bakuDateTimeDisplay(m.createdAt);
}

export default function InventoryReceiptsPage() {
  const { t } = useTranslation();
  const { token, ready } = useRequireAuth();
  const [rows, setRows] = useState<Movement[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        reason: "RECEIPT",
      });
      const res = await apiFetch(`/api/inventory/movements?${q.toString()}`);
      if (!res.ok) throw new Error(`movements ${res.status}`);
      const parsed = parsePaginatedList<Movement>(await res.json());
      setRows(parsed.items);
      setTotal(parsed.total);
    } catch (e) {
      setError(String(e));
    }
    setLoading(false);
  }, [token, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    if (!ready || !token) return;
    void load();
  }, [load, ready, token]);

  useEffect(() => {
    if (!ready || !token) return;
    return subscribeListRefresh("inventory-hub", () => void load());
  }, [load, ready, token]);

  if (!ready) {
    return (
      <div className="text-gray-600">
        <p>{t("common.loading")}</p>
      </div>
    );
  }
  if (!token) return null;

  return (
    <div className="space-y-6">
      <PageHeader title={t("inventory.receiptPageTitle")} />
      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setModalOpen(true)}>
          + {t("inventory.receiptNewBtn")}
        </button>
        <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void load()}>
          {t("inventory.refresh")}
        </button>
      </div>

      <CreateReceiptModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={() => void load()}
      />

      {loading && <p className="text-gray-600">{t("common.loading")}</p>}
      {!loading && (
        <>
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={`${DATA_TABLE_CLASS} min-w-full`}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("inventory.thMovDate")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("inventory.thWh")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("inventory.thProduct")}</th>
                <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("inventory.thQty")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("inventory.thBin")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("inventory.thNote")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                !error ? (
                  <FinanceEmptyTableRow
                    colSpan={6}
                    message={t("inventory.receiptEmptyTitle")}
                  />
                ) : null
              ) : (
              rows.map((m) => (
                <tr key={m.id} className={DATA_TABLE_TR_CLASS}>
                  <td className={`${DATA_TABLE_TD_RIGHT_CLASS} whitespace-nowrap`}>{rowDate(m)}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{m.warehouse.name}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{m.product.name}</td>
                  <td className={DATA_TABLE_TD_RIGHT_CLASS}>{fmtQty(m.quantity)}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{m.bin?.code ?? "вЂ”"}</td>
                  <td className={`${DATA_TABLE_TD_CLASS} max-w-[14rem] truncate`} title={m.note ?? ""}>
                    {m.note ?? "вЂ”"}
                  </td>
                </tr>
              ))
              )}
            </tbody>
          </table>
        </div>
        <ListPaginationFooter
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
        </>
      )}
    </div>
  );
}
