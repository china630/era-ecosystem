"use client";

import { DatePicker as FinanceDatePicker } from "../../../components/ui/date-picker";
import { CatalogField } from "@era/satellite-kit/ui";
import { useCallback, useEffect, useState } from "react";
import { bakuDateDisplay, todayBakuYmd } from "@era/satellite-kit/time";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { apiFetch } from "../../../lib/api-client";
import { parsePaginatedList } from "../../../lib/paginated-list";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { PageHeader } from "../../../components/layout/page-header";
import { EmptyState } from "../../../components/empty-state";
import { ListPaginationFooter } from "../../../components/list-pagination-footer";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  MODAL_CLOSE_BUTTON_CLASS,
  MODAL_DIALOG_CONTENT_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  MODAL_FOOTER_ACTIONS_CLASS,
  MODAL_FOOTER_BUTTON_CLASS,
  MODAL_INPUT_CLASS,
} from "../../../lib/design-system";

type ProtocolRow = {
  id: string;
  number: string;
  title: string;
  procedureType: string;
  protocolDate: string;
  status: string;
  winnerCounterparty?: { id: string; nameCipher?: string | null } | null;
  _count?: { bids: number };
};

export default function ProcurementProtocolsPage() {
  const { t } = useTranslation();
  const { token, ready } = useRequireAuth();
  const [rows, setRows] = useState<ProtocolRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [number, setNumber] = useState("");
  const [title, setTitle] = useState("");
  const [procedureType, setProcedureType] = useState("TENDER");
  const [protocolDate, setProtocolDate] = useState(() => todayBakuYmd());
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr(null);
    const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    const res = await apiFetch(`/api/procurement/protocols?${qs.toString()}`);
    if (!res.ok) {
      setErr(`${t("procurementProtocols.loadErr")} (${res.status})`);
      setRows([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    const parsed = parsePaginatedList<ProtocolRow>(await res.json());
    setRows(parsed.items);
    setTotal(parsed.total);
    setLoading(false);
  }, [token, page, pageSize, t]);

  useEffect(() => {
    if (!ready || !token) return;
    void load();
  }, [load, ready, token]);

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModalOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [modalOpen]);

  function typeLabel(code: string): string {
    const key = `procurementProtocols.type.${code}`;
    const label = t(key);
    return label === key ? code : label;
  }

  function statusLabel(code: string): string {
    const key = `procurementProtocols.status.${code}`;
    const label = t(key);
    return label === key ? code : label;
  }

  function openCreate() {
    setNumber("");
    setTitle("");
    setProcedureType("TENDER");
    setProtocolDate(todayBakuYmd());
    setModalOpen(true);
  }

  async function createProtocol() {
    if (!number.trim() || !title.trim()) return;
    setCreating(true);
    setErr(null);
    const res = await apiFetch("/api/procurement/protocols", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        number: number.trim(),
        title: title.trim(),
        procedureType,
        protocolDate,
      }),
    });
    setCreating(false);
    if (!res.ok) {
      setErr(`${t("procurementProtocols.createErr")} (${res.status})`);
      return;
    }
    setModalOpen(false);
    void load();
  }

  if (!ready) return null;
  if (!token) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("procurementProtocols.title")}
        subtitle={t("procurementProtocols.subtitle")}
        actions={
          <Button type="button" variant="primary" onClick={openCreate}>
            {t("procurementProtocols.createBtn")}
          </Button>
        }
      />

      {err ? <p className="text-sm text-red-600">{err}</p> : null}
      {loading ? <p className="text-[#7F8C8D]">{t("procurementProtocols.loading")}</p> : null}

      {!loading && (
        <>
          <div className={DATA_TABLE_VIEWPORT_CLASS}>
            <table className={`${DATA_TABLE_CLASS} min-w-full`}>
              <thead>
                <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("procurementProtocols.thNumber")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("procurementProtocols.thTitle")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("procurementProtocols.thType")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("procurementProtocols.thDate")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("procurementProtocols.thStatus")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("procurementProtocols.thBids")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr className={DATA_TABLE_TR_CLASS}>
                    <td colSpan={6} className={`${DATA_TABLE_TD_CLASS} py-10 text-center`}>
                      <EmptyState compact title={t("procurementProtocols.empty")} />
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className={DATA_TABLE_TR_CLASS}>
                      <td className={DATA_TABLE_TD_CLASS}>{row.number}</td>
                      <td className={DATA_TABLE_TD_CLASS}>{row.title}</td>
                      <td className={DATA_TABLE_TD_CLASS}>{typeLabel(row.procedureType)}</td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        {bakuDateDisplay(String(row.protocolDate).slice(0, 10))}
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        <Badge variant={row.status === "AWARDED" || row.status === "CLOSED" ? "success" : "neutral"}>
                          {statusLabel(row.status)}
                        </Badge>
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>{row._count?.bids ?? 0}</td>
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

      {modalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
        >
          <div
            className={`${MODAL_DIALOG_CONTENT_CLASS} max-w-lg`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="procurement-protocol-create-title"
          >
            <header className="flex shrink-0 items-start justify-between gap-3">
              <h3
                id="procurement-protocol-create-title"
                className="m-0 text-lg font-semibold text-[#34495E]"
              >
                {t("procurementProtocols.createTitle")}
              </h3>
              <Button
                type="button"
                variant="ghost"
                className={MODAL_CLOSE_BUTTON_CLASS}
                onClick={() => setModalOpen(false)}
                aria-label={t("common.close")}
              >
                <X className="h-4 w-4" aria-hidden />
              </Button>
            </header>
            <div className="mt-4 space-y-3 overflow-y-auto">
              <label className="block">
                <span className={MODAL_FIELD_LABEL_CLASS}>{t("procurementProtocols.thNumber")}</span>
                <input
                  className={`${MODAL_INPUT_CLASS} w-full`}
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                />
              </label>
              <label className="block">
                <span className={MODAL_FIELD_LABEL_CLASS}>{t("procurementProtocols.thTitle")}</span>
                <input
                  className={`${MODAL_INPUT_CLASS} w-full`}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <CatalogField
                kind="CLOSED_SMALL"
                label={t("procurementProtocols.thType")}
                value={procedureType}
                onChange={(next) => {
                  const v = Array.isArray(next) ? next[0] ?? "" : String(next ?? "");
                  if (v) setProcedureType(v);
                }}
                options={[
                  { value: "TENDER", label: t("procurementProtocols.type.TENDER") },
                  { value: "QUOTATION", label: t("procurementProtocols.type.QUOTATION") },
                  { value: "OTHER", label: t("procurementProtocols.type.OTHER") },
                ]}
              />
              <label className="block">
                <span className={MODAL_FIELD_LABEL_CLASS}>{t("procurementProtocols.thDate")}</span>
                <FinanceDatePicker
                  value={protocolDate}
                  onChange={(iso) => setProtocolDate(iso)}
                  respectPeriodLock={false}
                />
              </label>
            </div>
            <footer className={MODAL_FOOTER_ACTIONS_CLASS}>
              <Button
                type="button"
                variant="secondary"
                className={MODAL_FOOTER_BUTTON_CLASS}
                onClick={() => setModalOpen(false)}
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                variant="primary"
                className={MODAL_FOOTER_BUTTON_CLASS}
                disabled={creating || !number.trim() || !title.trim()}
                onClick={() => void createProtocol()}
              >
                {t("procurementProtocols.createBtn")}
              </Button>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  );
}
