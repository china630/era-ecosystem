"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  GHOST_BUTTON_CLASS,
  ListPaginationFooter,
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { orchFetch } from "../../../lib/orch-api";
import { useAuth } from "../../../lib/auth-context";
import { useListPagination } from "../../../lib/use-list-pagination";

export default function SuperAdminSecurityPage() {
  const t = useTranslations("superAdmin.security");
  const tCommon = useTranslations("common");
  const { token } = useAuth();
  const [orgId, setOrgId] = useState("");
  const [state, setState] = useState<Record<string, unknown> | null>(null);
  const [disputes, setDisputes] = useState<Array<Record<string, unknown>>>([]);
  const [disputeId, setDisputeId] = useState("");
  const [newStatus, setNewStatus] = useState("EVIDENCE_REVIEW");
  const [claimantUserId, setClaimantUserId] = useState("");
  const [incumbentUserId, setIncumbentUserId] = useState("");
  const [severity, setSeverity] = useState("STANDARD");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const { page, pageSize, setPage, setPageSize, paged, total } =
    useListPagination(disputes);

  async function load() {
    if (!token || !orgId.trim()) return;
    setError(null);
    setMessage(null);
    const id = orgId.trim();
    const [sRes, dRes] = await Promise.all([
      orchFetch(`/admin/organizations/${id}/security-state`, { token }),
      orchFetch(`/admin/organizations/${id}/disputes`, { token }),
    ]);
    if (!sRes.ok || !dRes.ok) {
      setError(t("loadFailed"));
      return;
    }
    setState((await sRes.json()) as Record<string, unknown>);
    const d = (await dRes.json()) as Array<Record<string, unknown>>;
    setDisputes(Array.isArray(d) ? d : []);
    setLoaded(true);
  }

  const DISPUTE_STATUSES = [
    "EVIDENCE_REQUIRED",
    "EVIDENCE_REVIEW",
    "INCUMBENT_NOTIFIED",
    "COOLDOWN",
    "APPROVED",
    "REJECTED",
    "EXECUTED",
    "REVERTED",
  ];

  function fmtValue(v: unknown): string {
    if (v == null) return "—";
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
  }

  async function patchDispute() {
    if (!token || !orgId.trim() || !disputeId.trim()) return;
    setError(null);
    const res = await orchFetch(
      `/admin/organizations/${orgId.trim()}/disputes/${disputeId.trim()}/status`,
      {
        method: "PATCH",
        token,
        body: JSON.stringify({ status: newStatus }),
      },
    );
    if (!res.ok) {
      setError(t("patchFailed"));
      return;
    }
    setMessage(t("statusUpdated"));
    await load();
  }

  async function openDispute() {
    if (!token || !orgId.trim() || !claimantUserId.trim() || !incumbentUserId.trim()) {
      setError(t("openRequired"));
      return;
    }
    setError(null);
    const res = await orchFetch(`/admin/organizations/${orgId.trim()}/disputes`, {
      method: "POST",
      token,
      body: JSON.stringify({
        claimantUserId: claimantUserId.trim(),
        incumbentUserId: incumbentUserId.trim(),
        severity,
      }),
    });
    if (!res.ok) {
      setError(t("openFailed"));
      return;
    }
    const created = (await res.json()) as { id?: string };
    if (created.id) setDisputeId(created.id);
    setMessage(t("openOk"));
    await load();
  }

  async function notifyDispute() {
    if (!token || !orgId.trim() || !disputeId.trim()) return;
    setError(null);
    const res = await orchFetch(
      `/admin/organizations/${orgId.trim()}/disputes/${disputeId.trim()}/notify`,
      { method: "POST", token },
    );
    if (!res.ok) {
      setError(t("notifyFailed"));
      return;
    }
    setMessage(t("notifyOk"));
    await load();
  }

  async function executeDispute() {
    if (!token || !orgId.trim() || !disputeId.trim()) return;
    if (!window.confirm(t("executeConfirm"))) return;
    setError(null);
    const res = await orchFetch(
      `/admin/organizations/${orgId.trim()}/disputes/${disputeId.trim()}/execute`,
      { method: "POST", token },
    );
    if (!res.ok) {
      setError(t("executeFailed"));
      return;
    }
    setMessage(t("executeOk"));
    await load();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      <div className={`${CARD_CONTAINER_CLASS} flex flex-wrap gap-2 p-4`}>
        <input
          className="h-9 min-w-[280px] flex-1 rounded-lg border border-[#D5DADF] px-3 text-sm"
          placeholder={t("orgIdPlaceholder")}
          value={orgId}
          onChange={(e) => setOrgId(e.target.value)}
        />
        <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void load()}>
          {t("load")}
        </button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

      <div className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
        <h2 className="text-sm font-semibold text-[#34495E]">{t("openTitle")}</h2>
        <div className="flex flex-wrap gap-2">
          <input
            className={MODAL_INPUT_CLASS}
            placeholder={t("claimantPlaceholder")}
            value={claimantUserId}
            onChange={(e) => setClaimantUserId(e.target.value)}
          />
          <input
            className={MODAL_INPUT_CLASS}
            placeholder={t("incumbentPlaceholder")}
            value={incumbentUserId}
            onChange={(e) => setIncumbentUserId(e.target.value)}
          />
          <select
            className="h-9 rounded-lg border border-[#D5DADF] px-3 text-sm"
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
          >
            <option value="STANDARD">STANDARD</option>
            <option value="HIGH">HIGH</option>
            <option value="CRITICAL">CRITICAL</option>
          </select>
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void openDispute()}>
            {t("openDispute")}
          </button>
        </div>
      </div>

      <div className={`${CARD_CONTAINER_CLASS} flex flex-wrap gap-2 p-4`}>
        <input
          className="h-9 min-w-[200px] rounded-lg border border-[#D5DADF] px-3 text-sm"
          placeholder={t("disputeIdPlaceholder")}
          value={disputeId}
          onChange={(e) => setDisputeId(e.target.value)}
        />
        <select
          className="h-9 rounded-lg border border-[#D5DADF] px-3 text-sm"
          value={newStatus}
          onChange={(e) => setNewStatus(e.target.value)}
        >
          {DISPUTE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void patchDispute()}>
          {t("updateDispute")}
        </button>
        <button type="button" className={GHOST_BUTTON_CLASS} onClick={() => void notifyDispute()}>
          {t("notify")}
        </button>
        <button type="button" className={GHOST_BUTTON_CLASS} onClick={() => void executeDispute()}>
          {t("execute")}
        </button>
      </div>

      {loaded ? (
        <>
          <div className={`${CARD_CONTAINER_CLASS} p-4`}>
            <h2 className="mb-2 text-sm font-semibold text-[#34495E]">{t("stateTitle")}</h2>
            {state ? (
              <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1.5 text-[13px]">
                {Object.entries(state).map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-[#7F8C8D]">{k}</dt>
                    <dd className="break-all text-[#34495E]">{fmtValue(v)}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm text-[#7F8C8D]">{t("noState")}</p>
            )}
          </div>

          <div className={CARD_CONTAINER_CLASS}>
            <div className="border-b border-[#D5DADF] px-3 py-2">
              <h2 className="text-sm font-semibold text-[#34495E]">{t("disputesTitle")}</h2>
            </div>
            {disputes.length === 0 ? (
              <p className="p-4 text-sm text-[#7F8C8D]">{t("noDisputes")}</p>
            ) : (
              <div className={DATA_TABLE_VIEWPORT_CLASS}>
                <table className={DATA_TABLE_CLASS}>
                  <thead>
                    <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                      <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colId")}</th>
                      <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colStatus")}</th>
                      <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colSeverity")}</th>
                      <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colCreated")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((d) => (
                      <tr
                        key={String(d.id)}
                        className={`${DATA_TABLE_TR_CLASS} cursor-pointer`}
                        onClick={() => setDisputeId(String(d.id))}
                      >
                        <td className={`${DATA_TABLE_TD_CLASS} font-mono text-xs`}>
                          {String(d.id)}
                        </td>
                        <td className={`${DATA_TABLE_TD_CLASS} font-medium`}>
                          {fmtValue(d.status)}
                        </td>
                        <td className={DATA_TABLE_TD_CLASS}>{fmtValue(d.severity)}</td>
                        <td className={DATA_TABLE_TD_CLASS}>{fmtValue(d.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <ListPaginationFooter
                  page={page}
                  pageSize={pageSize}
                  total={total}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                  labels={{
                    rowsPerPage: tCommon("paginationRowsPerPage"),
                    pageOf: tCommon("paginationPageOf"),
                    prev: tCommon("paginationPrev"),
                    next: tCommon("paginationNext"),
                  }}
                />
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
