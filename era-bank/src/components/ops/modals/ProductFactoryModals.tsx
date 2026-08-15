"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { CatalogField, Field, showApiError } from "@era/satellite-kit/ui";
import { OpsModalShell } from "@/components/ops/OpsModalShell";
import { OpsError } from "@/components/ops-ui";
import {
  CURRENCY_OPTIONS,
  loadGlAccountOptions,
  type LookupOption,
} from "@/lib/bank-lookups";

export const PRODUCT_KINDS = [
  "CURRENT",
  "TERM_DEPOSIT",
  "SAVINGS",
  "LOAN_ANNUITY",
  "LOAN_DIFF",
  "CARD",
] as const;

export type ProductKindValue = (typeof PRODUCT_KINDS)[number];

export type ProductTemplateDetail = {
  id: string;
  moduleKey?: string;
  kind: ProductKindValue | string;
  name: string;
  currency: string;
  status?: string;
  effectiveFrom?: string;
  paramsJson?: Record<string, unknown>;
};

function moduleKeyForKind(kind: string): string {
  if (kind === "CURRENT") return "banking_core";
  if (kind === "TERM_DEPOSIT" || kind === "SAVINGS") return "banking_deposits";
  if (kind === "LOAN_ANNUITY" || kind === "LOAN_DIFF") return "banking_loans";
  if (kind === "CARD") return "banking_cards";
  return "banking_core";
}

function isDepositKind(kind: string) {
  return kind === "TERM_DEPOSIT" || kind === "SAVINGS";
}
function isLoanKind(kind: string) {
  return kind === "LOAN_ANNUITY" || kind === "LOAN_DIFF";
}

/** UI % → annual fraction */
function pctToAnnual(pct: number): number {
  return Number((pct / 100).toFixed(6));
}
function annualToPct(rate: number): number {
  return Number((rate * 100).toFixed(4));
}

type Mode = "create" | "edit" | "view";

type ProductFactoryModalProps = {
  open: boolean;
  mode: Mode;
  initial?: ProductTemplateDetail | null;
  onClose: () => void;
  onSaved: () => void;
};

export function ProductFactoryModal({
  open,
  mode,
  initial,
  onClose,
  onSaved,
}: ProductFactoryModalProps) {
  const t = useTranslations("pages.productFactory");
  const tCommon = useTranslations("common");
  const readOnly = mode === "view";
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<string>("TERM_DEPOSIT");
  const [currency, setCurrency] = useState("AZN");
  const [name, setName] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [termMonths, setTermMonths] = useState("12");
  const [ratePct, setRatePct] = useState("12");
  const [termMin, setTermMin] = useState("");
  const [termMax, setTermMax] = useState("");
  const [rateMinPct, setRateMinPct] = useState("");
  const [rateMaxPct, setRateMaxPct] = useState("");
  const [glLiability, setGlLiability] = useState("");
  const [glAsset, setGlAsset] = useState("");
  const [glInterestIncome, setGlInterestIncome] = useState("");
  const [glInterestExpense, setGlInterestExpense] = useState("");
  const [overdraftAllowed, setOverdraftAllowed] = useState("false");
  const [adifEligible, setAdifEligible] = useState("true");
  const [dayCountConvention, setDayCountConvention] = useState("ACT_365");
  const [rateType, setRateType] = useState("FIXED");
  const [indexKey, setIndexKey] = useState("CBAR_REF");
  const [spreadBps, setSpreadBps] = useState("0");
  const [scheme, setScheme] = useState("VISA");
  const [cardType, setCardType] = useState("DEBIT");
  const [dailySpend, setDailySpend] = useState("5000");
  const [atmDaily, setAtmDaily] = useState("1000");
  const [glOptions, setGlOptions] = useState<LookupOption[]>([]);
  const formId = "product-factory-form";

  const kindOptions = useMemo(
    () =>
      PRODUCT_KINDS.map((k) => ({
        value: k,
        label: t(`kind_${k}` as "kind_CURRENT"),
      })),
    [t],
  );

  useEffect(() => {
    if (!open) return;
    void loadGlAccountOptions().then(setGlOptions);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (initial) {
      setKind(initial.kind);
      setCurrency(initial.currency || "AZN");
      setName(initial.name || "");
      setEffectiveFrom(
        initial.effectiveFrom
          ? String(initial.effectiveFrom).slice(0, 10)
          : new Date().toISOString().slice(0, 10),
      );
      const p = initial.paramsJson ?? {};
      setTermMonths(String(p.termMonths ?? 12));
      setRatePct(
        p.rateAnnual != null ? String(annualToPct(Number(p.rateAnnual))) : "12",
      );
      setTermMin(p.termMonthsMin != null ? String(p.termMonthsMin) : "");
      setTermMax(p.termMonthsMax != null ? String(p.termMonthsMax) : "");
      setRateMinPct(
        p.rateAnnualMin != null
          ? String(annualToPct(Number(p.rateAnnualMin)))
          : "",
      );
      setRateMaxPct(
        p.rateAnnualMax != null
          ? String(annualToPct(Number(p.rateAnnualMax)))
          : "",
      );
      setGlLiability(String(p.glLiabilityCode ?? ""));
      setGlAsset(String(p.glAssetCode ?? ""));
      setGlInterestIncome(String(p.glInterestIncomeCode ?? ""));
      setGlInterestExpense(String(p.glInterestExpenseCode ?? ""));
      setOverdraftAllowed(p.overdraftAllowed === true ? "true" : "false");
      setAdifEligible(p.adifEligible === false ? "false" : "true");
      setDayCountConvention(String(p.dayCountConvention ?? "ACT_365"));
      setRateType(String(p.rateType ?? "FIXED"));
      setIndexKey(String(p.indexKey ?? "CBAR_REF"));
      setSpreadBps(p.spreadBps != null ? String(p.spreadBps) : "0");
      setScheme(String(p.scheme ?? "VISA"));
      setCardType(String(p.cardType ?? "DEBIT"));
      setDailySpend(
        p.dailySpendLimitMinor != null
          ? String(Number(p.dailySpendLimitMinor) / 100)
          : "5000",
      );
      setAtmDaily(
        p.atmDailyLimitMinor != null
          ? String(Number(p.atmDailyLimitMinor) / 100)
          : "1000",
      );
    } else {
      setKind("TERM_DEPOSIT");
      setCurrency("AZN");
      setName("");
      setEffectiveFrom(new Date().toISOString().slice(0, 10));
      setTermMonths("12");
      setRatePct("12");
      setTermMin("");
      setTermMax("");
      setRateMinPct("");
      setRateMaxPct("");
      setGlLiability("");
      setGlAsset("");
      setGlInterestIncome("");
      setGlInterestExpense("");
      setOverdraftAllowed("false");
      setAdifEligible("true");
      setDayCountConvention("ACT_365");
      setRateType("FIXED");
      setIndexKey("CBAR_REF");
      setSpreadBps("0");
      setScheme("VISA");
      setCardType("DEBIT");
      setDailySpend("5000");
      setAtmDaily("1000");
    }
  }, [open, initial]);

  function buildParamsJson(): Record<string, unknown> {
    const bands: Record<string, number> = {};
    if (termMin) bands.termMonthsMin = Number(termMin);
    if (termMax) bands.termMonthsMax = Number(termMax);
    if (rateMinPct) bands.rateAnnualMin = pctToAnnual(Number(rateMinPct));
    if (rateMaxPct) bands.rateAnnualMax = pctToAnnual(Number(rateMaxPct));

    if (kind === "CURRENT") {
      return {
        glLiabilityCode: glLiability,
        overdraftAllowed: overdraftAllowed === "true",
      };
    }
    if (isDepositKind(kind)) {
      return {
        termMonths: Number(termMonths),
        rateAnnual: pctToAnnual(Number(ratePct)),
        glLiabilityCode: glLiability,
        ...(glInterestExpense
          ? { glInterestExpenseCode: glInterestExpense }
          : {}),
        adifEligible: adifEligible === "true",
        dayCountConvention,
        rateType,
        ...(rateType === "FLOATING"
          ? { indexKey, spreadBps: Number(spreadBps) || 0, resetFrequencyMonths: 3 }
          : {}),
        ...bands,
      };
    }
    if (isLoanKind(kind)) {
      return {
        termMonths: Number(termMonths),
        rateAnnual: pctToAnnual(Number(ratePct)),
        glAssetCode: glAsset,
        glInterestIncomeCode: glInterestIncome,
        dayCountConvention,
        rateType,
        ...(rateType === "FLOATING"
          ? { indexKey, spreadBps: Number(spreadBps) || 0, resetFrequencyMonths: 3 }
          : {}),
        ...bands,
      };
    }
    return {
      scheme,
      cardType,
      dailySpendLimitMinor: Math.round(Number(dailySpend) * 100),
      atmDailyLimitMinor: Math.round(Number(atmDaily) * 100),
    };
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (readOnly) return;
    setBusy(true);
    setError(null);
    try {
      const body = {
        moduleKey: moduleKeyForKind(kind),
        kind,
        name: name.trim(),
        currency,
        paramsJson: buildParamsJson(),
        effectiveFrom: new Date(effectiveFrom).toISOString(),
      };
      const url =
        mode === "edit" && initial?.id
          ? `/api/product-templates/${initial.id}`
          : "/api/product-templates";
      const res = await fetch(url, {
        method: mode === "edit" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError(await res.text());
        return;
      }
      onSaved();
      onClose();
    } catch {
      showApiError(tCommon("error"));
      setError(tCommon("error"));
    } finally {
      setBusy(false);
    }
  }

  const title =
    mode === "create"
      ? t("create")
      : mode === "edit"
        ? t("edit")
        : t("view");

  return (
    <OpsModalShell
      open={open}
      title={title}
      subtitle={t("subtitle")}
      onClose={onClose}
      formId={readOnly ? undefined : formId}
      submitLabel={readOnly ? undefined : mode === "edit" ? tCommon("save") : t("create")}
      busy={busy}
      maxWidthClass="max-w-3xl"
    >
      <form
        id={formId}
        onSubmit={submit}
        className="grid gap-4 sm:grid-cols-2"
      >
        <Field
          label={t("name")}
          preset="longText"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={readOnly}
        />
        <CatalogField
          kind="CLOSED_SMALL"
          label={t("kind")}
          options={kindOptions}
          value={kind}
          onChange={(next) =>
            setKind(Array.isArray(next) ? next[0] ?? "" : next)
          }
          required
          disabled={readOnly || (mode === "edit" && initial?.status === "ACTIVE")}
        />
        <CatalogField
          kind="CLOSED_SMALL"
          label={t("currency")}
          options={CURRENCY_OPTIONS}
          value={currency}
          onChange={(next) =>
            setCurrency(Array.isArray(next) ? next[0] ?? "" : next)
          }
          required
          disabled={readOnly || (mode === "edit" && initial?.status === "ACTIVE")}
        />
        <Field
          label={t("effectiveFrom")}
          preset="shortText"
          type="date"
          required
          value={effectiveFrom}
          onChange={(e) => setEffectiveFrom(e.target.value)}
          disabled={readOnly}
        />
        <Field
          label={t("moduleKey")}
          preset="code"
          value={moduleKeyForKind(kind)}
          disabled
        />

        {kind === "CURRENT" && (
          <>
            <CatalogField
              kind="ENTITY_REF"
              label={t("glLiability")}
              options={glOptions}
              value={glLiability}
              onChange={(next) =>
                setGlLiability(Array.isArray(next) ? next[0] ?? "" : next)
              }
              required
              disabled={readOnly}
            />
            <CatalogField
              kind="CLOSED_SMALL"
              label={t("overdraftAllowed")}
              options={[
                { value: "false", label: tCommon("no") },
                { value: "true", label: tCommon("yes") },
              ]}
              value={overdraftAllowed}
              onChange={(next) =>
                setOverdraftAllowed(Array.isArray(next) ? next[0] ?? "" : next)
              }
              disabled={readOnly}
            />
          </>
        )}

        {isDepositKind(kind) && (
          <>
            <Field
              label={t("termMonths")}
              preset="shortText"
              type="number"
              value={termMonths}
              onChange={(e) => setTermMonths(e.target.value)}
              disabled={readOnly}
              required
            />
            <Field
              label={t("rateAnnualPct")}
              preset="shortText"
              type="number"
              step="0.01"
              value={ratePct}
              onChange={(e) => setRatePct(e.target.value)}
              disabled={readOnly}
              required
            />
            <CatalogField
              kind="ENTITY_REF"
              label={t("glLiability")}
              options={glOptions}
              value={glLiability}
              onChange={(next) =>
                setGlLiability(Array.isArray(next) ? next[0] ?? "" : next)
              }
              required
              disabled={readOnly}
            />
            <CatalogField
              kind="ENTITY_REF"
              label={t("glInterestExpense")}
              options={glOptions}
              value={glInterestExpense}
              onChange={(next) =>
                setGlInterestExpense(Array.isArray(next) ? next[0] ?? "" : next)
              }
              disabled={readOnly}
            />
            <CatalogField
              kind="CLOSED_SMALL"
              label={t("dayCountConvention")}
              options={[
                { value: "ACT_365", label: "ACT/365" },
                { value: "ACT_360", label: "ACT/360" },
                { value: "THIRTY_360", label: "30/360" },
              ]}
              value={dayCountConvention}
              onChange={(next) =>
                setDayCountConvention(
                  Array.isArray(next) ? next[0] ?? "ACT_365" : next,
                )
              }
              disabled={readOnly}
            />
            <CatalogField
              kind="CLOSED_SMALL"
              label={t("rateType")}
              options={[
                { value: "FIXED", label: "FIXED" },
                { value: "FLOATING", label: "FLOATING" },
              ]}
              value={rateType}
              onChange={(next) =>
                setRateType(Array.isArray(next) ? next[0] ?? "FIXED" : next)
              }
              disabled={readOnly}
            />
            {rateType === "FLOATING" ? (
              <>
                <Field
                  label={t("indexKey")}
                  preset="shortText"
                  value={indexKey}
                  onChange={(e) => setIndexKey(e.target.value)}
                  disabled={readOnly}
                />
                <Field
                  label={t("spreadBps")}
                  preset="shortText"
                  type="number"
                  value={spreadBps}
                  onChange={(e) => setSpreadBps(e.target.value)}
                  disabled={readOnly}
                />
              </>
            ) : null}
            <CatalogField
              kind="CLOSED_SMALL"
              label={t("adifEligible")}
              options={[
                { value: "true", label: tCommon("yes") },
                { value: "false", label: tCommon("no") },
              ]}
              value={adifEligible}
              onChange={(next) =>
                setAdifEligible(Array.isArray(next) ? next[0] ?? "" : next)
              }
              disabled={readOnly}
            />
          </>
        )}

        {isLoanKind(kind) && (
          <>
            <Field
              label={t("termMonths")}
              preset="shortText"
              type="number"
              value={termMonths}
              onChange={(e) => setTermMonths(e.target.value)}
              disabled={readOnly}
              required
            />
            <Field
              label={t("rateAnnualPct")}
              preset="shortText"
              type="number"
              step="0.01"
              value={ratePct}
              onChange={(e) => setRatePct(e.target.value)}
              disabled={readOnly}
              required
            />
            <CatalogField
              kind="CLOSED_SMALL"
              label={t("dayCountConvention")}
              options={[
                { value: "ACT_365", label: "ACT/365" },
                { value: "ACT_360", label: "ACT/360" },
                { value: "THIRTY_360", label: "30/360" },
              ]}
              value={dayCountConvention}
              onChange={(next) =>
                setDayCountConvention(
                  Array.isArray(next) ? next[0] ?? "ACT_365" : next,
                )
              }
              disabled={readOnly}
            />
            <CatalogField
              kind="CLOSED_SMALL"
              label={t("rateType")}
              options={[
                { value: "FIXED", label: "FIXED" },
                { value: "FLOATING", label: "FLOATING" },
              ]}
              value={rateType}
              onChange={(next) =>
                setRateType(Array.isArray(next) ? next[0] ?? "FIXED" : next)
              }
              disabled={readOnly}
            />
            {rateType === "FLOATING" ? (
              <>
                <Field
                  label={t("indexKey")}
                  preset="shortText"
                  value={indexKey}
                  onChange={(e) => setIndexKey(e.target.value)}
                  disabled={readOnly}
                />
                <Field
                  label={t("spreadBps")}
                  preset="shortText"
                  type="number"
                  value={spreadBps}
                  onChange={(e) => setSpreadBps(e.target.value)}
                  disabled={readOnly}
                />
              </>
            ) : null}
            <CatalogField
              kind="ENTITY_REF"
              label={t("glAsset")}
              options={glOptions}
              value={glAsset}
              onChange={(next) =>
                setGlAsset(Array.isArray(next) ? next[0] ?? "" : next)
              }
              required
              disabled={readOnly}
            />
            <CatalogField
              kind="ENTITY_REF"
              label={t("glInterestIncome")}
              options={glOptions}
              value={glInterestIncome}
              onChange={(next) =>
                setGlInterestIncome(Array.isArray(next) ? next[0] ?? "" : next)
              }
              required
              disabled={readOnly}
            />
          </>
        )}

        {kind === "CARD" && (
          <>
            <CatalogField
              kind="CLOSED_SMALL"
              label={t("scheme")}
              options={[
                { value: "VISA", label: "VISA" },
                { value: "MASTERCARD", label: "Mastercard" },
              ]}
              value={scheme}
              onChange={(next) =>
                setScheme(Array.isArray(next) ? next[0] ?? "" : next)
              }
              disabled={readOnly}
              required
            />
            <CatalogField
              kind="CLOSED_SMALL"
              label={t("cardType")}
              options={[
                { value: "DEBIT", label: "DEBIT" },
                { value: "CREDIT", label: "CREDIT" },
              ]}
              value={cardType}
              onChange={(next) =>
                setCardType(Array.isArray(next) ? next[0] ?? "" : next)
              }
              disabled={readOnly}
              required
            />
            <Field
              label={t("dailySpendMajor")}
              preset="shortText"
              type="number"
              value={dailySpend}
              onChange={(e) => setDailySpend(e.target.value)}
              disabled={readOnly}
              required
            />
            <Field
              label={t("atmDailyMajor")}
              preset="shortText"
              type="number"
              value={atmDaily}
              onChange={(e) => setAtmDaily(e.target.value)}
              disabled={readOnly}
              required
            />
          </>
        )}

        {(isDepositKind(kind) || isLoanKind(kind)) && (
          <>
            <Field
              label={t("termMonthsMin")}
              preset="shortText"
              type="number"
              value={termMin}
              onChange={(e) => setTermMin(e.target.value)}
              disabled={readOnly}
            />
            <Field
              label={t("termMonthsMax")}
              preset="shortText"
              type="number"
              value={termMax}
              onChange={(e) => setTermMax(e.target.value)}
              disabled={readOnly}
            />
            <Field
              label={t("rateAnnualMinPct")}
              preset="shortText"
              type="number"
              step="0.01"
              value={rateMinPct}
              onChange={(e) => setRateMinPct(e.target.value)}
              disabled={readOnly}
            />
            <Field
              label={t("rateAnnualMaxPct")}
              preset="shortText"
              type="number"
              step="0.01"
              value={rateMaxPct}
              onChange={(e) => setRateMaxPct(e.target.value)}
              disabled={readOnly}
            />
          </>
        )}

        <div className="sm:col-span-2">
          <OpsError message={error} />
        </div>
      </form>
    </OpsModalShell>
  );
}

/** @deprecated use ProductFactoryModal */
export const ProductFactoryCreateModal = ProductFactoryModal;
