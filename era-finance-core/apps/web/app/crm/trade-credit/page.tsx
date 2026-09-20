"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { CatalogField } from "@era/satellite-kit/ui";
import { PageHeader } from "../../../components/layout/page-header";
import { apiFetch } from "../../../lib/api-client";
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
  MODAL_CHECKBOX_CLASS,
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "../../../lib/design-system";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { useSubscription } from "../../../lib/subscription-context";
import { EmptyState } from "../../../components/empty-state";

type PolicyGroupCode = "A" | "B" | "C" | "D";

type GrantRow = {
  id: string;
  counterpartyId: string;
  amount: number;
  expiresAt: string;
  status: "ISSUED" | "CONSUMED" | "EXPIRED" | "VOID";
  createdAt: string;
};

type FacilityRow = {
  id: string;
  counterpartyId: string;
  creditLimit: number;
  stopList: boolean;
  policyGroup: PolicyGroupCode | null;
  proposedLimit: number | null;
  proposedKind?: string | null;
  suggestedLimit?: number | null;
  limitBeforeBlock?: number | null;
};

type LimitDecisionRow = {
  id: string;
  counterpartyId: string;
  kind: string;
  oldLimit: number;
  newLimit: number;
  accepted: boolean;
  decidedAt: string;
  followupMaxDpd30: number | null;
};

const POLICY_LETTER: Record<PolicyGroupCode, string> = {
  A: "А",
  B: "Б",
  C: "В",
  D: "Г",
};

export default function TradeCreditGrantsPage() {
  const { t } = useTranslation();
  const { token, ready } = useRequireAuth();
  const { ready: subReady, effectiveSnapshot } = useSubscription();
  const skuOn = Boolean(effectiveSnapshot?.modules.tradeCreditControl);

  const [rows, setRows] = useState<GrantRow[]>([]);
  const [facilities, setFacilities] = useState<FacilityRow[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [policyGroupFilter, setPolicyGroupFilter] = useState("");
  const [counterpartyId, setCounterpartyId] = useState("");
  const [focusCounterpartyId, setFocusCounterpartyId] = useState<string | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [policyBusy, setPolicyBusy] = useState<string | null>(null);
  const [skuOff, setSkuOff] = useState(false);
  const [orgPolicy, setOrgPolicy] = useState<{
    enrichRiskyForcesD: boolean;
    enrichVoenInactiveForcesD: boolean;
    trialLimitAzn: number;
    restoreProposalEnabled: boolean;
    enrichTtlDays: number;
    limitK: number;
    suggestedCapAzn: number | null;
    groupMultB: number;
    groupMultC: number;
    partialPayHaircut: number;
    partialPayThreshold: number;
    concentrationHaircut: number;
    concentrationThreshold: number;
    enrichHaircut: number;
  } | null>(null);
  const [orgPolicyBusy, setOrgPolicyBusy] = useState(false);
  const [decisions, setDecisions] = useState<LimitDecisionRow[]>([]);
  const [hitRate30d, setHitRate30d] = useState<number | null>(null);

  const statusOptions = useMemo(
    () => [
      { value: "", label: t("tradeCredit.filterStatusAll") },
      { value: "ISSUED", label: t("tradeCredit.statusIssued") },
      { value: "CONSUMED", label: t("tradeCredit.statusConsumed") },
      { value: "EXPIRED", label: t("tradeCredit.statusExpired") },
      { value: "VOID", label: t("tradeCredit.statusVoid") },
    ],
    [t],
  );

  const policyGroupOptions = useMemo(
    () => [
      { value: "", label: t("tradeCredit.filterPolicyGroupAll") },
      { value: "A", label: t("tradeCredit.policyGroupA") },
      { value: "B", label: t("tradeCredit.policyGroupB") },
      { value: "C", label: t("tradeCredit.policyGroupC") },
      { value: "D", label: t("tradeCredit.policyGroupD") },
    ],
    [t],
  );

  const statusLabel = useCallback(
    (status: GrantRow["status"]) => {
      switch (status) {
        case "ISSUED":
          return t("tradeCredit.statusIssued");
        case "CONSUMED":
          return t("tradeCredit.statusConsumed");
        case "EXPIRED":
          return t("tradeCredit.statusExpired");
        case "VOID":
          return t("tradeCredit.statusVoid");
        default:
          return status;
      }
    },
    [t],
  );

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    const facQs = new URLSearchParams();
    if (policyGroupFilter) facQs.set("policyGroup", policyGroupFilter);
    const facRes = await apiFetch(
      `/api/trade-credit/facilities${facQs.toString() ? `?${facQs}` : ""}`,
    );
    if (facRes.status === 402) {
      setSkuOff(true);
      setFacilities([]);
      setRows([]);
      setLoading(false);
      return;
    }
    if (facRes.ok) {
      setFacilities((await facRes.json()) as FacilityRow[]);
    } else {
      setFacilities([]);
    }

    const polRes = await apiFetch("/api/trade-credit/policy");
    if (polRes.ok) {
      const pol = (await polRes.json()) as {
        enrichRiskyForcesD?: boolean;
        enrichVoenInactiveForcesD?: boolean;
        trialLimitAzn?: number;
        restoreProposalEnabled?: boolean;
        enrichTtlDays?: number;
        limitK?: number;
        suggestedCapAzn?: number | null;
        groupMultB?: number;
        groupMultC?: number;
        partialPayHaircut?: number;
        partialPayThreshold?: number;
        concentrationHaircut?: number;
        concentrationThreshold?: number;
        enrichHaircut?: number;
      };
      setOrgPolicy({
        enrichRiskyForcesD: Boolean(pol.enrichRiskyForcesD),
        enrichVoenInactiveForcesD: Boolean(pol.enrichVoenInactiveForcesD),
        trialLimitAzn: Number(pol.trialLimitAzn ?? 500),
        restoreProposalEnabled: pol.restoreProposalEnabled !== false,
        enrichTtlDays: Number(pol.enrichTtlDays ?? 90),
        limitK: Number(pol.limitK ?? 1),
        suggestedCapAzn:
          pol.suggestedCapAzn == null ? null : Number(pol.suggestedCapAzn),
        groupMultB: Number(pol.groupMultB ?? 0.5),
        groupMultC: Number(pol.groupMultC ?? 0.3),
        partialPayHaircut: Number(pol.partialPayHaircut ?? 0.8),
        partialPayThreshold: Number(pol.partialPayThreshold ?? 0.3),
        concentrationHaircut: Number(pol.concentrationHaircut ?? 0.7),
        concentrationThreshold: Number(pol.concentrationThreshold ?? 0.8),
        enrichHaircut: Number(pol.enrichHaircut ?? 0.5),
      });
    }

    const decRes = await apiFetch("/api/trade-credit/limit-decisions");
    if (decRes.ok) {
      const body = (await decRes.json()) as {
        hitRate30d?: number | null;
        decisions?: LimitDecisionRow[];
      };
      setHitRate30d(
        typeof body.hitRate30d === "number" ? body.hitRate30d : null,
      );
      setDecisions(Array.isArray(body.decisions) ? body.decisions : []);
    } else {
      setDecisions([]);
      setHitRate30d(null);
    }

    const qs = new URLSearchParams();
    if (statusFilter) qs.set("status", statusFilter);
    if (counterpartyId.trim()) qs.set("counterpartyId", counterpartyId.trim());
    const res = await apiFetch(
      `/api/trade-credit/grants${qs.toString() ? `?${qs}` : ""}`,
    );
    if (res.status === 402) {
      setSkuOff(true);
      setRows([]);
      setLoading(false);
      return;
    }
    if (!res.ok) {
      setError(t("tradeCredit.loadErr"));
      setLoading(false);
      return;
    }
    setSkuOff(false);
    setRows((await res.json()) as GrantRow[]);
    setLoading(false);
  }, [token, statusFilter, policyGroupFilter, counterpartyId, t]);

  useEffect(() => {
    if (ready && token && subReady) void load();
  }, [ready, token, subReady, load]);

  async function voidGrant(id: string) {
    if (!window.confirm(t("tradeCredit.voidConfirm"))) return;
    setBusyId(id);
    const res = await apiFetch(`/api/trade-credit/grants/${id}/void`, {
      method: "POST",
    });
    setBusyId(null);
    if (!res.ok) {
      toast.error(t("tradeCredit.voidErr"), { description: await res.text() });
      return;
    }
    toast.success(t("tradeCredit.voidOk"));
    await load();
  }

  async function facilityPolicyAction(
    counterpartyIdAction: string,
    path: "accept-raise" | "reject-raise" | "restore-after-block",
    okKey: string,
    errKey: string,
  ) {
    setPolicyBusy(`${path}:${counterpartyIdAction}`);
    const res = await apiFetch(`/api/trade-credit/policy/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ counterpartyId: counterpartyIdAction }),
    });
    setPolicyBusy(null);
    if (!res.ok) {
      toast.error(t(errKey), { description: await res.text() });
      return;
    }
    toast.success(t(okKey));
    await load();
  }

  async function saveOrgPolicyEnrich(
    patch: Partial<{
      enrichRiskyForcesD: boolean;
      enrichVoenInactiveForcesD: boolean;
      trialLimitAzn: number;
      restoreProposalEnabled: boolean;
      enrichTtlDays: number;
      limitK: number;
      suggestedCapAzn: number | null;
      groupMultB: number;
      groupMultC: number;
      partialPayHaircut: number;
      partialPayThreshold: number;
      concentrationHaircut: number;
      concentrationThreshold: number;
      enrichHaircut: number;
    }>,
  ) {
    if (!orgPolicy) return;
    setOrgPolicyBusy(true);
    const next = { ...orgPolicy, ...patch };
    setOrgPolicy(next);
    const res = await apiFetch("/api/trade-credit/policy", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setOrgPolicyBusy(false);
    if (!res.ok) {
      toast.error(t("tradeCredit.orgPolicySaveErr"), {
        description: await res.text(),
      });
      await load();
      return;
    }
    toast.success(t("tradeCredit.orgPolicySaved"));
  }

  function focusCounterparty(id: string) {
    setFocusCounterpartyId(id);
    setCounterpartyId(id);
  }

  if (!ready) return <p>{t("common.loading")}</p>;
  if (!token) return null;

  if (subReady && !skuOn && skuOff) {
    return (
      <div className="max-w-lg space-y-3 rounded-2xl border border-[#D5DADF] bg-white p-8 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-[#34495E]">{t("tradeCredit.title")}</h1>
        <p className="text-sm text-[#7F8C8D]">{t("tradeCredit.skuOff")}</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader
        title={t("tradeCredit.title")}
        subtitle={t("tradeCredit.subtitle")}
      />

      {orgPolicy ? (
        <div className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
          <h2 className="text-sm font-semibold text-[#34495E]">
            {t("tradeCredit.orgPolicyEnrichTitle")}
          </h2>
          <p className="text-xs text-[#7F8C8D]">
            {t("tradeCredit.orgPolicyEnrichHint")}
          </p>
          <label className="flex items-center gap-2 text-sm text-[#34495E]">
            <input
              type="checkbox"
              className={MODAL_CHECKBOX_CLASS}
              checked={orgPolicy.enrichRiskyForcesD}
              disabled={orgPolicyBusy}
              onChange={(e) =>
                void saveOrgPolicyEnrich({
                  enrichRiskyForcesD: e.target.checked,
                })
              }
            />
            {t("tradeCredit.enrichRiskyForcesD")}
          </label>
          <label className="flex items-center gap-2 text-sm text-[#34495E]">
            <input
              type="checkbox"
              className={MODAL_CHECKBOX_CLASS}
              checked={orgPolicy.enrichVoenInactiveForcesD}
              disabled={orgPolicyBusy}
              onChange={(e) =>
                void saveOrgPolicyEnrich({
                  enrichVoenInactiveForcesD: e.target.checked,
                })
              }
            />
            {t("tradeCredit.enrichVoenInactiveForcesD")}
          </label>
          <label className="flex items-center gap-2 text-sm text-[#34495E]">
            <input
              type="checkbox"
              className={MODAL_CHECKBOX_CLASS}
              checked={orgPolicy.restoreProposalEnabled}
              disabled={orgPolicyBusy}
              onChange={(e) =>
                void saveOrgPolicyEnrich({
                  restoreProposalEnabled: e.target.checked,
                })
              }
            />
            {t("tradeCredit.restoreProposalEnabled")}
          </label>
          <div className="flex flex-wrap gap-4 pt-1">
            <label className="text-sm text-[#34495E]">
              {t("tradeCredit.trialLimitAzn")}
              <input
                className={`${MODAL_INPUT_CLASS} !mt-1 !w-32`}
                type="number"
                min={0}
                step={50}
                value={orgPolicy.trialLimitAzn}
                disabled={orgPolicyBusy}
                onBlur={(e) => {
                  const v = Number(e.target.value);
                  if (!Number.isFinite(v) || v < 0) return;
                  void saveOrgPolicyEnrich({ trialLimitAzn: v });
                }}
                onChange={(e) =>
                  setOrgPolicy({
                    ...orgPolicy,
                    trialLimitAzn: Number(e.target.value),
                  })
                }
              />
            </label>
            <label className="text-sm text-[#34495E]">
              {t("tradeCredit.enrichTtlDays")}
              <input
                className={`${MODAL_INPUT_CLASS} !mt-1 !w-24`}
                type="number"
                min={1}
                step={1}
                value={orgPolicy.enrichTtlDays}
                disabled={orgPolicyBusy}
                onBlur={(e) => {
                  const v = Math.floor(Number(e.target.value));
                  if (!Number.isFinite(v) || v < 1) return;
                  void saveOrgPolicyEnrich({ enrichTtlDays: v });
                }}
                onChange={(e) =>
                  setOrgPolicy({
                    ...orgPolicy,
                    enrichTtlDays: Number(e.target.value),
                  })
                }
              />
            </label>
            {(
              [
                ["limitK", orgPolicy.limitK, 0, 0.1],
                ["groupMultB", orgPolicy.groupMultB, 0, 0.05],
                ["groupMultC", orgPolicy.groupMultC, 0, 0.05],
                ["partialPayThreshold", orgPolicy.partialPayThreshold, 0, 0.05],
                ["partialPayHaircut", orgPolicy.partialPayHaircut, 0, 0.05],
                [
                  "concentrationThreshold",
                  orgPolicy.concentrationThreshold,
                  0,
                  0.05,
                ],
                ["concentrationHaircut", orgPolicy.concentrationHaircut, 0, 0.05],
                ["enrichHaircut", orgPolicy.enrichHaircut, 0, 0.05],
              ] as const
            ).map(([key, value, min, step]) => (
              <label key={key} className="text-sm text-[#34495E]">
                {t(`tradeCredit.${key}`)}
                <input
                  className={`${MODAL_INPUT_CLASS} !mt-1 !w-28`}
                  type="number"
                  min={min}
                  step={step}
                  value={value}
                  disabled={orgPolicyBusy}
                  onBlur={(e) => {
                    const v = Number(e.target.value);
                    if (!Number.isFinite(v) || v < min) return;
                    void saveOrgPolicyEnrich({ [key]: v });
                  }}
                  onChange={(e) =>
                    setOrgPolicy({
                      ...orgPolicy,
                      [key]: Number(e.target.value),
                    })
                  }
                />
              </label>
            ))}
            <label className="text-sm text-[#34495E]">
              {t("tradeCredit.suggestedCapAzn")}
              <input
                className={`${MODAL_INPUT_CLASS} !mt-1 !w-32`}
                type="number"
                min={0}
                step={50}
                value={orgPolicy.suggestedCapAzn ?? ""}
                disabled={orgPolicyBusy}
                placeholder="—"
                onBlur={(e) => {
                  const raw = e.target.value.trim();
                  if (raw === "") {
                    void saveOrgPolicyEnrich({ suggestedCapAzn: null });
                    return;
                  }
                  const v = Number(raw);
                  if (!Number.isFinite(v) || v < 0) return;
                  void saveOrgPolicyEnrich({ suggestedCapAzn: v });
                }}
                onChange={(e) => {
                  const raw = e.target.value.trim();
                  setOrgPolicy({
                    ...orgPolicy,
                    suggestedCapAzn: raw === "" ? null : Number(raw),
                  });
                }}
              />
            </label>
          </div>
        </div>
      ) : null}

      {decisions.length > 0 ? (
        <div className={`${CARD_CONTAINER_CLASS} space-y-2 p-4`}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-[#34495E]">
              {t("tradeCredit.decisionsTitle")}
            </h2>
            {hitRate30d != null ? (
              <span className="text-xs text-[#7F8C8D]">
                {t("tradeCredit.decisionsHitRate", {
                  pct: Math.round(hitRate30d * 100),
                })}
              </span>
            ) : null}
          </div>
          <div className={DATA_TABLE_VIEWPORT_CLASS}>
            <table className={DATA_TABLE_CLASS}>
              <thead>
                <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>
                    {t("tradeCredit.filterCounterparty")}
                  </th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>
                    {t("tradeCredit.proposedKindLabel")}
                  </th>
                  <th className={DATA_TABLE_TH_RIGHT_CLASS}>
                    {t("tradeCredit.oldLimit")}
                  </th>
                  <th className={DATA_TABLE_TH_RIGHT_CLASS}>
                    {t("tradeCredit.newLimit")}
                  </th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>
                    {t("tradeCredit.decisionResult")}
                  </th>
                  <th className={DATA_TABLE_TH_RIGHT_CLASS}>
                    {t("tradeCredit.followupDpd")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {decisions.slice(0, 20).map((d) => (
                  <tr key={d.id} className={DATA_TABLE_TR_CLASS}>
                    <td className={DATA_TABLE_TD_CLASS}>
                      <button
                        type="button"
                        className="text-left text-[#2980B9] underline"
                        onClick={() => focusCounterparty(d.counterpartyId)}
                      >
                        {d.counterpartyId.slice(0, 8)}…
                      </button>
                    </td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      {t(`tradeCredit.kind.${d.kind}`, { defaultValue: d.kind })}
                    </td>
                    <td className={DATA_TABLE_TD_RIGHT_CLASS}>
                      {d.oldLimit.toFixed(2)}
                    </td>
                    <td className={DATA_TABLE_TD_RIGHT_CLASS}>
                      {d.newLimit.toFixed(2)}
                    </td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      {d.accepted
                        ? t("tradeCredit.decisionAccepted")
                        : t("tradeCredit.decisionRejected")}
                    </td>
                    <td className={DATA_TABLE_TD_RIGHT_CLASS}>
                      {d.followupMaxDpd30 ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[12rem]">
          <CatalogField
            kind="CLOSED_SMALL"
            label={t("tradeCredit.filterPolicyGroup")}
            value={policyGroupFilter}
            onChange={(next) =>
              setPolicyGroupFilter(Array.isArray(next) ? next[0] ?? "" : next)
            }
            options={policyGroupOptions}
            emptyLabel={null}
          />
        </div>
        <div className="min-w-[12rem]">
          <CatalogField
            kind="CLOSED_SMALL"
            label={t("tradeCredit.filterStatus")}
            value={statusFilter}
            onChange={(next) => setStatusFilter(Array.isArray(next) ? next[0] ?? "" : next)}
            options={statusOptions}
            emptyLabel={null}
          />
        </div>
        <div>
          <label className="mb-1 block text-[12px] font-medium text-[#7F8C8D]">
            {t("tradeCredit.filterCounterparty")}
          </label>
          <input
            className={`${MODAL_INPUT_CLASS} !w-72`}
            value={counterpartyId}
            onChange={(e) => setCounterpartyId(e.target.value)}
            placeholder="uuid"
          />
        </div>
        <button
          type="button"
          className={PRIMARY_BUTTON_CLASS}
          onClick={() => void load()}
        >
          {t("tradeCredit.applyFilters")}
        </button>
      </div>

      {error ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p>{t("common.loading")}</p>
      ) : (
        <>
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-[#34495E]">
              {t("tradeCredit.facilitiesTitle")}
            </h2>
            {facilities.length === 0 ? (
              <EmptyState title={t("tradeCredit.facilitiesEmpty")} />
            ) : (
              <div className={CARD_CONTAINER_CLASS}>
                <div className={DATA_TABLE_VIEWPORT_CLASS}>
                  <table className={DATA_TABLE_CLASS}>
                    <thead>
                      <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                        <th className={DATA_TABLE_TH_LEFT_CLASS}>
                          {t("tradeCredit.colCounterparty")}
                        </th>
                        <th className={DATA_TABLE_TH_LEFT_CLASS}>
                          {t("tradeCredit.policyGroup")}
                        </th>
                        <th className={DATA_TABLE_TH_RIGHT_CLASS}>
                          {t("tradeCredit.creditLimit")}
                        </th>
                        <th className={DATA_TABLE_TH_RIGHT_CLASS}>
                          {t("tradeCredit.colSuggested")}
                        </th>
                        <th className={DATA_TABLE_TH_LEFT_CLASS}>
                          {t("tradeCredit.stopList")}
                        </th>
                        <th className={DATA_TABLE_TH_RIGHT_CLASS}>
                          {t("tradeCredit.proposedLimit")}
                        </th>
                        <th className={DATA_TABLE_TH_LEFT_CLASS}>
                          {t("tradeCredit.proposedKindLabel")}
                        </th>
                        <th className={DATA_TABLE_TH_LEFT_CLASS}>
                          {t("tradeCredit.colActions")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {facilities.map((row) => (
                        <tr
                          key={row.id}
                          className={`${DATA_TABLE_TR_CLASS}${
                            focusCounterpartyId === row.counterpartyId
                              ? " bg-sky-50"
                              : ""
                          }`}
                        >
                          <td className={`${DATA_TABLE_TD_CLASS} font-mono text-[11px]`}>
                            {row.counterpartyId}
                          </td>
                          <td className={DATA_TABLE_TD_CLASS}>
                            {row.policyGroup ? (
                              <span className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded bg-[#34495E] px-1.5 text-[12px] font-semibold text-white">
                                {POLICY_LETTER[row.policyGroup]}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className={DATA_TABLE_TD_RIGHT_CLASS}>
                            {Number(row.creditLimit).toFixed(2)}
                          </td>
                          <td className={DATA_TABLE_TD_RIGHT_CLASS}>
                            {row.suggestedLimit != null
                              ? Number(row.suggestedLimit).toFixed(2)
                              : "—"}
                          </td>
                          <td className={DATA_TABLE_TD_CLASS}>
                            {row.stopList ? t("common.yes") : t("common.no")}
                          </td>
                          <td className={DATA_TABLE_TD_RIGHT_CLASS}>
                            {row.proposedLimit != null
                              ? Number(row.proposedLimit).toFixed(2)
                              : "—"}
                          </td>
                          <td className={DATA_TABLE_TD_CLASS}>
                            {row.proposedKind
                              ? t(`tradeCredit.kind.${row.proposedKind}`, {
                                  defaultValue: row.proposedKind,
                                })
                              : "—"}
                          </td>
                          <td className={DATA_TABLE_TD_CLASS}>
                            <div className="flex flex-wrap gap-1">
                              <button
                                type="button"
                                className={SECONDARY_BUTTON_CLASS}
                                onClick={() => focusCounterparty(row.counterpartyId)}
                              >
                                {t("tradeCredit.focusGrants")}
                              </button>
                              {row.proposedLimit != null ? (
                                <>
                                  <button
                                    type="button"
                                    className={PRIMARY_BUTTON_CLASS}
                                    disabled={
                                      policyBusy ===
                                      `accept-raise:${row.counterpartyId}`
                                    }
                                    onClick={() =>
                                      void facilityPolicyAction(
                                        row.counterpartyId,
                                        "accept-raise",
                                        "tradeCredit.acceptRaiseOk",
                                        "tradeCredit.acceptRaiseErr",
                                      )
                                    }
                                  >
                                    {t("tradeCredit.acceptRaise")}
                                  </button>
                                  <button
                                    type="button"
                                    className={SECONDARY_BUTTON_CLASS}
                                    disabled={
                                      policyBusy ===
                                      `reject-raise:${row.counterpartyId}`
                                    }
                                    onClick={() =>
                                      void facilityPolicyAction(
                                        row.counterpartyId,
                                        "reject-raise",
                                        "tradeCredit.rejectRaiseOk",
                                        "tradeCredit.rejectRaiseErr",
                                      )
                                    }
                                  >
                                    {t("tradeCredit.rejectRaise")}
                                  </button>
                                </>
                              ) : null}
                              {row.limitBeforeBlock != null ? (
                                <button
                                  type="button"
                                  className={SECONDARY_BUTTON_CLASS}
                                  disabled={
                                    policyBusy ===
                                    `restore-after-block:${row.counterpartyId}`
                                  }
                                  onClick={() =>
                                    void facilityPolicyAction(
                                      row.counterpartyId,
                                      "restore-after-block",
                                      "tradeCredit.restoreAfterBlockOk",
                                      "tradeCredit.restoreAfterBlockErr",
                                    )
                                  }
                                >
                                  {t("tradeCredit.restoreAfterBlock")}
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-[#34495E]">
              {t("tradeCredit.grantsTitle")}
            </h2>
            {rows.length === 0 ? (
              <EmptyState title={t("tradeCredit.empty")} />
            ) : (
              <div className={CARD_CONTAINER_CLASS}>
                <div className={DATA_TABLE_VIEWPORT_CLASS}>
                  <table className={DATA_TABLE_CLASS}>
                    <thead>
                      <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                        <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("tradeCredit.colCreated")}</th>
                        <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("tradeCredit.colCounterparty")}</th>
                        <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("tradeCredit.colAmount")}</th>
                        <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("tradeCredit.colExpires")}</th>
                        <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("tradeCredit.colStatus")}</th>
                        <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("tradeCredit.colActions")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr
                          key={row.id}
                          className={`${DATA_TABLE_TR_CLASS}${
                            focusCounterpartyId === row.counterpartyId
                              ? " bg-sky-50"
                              : ""
                          }`}
                        >
                          <td className={DATA_TABLE_TD_CLASS}>
                            {row.createdAt.slice(0, 19).replace("T", " ")}
                          </td>
                          <td className={`${DATA_TABLE_TD_CLASS} font-mono text-[11px]`}>
                            {row.counterpartyId}
                          </td>
                          <td className={DATA_TABLE_TD_RIGHT_CLASS}>
                            {Number(row.amount).toFixed(2)}
                          </td>
                          <td className={DATA_TABLE_TD_CLASS}>
                            {row.expiresAt.slice(0, 19).replace("T", " ")}
                          </td>
                          <td className={DATA_TABLE_TD_CLASS}>{statusLabel(row.status)}</td>
                          <td className={DATA_TABLE_TD_CLASS}>
                            {row.status === "ISSUED" ? (
                              <button
                                type="button"
                                className={SECONDARY_BUTTON_CLASS}
                                disabled={busyId === row.id}
                                onClick={() => void voidGrant(row.id)}
                              >
                                {t("tradeCredit.void")}
                              </button>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
