"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { apiFetch } from "../../../lib/api-client";
import { parsePaginatedList } from "../../../lib/paginated-list";
import { formatMoneyAzn } from "../../../lib/format-money";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { useOrgPermissions } from "../../../lib/use-org-permissions";
import { PageHeader } from "../../../components/layout/page-header";
import { EmptyState } from "../../../components/empty-state";
import { ListPaginationFooter, DEFAULT_LIST_PAGE_SIZE } from "../../../components/list-pagination-footer";
import {
  ManualAdjustmentModal,
  type ManualAdjustmentPrefill,
} from "../../../components/accounting/manual-adjustment-modal";
import {
  CARD_CONTAINER_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TD_RIGHT_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TH_RIGHT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  MODAL_DIALOG_CONTENT_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  MODAL_FOOTER_ACTIONS_CLASS,
  MODAL_FOOTER_BUTTON_CLASS,
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "../../../lib/design-system";
import { Button } from "../../../components/ui/button";

type Row = {
  id: string;
  date: string;
  reference: string | null;
  reason: string | null;
  template: string | null;
  counterpartyName: string | null;
  basisLabel: string | null;
  basisInvoiceId: string | null;
  basisFixedAssetId: string | null;
  reversedById: string | null;
  canReverse: boolean;
  amount: string;
};

function monthBounds(): { from: string; to: string } {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() + 1;
  const pad = (n: number) => String(n).padStart(2, "0");
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(last)}` };
}

export default function ManualAdjustmentsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token, ready } = useRequireAuth();
  const { canPostAccounting } = useOrgPermissions();
  const b = monthBounds();
  const [from, setFrom] = useState(b.from);
  const [to, setTo] = useState(b.to);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_LIST_PAGE_SIZE);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [prefill, setPrefill] = useState<ManualAdjustmentPrefill | null>(null);
  const [reverseRow, setReverseRow] = useState<Row | null>(null);
  const [reverseDate, setReverseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reverseReason, setReverseReason] = useState("");
  const [reverseBusy, setReverseBusy] = useState(false);
  const [pdfBusyId, setPdfBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    const qs = new URLSearchParams({
      dateFrom: from,
      dateTo: to,
      page: String(page),
      pageSize: String(pageSize),
    });
    const res = await apiFetch(`/api/accounting/manual-adjustments?${qs.toString()}`);
    setLoading(false);
    if (!res.ok) {
      setErr(`${t("manualAdjustments.loadErr")}: ${res.status}`);
      setRows([]);
      return;
    }
    const parsed = parsePaginatedList<Row>(await res.json());
    setRows(parsed.items);
    setTotal(parsed.total);
  }, [token, from, to, page, pageSize, t]);

  useEffect(() => {
    if (!ready || !token) return;
    void load();
  }, [ready, token, load]);

  useEffect(() => {
    if (!ready || !token) return;
    const template = searchParams.get("template");
    const invoice = searchParams.get("invoice");
    const counterparty = searchParams.get("counterparty");
    const copyFrom = searchParams.get("copyFrom");
    if (!template && !copyFrom) return;

    void (async () => {
      if (copyFrom) {
        const res = await apiFetch(`/api/accounting/manual-adjustments/${copyFrom}`);
        if (!res.ok) return;
        const detail = (await res.json()) as {
          template: string | null;
          counterpartyId: string | null;
          basisInvoiceId: string | null;
          basisFixedAssetId: string | null;
          departmentId: string | null;
          lines: Array<{ accountCode: string; debit: string; credit: string }>;
        };
        setPrefill({
          template: (detail.template as ManualAdjustmentPrefill["template"]) ?? "FREEFORM",
          counterpartyId: detail.counterpartyId ?? undefined,
          basisInvoiceId: detail.basisInvoiceId ?? undefined,
          basisFixedAssetId: detail.basisFixedAssetId ?? undefined,
          departmentId: detail.departmentId ?? undefined,
          lines: detail.lines.map((l) => ({
            accountCode: l.accountCode,
            debit: l.debit,
            credit: l.credit,
          })),
        });
      } else {
        const next: ManualAdjustmentPrefill = {
          template: (template as ManualAdjustmentPrefill["template"]) ?? "FREEFORM",
        };
        if (invoice) next.basisInvoiceId = invoice;
        if (counterparty) next.counterpartyId = counterparty;
        setPrefill(next);
      }
      setModalOpen(true);
      router.replace("/accounting/adjustments", { scroll: false });
    })();
  }, [ready, token, searchParams, router]);

  async function downloadPdf(id: string) {
    setPdfBusyId(id);
    try {
      const res = await apiFetch(`/api/accounting/manual-adjustments/${id}/pdf`);
      if (!res.ok) {
        toast.error(t("manualAdjustments.pdfErr"), { description: String(res.status) });
        return;
      }
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = `adjustment-${id.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(href);
    } finally {
      setPdfBusyId(null);
    }
  }

  async function copyRow(row: Row) {
    const res = await apiFetch(`/api/accounting/manual-adjustments/${row.id}`);
    if (!res.ok) {
      toast.error(t("manualAdjustments.copyErr"));
      return;
    }
    const detail = (await res.json()) as {
      template: string | null;
      counterpartyId: string | null;
      basisInvoiceId: string | null;
      basisFixedAssetId: string | null;
      departmentId: string | null;
      lines: Array<{ accountCode: string; debit: string; credit: string }>;
    };
    setPrefill({
      template: (detail.template as ManualAdjustmentPrefill["template"]) ?? "FREEFORM",
      counterpartyId: detail.counterpartyId ?? undefined,
      basisInvoiceId: detail.basisInvoiceId ?? undefined,
      basisFixedAssetId: detail.basisFixedAssetId ?? undefined,
      departmentId: detail.departmentId ?? undefined,
      lines: detail.lines.map((l) => ({
        accountCode: l.accountCode,
        debit: l.debit,
        credit: l.credit,
      })),
    });
    setModalOpen(true);
  }

  async function submitReverse() {
    if (!reverseRow || reverseReason.trim().length < 10) return;
    setReverseBusy(true);
    const res = await apiFetch(
      `/api/accounting/manual-adjustments/${reverseRow.id}/reverse`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: reverseDate, reason: reverseReason.trim() }),
      },
    );
    setReverseBusy(false);
    if (!res.ok) {
      toast.error(t("manualAdjustments.reverseErr"), { description: await res.text() });
      return;
    }
    toast.success(t("manualAdjustments.reverseOk"));
    setReverseRow(null);
    setReverseReason("");
    void load();
  }

  function basisLink(row: Row) {
    if (!row.basisLabel) return "—";
    if (row.basisInvoiceId) {
      return (
        <Link
          href={`/sales/invoices?invoice=${encodeURIComponent(row.basisInvoiceId)}`}
          className="text-[#2980B9] hover:underline"
        >
          {row.basisLabel}
        </Link>
      );
    }
    if (row.basisFixedAssetId) {
      return (
        <Link
          href={`/fixed-assets?asset=${encodeURIComponent(row.basisFixedAssetId)}`}
          className="text-[#2980B9] hover:underline"
        >
          {row.basisLabel}
        </Link>
      );
    }
    return row.basisLabel;
  }

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
      <PageHeader
        title={t("manualAdjustments.title")}
        subtitle={t("manualAdjustments.subtitle")}
      />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-[13px] font-medium text-[#34495E]">
            {t("reporting.from")}
            <input
              type="date"
              className={MODAL_INPUT_CLASS}
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <label className="flex flex-col gap-1 text-[13px] font-medium text-[#34495E]">
            {t("reporting.to")}
            <input
              type="date"
              className={MODAL_INPUT_CLASS}
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(1);
              }}
            />
          </label>
        </div>
        {canPostAccounting ? (
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            onClick={() => {
              setPrefill(null);
              setModalOpen(true);
            }}
          >
            {t("manualAdjustments.newBtn")}
          </button>
        ) : null}
      </div>

      {err ? <p className="m-0 text-sm text-red-600">{err}</p> : null}

      {loading ? (
        <p className="text-[13px] text-[#7F8C8D]">{t("common.loading")}</p>
      ) : rows.length === 0 ? (
        <EmptyState
          title={t("manualAdjustments.empty")}
          description={t("manualAdjustments.emptyHint")}
        />
      ) : (
        <div className={`${CARD_CONTAINER_CLASS} overflow-hidden`}>
          <div className={DATA_TABLE_VIEWPORT_CLASS}>
            <table className={DATA_TABLE_CLASS}>
              <thead>
                <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("manualAdjustments.thDate")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("manualAdjustments.thRef")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("manualAdjustments.thReason")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("manualAdjustments.thBasis")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("manualAdjustments.thCounterparty")}</th>
                  <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("manualAdjustments.thAmount")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("manualAdjustments.thActions")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={DATA_TABLE_TR_CLASS}>
                    <td className={DATA_TABLE_TD_CLASS}>{r.date}</td>
                    <td className={`${DATA_TABLE_TD_CLASS} font-mono`}>{r.reference ?? "—"}</td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      {(r.reason ?? "").length > 80 ? `${(r.reason ?? "").slice(0, 80)}…` : r.reason}
                      {r.reversedById ? (
                        <span className="ml-2 text-[#7F8C8D]">({t("manualAdjustments.reversed")})</span>
                      ) : null}
                    </td>
                    <td className={DATA_TABLE_TD_CLASS}>{basisLink(r)}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{r.counterpartyName ?? "—"}</td>
                    <td className={DATA_TABLE_TD_RIGHT_CLASS}>{formatMoneyAzn(r.amount)}</td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          className={SECONDARY_BUTTON_CLASS}
                          disabled={pdfBusyId === r.id}
                          onClick={() => void downloadPdf(r.id)}
                        >
                          {pdfBusyId === r.id ? "…" : t("manualAdjustments.pdfBtn")}
                        </button>
                        {canPostAccounting && !r.reversedById ? (
                          <button
                            type="button"
                            className={SECONDARY_BUTTON_CLASS}
                            onClick={() => void copyRow(r)}
                          >
                            {t("manualAdjustments.copyBtn")}
                          </button>
                        ) : null}
                        {canPostAccounting && r.canReverse ? (
                          <button
                            type="button"
                            className={SECONDARY_BUTTON_CLASS}
                            onClick={() => {
                              setReverseRow(r);
                              setReverseDate(new Date().toISOString().slice(0, 10));
                              setReverseReason("");
                            }}
                          >
                            {t("manualAdjustments.reverseBtn")}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 pb-4">
            <ListPaginationFooter
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        </div>
      )}

      <ManualAdjustmentModal
        open={modalOpen}
        prefill={prefill}
        onClose={() => {
          setModalOpen(false);
          setPrefill(null);
        }}
        onPosted={() => void load()}
      />

      {reverseRow ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
          <div role="dialog" aria-modal="true" className={`${MODAL_DIALOG_CONTENT_CLASS} max-w-md`}>
            <h2 className="m-0 text-lg font-semibold text-[#34495E]">
              {t("manualAdjustments.reverseModalTitle")}
            </h2>
            <p className="mt-2 text-[13px] text-[#7F8C8D]">
              {reverseRow.reference ?? reverseRow.id.slice(0, 8)}
            </p>
            <div className="mt-4 space-y-3">
              <label className={MODAL_FIELD_LABEL_CLASS}>
                {t("manualAdjustments.date")}
                <input
                  type="date"
                  className={`mt-1 block w-full ${MODAL_INPUT_CLASS}`}
                  value={reverseDate}
                  onChange={(e) => setReverseDate(e.target.value)}
                />
              </label>
              <label className={MODAL_FIELD_LABEL_CLASS}>
                {t("manualAdjustments.reason")}
                <textarea
                  className={`mt-1 block w-full ${MODAL_INPUT_CLASS}`}
                  rows={3}
                  minLength={10}
                  value={reverseReason}
                  onChange={(e) => setReverseReason(e.target.value)}
                  placeholder={t("manualAdjustments.reasonPh")}
                />
              </label>
            </div>
            <div className={`${MODAL_FOOTER_ACTIONS_CLASS} mt-4`}>
              <Button
                type="button"
                variant="outline"
                className={MODAL_FOOTER_BUTTON_CLASS}
                disabled={reverseBusy}
                onClick={() => setReverseRow(null)}
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                variant="primary"
                className={MODAL_FOOTER_BUTTON_CLASS}
                disabled={reverseBusy || reverseReason.trim().length < 10}
                onClick={() => void submitReverse()}
              >
                {reverseBusy ? "…" : t("manualAdjustments.reverseSubmit")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
