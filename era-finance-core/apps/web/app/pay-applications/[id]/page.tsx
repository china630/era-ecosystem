"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../../lib/api-client";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { useSubscription } from "../../../lib/subscription-context";
import { PageHeader } from "../../../components/layout/page-header";
import { Badge } from "../../../components/ui/badge";
import { EmptyState } from "../../../components/empty-state";
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "../../../lib/design-system";

type PayAppDetail = {
  id: string;
  number: string;
  status: string;
  retentionPct?: string | number | null;
  amountGross?: string | null;
  amountRetention?: string | null;
  amountNet?: string | null;
  periodFrom?: string | null;
  periodTo?: string | null;
  contractId: string;
  contract?: { number?: string };
  lines?: {
    id: string;
    description?: string | null;
    amount?: string | null;
    contractLineId?: string | null;
  }[];
};

function hasPayAppModule(activeModules: string[], tier: string) {
  if (tier === "TIER_3") return true;
  return activeModules.includes("contract_payapp_ks");
}

export default function PayApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { token, ready } = useRequireAuth();
  const { ready: subReady, effectiveSnapshot: snapshot } = useSubscription();
  const tier = snapshot?.tier ? String(snapshot.tier).toUpperCase() : "";
  const locked =
    subReady && snapshot && !hasPayAppModule(snapshot.activeModules ?? [], tier);
  const [row, setRow] = useState<PayAppDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token || !id || locked) return;
    const res = await apiFetch(`/api/pay-applications/${id}`);
    if (!res.ok) {
      setErr(`${t("payApplications.loadErr")} (${res.status})`);
      return;
    }
    setRow(await res.json());
    setErr(null);
  }, [token, id, locked, t]);

  useEffect(() => {
    if (ready && token && !locked) void load();
  }, [ready, token, locked, load]);

  async function run(action: "submit" | "approve" | "post") {
    if (!row) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    const res = await apiFetch(`/api/pay-applications/${row.id}/${action}`, {
      method: "POST",
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErr(
        `${t("payApplications.actionErr")} (${res.status}${
          data?.message ? `: ${data.message}` : ""
        })`,
      );
      return;
    }
    setMsg(t(`payApplications.${action}`));
    await load();
  }

  if (!ready || !token) return null;

  if (locked) {
    return (
      <EmptyState
        title={t("payApplications.lockedTitle")}
        description={t("payApplications.lockedDesc")}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          row
            ? t("payApplications.detailTitle", { number: row.number })
            : t("payApplications.detailFallback")
        }
        subtitle={t("payApplications.subtitle")}
        actions={
          <Link href="/pay-applications" className={SECONDARY_BUTTON_CLASS}>
            {t("payApplications.title")}
          </Link>
        }
      />
      {err ? <p className="text-sm text-red-600">{err}</p> : null}
      {msg ? <p className="text-sm text-green-700">{msg}</p> : null}
      {row ? (
        <>
          <p className="text-sm text-gray-700">
            <Badge variant={row.status === "POSTED" ? "success" : "neutral"}>
              {row.status}
            </Badge>{" "}
            · {row.contract?.number ?? row.contractId}
            {row.periodFrom || row.periodTo
              ? ` · ${row.periodFrom ?? "—"} → ${row.periodTo ?? "—"}`
              : ""}
            {row.retentionPct != null ? ` · retention ${row.retentionPct}%` : ""}
          </p>
          <p className="text-sm">
            {t("payApplications.thNet")}: {row.amountNet ?? "—"} · gross{" "}
            {row.amountGross ?? "—"} · retention {row.amountRetention ?? "—"}
          </p>
          <div className="flex flex-wrap gap-2">
            {row.status === "DRAFT" ? (
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                disabled={busy}
                onClick={() => void run("submit")}
              >
                {t("payApplications.submit")}
              </button>
            ) : null}
            {row.status === "DRAFT" || row.status === "SUBMITTED" ? (
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                disabled={busy}
                onClick={() => void run("approve")}
              >
                {t("payApplications.approve")}
              </button>
            ) : null}
            {row.status === "APPROVED" ? (
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                disabled={busy}
                onClick={() => void run("post")}
              >
                {t("payApplications.post")}
              </button>
            ) : null}
            <a
              className={SECONDARY_BUTTON_CLASS}
              href={`/print/ks2/${row.id}`}
              target="_blank"
              rel="noreferrer"
            >
              {t("payApplications.ks2")}
            </a>
            <a
              className={SECONDARY_BUTTON_CLASS}
              href={`/print/ks3/${row.id}`}
              target="_blank"
              rel="noreferrer"
            >
              {t("payApplications.ks3")}
            </a>
          </div>
          {row.status === "APPROVED" || row.status === "POSTED" ? (
            <p className="text-xs text-[#7F8C8D]">{t("payApplications.frozenHint")}</p>
          ) : null}
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("contractDetail.thDesc")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("contractDetail.thAmount")}</th>
              </tr>
            </thead>
            <tbody>
              {(row.lines ?? []).map((l) => (
                <tr key={l.id} className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS}>{l.description ?? "—"}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{l.amount ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}
    </div>
  );
}
