"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CatalogField,
  Field,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { OpsModalShell } from "@/components/ops/OpsModalShell";
import { useEodLock } from "@/components/ops/EodLockProvider";
import { useOpsMe } from "@/components/ops/useOpsMe";
import { OpsError, StatusBadge, formatAznMinor } from "@/components/ops-ui";
import {
  IFRS9_STAGE_OPTIONS,
  loadAccountOptions,
  loadCustomerOptions,
  loadProductTemplateDetail,
  loadProductTemplateOptions,
  majorToMinor,
  type LookupOption,
  withOrphanOption,
} from "@/lib/bank-lookups";

type LoanDetail = {
  id: string;
  status?: string;
  principalMinor?: unknown;
  outstandingMinor?: unknown;
  currency?: string;
  accountId?: string | null;
  customerId?: string;
  ifrs9Stage?: number;
  suggestedIfrs9Stage?: number;
  daysPastDue?: number;
  isNpl?: boolean;
  akbScore?: number | null;
  makerUserId?: string | null;
  pricingExceptionReason?: string | null;
  collateral?: {
    description?: string;
    amountMinor?: string;
    currency?: string;
    type?: string;
  } | null;
};

type Installment = {
  sequenceNo: number;
  dueDate?: string;
  principalMinor?: unknown;
  interestMinor?: unknown;
  paidPrincipalMinor?: unknown;
  paidInterestMinor?: unknown;
  status?: string;
};

type DetailTab = "overview" | "schedule" | "restructure" | "collateral";

type LoanCreateModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
};

export function LoanCreateModal({
  open,
  onClose,
  onCreated,
}: LoanCreateModalProps) {
  const t = useTranslations("pages.loans");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [customers, setCustomers] = useState<LookupOption[]>([]);
  const [products, setProducts] = useState<LookupOption[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [productTemplateId, setProductTemplateId] = useState("");
  const [termMonths, setTermMonths] = useState("24");
  const [rateAnnual, setRateAnnual] = useState("0.18");
  const [bandEditable, setBandEditable] = useState(false);
  const [bureauScore, setBureauScore] = useState<number | null>(null);
  const [bureauBusy, setBureauBusy] = useState(false);
  const [pricingException, setPricingException] = useState(false);
  const [exceptionReason, setExceptionReason] = useState("");
  const formId = "loan-create-form";

  useEffect(() => {
    if (!open) return;
    void loadCustomerOptions().then(setCustomers);
    void Promise.all([
      loadProductTemplateOptions("LOAN_ANNUITY"),
      loadProductTemplateOptions("LOAN_DIFF"),
    ]).then(([a, b]) => setProducts([...a, ...b]));
    setBureauScore(null);
    setProductTemplateId("");
    setTermMonths("24");
    setRateAnnual("0.18");
    setBandEditable(false);
    setPricingException(false);
    setExceptionReason("");
  }, [open]);

  useEffect(() => {
    if (!productTemplateId) return;
    void loadProductTemplateDetail(productTemplateId).then((detail) => {
      if (!detail) return;
      const p = (detail.paramsJson ?? {}) as Record<string, unknown>;
      if (p.termMonths != null) setTermMonths(String(p.termMonths));
      if (p.rateAnnual != null) setRateAnnual(String(p.rateAnnual));
      setBandEditable(
        p.termMonthsMin != null ||
          p.termMonthsMax != null ||
          p.rateAnnualMin != null ||
          p.rateAnnualMax != null,
      );
    });
  }, [productTemplateId]);

  async function pullBureau() {
    if (!customerId) return;
    setBureauBusy(true);
    try {
      const res = await fetch("/api/loans/bureau/pull", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId }),
      });
      if (!res.ok) {
        setError(await res.text());
        return;
      }
      const report = (await res.json()) as { score: number };
      setBureauScore(report.score);
    } catch {
      setError("Bureau pull failed");
    } finally {
      setBureauBusy(false);
    }
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    try {
      if (pricingException && !exceptionReason.trim()) {
        setError(t("exceptionReasonRequired"));
        setBusy(false);
        return;
      }
      const res = await fetch("/api/loans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          productTemplateId,
          principalMinor: String(
            majorToMinor(String(form.get("principalMajor") ?? "0")),
          ),
          ...(bandEditable
            ? {
                termMonths: Number(termMonths),
                rateAnnual: Number(rateAnnual),
              }
            : {}),
          ...(pricingException
            ? {
                pricingException: true,
                exceptionReason: exceptionReason.trim(),
              }
            : {}),
          collateralDescription: String(form.get("collateralDescription") || ""),
          collateralAmountMinor: String(
            majorToMinor(String(form.get("collateralAmountMajor") ?? "0")),
          ),
          collateralType: String(form.get("collateralType") || "OTHER"),
        }),
      });
      if (!res.ok) {
        setError(await res.text());
        return;
      }
      const loan = (await res.json()) as { id: string };
      onCreated(loan.id);
    } catch {
      setError("Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <OpsModalShell
      open={open}
      title={t("originateTitle")}
      subtitle={t("originateSubtitle")}
      onClose={onClose}
      formId={formId}
      submitLabel={t("originate")}
      busy={busy}
      maxWidthClass="max-w-2xl"
    >
      <form id={formId} onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <CatalogField
          kind="ENTITY_REF"
          label={t("customerId")}
          options={withOrphanOption(customers, customerId)}
          value={customerId}
          onChange={(next) =>
            setCustomerId(Array.isArray(next) ? next[0] ?? "" : next)
          }
          required
        />
        <CatalogField
          kind="ENTITY_REF"
          label={t("productTemplate")}
          options={withOrphanOption(products, productTemplateId)}
          value={productTemplateId}
          onChange={(next) =>
            setProductTemplateId(Array.isArray(next) ? next[0] ?? "" : next)
          }
          required
        />
        <Field
          name="principalMajor"
          label={t("principalMajor")}
          preset="amount"
          type="number"
          step="0.01"
          required
          defaultValue={50000}
        />
        <Field
          label={t("termMonths")}
          preset="shortText"
          type="number"
          value={termMonths}
          onChange={(e) => setTermMonths(e.target.value)}
          disabled={!bandEditable}
        />
        <Field
          label={t("rateAnnual")}
          preset="shortText"
          type="number"
          step="0.0001"
          value={rateAnnual}
          onChange={(e) => setRateAnnual(e.target.value)}
          disabled={!bandEditable}
        />
        <div className="flex items-end gap-2">
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            disabled={!customerId || bureauBusy}
            onClick={() => void pullBureau()}
          >
            {t("bureauPull")}
          </button>
          <span className="text-sm text-muted-foreground">
            {bureauScore != null ? `${t("colBureau")}: ${bureauScore}` : t("bureauHint")}
          </span>
        </div>
        <Field
          name="collateralDescription"
          label={t("collateralDescription")}
          preset="longText"
          className="sm:col-span-2"
        />
        <Field
          name="collateralAmountMajor"
          label={t("collateralAmount")}
          preset="amount"
          type="number"
          step="0.01"
          defaultValue={0}
        />
        <Field
          name="collateralType"
          label={t("collateralType")}
          preset="shortText"
          defaultValue="REAL_ESTATE"
        />
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            checked={pricingException}
            onChange={(e) => setPricingException(e.target.checked)}
          />
          {t("pricingException")}
        </label>
        {pricingException ? (
          <Field
            label={t("exceptionReason")}
            preset="longText"
            className="sm:col-span-2"
            value={exceptionReason}
            onChange={(e) => setExceptionReason(e.target.value)}
            required
          />
        ) : null}
        <div className="sm:col-span-2">
          <OpsError message={error} />
        </div>
      </form>
    </OpsModalShell>
  );
}

type LoanDetailModalProps = {
  open: boolean;
  loanId: string | null;
  onClose: () => void;
  onUpdated?: () => void;
};

export function LoanDetailModal({
  open,
  loanId,
  onClose,
  onUpdated,
}: LoanDetailModalProps) {
  const t = useTranslations("pages.loans");
  const tCommon = useTranslations("common");
  const { mutationsDisabled } = useEodLock();
  const me = useOpsMe();
  const canApprove = me?.canApprove === true;
  const [data, setData] = useState<LoanDetail | null>(null);
  const [schedule, setSchedule] = useState<Installment[]>([]);
  const [accounts, setAccounts] = useState<LookupOption[]>([]);
  const [disburseAccountId, setDisburseAccountId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [repayMajor, setRepayMajor] = useState("1000");
  const [ifrs9Stage, setIfrs9Stage] = useState("2");
  const [tab, setTab] = useState<DetailTab>("overview");

  const load = useCallback(async () => {
    if (!loanId) return;
    setError(null);
    try {
      const [lRes, sRes] = await Promise.all([
        fetch(`/api/loans/${loanId}`, { cache: "no-store" }),
        fetch(`/api/loans/${loanId}/schedule`, { cache: "no-store" }),
      ]);
      if (!lRes.ok) {
        setError(`${tCommon("error")} (${lRes.status})`);
        return;
      }
      const loan = (await lRes.json()) as LoanDetail;
      setData(loan);
      setIfrs9Stage(String(loan.ifrs9Stage ?? loan.suggestedIfrs9Stage ?? 1));
      if (sRes.ok) setSchedule((await sRes.json()) as Installment[]);
      void loadAccountOptions(loan.customerId).then(setAccounts);
    } catch {
      setError(tCommon("error"));
    }
  }, [loanId, tCommon]);

  useEffect(() => {
    if (open && loanId) {
      setTab("overview");
      void load();
    }
    if (!open) {
      setData(null);
      setSchedule([]);
    }
  }, [open, loanId, load]);

  async function disburse() {
    if (!loanId || !disburseAccountId) return;
    const res = await fetch(`/api/loans/${loanId}/disburse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId: disburseAccountId }),
    });
    if (!res.ok) setError(await res.text());
    await load();
    onUpdated?.();
  }

  async function repay() {
    if (!loanId) return;
    const res = await fetch(`/api/loans/${loanId}/repay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amountMinor: String(majorToMinor(repayMajor)),
      }),
    });
    if (!res.ok) setError(await res.text());
    await load();
    onUpdated?.();
  }

  async function restructure() {
    if (!loanId) return;
    const res = await fetch(`/api/loans/${loanId}/restructure`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ifrs9Stage: Number(ifrs9Stage) }),
    });
    if (!res.ok) setError(await res.text());
    await load();
    onUpdated?.();
  }

  async function saveCollateral(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!loanId) return;
    const form = new FormData(e.currentTarget);
    const res = await fetch(`/api/loans/${loanId}/collateral`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: form.get("description"),
        amountMinor: String(
          majorToMinor(String(form.get("amountMajor") ?? "0")),
        ),
        currency: "AZN",
        type: form.get("type") || "OTHER",
      }),
    });
    if (!res.ok) setError(await res.text());
    await load();
    onUpdated?.();
  }

  async function pricingAction(action: "pricing-approve" | "pricing-reject") {
    if (!loanId) return;
    const res = await fetch(`/api/loans/${loanId}/${action}`, {
      method: "POST",
    });
    if (!res.ok) setError(await res.text());
    await load();
    onUpdated?.();
  }

  const isMaker = Boolean(data?.makerUserId) && me?.id === data?.makerUserId;

  return (
    <OpsModalShell
      open={open}
      title={t("detailTitle")}
      subtitle={loanId ?? undefined}
      onClose={onClose}
      hideFooter
      maxWidthClass="max-w-3xl"
    >
      <div className="mb-4 flex flex-wrap gap-2 border-b pb-2 text-sm">
        {(
          [
            ["overview", t("detailTitle")],
            ["schedule", t("schedule")],
            ["restructure", t("restructure")],
            ["collateral", t("collateral")],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`rounded px-3 py-1 ${
              tab === key ? "bg-primary text-primary-foreground" : "bg-muted"
            }`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <OpsError message={error} />
      {tab === "overview" && data ? (
        <div className="space-y-4">
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              {t("colStatus")}:{" "}
              {data.status ? <StatusBadge status={data.status} /> : "—"}
              {data.isNpl ? (
                <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[10px] text-red-800">
                  NPL
                </span>
              ) : null}
            </div>
            <div>
              {t("colPrincipal")}: {formatAznMinor(data.principalMinor)}
            </div>
            <div>
              {t("colOutstanding")}: {formatAznMinor(data.outstandingMinor)}
            </div>
            <div>
              {t("colStage")}: {data.ifrs9Stage ?? 1}
              {data.suggestedIfrs9Stage != null
                ? ` (suggested ${data.suggestedIfrs9Stage})`
                : ""}
            </div>
            <div>
              {t("colBureau")}: {data.akbScore ?? "—"}
            </div>
            <div>
              {t("dpd")}: {data.daysPastDue ?? 0}
            </div>
            {data.pricingExceptionReason ? (
              <div className="sm:col-span-2">
                {t("exceptionReason")}: {data.pricingExceptionReason}
              </div>
            ) : null}
          </div>
          {data.status === "PENDING_PRICING_APPROVAL" &&
          canApprove &&
          !isMaker ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                disabled={mutationsDisabled}
                onClick={() => void pricingAction("pricing-approve")}
              >
                {t("pricingApprove")}
              </button>
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                disabled={mutationsDisabled}
                onClick={() => void pricingAction("pricing-reject")}
              >
                {t("pricingReject")}
              </button>
            </div>
          ) : null}
          {data.status === "PENDING_PRICING_APPROVAL" && isMaker ? (
            <p className="text-sm text-muted-foreground">
              {t("makerCannotApprovePricing")}
            </p>
          ) : null}
          {data.status === "APPROVED" ? (
            <div className="flex flex-wrap items-end gap-3">
              <CatalogField
                kind="ENTITY_REF"
                label={t("disburseAccount")}
                options={withOrphanOption(accounts, disburseAccountId)}
                value={disburseAccountId}
                onChange={(next) =>
                  setDisburseAccountId(
                    Array.isArray(next) ? next[0] ?? "" : next,
                  )
                }
              />
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                disabled={mutationsDisabled || !disburseAccountId}
                onClick={() => void disburse()}
              >
                {t("disburse")}
              </button>
            </div>
          ) : null}
          {data.status === "DISBURSED" || data.status === "ACTIVE" ? (
            <div className="flex flex-wrap items-end gap-3">
              <p className="w-full text-xs text-muted-foreground">
                {t("repayScheduleHint")}
              </p>
              <Field
                label={t("repayAmountMajor")}
                preset="amount"
                type="number"
                step="0.01"
                value={repayMajor}
                onChange={(e) => setRepayMajor(e.target.value)}
              />
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                disabled={mutationsDisabled}
                onClick={() => void repay()}
              >
                {t("repay")}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      {tab === "schedule" ? (
        schedule.length === 0 ? (
          <p className="text-sm text-muted-foreground">{tCommon("empty")}</p>
        ) : (
          <table className="min-w-full text-left text-[12px]">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">{t("due")}</th>
                <th className="px-3 py-2">{t("colPrincipal")}</th>
                <th className="px-3 py-2">{t("interest")}</th>
                <th className="px-3 py-2">{t("paidRemaining")}</th>
                <th className="px-3 py-2">{t("colStatus")}</th>
              </tr>
            </thead>
            <tbody>
              {schedule.map((row) => {
                const paidP = BigInt(String(row.paidPrincipalMinor ?? 0));
                const paidI = BigInt(String(row.paidInterestMinor ?? 0));
                const remP =
                  BigInt(String(row.principalMinor ?? 0)) - paidP;
                const remI =
                  BigInt(String(row.interestMinor ?? 0)) - paidI;
                return (
                  <tr key={row.sequenceNo} className="border-b">
                    <td className="px-3 py-2">{row.sequenceNo}</td>
                    <td className="px-3 py-2">
                      {row.dueDate?.slice(0, 10) ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      {formatAznMinor(row.principalMinor)}
                    </td>
                    <td className="px-3 py-2">
                      {formatAznMinor(row.interestMinor)}
                    </td>
                    <td className="px-3 py-2">
                      {formatAznMinor(paidP + paidI)} /{" "}
                      {formatAznMinor(
                        (remP > BigInt(0) ? remP : BigInt(0)) +
                          (remI > BigInt(0) ? remI : BigInt(0)),
                      )}
                    </td>
                    <td className="px-3 py-2">{row.status ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )
      ) : null}
      {tab === "restructure" ? (
        <div className="flex flex-wrap items-end gap-3">
          <CatalogField
            kind="CLOSED_SMALL"
            label={t("ifrsStage")}
            options={IFRS9_STAGE_OPTIONS}
            value={ifrs9Stage}
            onChange={(next) =>
              setIfrs9Stage(Array.isArray(next) ? next[0] ?? "1" : next)
            }
          />
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={mutationsDisabled}
            onClick={() => void restructure()}
          >
            {t("applyRestructure")}
          </button>
        </div>
      ) : null}
      {tab === "collateral" ? (
        <form
          onSubmit={(e) => void saveCollateral(e)}
          className="grid gap-4 sm:grid-cols-2"
        >
          <Field
            name="description"
            label={t("collateralDescription")}
            preset="longText"
            className="sm:col-span-2"
            defaultValue={data?.collateral?.description ?? ""}
          />
          <Field
            name="amountMajor"
            label={t("collateralAmount")}
            preset="amount"
            type="number"
            step="0.01"
            defaultValue={
              data?.collateral?.amountMinor
                ? Number(data.collateral.amountMinor) / 100
                : 0
            }
          />
          <Field
            name="type"
            label={t("collateralType")}
            preset="shortText"
            defaultValue={data?.collateral?.type ?? "REAL_ESTATE"}
          />
          <div className="sm:col-span-2">
            <button
              type="submit"
              className={PRIMARY_BUTTON_CLASS}
              disabled={mutationsDisabled}
            >
              {t("saveCollateral")}
            </button>
          </div>
        </form>
      ) : null}
    </OpsModalShell>
  );
}
