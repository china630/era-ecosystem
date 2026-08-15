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
  loadAccountOptions,
  loadCustomerOptions,
  loadProductTemplateDetail,
  loadProductTemplateOptions,
  majorToMinor,
  type LookupOption,
  withOrphanOption,
} from "@/lib/bank-lookups";

type DepositDetail = {
  id: string;
  status?: string;
  principalMinor?: unknown;
  accruedInterestMinor?: unknown;
  rateAnnual?: unknown;
  currency?: string;
  customerId?: string;
  accountId?: string;
  maturityDate?: string;
  openedAt?: string;
  adifTagged?: boolean;
  makerUserId?: string | null;
  pricingExceptionReason?: string | null;
};

type DepositCreateModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
};

export function DepositCreateModal({ open, onClose, onCreated }: DepositCreateModalProps) {
  const t = useTranslations("pages.deposits");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [customers, setCustomers] = useState<LookupOption[]>([]);
  const [accounts, setAccounts] = useState<LookupOption[]>([]);
  const [products, setProducts] = useState<LookupOption[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [productTemplateId, setProductTemplateId] = useState("");
  const [termMonths, setTermMonths] = useState("");
  const [ratePct, setRatePct] = useState("");
  const [bandEditable, setBandEditable] = useState(false);
  const [pricingException, setPricingException] = useState(false);
  const [exceptionReason, setExceptionReason] = useState("");
  const formId = "deposit-create-form";

  useEffect(() => {
    if (!open) return;
    void (async () => {
      const [c, term, sav] = await Promise.all([
        loadCustomerOptions(),
        loadProductTemplateOptions("TERM_DEPOSIT"),
        loadProductTemplateOptions("SAVINGS"),
      ]);
      setCustomers(c);
      setProducts([...term, ...sav]);
    })();
  }, [open]);

  useEffect(() => {
    if (!customerId) {
      setAccounts([]);
      return;
    }
    void loadAccountOptions(customerId).then(setAccounts);
  }, [customerId]);

  useEffect(() => {
    if (!productTemplateId) {
      setTermMonths("");
      setRatePct("");
      setBandEditable(false);
      return;
    }
    void loadProductTemplateDetail(productTemplateId).then((detail) => {
      if (!detail) return;
      const p = (detail.paramsJson ?? {}) as Record<string, unknown>;
      setTermMonths(String(p.termMonths ?? ""));
      setRatePct(
        p.rateAnnual != null
          ? String(Number((Number(p.rateAnnual) * 100).toFixed(4)))
          : "",
      );
      setBandEditable(
        p.termMonthsMin != null ||
          p.termMonthsMax != null ||
          p.rateAnnualMin != null ||
          p.rateAnnualMax != null,
      );
    });
  }, [productTemplateId]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    try {
      const body: Record<string, unknown> = {
        accountId,
        customerId,
        productTemplateId,
        principalMinor: String(
          majorToMinor(String(form.get("principalMajor") ?? "0")),
        ),
      };
      if (bandEditable) {
        if (termMonths) body.termMonths = Number(termMonths);
        if (ratePct) body.rateAnnual = Number(ratePct) / 100;
      }
      if (pricingException) {
        body.pricingException = true;
        body.exceptionReason = exceptionReason.trim();
        if (!exceptionReason.trim()) {
          setError(t("exceptionReasonRequired"));
          setBusy(false);
          return;
        }
      }
      const res = await fetch("/api/deposits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError(await res.text());
        return;
      }
      const dep = (await res.json()) as { id: string };
      onCreated(dep.id);
    } catch {
      setError("Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <OpsModalShell
      open={open}
      title={t("openTitle")}
      subtitle={t("openSubtitle")}
      onClose={onClose}
      formId={formId}
      submitLabel={t("openDeposit")}
      busy={busy}
      maxWidthClass="max-w-2xl"
    >
      <form id={formId} onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <CatalogField
          kind="ENTITY_REF"
          label={t("customerId")}
          options={withOrphanOption(customers, customerId)}
          value={customerId}
          onChange={(next) => {
            setCustomerId(Array.isArray(next) ? next[0] ?? "" : next);
            setAccountId("");
          }}
          required
        />
        <CatalogField
          kind="ENTITY_REF"
          label={t("debitAccount")}
          options={withOrphanOption(accounts, accountId)}
          value={accountId}
          onChange={(next) =>
            setAccountId(Array.isArray(next) ? next[0] ?? "" : next)
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
          label={t("principal")}
          preset="amount"
          type="number"
          step="0.01"
          required
          defaultValue={10000}
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
          step="0.01"
          value={ratePct}
          onChange={(e) => setRatePct(e.target.value)}
          disabled={!bandEditable}
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

type DepositDetailModalProps = {
  open: boolean;
  depositId: string | null;
  onClose: () => void;
  onUpdated?: () => void;
};

export function DepositDetailModal({
  open,
  depositId,
  onClose,
  onUpdated,
}: DepositDetailModalProps) {
  const t = useTranslations("pages.deposits");
  const tCommon = useTranslations("common");
  const { mutationsDisabled } = useEodLock();
  const me = useOpsMe();
  const canApprove = me?.canApprove === true;
  const [data, setData] = useState<DepositDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!depositId) return;
    setError(null);
    try {
      const res = await fetch(`/api/deposits/${depositId}`, { cache: "no-store" });
      if (!res.ok) {
        setError(`${tCommon("error")} (${res.status})`);
        return;
      }
      setData((await res.json()) as DepositDetail);
    } catch {
      setError(tCommon("error"));
    }
  }, [depositId, tCommon]);

  useEffect(() => {
    if (open && depositId) void load();
  }, [open, depositId, load]);

  async function closeDeposit() {
    if (!depositId) return;
    const res = await fetch(`/api/deposits/${depositId}/close`, { method: "POST" });
    if (!res.ok) {
      setError(await res.text());
      return;
    }
    onUpdated?.();
    onClose();
  }

  async function rollover() {
    if (!depositId || !data?.maturityDate) return;
    const next = new Date(data.maturityDate);
    next.setMonth(next.getMonth() + 6);
    const res = await fetch(`/api/deposits/${depositId}/rollover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newMaturityDate: next.toISOString() }),
    });
    if (!res.ok) {
      setError(await res.text());
      return;
    }
    await load();
    onUpdated?.();
  }

  async function pricingAction(action: "pricing-approve" | "pricing-reject") {
    if (!depositId) return;
    const res = await fetch(`/api/deposits/${depositId}/${action}`, {
      method: "POST",
    });
    if (!res.ok) {
      setError(await res.text());
      return;
    }
    await load();
    onUpdated?.();
  }

  const isMaker = Boolean(data?.makerUserId) && me?.id === data?.makerUserId;

  return (
    <OpsModalShell
      open={open}
      title={t("detailTitle")}
      subtitle={depositId ?? undefined}
      onClose={onClose}
      maxWidthClass="max-w-2xl"
    >
      {error && <OpsError message={error} />}
      {data && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <StatusBadge status={String(data.status ?? "—")} />
            <span className="text-sm text-muted-foreground">
              {formatAznMinor(data.principalMinor)} {data.currency}
            </span>
          </div>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">{t("customerId")}</dt>
              <dd>{data.customerId}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("debitAccount")}</dt>
              <dd>{data.accountId}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("accruedInterest")}</dt>
              <dd>
                {formatAznMinor(data.accruedInterestMinor ?? 0)} {data.currency}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("maturityDate")}</dt>
              <dd>{data.maturityDate ? String(data.maturityDate).slice(0, 10) : "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">ADİF</dt>
              <dd>{data.adifTagged ? tCommon("yes") : tCommon("no")}</dd>
            </div>
            {data.pricingExceptionReason ? (
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">{t("exceptionReason")}</dt>
                <dd>{data.pricingExceptionReason}</dd>
              </div>
            ) : null}
          </dl>
          {!mutationsDisabled &&
            data.status === "PENDING_PRICING_APPROVAL" &&
            canApprove &&
            !isMaker && (
              <div className="flex gap-2">
                <button
                  type="button"
                  className={PRIMARY_BUTTON_CLASS}
                  onClick={() => void pricingAction("pricing-approve")}
                >
                  {t("pricingApprove")}
                </button>
                <button
                  type="button"
                  className={SECONDARY_BUTTON_CLASS}
                  onClick={() => void pricingAction("pricing-reject")}
                >
                  {t("pricingReject")}
                </button>
              </div>
            )}
          {!mutationsDisabled &&
            data.status === "PENDING_PRICING_APPROVAL" &&
            isMaker && (
              <p className="text-sm text-muted-foreground">
                {t("makerCannotApprovePricing")}
              </p>
            )}
          {!mutationsDisabled && data.status === "ACTIVE" && (
            <div className="flex gap-2">
              <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void closeDeposit()}>
                {t("close")}
              </button>
              <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void rollover()}>
                {t("rollover")}
              </button>
            </div>
          )}
        </div>
      )}
    </OpsModalShell>
  );
}
