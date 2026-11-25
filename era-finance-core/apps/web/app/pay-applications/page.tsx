"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Field, ModalShell } from "@era/satellite-kit/ui";
import { todayBakuYmd } from "@era/satellite-kit/time";
import { DatePicker as FinanceDatePicker } from "../../components/ui/date-picker";
import { apiFetch } from "../../lib/api-client";
import { useRequireAuth } from "../../lib/use-require-auth";
import { useSubscription } from "../../lib/subscription-context";
import { PageHeader } from "../../components/layout/page-header";
import { EmptyState } from "../../components/empty-state";
import { FinanceEmptyTableRow } from "../../components/finance-empty-table-row";
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "../../lib/design-system";

type Row = {
  id: string;
  number: string;
  status: string;
  amountNet?: string;
  contract?: { number?: string };
};

function hasPayAppModule(activeModules: string[], tier: string) {
  if (tier === "TIER_3") return true;
  return activeModules.includes("contract_payapp_ks");
}

export default function PayApplicationsPage() {
  const { t } = useTranslation();
  const { token, ready } = useRequireAuth();
  const { ready: subReady, effectiveSnapshot: snapshot } = useSubscription();
  const tier = snapshot?.tier ? String(snapshot.tier).toUpperCase() : "";
  const locked =
    subReady && snapshot && !hasPayAppModule(snapshot.activeModules ?? [], tier);
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [number, setNumber] = useState("");
  const [contractId, setContractId] = useState("");
  const [periodFrom, setPeriodFrom] = useState(() => todayBakuYmd().slice(0, 8) + "01");
  const [periodTo, setPeriodTo] = useState(() => todayBakuYmd());
  const [retentionPct, setRetentionPct] = useState("0");

  const load = useCallback(async () => {
    if (!token || locked) return;
    const res = await apiFetch("/api/pay-applications?page=1&pageSize=50");
    if (!res.ok) {
      setErr(`${t("payApplications.loadErr")} (${res.status})`);
      return;
    }
    const data = await res.json();
    setRows(data.items ?? data ?? []);
    setErr(null);
  }, [token, locked, t]);

  useEffect(() => {
    if (ready && token && !locked) void load();
  }, [ready, token, locked, load]);

  async function createPayApp() {
    if (!number.trim() || !contractId.trim()) return;
    setBusy(true);
    setErr(null);
    const res = await apiFetch("/api/pay-applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        number: number.trim(),
        contractId: contractId.trim(),
        periodFrom: periodFrom || undefined,
        periodTo: periodTo || undefined,
        retentionPct: retentionPct.trim() ? Number(retentionPct) : 0,
        fromSov: true,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErr(
        `${t("payApplications.createErr")} (${res.status}${
          data?.message ? `: ${data.message}` : ""
        })`,
      );
      return;
    }
    setCreateOpen(false);
    setNumber("");
    setContractId("");
    await load();
  }

  if (!ready || !token) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("payApplications.title")}
        subtitle={t("payApplications.subtitle")}
        actions={
          <div className="flex flex-wrap gap-2">
            {!locked ? (
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                onClick={() => setCreateOpen(true)}
              >
                {t("payApplications.createBtn")}
              </button>
            ) : null}
            <Link href="/contracts" className={SECONDARY_BUTTON_CLASS}>
              {t("payApplications.contractsLink")}
            </Link>
          </div>
        }
      />
      {locked ? (
        <EmptyState
          title={t("payApplications.lockedTitle")}
          description={t("payApplications.lockedDesc")}
        />
      ) : (
        <>
          {err ? <p className="text-sm text-red-600">{err}</p> : null}
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("payApplications.thNumber")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("payApplications.thContract")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("payApplications.thStatus")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("payApplications.thNet")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("payApplications.thPrint")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <FinanceEmptyTableRow colSpan={5} message={t("payApplications.empty")} />
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className={DATA_TABLE_TR_CLASS}>
                    <td className={DATA_TABLE_TD_CLASS}>
                      <Link
                        href={`/pay-applications/${r.id}`}
                        className="text-blue-700 hover:underline"
                      >
                        {r.number}
                      </Link>
                    </td>
                    <td className={DATA_TABLE_TD_CLASS}>{r.contract?.number ?? "—"}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{r.status}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{r.amountNet ?? "—"}</td>
                    <td className={`${DATA_TABLE_TD_CLASS} space-x-2`}>
                      <a
                        className={PRIMARY_BUTTON_CLASS}
                        href={`/print/ks2/${r.id}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {t("payApplications.ks2")}
                      </a>
                      <a
                        className={SECONDARY_BUTTON_CLASS}
                        href={`/print/ks3/${r.id}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {t("payApplications.ks3")}
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </>
      )}

      {createOpen ? (
        <ModalShell
          title={t("payApplications.createTitle")}
          onClose={() => setCreateOpen(false)}
          closeLabel={t("common.close")}
          maxWidthClass="max-w-lg"
          footer={
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                onClick={() => setCreateOpen(false)}
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                disabled={busy || !number.trim() || !contractId.trim()}
                onClick={() => void createPayApp()}
              >
                {t("payApplications.createBtn")}
              </button>
            </div>
          }
        >
          <div className="space-y-3">
            <Field
              label={t("payApplications.number")}
              preset="shortText"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              required
            />
            <Field
              label={t("payApplications.contractId")}
              preset="shortText"
              value={contractId}
              onChange={(e) => setContractId(e.target.value)}
              required
            />
            <p className="text-xs text-[#7F8C8D]">{t("payApplications.fromSov")}</p>
            <label className="block">
              <span className="mb-1 block text-sm text-[#7F8C8D]">
                {t("payApplications.periodFrom")}
              </span>
              <FinanceDatePicker
                value={periodFrom}
                onChange={setPeriodFrom}
                fieldVariant="modal"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-[#7F8C8D]">
                {t("payApplications.periodTo")}
              </span>
              <FinanceDatePicker
                value={periodTo}
                onChange={setPeriodTo}
                fieldVariant="modal"
              />
            </label>
            <Field
              label={t("payApplications.retentionPct")}
              preset="shortText"
              value={retentionPct}
              onChange={(e) => setRetentionPct(e.target.value)}
            />
          </div>
        </ModalShell>
      ) : null}
    </div>
  );
}
