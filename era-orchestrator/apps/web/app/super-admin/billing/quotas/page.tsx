"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil } from "lucide-react";
import {
  CARD_CONTAINER_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TH_RIGHT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  ListPaginationFooter,
  ModalShell,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TABLE_ROW_ICON_BTN_CLASS,
} from "@era/satellite-kit/ui";
import { cpAdminFetch } from "../../../../lib/cp-admin-fetch";
import { useListPagination } from "../../../../lib/use-list-pagination";
import { useBilling } from "../billing-context";

const TIERS = ["TIER_0", "TIER_1", "TIER_2", "TIER_3"] as const;
type Tier = (typeof TIERS)[number];

const QUOTA_FIELDS = [
  "maxEmployees",
  "maxInvoicesPerMonth",
  "maxStorageGb",
  "maxWhatsappAlertsPerMonth",
  "maxOcrPagesPerMonth",
  "maxWorkspaces",
] as const;
type QuotaField = (typeof QUOTA_FIELDS)[number];

type TierQuotas = Record<QuotaField, number | null>;

function parseQuota(v: string): number | null {
  const trimmed = v.trim();
  if (trimmed === "" || trimmed === "∞") return null;
  const n = Number.parseInt(trimmed, 10);
  return Number.isFinite(n) ? n : null;
}

function quotaToInput(v: number | null | undefined): string {
  return v == null ? "" : String(v);
}

export default function SuperAdminBillingQuotasPage() {
  const t = useTranslations("superAdmin.billingQuotas");
  const tCommon = useTranslations("common");
  const { billing, loading, error, reload } = useBilling();
  const [matrix, setMatrix] = useState<Record<Tier, Record<QuotaField, string>>>(
    () =>
      Object.fromEntries(
        TIERS.map((tier) => [tier, Object.fromEntries(QUOTA_FIELDS.map((f) => [f, ""]))]),
      ) as Record<Tier, Record<QuotaField, string>>,
  );
  const [prices, setPrices] = useState<Record<Tier, string>>(
    () => Object.fromEntries(TIERS.map((t) => [t, ""])) as Record<Tier, string>,
  );
  const [ceilings, setCeilings] = useState<Record<Tier, string>>(
    () => Object.fromEntries(TIERS.map((t) => [t, ""])) as Record<Tier, string>,
  );
  const [quotaPricing, setQuotaPricing] = useState({
    employeeBlockSize: "10",
    pricePerEmployeeBlockAzn: "15",
    documentPackSize: "1000",
    pricePerDocumentPackAzn: "5",
  });
  const [meterPricing, setMeterPricing] = useState({
    pricePerUserMonthAzn: "0",
    pricePerGbMonthAzn: "0",
    pricePerWhatsappAlertAzn: "0",
    pricePerInvoiceAzn: "0",
    pricePerOcrPageAzn: "0",
  });
  const [editing, setEditing] = useState<Tier | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const tierRows = useMemo(() => [...TIERS], []);
  const { page, pageSize, setPage, setPageSize, paged, total } =
    useListPagination(tierRows);

  useEffect(() => {
    if (!billing) return;
    const quotas = (billing.quotas ?? {}) as Record<string, Partial<TierQuotas>>;
    setMatrix(
      Object.fromEntries(
        TIERS.map((tier) => [
          tier,
          Object.fromEntries(
            QUOTA_FIELDS.map((f) => [f, quotaToInput(quotas[tier]?.[f])]),
          ),
        ]),
      ) as Record<Tier, Record<QuotaField, string>>,
    );
    setPrices(
      Object.fromEntries(
        TIERS.map((tier) => [tier, String(billing.prices?.[tier] ?? "")]),
      ) as Record<Tier, string>,
    );
    setCeilings(
      Object.fromEntries(
        TIERS.map((tier) => [
          tier,
          String(billing.tierSpendCeilings?.[tier] ?? ""),
        ]),
      ) as Record<Tier, string>,
    );
    setQuotaPricing({
      employeeBlockSize: String(billing.quotaPricing.employeeBlockSize),
      pricePerEmployeeBlockAzn: String(billing.quotaPricing.pricePerEmployeeBlockAzn),
      documentPackSize: String(billing.quotaPricing.documentPackSize),
      pricePerDocumentPackAzn: String(billing.quotaPricing.pricePerDocumentPackAzn),
    });
    const m = billing.meterUnitPricing ?? {};
    setMeterPricing({
      pricePerUserMonthAzn: String(m.pricePerUserMonthAzn ?? 0),
      pricePerGbMonthAzn: String(m.pricePerGbMonthAzn ?? 0),
      pricePerWhatsappAlertAzn: String(m.pricePerWhatsappAlertAzn ?? 0),
      pricePerInvoiceAzn: String(m.pricePerInvoiceAzn ?? 0),
      pricePerOcrPageAzn: String(m.pricePerOcrPageAzn ?? 0),
    });
  }, [billing]);

  async function saveTier() {
    if (!editing) return;
    setSaving(true);
    setFormError(null);
    try {
      const quotas: TierQuotas = Object.fromEntries(
        QUOTA_FIELDS.map((f) => [f, parseQuota(matrix[editing][f])]),
      ) as TierQuotas;
      const price = Number.parseFloat(prices[editing]);
      const ceiling = Number.parseFloat(ceilings[editing]);
      if (!Number.isFinite(price) || price < 0) {
        setFormError(t("errPrice"));
        return;
      }
      const quotaRes = await cpAdminFetch("config/billing/quotas", {
        method: "PATCH",
        body: JSON.stringify({ tier: editing, quotas }),
      });
      if (!quotaRes.ok) {
        setFormError(`HTTP ${quotaRes.status}`);
        return;
      }
      await cpAdminFetch("config/billing/price", {
        method: "PATCH",
        body: JSON.stringify({ tier: editing, amountAzn: price }),
      });
      if (Number.isFinite(ceiling) && ceiling >= 0) {
        const allCeilings = Object.fromEntries(
          TIERS.map((tier) => [
            tier,
            tier === editing
              ? ceiling
              : Number.parseFloat(ceilings[tier]) || 0,
          ]),
        );
        await cpAdminFetch("config/billing/tier-spend-ceilings", {
          method: "PATCH",
          body: JSON.stringify(allCeilings),
        });
      }
      setEditing(null);
      await reload();
    } finally {
      setSaving(false);
    }
  }

  async function saveUnitPricing() {
    setSaving(true);
    try {
      await cpAdminFetch("config/billing/quota-pricing", {
        method: "PATCH",
        body: JSON.stringify({
          employeeBlockSize: Number.parseInt(quotaPricing.employeeBlockSize, 10),
          pricePerEmployeeBlockAzn: Number.parseFloat(
            quotaPricing.pricePerEmployeeBlockAzn,
          ),
          documentPackSize: Number.parseInt(quotaPricing.documentPackSize, 10),
          pricePerDocumentPackAzn: Number.parseFloat(
            quotaPricing.pricePerDocumentPackAzn,
          ),
        }),
      });
      await cpAdminFetch("config/billing/meter-unit-pricing", {
        method: "PATCH",
        body: JSON.stringify({
          pricePerUserMonthAzn: Number.parseFloat(meterPricing.pricePerUserMonthAzn),
          pricePerGbMonthAzn: Number.parseFloat(meterPricing.pricePerGbMonthAzn),
          pricePerWhatsappAlertAzn: Number.parseFloat(
            meterPricing.pricePerWhatsappAlertAzn,
          ),
          pricePerInvoiceAzn: Number.parseFloat(meterPricing.pricePerInvoiceAzn),
          pricePerOcrPageAzn: Number.parseFloat(meterPricing.pricePerOcrPageAzn),
        }),
      });
      await reload();
    } finally {
      setSaving(false);
    }
  }

  function setCell(tier: Tier, field: QuotaField, value: string) {
    setMatrix((prev) => ({ ...prev, [tier]: { ...prev[tier], [field]: value } }));
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-[#34495E]">{t("title")}</h1>
        <p className="mt-1 text-sm text-[#7F8C8D]">{t("subtitle")}</p>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loading ? <p className="text-sm text-[#7F8C8D]">{t("loading")}</p> : null}

      <div className={DATA_TABLE_VIEWPORT_CLASS}>
        <div className="border-b border-[#D5DADF] bg-[#F8F9FA] px-3 py-2">
          <h2 className="text-sm font-semibold text-[#34495E]">{t("matrixTitle")}</h2>
          <p className="text-xs text-[#7F8C8D]">{t("matrixHint")}</p>
        </div>
        <div className="overflow-x-auto">
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colTier")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colPrice")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colCeiling")}</th>
                {QUOTA_FIELDS.map((f) => (
                  <th key={f} className={DATA_TABLE_TH_LEFT_CLASS}>
                    {t(`field.${f}` as "field.maxEmployees")}
                  </th>
                ))}
                <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((tier) => (
                <tr key={tier} className={DATA_TABLE_TR_CLASS}>
                  <td className={`${DATA_TABLE_TD_CLASS} font-mono text-xs font-semibold`}>
                    {tier}
                  </td>
                  <td className={`${DATA_TABLE_TD_CLASS} tabular-nums`}>
                    {prices[tier] || "—"}
                  </td>
                  <td className={`${DATA_TABLE_TD_CLASS} tabular-nums`}>
                    {ceilings[tier] || "—"}
                  </td>
                  {QUOTA_FIELDS.map((f) => (
                    <td key={f} className={`${DATA_TABLE_TD_CLASS} tabular-nums`}>
                      {matrix[tier][f] === "" ? "∞" : matrix[tier][f]}
                    </td>
                  ))}
                  <td className={`${DATA_TABLE_TD_CLASS} text-right`}>
                    <button
                      type="button"
                      className={TABLE_ROW_ICON_BTN_CLASS}
                      title={t("edit")}
                      aria-label={t("edit")}
                      onClick={() => {
                        setFormError(null);
                        setEditing(tier);
                      }}
                    >
                      <Pencil className="h-4 w-4 text-[#2980B9]" aria-hidden />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
      <p className="text-xs text-[#95A5A6]">{t("unlimitedHint")}</p>

      <div className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
        <h2 className="text-sm font-semibold text-[#34495E]">{t("unitPricingTitle")}</h2>
        <p className="text-xs text-[#7F8C8D]">{t("unitPricingHint")}</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              "employeeBlockSize",
              "pricePerEmployeeBlockAzn",
              "documentPackSize",
              "pricePerDocumentPackAzn",
            ] as const
          ).map((k) => (
            <label key={k} className="text-sm">
              {t(`quotaPricing.${k}`)}
              <input
                className="mt-1 block h-9 w-full rounded-lg border border-[#D5DADF] px-2 text-sm"
                value={quotaPricing[k]}
                onChange={(e) =>
                  setQuotaPricing((p) => ({ ...p, [k]: e.target.value }))
                }
              />
            </label>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {(
            [
              "pricePerUserMonthAzn",
              "pricePerGbMonthAzn",
              "pricePerWhatsappAlertAzn",
              "pricePerInvoiceAzn",
              "pricePerOcrPageAzn",
            ] as const
          ).map((k) => (
            <label key={k} className="text-sm">
              {t(`meterPricing.${k}`)}
              <input
                className="mt-1 block h-9 w-full rounded-lg border border-[#D5DADF] px-2 text-sm"
                value={meterPricing[k]}
                onChange={(e) =>
                  setMeterPricing((p) => ({ ...p, [k]: e.target.value }))
                }
              />
            </label>
          ))}
        </div>
        <button
          type="button"
          className={PRIMARY_BUTTON_CLASS}
          disabled={saving}
          onClick={() => void saveUnitPricing()}
        >
          {t("saveUnitPricing")}
        </button>
      </div>

      <ModalShell
        open={editing != null}
        title={t("editTitle", { tier: editing ?? "" })}
        onClose={() => setEditing(null)}
        closeLabel={tCommon("close")}
      >
        {editing ? (
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">
                {t("colPrice")}
                <input
                  className="mt-1 block h-9 w-full rounded-lg border border-[#D5DADF] px-2 text-sm"
                  value={prices[editing]}
                  onChange={(e) =>
                    setPrices((p) => ({ ...p, [editing]: e.target.value }))
                  }
                />
              </label>
              <label className="text-sm">
                {t("colCeiling")}
                <input
                  className="mt-1 block h-9 w-full rounded-lg border border-[#D5DADF] px-2 text-sm"
                  value={ceilings[editing]}
                  onChange={(e) =>
                    setCeilings((p) => ({ ...p, [editing]: e.target.value }))
                  }
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {QUOTA_FIELDS.map((f) => (
                <label key={f} className="text-sm">
                  {t(`field.${f}` as "field.maxEmployees")}
                  <input
                    className="mt-1 block h-9 w-full rounded-lg border border-[#D5DADF] px-2 text-sm"
                    value={matrix[editing][f]}
                    placeholder="∞"
                    onChange={(e) => setCell(editing, f, e.target.value)}
                  />
                </label>
              ))}
            </div>
            {formError ? <p className="text-sm text-red-700">{formError}</p> : null}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                onClick={() => setEditing(null)}
              >
                {tCommon("cancel")}
              </button>
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                disabled={saving}
                onClick={() => void saveTier()}
              >
                {saving ? tCommon("loading") : tCommon("save")}
              </button>
            </div>
          </div>
        ) : null}
      </ModalShell>
    </div>
  );
}
