"use client";

import { DatePicker as FinanceDatePicker } from "../../../components/ui/date-picker";
import { CatalogField, Field } from "@era/satellite-kit/ui";
import { useCallback, useEffect, useState } from "react";
import { bakuDateDisplay, todayBakuYmd } from "@era/satellite-kit/time";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import Link from "next/link";
import { apiFetch } from "../../../lib/api-client";
import { parsePaginatedList } from "../../../lib/paginated-list";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { useSubscription } from "../../../lib/subscription-context";
import { PageHeader } from "../../../components/layout/page-header";
import { EmptyState } from "../../../components/empty-state";
import { FinanceEmptyTableRow } from "../../../components/finance-empty-table-row";
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
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "../../../lib/design-system";

type ProtocolRow = {
  id: string;
  number: string;
  title: string;
  procedureType: string;
  protocolDate: string;
  status: string;
  winnerCounterparty?: { id: string; nameCipher?: string | null } | null;
  contract?: { id: string; number: string; status: string } | null;
  _count?: { bids: number };
};

type BidRow = {
  id: string;
  counterpartyId: string;
  amount: string | number;
  isWinner: boolean;
  note?: string | null;
  counterparty?: { id: string; nameCipher?: string | null } | null;
};

type ProtocolDetail = ProtocolRow & {
  bids: BidRow[];
  notes?: string | null;
};

function hasTendersPro(activeModules: string[], tier: string) {
  if (tier === "TIER_3") return true;
  return activeModules.includes("procurement_tenders_pro");
}

export default function ProcurementProtocolsPage() {
  const { t } = useTranslation();
  const { token, ready } = useRequireAuth();
  const { ready: subReady, effectiveSnapshot: snapshot } = useSubscription();
  const tier = snapshot?.tier ? String(snapshot.tier).toUpperCase() : "";
  const tendersLocked =
    subReady &&
    snapshot &&
    !hasTendersPro(snapshot.activeModules ?? [], tier);
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
  const [detail, setDetail] = useState<ProtocolDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [bidCpId, setBidCpId] = useState("");
  const [bidAmount, setBidAmount] = useState("");
  const [selectedWinnerId, setSelectedWinnerId] = useState("");
  const [cpOptions, setCpOptions] = useState<{ value: string; label: string }[]>(
    [],
  );

  const loadCounterparties = useCallback(
    async (q: string) => {
      if (!token) return;
      const qs = new URLSearchParams({ search: q, limit: "20" });
      const res = await apiFetch(`/api/counterparties?${qs.toString()}`);
      if (!res.ok) return;
      const data = await res.json();
      const items = Array.isArray(data) ? data : data.items ?? data.data ?? [];
      setCpOptions(
        items.map((c: { id: string; name?: string; nameCipher?: string | null }) => ({
          value: c.id,
          label: c.name ?? c.nameCipher ?? c.id,
        })),
      );
    },
    [token],
  );

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

  const loadDetail = useCallback(
    async (id: string) => {
      setDetailLoading(true);
      setErr(null);
      const res = await apiFetch(`/api/procurement/protocols/${id}`);
      setDetailLoading(false);
      if (!res.ok) {
        setErr(`${t("procurementProtocols.loadErr")} (${res.status})`);
        setDetail(null);
        return;
      }
      const data = (await res.json()) as ProtocolDetail;
      setDetail(data);
      const marked = data.bids?.find((b) => b.isWinner)?.id ?? data.bids?.[0]?.id ?? "";
      setSelectedWinnerId(marked);
    },
    [t],
  );

  useEffect(() => {
    if (!ready || !token) return;
    void load();
    void loadCounterparties("");
  }, [load, loadCounterparties, ready, token]);

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

  async function runLifecycle(path: "open" | "award" | "cancel") {
    if (!detail) return;
    setActionBusy(true);
    setErr(null);
    const body =
      path === "award"
        ? JSON.stringify({
            winnerBidId: selectedWinnerId || undefined,
            contractType: "CONSTRUCTION",
          })
        : undefined;
    const res = await apiFetch(`/api/procurement/protocols/${detail.id}/${path}`, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body,
    });
    setActionBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErr(
        `${t(`procurementProtocols.${path}Err`)} (${res.status}${
          data?.message ? `: ${data.message}` : ""
        })`,
      );
      return;
    }
    await load();
    await loadDetail(detail.id);
  }

  async function addBid() {
    if (!detail || !bidCpId.trim() || !bidAmount.trim()) return;
    if (detail.status === "REGISTERED" || detail.status === "AWARDED" || detail.status === "CANCELLED") {
      setErr(t("procurementProtocols.bidsLocked"));
      return;
    }
    setActionBusy(true);
    setErr(null);
    const nextBids = [
      ...(detail.bids ?? []).map((b) => ({
        counterpartyId: b.counterpartyId,
        amount: Number(b.amount),
        isWinner: b.isWinner,
        note: b.note ?? undefined,
      })),
      {
        counterpartyId: bidCpId.trim(),
        amount: Number(bidAmount),
        isWinner: (detail.bids?.length ?? 0) === 0,
      },
    ];
    const res = await apiFetch(`/api/procurement/protocols/${detail.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bids: nextBids }),
    });
    setActionBusy(false);
    if (!res.ok) {
      setErr(`${t("procurementProtocols.bidAddErr")} (${res.status})`);
      return;
    }
    setBidCpId("");
    setBidAmount("");
    await load();
    await loadDetail(detail.id);
  }

  if (!ready) return null;
  if (!token) return null;

  const canOpen =
    !tendersLocked &&
    detail &&
    (detail.status === "DRAFT" || detail.status === "REGISTERED");
  const canAward =
    !tendersLocked &&
    detail &&
    (detail.status === "OPEN" || detail.status === "REGISTERED") &&
    (detail.bids?.length ?? 0) > 0;
  const canCancel =
    !tendersLocked &&
    detail &&
    detail.status !== "AWARDED" &&
    detail.status !== "CANCELLED";
  const canAddBid =
    !tendersLocked &&
    detail &&
    detail.status !== "REGISTERED" &&
    detail.status !== "AWARDED" &&
    detail.status !== "CANCELLED";

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("procurementProtocols.title")}
        subtitle={t("procurementProtocols.subtitle")}
        actions={
          <Button
            type="button"
            variant="primary"
            onClick={openCreate}
            disabled={Boolean(tendersLocked)}
          >
            {t("procurementProtocols.createBtn")}
          </Button>
        }
      />

      {tendersLocked ? (
        <EmptyState
          title={t("procurementProtocols.lockedTitle")}
          description={t("procurementProtocols.lockedDesc")}
        />
      ) : null}

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
                  <FinanceEmptyTableRow
                    colSpan={6}
                    message={t("procurementProtocols.empty")}
                  />
                ) : (
                  rows.map((row) => (
                    <tr
                      key={row.id}
                      className={`${DATA_TABLE_TR_CLASS} cursor-pointer ${
                        detail?.id === row.id ? "bg-blue-50" : ""
                      }`}
                      onClick={() => void loadDetail(row.id)}
                    >
                      <td className={DATA_TABLE_TD_CLASS}>{row.number}</td>
                      <td className={DATA_TABLE_TD_CLASS}>{row.title}</td>
                      <td className={DATA_TABLE_TD_CLASS}>{typeLabel(row.procedureType)}</td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        {bakuDateDisplay(String(row.protocolDate).slice(0, 10))}
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        <Badge
                          variant={
                            row.status === "AWARDED" || row.status === "CLOSED"
                              ? "success"
                              : "neutral"
                          }
                        >
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

      {detailLoading ? (
        <p className="text-[#7F8C8D]">{t("procurementProtocols.loading")}</p>
      ) : null}

      {detail ? (
        <section className="space-y-3 rounded border p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-[#34495E]">
                {detail.number} · {detail.title}
              </h2>
              <p className="text-sm text-[#7F8C8D]">
                {statusLabel(detail.status)}
                {detail.contract ? (
                  <>
                    {" · "}
                    <Link
                      href={`/contracts/${detail.contract.id}`}
                      className="text-blue-700 hover:underline"
                    >
                      {t("procurementProtocols.contractRef", {
                        number: detail.contract.number,
                      })}
                    </Link>
                  </>
                ) : null}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {canOpen ? (
                <button
                  type="button"
                  className={SECONDARY_BUTTON_CLASS}
                  disabled={actionBusy}
                  onClick={() => void runLifecycle("open")}
                >
                  {t("procurementProtocols.openBtn")}
                </button>
              ) : null}
              {canAward ? (
                <button
                  type="button"
                  className={PRIMARY_BUTTON_CLASS}
                  disabled={actionBusy || !selectedWinnerId}
                  onClick={() => void runLifecycle("award")}
                >
                  {t("procurementProtocols.awardBtn")}
                </button>
              ) : null}
              {canCancel ? (
                <button
                  type="button"
                  className={SECONDARY_BUTTON_CLASS}
                  disabled={actionBusy}
                  onClick={() => void runLifecycle("cancel")}
                >
                  {t("procurementProtocols.cancelBtn")}
                </button>
              ) : null}
            </div>
          </div>

          <h3 className="text-sm font-semibold">{t("procurementProtocols.bidsTitle")}</h3>
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("procurementProtocols.thWinner")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("procurementProtocols.thCounterparty")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("procurementProtocols.thAmount")}</th>
              </tr>
            </thead>
            <tbody>
              {(detail.bids ?? []).length === 0 ? (
                <FinanceEmptyTableRow
                  colSpan={3}
                  message={t("procurementProtocols.bidsEmpty")}
                />
              ) : (
                (detail.bids ?? []).map((b) => (
                  <tr key={b.id} className={DATA_TABLE_TR_CLASS}>
                    <td className={DATA_TABLE_TD_CLASS}>
                      <input
                        type="radio"
                        name="winnerBid"
                        checked={selectedWinnerId === b.id}
                        disabled={detail.status === "AWARDED" || detail.status === "CANCELLED"}
                        onChange={() => setSelectedWinnerId(b.id)}
                        aria-label={t("procurementProtocols.thWinner")}
                      />
                    </td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      {b.counterparty?.nameCipher ?? b.counterpartyId}
                      {b.isWinner ? ` · ${t("procurementProtocols.markedWinner")}` : ""}
                    </td>
                    <td className={DATA_TABLE_TD_CLASS}>{String(b.amount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {canAddBid ? (
            <div className="flex flex-wrap items-end gap-3">
              <CatalogField
                kind="ENTITY_REF"
                label={t("procurementProtocols.thCounterparty")}
                value={bidCpId}
                onChange={(v) => setBidCpId(String(v))}
                options={cpOptions}
                onQueryChange={(q) => void loadCounterparties(q)}
                serverSearch
              />
              <Field
                label={t("procurementProtocols.thAmount")}
                preset="shortText"
                value={bidAmount}
                onChange={(e) => setBidAmount(e.target.value)}
              />
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                disabled={actionBusy || !bidCpId.trim() || !bidAmount.trim()}
                onClick={() => void addBid()}
              >
                {t("procurementProtocols.addBid")}
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

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
                  className={MODAL_INPUT_CLASS}
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                />
              </label>
              <label className="block">
                <span className={MODAL_FIELD_LABEL_CLASS}>{t("procurementProtocols.thTitle")}</span>
                <input
                  className={MODAL_INPUT_CLASS}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <CatalogField
                kind="CLOSED_SMALL"
                label={t("procurementProtocols.thType")}
                value={procedureType}
                onChange={(v) => setProcedureType(String(v))}
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
                  onChange={setProtocolDate}
                  fieldVariant="modal"
                />
              </label>
            </div>
            <footer className={MODAL_FOOTER_ACTIONS_CLASS}>
              <Button
                type="button"
                variant="ghost"
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
