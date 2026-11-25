"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Field,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  showApiError,
} from "@era/satellite-kit/ui";
import { formatAznMinor } from "@/components/ops-ui";

type LeaseAsset = {
  id: string;
  description?: string;
  catalogValueMinor?: string | number;
  currency?: string;
  status?: string;
};
type LeaseContract = {
  id: string;
  status?: string;
  customerId?: string;
  assetId?: string;
  termMonths?: number;
  residualValueMinor?: string | number;
  netInvestmentMinor?: string | number;
  accruedFinanceIncomeMinor?: string | number;
};

type ScheduleLine = {
  sequenceNo: number;
  dueDate: string;
  paymentMinor: string;
  principalMinor: string;
  interestMinor: string;
};

export default function LeasingPage() {
  const t = useTranslations("pages.leasing");
  const tCommon = useTranslations("common");
  const [assets, setAssets] = useState<LeaseAsset[]>([]);
  const [contracts, setContracts] = useState<LeaseContract[]>([]);
  const [desc, setDesc] = useState("");
  const [valueMajor, setValueMajor] = useState("10000");
  const [customerId, setCustomerId] = useState("");
  const [assetId, setAssetId] = useState("");
  const [productTemplateId, setProductTemplateId] = useState("");
  const [advancePct, setAdvancePct] = useState("20");
  const [residualMajor, setResidualMajor] = useState("1000");
  const [termMonths, setTermMonths] = useState("36");
  const [rateAnnual, setRateAnnual] = useState("0.12");
  const [scheduleId, setScheduleId] = useState<string | null>(null);
  const [scheduleLines, setScheduleLines] = useState<ScheduleLine[]>([]);
  const [buyout, setBuyout] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [aRes, cRes] = await Promise.all([
        fetch("/api/leasing/assets", { cache: "no-store" }),
        fetch("/api/leasing/contracts", { cache: "no-store" }),
      ]);
      if (aRes.ok) setAssets((await aRes.json()) as LeaseAsset[]);
      if (cRes.ok) setContracts((await cRes.json()) as LeaseContract[]);
      if (!aRes.ok || !cRes.ok) showApiError(tCommon("error"));
    } catch {
      showApiError(tCommon("error"));
    }
  }, [tCommon]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createAsset(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/leasing/assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: desc,
        catalogValueMinor: String(Math.round(Number(valueMajor) * 100)),
        currency: "AZN",
      }),
    });
    if (!res.ok) {
      showApiError(await res.text());
      return;
    }
    setDesc("");
    await load();
  }

  async function createContract(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/leasing/contracts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId,
        assetId,
        productTemplateId,
        advancePct: Number(advancePct),
        residualValueMinor: String(Math.round(Number(residualMajor) * 100)),
        termMonths: Number(termMonths),
        rateAnnual: Number(rateAnnual),
        linkLoan: true,
      }),
    });
    if (!res.ok) {
      showApiError(await res.text());
      return;
    }
    await load();
  }

  async function showSchedule(id: string) {
    setScheduleId(id);
    setBuyout(null);
    const res = await fetch(`/api/leasing/contracts/${id}/schedule`, {
      cache: "no-store",
    });
    if (!res.ok) {
      showApiError(await res.text());
      return;
    }
    const data = (await res.json()) as { lines?: ScheduleLine[] };
    setScheduleLines(data.lines ?? []);
  }

  async function showBuyout(id: string) {
    const res = await fetch(`/api/leasing/contracts/${id}/buyout-quote`, {
      cache: "no-store",
    });
    if (!res.ok) {
      showApiError(await res.text());
      return;
    }
    const data = (await res.json()) as { buyoutMinor?: string };
    setBuyout(data.buyoutMinor ?? null);
    setScheduleId(id);
  }

  async function accrue(id: string) {
    const res = await fetch(`/api/leasing/contracts/${id}/accrue-finance-income`, {
      method: "POST",
    });
    if (!res.ok) {
      showApiError(await res.text());
      return;
    }
    await load();
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <p className="text-xs text-slate-500">{t("labNote")}</p>
      <form className="space-y-2 rounded-xl border p-4" onSubmit={createAsset}>
        <h2 className="font-medium">{t("newAsset")}</h2>
        <Field
          label={t("description")}
          preset="shortText"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          required
        />
        <Field
          label={t("catalogValue")}
          preset="amount"
          type="number"
          step="0.01"
          value={valueMajor}
          onChange={(e) => setValueMajor(e.target.value)}
        />
        <button type="submit" className={PRIMARY_BUTTON_CLASS}>
          {t("createAsset")}
        </button>
      </form>
      <ul className="space-y-1 text-sm">
        {assets.map((a) => (
          <li key={a.id} className="rounded border px-3 py-2">
            {a.description} · {a.status} · {formatAznMinor(a.catalogValueMinor)}{" "}
            ·{" "}
            <button
              type="button"
              className="underline"
              onClick={() => setAssetId(a.id)}
            >
              {a.id}
            </button>
          </li>
        ))}
      </ul>
      <form className="space-y-2 rounded-xl border p-4" onSubmit={createContract}>
        <h2 className="font-medium">{t("newContract")}</h2>
        <Field
          label={t("customerId")}
          preset="code"
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          required
        />
        <Field
          label={t("assetId")}
          preset="code"
          value={assetId}
          onChange={(e) => setAssetId(e.target.value)}
          required
        />
        <Field
          label={t("productTemplateId")}
          preset="code"
          value={productTemplateId}
          onChange={(e) => setProductTemplateId(e.target.value)}
          required
        />
        <Field
          label={t("advancePct")}
          preset="code"
          type="number"
          step="0.01"
          value={advancePct}
          onChange={(e) => setAdvancePct(e.target.value)}
        />
        <Field
          label={t("residual")}
          preset="amount"
          type="number"
          step="0.01"
          value={residualMajor}
          onChange={(e) => setResidualMajor(e.target.value)}
        />
        <Field
          label={t("termMonths")}
          preset="code"
          type="number"
          value={termMonths}
          onChange={(e) => setTermMonths(e.target.value)}
        />
        <Field
          label={t("rateAnnual")}
          preset="code"
          type="number"
          step="0.0001"
          value={rateAnnual}
          onChange={(e) => setRateAnnual(e.target.value)}
        />
        <button type="submit" className={PRIMARY_BUTTON_CLASS}>
          {t("createContract")}
        </button>
      </form>
      <ul className="space-y-2 text-sm">
        {contracts.map((c) => (
          <li key={c.id} className="rounded border px-3 py-2 space-y-1">
            <div>
              {c.status} · {c.customerId} · {c.termMonths}m · residual{" "}
              {formatAznMinor(c.residualValueMinor)} · net{" "}
              {formatAznMinor(c.netInvestmentMinor)} · accrued{" "}
              {formatAznMinor(c.accruedFinanceIncomeMinor)} · {c.id}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                onClick={() => void showSchedule(c.id)}
              >
                {t("schedule")}
              </button>
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                onClick={() => void showBuyout(c.id)}
              >
                {t("buyout")}
              </button>
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                onClick={() => void accrue(c.id)}
              >
                {t("accrue")}
              </button>
            </div>
          </li>
        ))}
      </ul>
      {scheduleId && scheduleLines.length > 0 ? (
        <section className="rounded-xl border p-4 text-sm space-y-2">
          <h2 className="font-medium">
            {t("schedule")} · {scheduleId}
          </h2>
          {buyout ? (
            <p>
              {t("buyout")}: {formatAznMinor(buyout)}
            </p>
          ) : null}
          <ul className="max-h-64 overflow-auto space-y-1">
            {scheduleLines.map((line) => (
              <li key={line.sequenceNo} className="flex justify-between gap-2 border-b py-1 text-xs">
                <span>
                  #{line.sequenceNo} · {line.dueDate.slice(0, 10)}
                </span>
                <span>{formatAznMinor(line.paymentMinor)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
