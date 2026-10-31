"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { bakuDateDisplay } from "@era/satellite-kit/time";
import { ModalShell } from "@era/satellite-kit/ui";
import { apiFetch } from "../../../lib/api-client";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { PageHeader } from "../../../components/layout/page-header";
import { EmptyState } from "../../../components/empty-state";
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
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "../../../lib/design-system";

type MoneyLine = {
  revenueCode: string;
  amount: number;
  vatRate?: number;
  glAccountCode?: string;
};
type RevenueLine = { revenueCode: string; amount: number; glAccountCode?: string };
type SaleLine = { sku: string; qty: number; amount: number; revenueCode?: string; glAccountCode?: string };
type QtyLine = { sku: string; qty: number; warehouseCode?: string; purpose: string };
type PayLine = { method: string; amount: number };
type CarryLine = { amount: number; kind: string };

type Lines = {
  moneyLines: MoneyLine[];
  qtyLines: QtyLine[];
  saleLines: SaleLine[];
  revenueLines: RevenueLine[];
  paymentLines: PayLine[];
  depositReceiptLines: PayLine[];
  depositCarryLines: CarryLine[];
  depositPayoutLines: PayLine[];
};

type Row = {
  id: string;
  businessDate: string;
  reference: string;
  errorMessage: string | null;
  lines: Lines;
};

function money(amount: number): string {
  return new Intl.NumberFormat("az-AZ", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function lineCount(lines: Lines | undefined): number {
  if (!lines) return 0;
  return (
    lines.moneyLines.length +
    lines.revenueLines.length +
    lines.saleLines.length +
    lines.qtyLines.length +
    lines.paymentLines.length +
    lines.depositReceiptLines.length +
    lines.depositCarryLines.length +
    lines.depositPayoutLines.length
  );
}

function Section({
  title,
  children,
  hasRows,
}: {
  title: string;
  hasRows: boolean;
  children: ReactNode;
}) {
  if (!hasRows) return null;
  return (
    <section className="mb-6">
      <h3 className="mb-2 text-sm font-semibold text-[#34495E]">{title}</h3>
      {children}
    </section>
  );
}

export default function HotelDayDocumentsPage() {
  const { t } = useTranslation();
  const { ready } = useRequireAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState<Row | null>(null);
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async () => {
    const res = await apiFetch("/api/reporting/hotel-day-documents");
    if (!res.ok) {
      toast.error(t("inventory.dayDocumentLoadError"));
      return;
    }
    const data = (await res.json()) as Row[];
    setRows(Array.isArray(data) ? data : []);
  }, [t]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  async function post(row: Row) {
    setBusyId(row.id);
    try {
      const res = await apiFetch(`/api/reporting/hotel-day-documents/${row.id}/post`, {
        method: "POST",
      });
      const body = (await res.json().catch(() => ({}))) as {
        message?: string;
        meta?: { error?: string };
      };
      if (!res.ok || body.meta?.error) {
        toast.error(body.meta?.error ?? body.message ?? t("inventory.dayDocumentPostError"));
        await load();
        return;
      }
      if (open?.id === row.id) setOpen(null);
      await load();
    } finally {
      setBusyId("");
    }
  }

  if (!ready) return null;

  const lines = open?.lines;

  return (
    <>
      <PageHeader title={t("inventory.dayDocumentTitle")} subtitle={t("inventory.dayDocumentHint")} />
      <section className={`${CARD_CONTAINER_CLASS} p-6`}>
        {rows.length === 0 ? (
          <EmptyState title={t("inventory.dayDocumentEmpty")} />
        ) : (
          <div className={DATA_TABLE_VIEWPORT_CLASS}>
            <table className={DATA_TABLE_CLASS}>
              <thead>
                <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("inventory.dayDocumentDate")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("inventory.dayDocumentError")}</th>
                  <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("inventory.dayDocumentLineCount")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS} />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className={DATA_TABLE_TR_CLASS}>
                    <td className={DATA_TABLE_TD_CLASS}>{bakuDateDisplay(row.businessDate)}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.errorMessage}</td>
                    <td className={DATA_TABLE_TD_RIGHT_CLASS}>{lineCount(row.lines)}</td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className={SECONDARY_BUTTON_CLASS}
                          onClick={() => setOpen(row)}
                        >
                          {t("inventory.dayDocumentOpen")}
                        </button>
                        <button
                          type="button"
                          className={PRIMARY_BUTTON_CLASS}
                          disabled={busyId === row.id}
                          onClick={() => void post(row)}
                        >
                          {t("inventory.dayDocumentPost")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {open && lines ? (
        <ModalShell
          title={bakuDateDisplay(open.businessDate)}
          subtitle={open.errorMessage ?? undefined}
          onClose={() => setOpen(null)}
          closeLabel={t("inventory.dayDocumentClose")}
          maxWidthClass="max-w-3xl"
          footer={
            <div className="flex justify-end gap-2">
              <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => setOpen(null)}>
                {t("inventory.dayDocumentClose")}
              </button>
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                disabled={busyId === open.id}
                onClick={() => void post(open)}
              >
                {t("inventory.dayDocumentPost")}
              </button>
            </div>
          }
        >
          <Section title={t("inventory.dayDocumentMoney")} hasRows={lines.moneyLines.length > 0}>
            <LineTable
              headers={[t("inventory.dayDocumentCode"), t("inventory.dayDocumentAccount"), t("inventory.dayDocumentVat"), t("inventory.dayDocumentAmount")]}
              rows={lines.moneyLines.map((line) => [
                line.revenueCode,
                line.glAccountCode || "—",
                String(line.vatRate ?? 0),
                money(line.amount),
              ])}
            />
          </Section>
          <Section title={t("inventory.dayDocumentRevenue")} hasRows={lines.revenueLines.length > 0}>
            <LineTable
              headers={[t("inventory.dayDocumentCode"), t("inventory.dayDocumentAccount"), t("inventory.dayDocumentAmount")]}
              rows={lines.revenueLines.map((line) => [
                line.revenueCode,
                line.glAccountCode || "—",
                money(line.amount),
              ])}
            />
          </Section>
          <Section title={t("inventory.dayDocumentSales")} hasRows={lines.saleLines.length > 0}>
            <LineTable
              headers={[t("inventory.dayDocumentSku"), t("inventory.dayDocumentQtyCol"), t("inventory.dayDocumentCode"), t("inventory.dayDocumentAmount")]}
              rows={lines.saleLines.map((line) => [
                line.sku,
                String(line.qty),
                line.revenueCode || "—",
                money(line.amount),
              ])}
            />
          </Section>
          <Section title={t("inventory.dayDocumentQty")} hasRows={lines.qtyLines.length > 0}>
            <LineTable
              headers={[t("inventory.dayDocumentSku"), t("inventory.dayDocumentQtyCol"), t("inventory.dayDocumentWarehouse"), t("inventory.dayDocumentPurpose")]}
              rows={lines.qtyLines.map((line) => [
                line.sku,
                String(line.qty),
                line.warehouseCode || "—",
                line.purpose ? t(`inventory.dayDocumentPurpose_${line.purpose}`, { defaultValue: line.purpose }) : "—",
              ])}
            />
          </Section>
          <Section title={t("inventory.dayDocumentPayments")} hasRows={lines.paymentLines.length > 0}>
            <PayTable lines={lines.paymentLines} method={t("inventory.dayDocumentMethod")} amount={t("inventory.dayDocumentAmount")} />
          </Section>
          <Section title={t("inventory.dayDocumentDepositIn")} hasRows={lines.depositReceiptLines.length > 0}>
            <PayTable lines={lines.depositReceiptLines} method={t("inventory.dayDocumentMethod")} amount={t("inventory.dayDocumentAmount")} />
          </Section>
          <Section title={t("inventory.dayDocumentDepositCarry")} hasRows={lines.depositCarryLines.length > 0}>
            <LineTable
              headers={[t("inventory.dayDocumentPurpose"), t("inventory.dayDocumentAmount")]}
              rows={lines.depositCarryLines.map((line) => [line.kind, money(line.amount)])}
            />
          </Section>
          <Section title={t("inventory.dayDocumentDepositOut")} hasRows={lines.depositPayoutLines.length > 0}>
            <PayTable lines={lines.depositPayoutLines} method={t("inventory.dayDocumentMethod")} amount={t("inventory.dayDocumentAmount")} />
          </Section>
          {lineCount(lines) === 0 ? (
            <p className="text-sm text-[#7F8C8D]">{t("inventory.dayDocumentEmptySection")}</p>
          ) : null}
        </ModalShell>
      ) : null}
    </>
  );
}

function LineTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <table className={DATA_TABLE_CLASS}>
      <thead>
        <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
          {headers.map((header) => (
            <th key={header} className={DATA_TABLE_TH_LEFT_CLASS}>
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((cells, index) => (
          <tr key={index} className={DATA_TABLE_TR_CLASS}>
            {cells.map((cell, cellIndex) => (
              <td
                key={cellIndex}
                className={cellIndex === cells.length - 1 ? DATA_TABLE_TD_RIGHT_CLASS : DATA_TABLE_TD_CLASS}
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PayTable({
  lines,
  method,
  amount,
}: {
  lines: PayLine[];
  method: string;
  amount: string;
}) {
  return (
    <LineTable
      headers={[method, amount]}
      rows={lines.map((line) => [line.method, money(line.amount)])}
    />
  );
}
