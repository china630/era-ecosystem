"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../../lib/api-client";
import { formatMoneyAzn } from "../../../lib/format-money";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { PageHeader } from "../../../components/layout/page-header";
import { SubscriptionPaywall } from "../../../components/subscription-paywall";
import { EmptyState } from "../../../components/empty-state";
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TD_RIGHT_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TH_RIGHT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "../../../lib/design-system";

type Balance = {
  accountCode: string;
  accountNameAz: string;
  balance: string;
  currency: string;
  linkedBankAccount: {
    id: string;
    iban: string;
    bankName: string;
    ledgerAccountCode: string;
  } | null;
};

type Movement = {
  id: string;
  kind: string;
  amount: string;
  note: string | null;
  createdAt: string;
  transaction: {
    id: string;
    reference: string | null;
    description: string | null;
    date: string;
  } | null;
};

type ReconcileResult = {
  difference: string;
  reconciled: boolean;
  gl: { netMovement: string; entryCount: number };
  bank: {
    bankName: string | null;
    iban: string | null;
    inflow: string;
    outflow: string;
    netMovement: string;
    lineCount: number;
    note: string;
  };
};

function parseApiError(data: unknown): string {
  if (!data || typeof data !== "object") return "Error";
  const payload = data as Record<string, unknown>;
  const m = payload.message;
  if (typeof m === "string") return m;
  if (Array.isArray(m)) return m.join("; ");
  return "Error";
}

function VatDepositPageInner() {
  const { t } = useTranslation();
  const { token, ready } = useRequireAuth();
  const [balance, setBalance] = useState<Balance | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [routePayment, setRoutePayment] = useState("");
  const [routeVat, setRouteVat] = useState("");
  const [remitAmount, setRemitAmount] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [reconcile, setReconcile] = useState<ReconcileResult | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    try {
      const [balRes, movRes] = await Promise.all([
        apiFetch("/api/accounting/vat-deposit/balance"),
        apiFetch("/api/accounting/vat-deposit/movements"),
      ]);
      const balJson = await balRes.json();
      const movJson = await movRes.json();
      if (!balRes.ok) throw new Error(parseApiError(balJson));
      if (!movRes.ok) throw new Error(parseApiError(movJson));
      setBalance(balJson as Balance);
      setMovements(Array.isArray(movJson) ? movJson : []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("reporting.vatDeposit.loadErr"));
    } finally {
      setLoading(false);
    }
  }, [token, t]);

  useEffect(() => {
    if (ready && token) void load();
  }, [ready, token, load]);

  const onRoute = async () => {
    if (!token) return;
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await apiFetch("/api/accounting/vat-deposit/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentAmount: Number(routePayment),
          vatPortion: Number(routeVat),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(parseApiError(json));
      setMsg(t("reporting.vatDeposit.routeOk"));
      setRoutePayment("");
      setRouteVat("");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("reporting.vatDeposit.routeErr"));
    } finally {
      setBusy(false);
    }
  };

  const onRemit = async () => {
    if (!token) return;
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await apiFetch("/api/accounting/vat-deposit/remit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(remitAmount) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(parseApiError(json));
      setMsg(t("reporting.vatDeposit.remitOk"));
      setRemitAmount("");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("reporting.vatDeposit.remitErr"));
    } finally {
      setBusy(false);
    }
  };

  const onReconcile = async () => {
    if (!token || !dateFrom || !dateTo) return;
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await apiFetch("/api/accounting/vat-deposit/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dateFrom, dateTo }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(parseApiError(json));
      setReconcile(json as ReconcileResult);
      setMsg(
        (json as ReconcileResult).reconciled
          ? t("reporting.vatDeposit.reconcileOk")
          : t("reporting.vatDeposit.reconcileDiff"),
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("reporting.vatDeposit.reconcileErr"));
    } finally {
      setBusy(false);
    }
  };

  if (!ready) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("reporting.vatDeposit.title")}
        subtitle={t("reporting.vatDeposit.subtitle")}
        actions={
          <Link href="/reporting" className={SECONDARY_BUTTON_CLASS}>
            {t("common.back")}
          </Link>
        }
      />

      {err ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {err}
        </p>
      ) : null}
      {msg ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {msg}
        </p>
      ) : null}

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">
          {t("reporting.vatDeposit.balanceTitle")}
        </h2>
        {loading && !balance ? (
          <p className="mt-3 text-sm text-gray-600">{t("common.loading")}</p>
        ) : balance ? (
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-gray-500">{t("reporting.vatDeposit.account")}</dt>
              <dd className="font-medium text-gray-900">
                {balance.accountCode} — {balance.accountNameAz}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">{t("reporting.vatDeposit.balance")}</dt>
              <dd className="text-xl font-semibold text-gray-900">
                {formatMoneyAzn(balance.balance)} {balance.currency}
              </dd>
            </div>
            {balance.linkedBankAccount ? (
              <div className="sm:col-span-2">
                <dt className="text-sm text-gray-500">{t("reporting.vatDeposit.linkedBank")}</dt>
                <dd className="text-sm text-gray-800">
                  {balance.linkedBankAccount.bankName} · {balance.linkedBankAccount.iban} · NAS{" "}
                  {balance.linkedBankAccount.ledgerAccountCode}
                </dd>
              </div>
            ) : (
              <div className="sm:col-span-2 text-sm text-amber-800">
                {t("reporting.vatDeposit.noLinkedBank")}
              </div>
            )}
          </dl>
        ) : (
          <EmptyState title={t("reporting.vatDeposit.noData")} />
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">
            {t("reporting.vatDeposit.routeTitle")}
          </h2>
          <p className="mt-1 text-sm text-gray-600">{t("reporting.vatDeposit.routeHint")}</p>
          <div className="mt-4 space-y-3">
            <label className="block text-sm">
              <span className="text-gray-600">{t("reporting.vatDeposit.paymentAmount")}</span>
              <input
                className={MODAL_INPUT_CLASS}
                type="number"
                min="0"
                step="0.01"
                value={routePayment}
                onChange={(e) => setRoutePayment(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="text-gray-600">{t("reporting.vatDeposit.vatPortion")}</span>
              <input
                className={MODAL_INPUT_CLASS}
                type="number"
                min="0"
                step="0.01"
                value={routeVat}
                onChange={(e) => setRouteVat(e.target.value)}
              />
            </label>
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={busy || !routePayment || !routeVat}
              onClick={() => void onRoute()}
            >
              {t("reporting.vatDeposit.routeAction")}
            </button>
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">
            {t("reporting.vatDeposit.remitTitle")}
          </h2>
          <p className="mt-1 text-sm text-gray-600">{t("reporting.vatDeposit.remitHint")}</p>
          <div className="mt-4 space-y-3">
            <label className="block text-sm">
              <span className="text-gray-600">{t("reporting.vatDeposit.remitAmount")}</span>
              <input
                className={MODAL_INPUT_CLASS}
                type="number"
                min="0"
                step="0.01"
                value={remitAmount}
                onChange={(e) => setRemitAmount(e.target.value)}
              />
            </label>
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={busy || !remitAmount}
              onClick={() => void onRemit()}
            >
              {t("reporting.vatDeposit.remitAction")}
            </button>
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">
          {t("reporting.vatDeposit.reconcileTitle")}
        </h2>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="text-gray-600">{t("reporting.vatDeposit.dateFrom")}</span>
            <input
              className={MODAL_INPUT_CLASS}
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="text-gray-600">{t("reporting.vatDeposit.dateTo")}</span>
            <input
              className={MODAL_INPUT_CLASS}
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </label>
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            disabled={busy || !dateFrom || !dateTo}
            onClick={() => void onReconcile()}
          >
            {t("reporting.vatDeposit.reconcileAction")}
          </button>
        </div>
        {reconcile ? (
          <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-gray-500">{t("reporting.vatDeposit.glNet")}</dt>
              <dd>{formatMoneyAzn(reconcile.gl.netMovement)}</dd>
            </div>
            <div>
              <dt className="text-gray-500">{t("reporting.vatDeposit.bankNet")}</dt>
              <dd>{formatMoneyAzn(reconcile.bank.netMovement)}</dd>
            </div>
            <div>
              <dt className="text-gray-500">{t("reporting.vatDeposit.difference")}</dt>
              <dd className={reconcile.reconciled ? "text-emerald-700" : "text-amber-800"}>
                {formatMoneyAzn(reconcile.difference)}
              </dd>
            </div>
            <div className="sm:col-span-2 text-gray-600">{reconcile.bank.note}</div>
          </dl>
        ) : null}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">
          {t("reporting.vatDeposit.movementsTitle")}
        </h2>
        <div className={`${DATA_TABLE_VIEWPORT_CLASS} mt-4`}>
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("reporting.vatDeposit.colDate")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("reporting.vatDeposit.colKind")}</th>
                <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("reporting.vatDeposit.colAmount")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("reporting.vatDeposit.colNote")}</th>
              </tr>
            </thead>
            <tbody>
              {movements.length === 0 ? (
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td colSpan={4} className={DATA_TABLE_TD_CLASS}>
                    {t("reporting.vatDeposit.noMovements")}
                  </td>
                </tr>
              ) : (
                movements.map((row) => (
                  <tr key={row.id} className={DATA_TABLE_TR_CLASS}>
                    <td className={DATA_TABLE_TD_CLASS}>
                      {new Date(row.createdAt).toLocaleString()}
                    </td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.kind}</td>
                    <td className={DATA_TABLE_TD_RIGHT_CLASS}>
                      {formatMoneyAzn(row.amount)}
                    </td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.note ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default function VatDepositPage() {
  return (
    <SubscriptionPaywall module="taxPro">
      <VatDepositPageInner />
    </SubscriptionPaywall>
  );
}
