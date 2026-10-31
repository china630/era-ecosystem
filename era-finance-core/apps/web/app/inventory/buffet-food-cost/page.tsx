"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { CatalogField, DatePicker, Field, FieldTextarea } from "@era/satellite-kit/ui";
import { bakuCivilUtcDate, todayBakuYmd } from "@era/satellite-kit/time";
import { apiFetch } from "../../../lib/api-client";
import { decodeTheoSku } from "../../../lib/buffet-handoff-query";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { PageHeader } from "../../../components/layout/page-header";
import {
  CARD_CONTAINER_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TD_RIGHT_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TH_RIGHT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "../../../lib/design-system";

type CostRunReport = {
  period: { from: string; to: string };
  satelliteOutletCode: string | null;
  warehouseCount: number;
  warehouses: Array<{ id: string; name: string; satelliteOutletCode: string | null }>;
  foodUsageAzn: number;
  posSaleAzn: number;
  posCompAzn: number;
  posAttributedAzn: number;
  staffNetAzn: number;
  attributedAzn: number;
  residualBuffetAzn: number;
  theoreticalAzn: number;
  varianceAzn: number;
  reliability: "COMPLETE" | "ISSUES_ONLY";
  warnings: string[];
  cogsPostingNote?: string;
  skuRows: Array<{
    sku: string;
    name: string;
    usageAzn: number;
    theoreticalAzn: number | null;
    varianceAzn: number | null;
    actualVsTheoreticalPct: number | null;
    warning: string | null;
  }>;
};

type BudgetClass = "CHEMICAL" | "CONSUMABLE" | "TABLEWARE" | "INVENTORY_GT";

type BudgetReport = {
  period: { from: string; to: string; days: number };
  satelliteOutletCode: string | null;
  planPeriodDays: number;
  weeklyPlanByClass?: Record<BudgetClass, number>;
  planTotalAzn: number;
  factTotalAzn: number;
  varianceTotalAzn: number;
  stocktakeHint?: string;
  warnings: string[];
  rows: Array<{
    costClass: BudgetClass;
    planAzn: number;
    factAzn: number;
    varianceAzn: number;
    warehouseCount: number;
  }>;
};

const BUDGET_CLASSES: BudgetClass[] = [
  "CHEMICAL",
  "CONSUMABLE",
  "TABLEWARE",
  "INVENTORY_GT",
];

function addDaysYmd(ymd: string, days: number): string {
  const d = bakuCivilUtcDate(ymd);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function mondayOfWeek(ymd: string): string {
  const js = bakuCivilUtcDate(ymd).getUTCDay();
  const iso = js === 0 ? 7 : js;
  return addDaysYmd(ymd, 1 - iso);
}

function mapToJson(bySku: Record<string, number>): string {
  return JSON.stringify(bySku, null, 0);
}

function handoffFieldLabel(base: string, hasHandoff: boolean, fromHandoff: string): string {
  if (!hasHandoff) return base;
  return `${base} (${fromHandoff})`;
}

function localizeSoftWarning(
  raw: string,
  labels: {
    issuesOnly: string;
    noFoodWh: string;
    theoZero: string;
    outletMismatch: string;
  },
): string {
  const lower = raw.toLowerCase();
  if (lower.includes("issues_only") || lower.includes("stocktake missing")) {
    return labels.issuesOnly;
  }
  if (lower.includes("no food warehouses")) {
    return labels.noFoodWh;
  }
  if (lower.includes("theoretical is 0")) {
    return labels.theoZero;
  }
  if (lower.includes("outlet_code_mismatch")) {
    return labels.outletMismatch;
  }
  return raw;
}

const LAB_OUTLET_DEFAULTS = ["NAFTANI", "XUDMANI", "KAFE"] as const;

export default function BuffetFoodCostRunPage() {
  const { t } = useTranslation();
  const { token, ready } = useRequireAuth();
  const search = useSearchParams();
  const fromHandoffLabel = t("inventory.buffetCostFromHandoff", "from F&B handoff");
  const softWarningLabels = {
    issuesOnly: t(
      "inventory.buffetCostWarnIssuesOnly",
      "FOOD stocktake missing or incomplete for period — reliability ISSUES_ONLY",
    ),
    noFoodWh: t(
      "inventory.buffetCostWarnNoFoodWh",
      "No FOOD warehouses in scope — set costClass=FOOD (+ outlet code) in Inventory settings",
    ),
    theoZero: t(
      "inventory.buffetCostWarnTheoZero",
      "Theoretical is 0 — variance band not applied at total level",
    ),
    outletMismatch: t(
      "inventory.buffetCostWarnOutletMismatch",
      "Outlet code mismatch — F&B outlet code does not match FOOD warehouse satelliteOutletCode",
    ),
  };

  const defaults = useMemo(() => {
    const to = search.get("to") || todayBakuYmd();
    const from = search.get("from") || mondayOfWeek(to);
    const theoSkuMap = decodeTheoSku(search.get("theoSku"));
    const hasHandoff =
      search.has("theoSku") ||
      search.has("theoreticalAzn") ||
      search.has("posSaleAzn") ||
      search.has("posCompAzn") ||
      search.has("staffNetAzn");
    return {
      from,
      to: search.get("to") ? to : addDaysYmd(from, 6),
      outlet: search.get("outletCode") || search.get("satelliteOutletCode") || "",
      posSale: search.get("posSaleAzn") || "0",
      posComp: search.get("posCompAzn") || "0",
      staffNet: search.get("staffNetAzn") || "0",
      theoretical: search.get("theoreticalAzn") || "",
      theoSkuMap,
      hasHandoff,
    };
  }, [search]);

  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [outlet, setOutlet] = useState(defaults.outlet);
  const [posSale, setPosSale] = useState(defaults.posSale);
  const [posComp, setPosComp] = useState(defaults.posComp);
  const [staffNet, setStaffNet] = useState(defaults.staffNet);
  const [theoretical, setTheoretical] = useState(defaults.theoretical);
  const [theoSkuMap, setTheoSkuMap] = useState<Record<string, number>>(defaults.theoSkuMap);
  const [theoSkuJson, setTheoSkuJson] = useState(() => mapToJson(defaults.theoSkuMap));
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [theoUnlocked, setTheoUnlocked] = useState(!defaults.hasHandoff);
  const [whExpanded, setWhExpanded] = useState(false);
  const [report, setReport] = useState<CostRunReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"food" | "budget">("food");
  const [budgetReport, setBudgetReport] = useState<BudgetReport | null>(null);
  const [budgetError, setBudgetError] = useState<string | null>(null);
  const [budgetLoading, setBudgetLoading] = useState(false);
  const [planDraft, setPlanDraft] = useState<Record<BudgetClass, string>>({
    CHEMICAL: "0",
    CONSUMABLE: "0",
    TABLEWARE: "0",
    INVENTORY_GT: "0",
  });
  const [planSaving, setPlanSaving] = useState(false);
  const handoffRan = useRef(false);

  const theoReadOnly = defaults.hasHandoff && !theoUnlocked && !advancedOpen;

  const outletCodeOptions = useMemo(() => {
    const codes = new Set<string>(LAB_OUTLET_DEFAULTS);
    if (outlet.trim()) codes.add(outlet.trim());
    if (report?.satelliteOutletCode) codes.add(report.satelliteOutletCode);
    for (const wh of report?.warehouses ?? []) {
      const c = wh.satelliteOutletCode?.trim();
      if (c) codes.add(c);
    }
    return [...codes]
      .sort((a, b) => a.localeCompare(b))
      .map((c) => ({ value: c, label: c }));
  }, [outlet, report]);

  const outletMismatch = useMemo(() => {
    if (!report) return false;
    return report.warnings.some((w) =>
      w.toLowerCase().includes("outlet_code_mismatch"),
    );
  }, [report]);

  const resolveTheoreticalBySku = useCallback((): Record<string, number> | undefined => {
    if (advancedOpen) {
      try {
        const parsed = JSON.parse(theoSkuJson || "{}") as Record<string, unknown>;
        const out: Record<string, number> = {};
        for (const [k, v] of Object.entries(parsed)) {
          const n = Number(v);
          if (Number.isFinite(n) && n >= 0) out[k] = n;
        }
        return Object.keys(out).length > 0 ? out : undefined;
      } catch {
        throw new Error("INVALID_THEO_JSON");
      }
    }
    return Object.keys(theoSkuMap).length > 0 ? theoSkuMap : undefined;
  }, [advancedOpen, theoSkuJson, theoSkuMap]);

  const run = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      if (from > to) {
        setError(t("inventory.buffetCostDateOrder", "From date must be on or before To"));
        setReport(null);
        setLoading(false);
        return;
      }
      let theoreticalBySku: Record<string, number> | undefined;
      try {
        theoreticalBySku = resolveTheoreticalBySku();
      } catch {
        setError(t("inventory.buffetCostTheoSkuInvalid", "Invalid theoreticalBySku JSON"));
        setLoading(false);
        return;
      }
      const body: Record<string, unknown> = {
        from,
        to,
        ...(outlet.trim() ? { satelliteOutletCode: outlet.trim() } : {}),
        posSaleAzn: Number(posSale) || 0,
        posCompAzn: Number(posComp) || 0,
        staffNetAzn: Number(staffNet) || 0,
        ...(theoretical.trim() !== ""
          ? { theoreticalAzn: Number(theoretical) || 0 }
          : {}),
        ...(theoreticalBySku ? { theoreticalBySku } : {}),
      };
      const res = await apiFetch("/api/inventory/buffet-food-cost-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(
          typeof data?.message === "string"
            ? data.message
            : t("inventory.buffetCostLoadFailed", "Could not run buffet food cost report"),
        );
        setReport(null);
        return;
      }
      setReport(data as CostRunReport);
    } catch {
      setError(t("inventory.buffetCostLoadFailed", "Could not run buffet food cost report"));
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [
    token,
    from,
    to,
    outlet,
    posSale,
    posComp,
    staffNet,
    theoretical,
    resolveTheoreticalBySku,
    t,
  ]);

  const runBudget = useCallback(async () => {
    if (!token) return;
    if (from > to) {
      setBudgetError(t("inventory.buffetCostDateOrder", "From date must be on or before To"));
      setBudgetReport(null);
      return;
    }
    setBudgetLoading(true);
    setBudgetError(null);
    try {
      const res = await apiFetch("/api/inventory/outlet-budget-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to,
          ...(outlet.trim() ? { satelliteOutletCode: outlet.trim() } : {}),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setBudgetError(
          typeof data?.message === "string"
            ? data.message
            : t("inventory.outletBudgetLoadFailed", "Could not run outlet budget"),
        );
        setBudgetReport(null);
        return;
      }
      const rep = data as BudgetReport;
      setBudgetReport(rep);
      if (rep.weeklyPlanByClass) {
        setPlanDraft({
          CHEMICAL: String(rep.weeklyPlanByClass.CHEMICAL ?? 0),
          CONSUMABLE: String(rep.weeklyPlanByClass.CONSUMABLE ?? 0),
          TABLEWARE: String(rep.weeklyPlanByClass.TABLEWARE ?? 0),
          INVENTORY_GT: String(rep.weeklyPlanByClass.INVENTORY_GT ?? 0),
        });
      }
    } catch {
      setBudgetError(t("inventory.outletBudgetLoadFailed", "Could not run outlet budget"));
      setBudgetReport(null);
    } finally {
      setBudgetLoading(false);
    }
  }, [token, from, to, outlet, t]);

  async function saveBudgetPlan() {
    setPlanSaving(true);
    try {
      const planByClass: Partial<Record<BudgetClass, number>> = {};
      for (const cls of BUDGET_CLASSES) {
        planByClass[cls] = Number(planDraft[cls]) || 0;
      }
      const res = await apiFetch("/api/inventory/outlet-budget-plan", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          satelliteOutletCode: outlet.trim() || null,
          planByClass,
          planPeriodDays: 7,
        }),
      });
      if (!res.ok) {
        setBudgetError(await res.text());
        toast.error(t("inventory.outletBudgetSaveFailed", "Could not save plan"));
        return;
      }
      toast.success(t("inventory.outletBudgetSaved", "Plan saved"));
      await runBudget();
    } finally {
      setPlanSaving(false);
    }
  }

  useEffect(() => {
    if (!ready || !token || handoffRan.current) return;
    handoffRan.current = true;
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial + query defaults only
  }, [ready, token]);

  const theoEntries = Object.entries(theoSkuMap);
  const handoffTheoZero =
    defaults.hasHandoff &&
    (Number(theoretical) || 0) <= 0 &&
    theoEntries.every(([, v]) => v <= 0);

  const foodWarningsFiltered = useMemo(() => {
    if (!report) return [];
    return report.warnings.filter((w) => {
      if (report.reliability === "ISSUES_ONLY") {
        const lower = w.toLowerCase();
        if (lower.includes("issues_only") || lower.includes("stocktake missing")) {
          return false;
        }
      }
      return true;
    });
  }, [report]);

  const budgetWhEmpty =
    budgetReport != null &&
    budgetReport.rows.every((r) => r.warehouseCount === 0);

  if (!ready) return null;

  return (
    <div className="buffet-food-cost-page space-y-4 p-4 md:p-6">
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media print {
          nav, aside, .buffet-no-print { display: none !important; }
          .buffet-food-cost-page { padding: 0 !important; }
          .buffet-print-only { display: block !important; }
        }
        .buffet-print-only { display: none; }
      `,
        }}
      />
      <div className="buffet-no-print">
        <PageHeader
          title={t("inventory.buffetCostTitle", "Buffet FOOD cost run")}
          subtitle={t(
            "inventory.buffetCostDesc",
            "HYBRID: FOOD usage vs attributed (sale + COMP + staff net), residual, theoretical, variance. Soft warnings only.",
          )}
        />
      </div>
      <h1 className="buffet-print-only text-xl font-semibold text-[#111827]">
        {t("inventory.buffetCostTitle", "Buffet FOOD cost run")}
        {outlet ? ` · ${outlet}` : ""} · {from} → {to}
      </h1>

      <div className="buffet-no-print flex flex-wrap gap-2">
        <button
          type="button"
          className={viewMode === "food" ? PRIMARY_BUTTON_CLASS : SECONDARY_BUTTON_CLASS}
          onClick={() => setViewMode("food")}
        >
          {t("inventory.buffetCostTabFood", "FOOD HYBRID")}
        </button>
        <button
          type="button"
          className={viewMode === "budget" ? PRIMARY_BUTTON_CLASS : SECONDARY_BUTTON_CLASS}
          onClick={() => {
            setViewMode("budget");
            if (!budgetReport) void runBudget();
          }}
        >
          {t("inventory.buffetCostTabBudget", "Non-FOOD budget")}
        </button>
        <button
          type="button"
          className={SECONDARY_BUTTON_CLASS}
          onClick={() => window.print()}
        >
          {t("inventory.buffetCostPrint", "Print report")}
        </button>
      </div>

      {defaults.hasHandoff && viewMode === "food" ? (
        <div className={`${CARD_CONTAINER_CLASS} space-y-2 border border-[#BFDBFE] bg-[#EFF6FF] p-4`}>
          <div className="text-sm font-medium text-[#1E3A5F]">
            {t(
              "inventory.buffetCostHandoffBanner",
              "F&B handoff loaded — attributed and theoretical prefilled from Cost run. FOOD usage still comes from warehouses.",
            )}
          </div>
          <dl className="grid gap-1 text-sm text-[#1E3A5F] sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex justify-between gap-2">
              <dt className="text-[#64748B]">{t("inventory.buffetCostOutlet", "F&B outlet code")}</dt>
              <dd className="tabular-nums font-medium">{outlet || "—"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[#64748B]">{t("common.from", "From")}</dt>
              <dd className="tabular-nums">{from}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[#64748B]">{t("common.to", "To")}</dt>
              <dd className="tabular-nums">{to}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[#64748B]">
                {t("inventory.buffetCostTheoretical", "Theoretical (total)")}
              </dt>
              <dd className="tabular-nums font-medium">
                {(Number(theoretical) || 0).toFixed(2)} AZN
              </dd>
            </div>
          </dl>
        </div>
      ) : null}

      <div
        className={`buffet-no-print ${CARD_CONTAINER_CLASS} flex flex-wrap items-end gap-3 p-4`}
      >
        <DatePicker
          label={t("common.from", "From")}
          value={from}
          onChange={setFrom}
          placeholder={t("ui.datePickerPlaceholder")}
        />
        <DatePicker
          label={t("common.to", "To")}
          value={to}
          onChange={setTo}
          placeholder={t("ui.datePickerPlaceholder")}
        />
        <div className="min-w-[10rem]">
          <CatalogField
            kind="SEARCHABLE"
            label={t("inventory.buffetCostOutlet", "F&B outlet code")}
            value={outlet}
            options={outletCodeOptions}
            onChange={(next) => setOutlet(String(next ?? ""))}
          />
        </div>
        {viewMode === "food" ? (
          <>
            <Field
              label={handoffFieldLabel(
                t("inventory.buffetCostPosSale", "POS sale"),
                defaults.hasHandoff,
                fromHandoffLabel,
              )}
              preset="amount"
              type="number"
              min={0}
              value={posSale}
              onChange={(e) => setPosSale(e.target.value)}
            />
            <Field
              label={handoffFieldLabel(
                t("inventory.buffetCostPosComp", "COMP"),
                defaults.hasHandoff,
                fromHandoffLabel,
              )}
              preset="amount"
              type="number"
              min={0}
              value={posComp}
              onChange={(e) => setPosComp(e.target.value)}
            />
            <Field
              label={handoffFieldLabel(
                t("inventory.buffetCostStaffNet", "Staff net"),
                defaults.hasHandoff,
                fromHandoffLabel,
              )}
              preset="amount"
              type="number"
              min={0}
              value={staffNet}
              onChange={(e) => setStaffNet(e.target.value)}
            />
            <Field
              label={t("inventory.buffetCostTheoretical", "Theoretical (total)")}
              preset="amount"
              type="number"
              min={0}
              value={theoretical}
              onChange={(e) => setTheoretical(e.target.value)}
              placeholder={t("inventory.buffetCostTheoOptional", "optional")}
              disabled={theoReadOnly}
            />
            {defaults.hasHandoff && !theoUnlocked ? (
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                onClick={() => setTheoUnlocked(true)}
              >
                {t("inventory.buffetCostUnlockOverrides", "Unlock overrides")}
              </button>
            ) : null}
          </>
        ) : null}
        <button
          type="button"
          className={PRIMARY_BUTTON_CLASS}
          disabled={viewMode === "food" ? loading : budgetLoading}
          onClick={() => void (viewMode === "food" ? run() : runBudget())}
        >
          {t("inventory.buffetCostRun", "Run")}
        </button>
        <button
          type="button"
          className={SECONDARY_BUTTON_CLASS}
          onClick={() => {
            const mon = mondayOfWeek(todayBakuYmd());
            setFrom(mon);
            setTo(addDaysYmd(mon, 6));
          }}
        >
          {t("inventory.buffetCostThisWeek", "This week")}
        </button>
      </div>

      {viewMode === "food" ? (
        <div className="space-y-2">
          {theoEntries.length > 0 ? (
            <div className={`${CARD_CONTAINER_CLASS} p-3`}>
              <div className="mb-2 text-sm font-medium text-[#374151]">
                {t("inventory.buffetCostTheoSkuSummary", "Theoretical by SKU (from F&B Forecast)")}
              </div>
              <ul className="grid gap-1 text-sm sm:grid-cols-2 lg:grid-cols-4">
                {theoEntries.map(([sku, azn]) => (
                  <li key={sku} className="flex justify-between gap-2 tabular-nums">
                    <span className="text-[#6B7280]">{sku}</span>
                    <span>{azn.toFixed(2)} AZN</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {handoffTheoZero ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-sm text-amber-900">
              {t(
                "inventory.buffetCostTheoZeroHandoff",
                "Theoretical is 0 from F&B handoff — set guest-nights and Forecast pack norms in F&B /admin/buffet.",
              )}
            </p>
          ) : null}
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            onClick={() => {
              setAdvancedOpen((v) => {
                if (!v) setTheoSkuJson(mapToJson(theoSkuMap));
                return !v;
              });
            }}
          >
            {advancedOpen
              ? t("inventory.buffetCostAdvancedHide", "Hide Advanced JSON")
              : t("inventory.buffetCostAdvancedShow", "Advanced JSON (debug)")}
          </button>
          {advancedOpen ? (
            <FieldTextarea
              label={t(
                "inventory.buffetCostTheoSku",
                'theoreticalBySku JSON (e.g. {"MEAT":1000})',
              )}
              value={theoSkuJson}
              onChange={(e) => {
                setTheoSkuJson(e.target.value);
                try {
                  const parsed = JSON.parse(e.target.value || "{}") as Record<string, unknown>;
                  const next: Record<string, number> = {};
                  for (const [k, v] of Object.entries(parsed)) {
                    const n = Number(v);
                    if (Number.isFinite(n) && n >= 0) next[k] = n;
                  }
                  setTheoSkuMap(next);
                } catch {
                  /* keep typing */
                }
              }}
            />
          ) : null}
        </div>
      ) : null}

      {viewMode === "food" && error ? (
        <p className="buffet-no-print text-sm text-red-600">{error}</p>
      ) : null}

      {viewMode === "food" && outletMismatch ? (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-950">
          <div className="font-medium">
            {t("inventory.buffetCostOutletMismatchTitle", "Outlet code mismatch")}
          </div>
          <p className="mt-1">
            {t(
              "inventory.buffetCostOutletMismatchBody",
              "Query outlet code does not match FOOD warehouse satelliteOutletCode — fix tags in Inventory settings before trusting usage.",
            )}
          </p>
          <Link
            href="/inventory/settings#warehouses"
            className="mt-2 inline-block font-medium text-[#2980B9] underline"
          >
            {t("inventory.buffetCostTagWarehouses", "Tag FOOD warehouses in Inventory settings")}
          </Link>
        </div>
      ) : null}

      {viewMode === "food" && report ? (
        <div className="space-y-4">
          {report.reliability === "ISSUES_ONLY" ? (
            <div className="buffet-no-print rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
              <div className="font-medium">
                {t("inventory.buffetCostIssuesOnlyTitle", "Reliability: ISSUES_ONLY")}
              </div>
              <p className="mt-1 text-amber-900">
                {t(
                  "inventory.buffetCostIssuesOnlyBody",
                  "FOOD stocktake missing or incomplete for this period — treat residual/variance as indicative only.",
                )}
              </p>
              <div className="mt-2 flex flex-wrap gap-3 text-sm">
                <Link
                  href="/inventory/settings#warehouses"
                  className="font-medium text-[#2980B9] underline"
                >
                  {t(
                    "inventory.buffetCostTagWarehouses",
                    "Tag FOOD warehouses in Inventory settings",
                  )}
                </Link>
                <Link href="/inventory/audits" className="font-medium text-[#2980B9] underline">
                  {t("inventory.buffetCostStocktakeLink", "Open / create stocktake")}
                </Link>
              </div>
            </div>
          ) : (
            <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200">
              {t("inventory.buffetCostReliabilityComplete", "Reliability: COMPLETE")}
            </span>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <Metric label={t("inventory.buffetCostUsage", "FOOD usage")} value={report.foodUsageAzn} />
            <Metric
              label={t("inventory.buffetCostAttributed", "Attributed")}
              value={report.attributedAzn}
            />
            <Metric
              label={t("inventory.buffetCostResidual", "Residual buffet")}
              value={report.residualBuffetAzn}
            />
            <Metric
              label={t("inventory.buffetCostTheoretical", "Theoretical")}
              value={report.theoreticalAzn}
            />
            <Metric
              label={t("inventory.buffetCostVariance", "Variance")}
              value={report.varianceAzn}
            />
          </div>

          <div className={`${CARD_CONTAINER_CLASS} p-3`}>
            <div className="mb-2 text-sm font-semibold text-[#2C3E50]">
              {t("inventory.buffetCostAttributedBreakdown", "Attributed breakdown")}
            </div>
            <dl className="grid gap-1 text-sm sm:grid-cols-3">
              <div className="flex justify-between gap-2">
                <dt className="text-[#7F8C8D]">{t("inventory.buffetCostPosSale", "POS sale")}</dt>
                <dd className="tabular-nums">{report.posSaleAzn.toFixed(2)} AZN</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[#7F8C8D]">{t("inventory.buffetCostPosComp", "COMP")}</dt>
                <dd className="tabular-nums">{report.posCompAzn.toFixed(2)} AZN</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[#7F8C8D]">{t("inventory.buffetCostStaffNet", "Staff net")}</dt>
                <dd className="tabular-nums">{report.staffNetAzn.toFixed(2)} AZN</dd>
              </div>
            </dl>
          </div>

          <div className={`${CARD_CONTAINER_CLASS} space-y-2 p-3`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold text-[#2C3E50]">
                {t("inventory.buffetCostWarehouses", "Warehouses")}: {report.warehouseCount}
                {report.satelliteOutletCode
                  ? ` · ${t("inventory.buffetCostOutletShort", "outlet")} ${report.satelliteOutletCode}`
                  : ""}
              </div>
              {report.warehouses.length > 0 ? (
                <button
                  type="button"
                  className={SECONDARY_BUTTON_CLASS}
                  onClick={() => setWhExpanded((v) => !v)}
                >
                  {whExpanded
                    ? t("inventory.buffetCostWhCollapse", "Hide list")
                    : t("inventory.buffetCostWhExpand", "Show list")}
                </button>
              ) : null}
            </div>
            {whExpanded && report.warehouses.length > 0 ? (
              <ul className="list-inside list-disc text-sm text-[#4B5563]">
                {report.warehouses.map((wh) => (
                  <li key={wh.id}>
                    {wh.name}
                    {wh.satelliteOutletCode ? ` (${wh.satelliteOutletCode})` : ""}
                  </li>
                ))}
              </ul>
            ) : null}
            {report.warehouseCount === 0 ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-sm text-amber-900">
                <Link
                  href="/inventory/settings#warehouses"
                  className="font-medium text-[#2980B9] underline"
                >
                  {t(
                    "inventory.buffetCostTagWarehouses",
                    "Tag FOOD warehouses in Inventory settings",
                  )}
                </Link>
              </p>
            ) : null}
          </div>

          {report.cogsPostingNote ? (
            <p className="text-xs text-[#9CA3AF]">{report.cogsPostingNote}</p>
          ) : null}
          {foodWarningsFiltered.length > 0 ? (
            <ul className="list-inside list-disc text-sm text-amber-800">
              {foodWarningsFiltered.map((w) => (
                <li key={w}>{localizeSoftWarning(w, softWarningLabels)}</li>
              ))}
            </ul>
          ) : report.reliability === "COMPLETE" ? (
            <p className="text-sm text-emerald-700">
              {t("inventory.buffetCostNoWarnings", "No soft warnings")}
            </p>
          ) : null}

          <div className={DATA_TABLE_VIEWPORT_CLASS}>
            <table className={DATA_TABLE_CLASS}>
              <thead>
                <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>
                    {t("inventory.buffetCostColSku", "SKU")}
                  </th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>
                    {t("inventory.buffetCostColName", "Name")}
                  </th>
                  <th className={DATA_TABLE_TH_RIGHT_CLASS}>
                    {t("inventory.buffetCostColUsage", "Usage")}
                  </th>
                  <th className={DATA_TABLE_TH_RIGHT_CLASS}>
                    {t("inventory.buffetCostColTheoretical", "Theoretical")}
                  </th>
                  <th className={DATA_TABLE_TH_RIGHT_CLASS}>
                    {t("inventory.buffetCostColVariance", "Variance")}
                  </th>
                  <th className={DATA_TABLE_TH_RIGHT_CLASS}>
                    {t("inventory.buffetCostColPct", "%")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {report.skuRows.length === 0 ? (
                  <tr className={DATA_TABLE_TR_CLASS}>
                    <td className={DATA_TABLE_TD_CLASS} colSpan={6}>
                      {t(
                        "inventory.buffetCostNoSku",
                        "No FOOD OUT movements in scoped warehouses for this period. Tag warehouses with costClass=FOOD.",
                      )}
                    </td>
                  </tr>
                ) : (
                  report.skuRows.map((row) => {
                    const outOfBand = Boolean(row.warning);
                    const pct = row.actualVsTheoreticalPct;
                    return (
                    <tr
                      key={row.sku}
                      className={`${DATA_TABLE_TR_CLASS}${
                        outOfBand ? " bg-amber-50" : ""
                      }`}
                      title={
                        outOfBand && row.theoreticalAzn != null
                          ? t(
                              "inventory.buffetCostSkuVarianceHint",
                              "{{sku}}: usage {{usage}} vs theoretical {{theo}} AZN",
                              {
                                sku: row.sku,
                                usage: row.usageAzn.toFixed(2),
                                theo: row.theoreticalAzn.toFixed(2),
                              },
                            )
                          : undefined
                      }
                    >
                      <td className={DATA_TABLE_TD_CLASS}>
                        <span className={outOfBand ? "font-semibold text-amber-900" : ""}>
                          {row.sku}
                        </span>
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        {row.name}
                        {row.warning ? (
                          <div className="text-xs font-medium text-amber-800">
                            {row.warning}
                          </div>
                        ) : null}
                      </td>
                      <td className={DATA_TABLE_TD_RIGHT_CLASS}>
                        {row.usageAzn.toFixed(2)}
                      </td>
                      <td className={DATA_TABLE_TD_RIGHT_CLASS}>
                        {row.theoreticalAzn != null
                          ? row.theoreticalAzn.toFixed(2)
                          : "—"}
                      </td>
                      <td
                        className={`${DATA_TABLE_TD_RIGHT_CLASS}${
                          outOfBand ? " font-semibold text-amber-900" : ""
                        }`}
                      >
                        {row.varianceAzn != null ? row.varianceAzn.toFixed(2) : "—"}
                      </td>
                      <td
                        className={`${DATA_TABLE_TD_RIGHT_CLASS}${
                          outOfBand ? " font-semibold text-amber-900" : ""
                        }`}
                      >
                        {pct != null ? `${pct.toFixed(1)}%` : "—"}
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {viewMode === "budget" ? (
        <div className="space-y-4">
          <p className="m-0 text-sm text-[#6B7280]">
            {t(
              "inventory.outletBudgetHint",
              "Plan/fact for CHEMICAL, CONSUMABLE, TABLEWARE, INVENTORY_GT warehouses. Weekly plan scales to the selected period. TABLEWARE stocktake cadence defaults to every 15 days in F&B settings.",
            )}
          </p>
          <div className={`${CARD_CONTAINER_CLASS} grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4`}>
            {BUDGET_CLASSES.filter((cls) => {
              // Hide INVENTORY_GT until a WH is tagged (or plan already set).
              if (cls !== "INVENTORY_GT") return true;
              const row = budgetReport?.rows.find((r) => r.costClass === cls);
              const whCount = row?.warehouseCount ?? 0;
              const planVal = Number(planDraft.INVENTORY_GT) || 0;
              return whCount > 0 || planVal > 0;
            }).map((cls) => (
              <Field
                key={cls}
                label={t(`inventory.outletBudgetPlan${cls}`, `Plan ${cls} (week AZN)`)}
                preset="amount"
                type="number"
                min={0}
                value={planDraft[cls]}
                onChange={(e) =>
                  setPlanDraft((prev) => ({ ...prev, [cls]: e.target.value }))
                }
              />
            ))}
          </div>
          {budgetReport &&
          (budgetReport.rows.find((r) => r.costClass === "INVENTORY_GT")?.warehouseCount ??
            0) === 0 &&
          (Number(planDraft.INVENTORY_GT) || 0) <= 0 ? (
            <p className="m-0 text-xs text-[#9CA3AF]">
              {t(
                "inventory.outletBudgetGtHidden",
                "INVENTORY_GT plan hidden — tag a warehouse with costClass=INVENTORY_GT in Inventory settings to enable.",
              )}{" "}
              <Link
                href="/inventory/settings#warehouses"
                className="text-[#2980B9] underline"
              >
                {t("inventory.buffetCostTagWarehouses", "Tag FOOD warehouses in Inventory settings")}
              </Link>
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              disabled={planSaving}
              onClick={() => void saveBudgetPlan()}
            >
              {planSaving ? "…" : t("inventory.outletBudgetSavePlan", "Save plan")}
            </button>
          </div>
          {budgetError ? <p className="text-sm text-red-600">{budgetError}</p> : null}
          {budgetWhEmpty ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-sm text-amber-900">
              <Link
                href="/inventory/settings#warehouses"
                className="font-medium text-[#2980B9] underline"
              >
                {t(
                  "inventory.outletBudgetTagWh",
                  "Tag non-FOOD warehouses (CHEMICAL / CONSUMABLE / TABLEWARE / INVENTORY_GT) in Inventory settings",
                )}
              </Link>
            </p>
          ) : null}
          {budgetReport ? (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <Metric
                  label={t("inventory.outletBudgetPlanTotal", "Plan total")}
                  value={budgetReport.planTotalAzn}
                />
                <Metric
                  label={t("inventory.outletBudgetFactTotal", "Fact total")}
                  value={budgetReport.factTotalAzn}
                />
                <Metric
                  label={t("inventory.outletBudgetVariance", "Variance")}
                  value={budgetReport.varianceTotalAzn}
                />
              </div>
              {budgetReport.stocktakeHint ? (
                <p className="text-xs text-[#9CA3AF]">{budgetReport.stocktakeHint}</p>
              ) : null}
              {budgetReport.warnings.length > 0 ? (
                <ul className="list-inside list-disc text-sm text-amber-800">
                  {budgetReport.warnings.map((w) => (
                    <li key={w}>{localizeSoftWarning(w, softWarningLabels)}</li>
                  ))}
                </ul>
              ) : null}
              <div className={DATA_TABLE_VIEWPORT_CLASS}>
                <table className={DATA_TABLE_CLASS}>
                  <thead>
                    <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                      <th className={DATA_TABLE_TH_LEFT_CLASS}>
                        {t("inventory.outletBudgetColClass", "Class")}
                      </th>
                      <th className={DATA_TABLE_TH_RIGHT_CLASS}>
                        {t("inventory.outletBudgetColPlan", "Plan")}
                      </th>
                      <th className={DATA_TABLE_TH_RIGHT_CLASS}>
                        {t("inventory.outletBudgetColFact", "Fact")}
                      </th>
                      <th className={DATA_TABLE_TH_RIGHT_CLASS}>
                        {t("inventory.outletBudgetColVariance", "Variance")}
                      </th>
                      <th className={DATA_TABLE_TH_RIGHT_CLASS}>
                        {t("inventory.outletBudgetColWh", "WH")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {budgetReport.rows.map((row) => (
                      <tr key={row.costClass} className={DATA_TABLE_TR_CLASS}>
                        <td className={DATA_TABLE_TD_CLASS}>
                          {t(`inventory.costClass.${row.costClass}`, row.costClass)}
                        </td>
                        <td className={DATA_TABLE_TD_RIGHT_CLASS}>
                          {row.planAzn.toFixed(2)}
                        </td>
                        <td className={DATA_TABLE_TD_RIGHT_CLASS}>
                          {row.factAzn.toFixed(2)}
                        </td>
                        <td className={DATA_TABLE_TD_RIGHT_CLASS}>
                          {row.varianceAzn.toFixed(2)}
                        </td>
                        <td className={DATA_TABLE_TD_RIGHT_CLASS}>
                          {row.warehouseCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className={`${CARD_CONTAINER_CLASS} p-3`}>
      <div className="text-xs uppercase tracking-wide text-[#9CA3AF]">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums text-[#111827]">
        {value.toFixed(2)}{" "}
        <span className="text-sm font-normal text-[#6B7280]">AZN</span>
      </div>
    </div>
  );
}
