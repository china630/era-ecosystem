"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../../lib/api-client";
import { parsePaginatedList } from "../../../lib/paginated-list";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { PageHeader } from "../../../components/layout/page-header";
import { EmptyState } from "../../../components/empty-state";
import { ListPaginationFooter } from "../../../components/list-pagination-footer";
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
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
  const [number, setNumber] = useState("");
  const [title, setTitle] = useState("");
  const [procedureType, setProcedureType] = useState("TENDER");
  const [protocolDate, setProtocolDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
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
    setNumber("");
    setTitle("");
    void load();
  }

  if (!ready) return null;
  if (!token) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("procurementProtocols.title")}
        subtitle={t("procurementProtocols.subtitle")}
      />

      <div className="flex flex-wrap items-end gap-3 rounded border border-[#D5DADF] bg-white p-4">
        <label className="flex flex-col gap-1 text-sm">
          <span>{t("procurementProtocols.thNumber")}</span>
          <input
            className={MODAL_INPUT_CLASS}
            value={number}
            onChange={(e) => setNumber(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>{t("procurementProtocols.thTitle")}</span>
          <input
            className={MODAL_INPUT_CLASS}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>{t("procurementProtocols.thType")}</span>
          <select
            className={MODAL_INPUT_CLASS}
            value={procedureType}
            onChange={(e) => setProcedureType(e.target.value)}
          >
            <option value="TENDER">TENDER</option>
            <option value="QUOTATION">QUOTATION</option>
            <option value="OTHER">OTHER</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>{t("procurementProtocols.thDate")}</span>
          <input
            type="date"
            className={MODAL_INPUT_CLASS}
            value={protocolDate}
            onChange={(e) => setProtocolDate(e.target.value)}
          />
        </label>
        <button
          type="button"
          className={PRIMARY_BUTTON_CLASS}
          disabled={creating || !number.trim() || !title.trim()}
          onClick={() => void createProtocol()}
        >
          {t("procurementProtocols.createBtn")}
        </button>
      </div>

      {err ? <p className="text-sm text-red-600">{err}</p> : null}
      {loading ? <p className="text-gray-600">{t("procurementProtocols.loading")}</p> : null}

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
                      <td className={DATA_TABLE_TD_CLASS}>{row.procedureType}</td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        {String(row.protocolDate).slice(0, 10)}
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>{row.status}</td>
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
    </div>
  );
}
