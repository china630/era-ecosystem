"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { CatalogField } from "@era/satellite-kit/ui";
import { apiFetch } from "../../../lib/api-client";
import { useSubscription } from "../../../lib/subscription-context";
import {
  MODAL_CHECKBOX_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "../../../lib/design-system";

type PolicyGroupCode = "A" | "B" | "C" | "D";

type EnrichmentRun = {
  id: string;
  riskyTaxpayer: boolean | null;
  voenName: string | null;
  voenInactive: boolean | null;
  errorMessage: string | null;
  createdAt: string;
};

type FacilityView = {
  counterpartyId: string;
  facilityId: string | null;
  creditLimit: number;
  stopList: boolean;
  status: "ACTIVE" | "DISABLED" | null;
  openAr: number;
  unusedIssuedGrants: number;
  available: number;
  policyGroup: PolicyGroupCode | null;
  policyGroupComputed: PolicyGroupCode | null;
  policyGroupManual: PolicyGroupCode | null;
  policyReasons: string[];
  proposedLimit: number | null;
  proposedAt: string | null;
  proposedKind: string | null;
  suggestedLimit: number | null;
  limitBeforeBlock: number | null;
  autoRaiseMuted: boolean;
};

const POLICY_LETTER: Record<PolicyGroupCode, string> = {
  A: "А",
  B: "Б",
  C: "В",
  D: "Г",
};

const lbl = MODAL_FIELD_LABEL_CLASS;

export function TradeCreditFacilitySection({
  counterpartyId,
  defaultInviteEmail,
}: {
  counterpartyId: string;
  defaultInviteEmail?: string;
}) {
  const { t } = useTranslation();
  const { ready: subReady, effectiveSnapshot } = useSubscription();
  const skuOn = Boolean(effectiveSnapshot?.modules.tradeCreditControl);

  const [skuProbe, setSkuProbe] = useState<"unknown" | "on" | "off">("unknown");
  const [facility, setFacility] = useState<FacilityView | null>(null);
  const [creditLimit, setCreditLimit] = useState("0");
  const [stopList, setStopList] = useState(false);
  const [status, setStatus] = useState<"ACTIVE" | "DISABLED">("ACTIVE");
  const [manualPin, setManualPin] = useState("");
  const [grantAmount, setGrantAmount] = useState("");
  const [issuedCode, setIssuedCode] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState(defaultInviteEmail ?? "");
  const [inviteTempPassword, setInviteTempPassword] = useState<string | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [loadBusy, setLoadBusy] = useState(false);
  const [enrichmentRuns, setEnrichmentRuns] = useState<EnrichmentRun[]>([]);
  const [enrichmentBusy, setEnrichmentBusy] = useState(false);
  const [enrichSoftBlocked, setEnrichSoftBlocked] = useState(false);

  const enabled = skuOn || skuProbe === "on";

  const pinOptions = useMemo(
    () => [
      { value: "A", label: t("tradeCredit.policyGroupA") },
      { value: "B", label: t("tradeCredit.policyGroupB") },
      { value: "C", label: t("tradeCredit.policyGroupC") },
      { value: "D", label: t("tradeCredit.policyGroupD") },
    ],
    [t],
  );

  const applyView = useCallback((view: FacilityView) => {
    setFacility(view);
    setCreditLimit(String(view.creditLimit ?? 0));
    setStopList(Boolean(view.stopList));
    setStatus(view.status === "DISABLED" ? "DISABLED" : "ACTIVE");
    setManualPin(view.policyGroupManual ?? "");
  }, []);

  const loadFacility = useCallback(async () => {
    if (!counterpartyId) return;
    setLoadBusy(true);
    const res = await apiFetch(`/api/counterparties/${counterpartyId}/trade-credit`);
    if (res.status === 402) {
      setSkuProbe("off");
      setFacility(null);
      setLoadBusy(false);
      return;
    }
    if (!res.ok) {
      setLoadBusy(false);
      toast.error(t("tradeCredit.facilityLoadErr"), {
        description: await res.text(),
      });
      return;
    }
    setSkuProbe("on");
    const view = (await res.json()) as FacilityView;
    applyView(view);
    setLoadBusy(false);
  }, [counterpartyId, t, applyView]);

  const loadEnrichment = useCallback(async () => {
    if (!counterpartyId) return;
    const res = await apiFetch(
      `/api/counterparties/${counterpartyId}/trade-credit/enrichment`,
    );
    if (res.status === 402 || !res.ok) {
      setEnrichmentRuns([]);
      setEnrichSoftBlocked(false);
      return;
    }
    const body = (await res.json()) as
      | EnrichmentRun[]
      | {
          runs?: EnrichmentRun[];
          enrichMeter?: { softBlocked?: boolean };
        };
    if (Array.isArray(body)) {
      setEnrichmentRuns(body);
      setEnrichSoftBlocked(false);
      return;
    }
    setEnrichmentRuns(body.runs ?? []);
    setEnrichSoftBlocked(Boolean(body.enrichMeter?.softBlocked));
  }, [counterpartyId]);

  useEffect(() => {
    if (!subReady) return;
    if (skuOn) {
      void loadFacility();
      void loadEnrichment();
      return;
    }
    // Probe facility when subscription snapshot omits the flag
    void loadFacility();
    void loadEnrichment();
  }, [subReady, skuOn, loadFacility, loadEnrichment]);

  useEffect(() => {
    setInviteEmail(defaultInviteEmail ?? "");
  }, [defaultInviteEmail]);

  if (!subReady) return null;
  if (!enabled && skuProbe === "off") return null;
  if (!enabled && skuProbe === "unknown" && !skuOn) {
    return loadBusy ? (
      <p className="text-[13px] text-[#7F8C8D]">{t("common.loading")}</p>
    ) : null;
  }

  async function saveFacility() {
    setBusy(true);
    const res = await apiFetch(`/api/counterparties/${counterpartyId}/trade-credit`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creditLimit: Number(creditLimit) || 0,
        stopList,
        status,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(t("tradeCredit.facilitySaveErr"), {
        description: await res.text(),
      });
      return;
    }
    const view = (await res.json()) as FacilityView;
    applyView(view);
    toast.success(t("tradeCredit.facilitySaveOk"));
  }

  async function pinPolicy(next: string) {
    setBusy(true);
    const group = next === "" ? null : (next as PolicyGroupCode);
    const res = await apiFetch("/api/trade-credit/policy/pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ counterpartyId, group }),
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(t("tradeCredit.policyPinErr"), {
        description: await res.text(),
      });
      return;
    }
    setManualPin(next);
    toast.success(t("tradeCredit.policyPinOk"));
    await loadFacility();
  }

  async function policyAction(
    path: "accept-raise" | "reject-raise" | "restore-after-block" | "reclassify",
    okKey: string,
    errKey: string,
  ) {
    setBusy(true);
    const res = await apiFetch(`/api/trade-credit/policy/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ counterpartyId }),
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(t(errKey), { description: await res.text() });
      return;
    }
    toast.success(t(okKey));
    await loadFacility();
  }

  async function issueGrant() {
    const amount = Number(grantAmount);
    if (!(amount > 0)) {
      toast.error(t("tradeCredit.grantIssueErr"));
      return;
    }
    setBusy(true);
    const res = await apiFetch("/api/trade-credit/grants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ counterpartyId, amount }),
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(t("tradeCredit.grantIssueErr"), {
        description: await res.text(),
      });
      return;
    }
    const issued = (await res.json()) as { code?: string };
    setIssuedCode(issued.code ?? null);
    toast.success(t("tradeCredit.grantIssued"));
    setGrantAmount("");
    await loadFacility();
  }

  async function runDeepCheck() {
    setEnrichmentBusy(true);
    const res = await apiFetch(
      `/api/counterparties/${counterpartyId}/trade-credit/enrichment`,
      { method: "POST" },
    );
    setEnrichmentBusy(false);
    if (!res.ok) {
      const text = await res.text();
      let code: string | undefined;
      try {
        code = (JSON.parse(text) as { code?: string }).code;
      } catch {
        /* ignore */
      }
      if (code === "TRADE_CREDIT_ENRICH_SOFT_BLOCKED") {
        setEnrichSoftBlocked(true);
        toast.error(t("tradeCredit.deepCheckSoftBlocked"));
        return;
      }
      toast.error(t("tradeCredit.deepCheckErr"), {
        description: text,
      });
      return;
    }
    toast.success(t("tradeCredit.deepCheckOk"));
    await loadEnrichment();
  }

  async function inviteBuyer() {
    const email = inviteEmail.trim();
    if (!email) return;
    setBusy(true);
    setInviteTempPassword(null);
    const res = await apiFetch(
      `/api/counterparties/${counterpartyId}/trade-credit/invite`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      },
    );
    setBusy(false);
    if (res.status === 404) {
      toast.error(t("tradeCredit.inviteUnavailable"));
      return;
    }
    if (!res.ok) {
      toast.error(t("tradeCredit.inviteErr"), {
        description: await res.text(),
      });
      return;
    }
    const body = (await res.json().catch(() => ({}))) as {
      temporaryPassword?: string;
      createdAccount?: boolean;
    };
    if (body.temporaryPassword) {
      setInviteTempPassword(body.temporaryPassword);
      toast.success(t("tradeCredit.inviteOk"), {
        description: t("tradeCredit.inviteTempPassword", {
          password: body.temporaryPassword,
        }),
      });
      return;
    }
    toast.success(
      body.createdAccount === false
        ? t("tradeCredit.inviteExistingAccount")
        : t("tradeCredit.inviteOk"),
    );
  }

  const effectiveLetter =
    facility?.policyGroup != null ? POLICY_LETTER[facility.policyGroup] : null;
  const sourceLabel =
    facility?.policyGroupManual != null
      ? t("tradeCredit.policySourceManual")
      : facility?.policyGroupComputed != null
        ? t("tradeCredit.policySourceComputed")
        : t("tradeCredit.policySourceNone");

  return (
    <div className="border-t border-[#E5E7EB] pt-4 space-y-3">
      <h4 className="text-[13px] font-semibold text-[#34495E]">
        {t("tradeCredit.sectionTitle")}
      </h4>
      {loadBusy ? (
        <p className="text-[13px] text-[#7F8C8D]">{t("common.loading")}</p>
      ) : (
        <>
          {facility ? (
            <p className="text-[12px] text-[#7F8C8D]">
              {t("tradeCredit.available")}:{" "}
              <span className="font-semibold tabular-nums text-[#34495E]">
                {facility.available.toFixed(2)} AZN
              </span>
              {" · "}
              {t("tradeCredit.openAr")}: {facility.openAr.toFixed(2)}
              {" · "}
              {t("tradeCredit.unusedGrants")}: {facility.unusedIssuedGrants.toFixed(2)}
            </p>
          ) : null}

          {facility ? (
            <div className="space-y-2 rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className={lbl}>{t("tradeCredit.policyGroup")}</span>
                {effectiveLetter ? (
                  <span
                    className="inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-md bg-[#34495E] px-2 text-[13px] font-semibold text-white"
                    title={facility.policyGroup ?? undefined}
                  >
                    {effectiveLetter}
                  </span>
                ) : (
                  <span className="text-[12px] text-[#7F8C8D]">
                    {t("tradeCredit.policyGroupNone")}
                  </span>
                )}
                <span className="text-[11px] text-[#7F8C8D]">{sourceLabel}</span>
              </div>
              {facility.policyReasons?.length ? (
                <ul className="list-disc space-y-0.5 pl-4 text-[12px] text-[#5D6D7E]">
                  {facility.policyReasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              ) : null}
              <CatalogField
                kind="CLOSED_SMALL"
                label={t("tradeCredit.policyPin")}
                value={manualPin}
                onChange={(next) => {
                  const v = Array.isArray(next) ? next[0] ?? "" : next;
                  void pinPolicy(v);
                }}
                options={pinOptions}
                emptyLabel={t("tradeCredit.policyPinClear")}
                disabled={busy}
              />
              <label className="flex cursor-pointer items-center gap-2 text-[13px] text-[#34495E]">
                <input
                  type="checkbox"
                  className={MODAL_CHECKBOX_CLASS}
                  checked={Boolean(facility.autoRaiseMuted)}
                  disabled={busy}
                  onChange={(e) => {
                    void (async () => {
                      setBusy(true);
                      const res = await apiFetch(
                        "/api/trade-credit/policy/mute-raise",
                        {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            counterpartyId,
                            muted: e.target.checked,
                          }),
                        },
                      );
                      setBusy(false);
                      if (!res.ok) {
                        toast.error(t("tradeCredit.muteRaiseErr"), {
                          description: await res.text(),
                        });
                        return;
                      }
                      toast.success(t("tradeCredit.muteRaiseOk"));
                      await loadFacility();
                    })();
                  }}
                />
                <span>{t("tradeCredit.muteRaise")}</span>
              </label>
              {facility.suggestedLimit != null ? (
                <p className="text-[12px] text-[#5D6D7E]">
                  {t("tradeCredit.suggestedLimit")}:{" "}
                  <span className="font-semibold tabular-nums text-[#34495E]">
                    {Number(facility.suggestedLimit).toFixed(2)} AZN
                  </span>
                </p>
              ) : null}
              {facility.proposedLimit != null ? (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-[12px] text-[#34495E]">
                    {t("tradeCredit.proposedLimit")}:{" "}
                    <span className="font-semibold tabular-nums">
                      {Number(facility.proposedLimit).toFixed(2)} AZN
                    </span>
                    {facility.proposedKind ? (
                      <span className="ml-1 text-[11px] text-[#7F8C8D]">
                        (
                        {t(`tradeCredit.kind.${facility.proposedKind}`, {
                          defaultValue: facility.proposedKind,
                        })}
                        )
                      </span>
                    ) : null}
                  </span>
                  <button
                    type="button"
                    className={PRIMARY_BUTTON_CLASS}
                    disabled={busy}
                    onClick={() =>
                      void policyAction(
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
                    disabled={busy}
                    onClick={() =>
                      void policyAction(
                        "reject-raise",
                        "tradeCredit.rejectRaiseOk",
                        "tradeCredit.rejectRaiseErr",
                      )
                    }
                  >
                    {t("tradeCredit.rejectRaise")}
                  </button>
                </div>
              ) : null}
              {facility.limitBeforeBlock != null ? (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-[12px] text-[#7F8C8D]">
                    {t("tradeCredit.limitBeforeBlock")}:{" "}
                    {Number(facility.limitBeforeBlock).toFixed(2)} AZN
                  </span>
                  <button
                    type="button"
                    className={SECONDARY_BUTTON_CLASS}
                    disabled={busy}
                    onClick={() =>
                      void policyAction(
                        "restore-after-block",
                        "tradeCredit.restoreAfterBlockOk",
                        "tradeCredit.restoreAfterBlockErr",
                      )
                    }
                  >
                    {t("tradeCredit.restoreAfterBlock")}
                  </button>
                </div>
              ) : null}
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                disabled={busy}
                onClick={() =>
                  void policyAction(
                    "reclassify",
                    "tradeCredit.reclassifyOk",
                    "tradeCredit.reclassifyErr",
                  )
                }
              >
                {t("tradeCredit.reclassify")}
              </button>
            </div>
          ) : null}

          <div className="space-y-2 rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className={lbl}>{t("tradeCredit.enrichmentRuns")}</span>
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                disabled={busy || enrichmentBusy || enrichSoftBlocked}
                onClick={() => void runDeepCheck()}
              >
                {t("tradeCredit.deepCheck")}
              </button>
            </div>
            {enrichSoftBlocked ? (
              <p className="text-[12px] text-amber-800">
                {t("tradeCredit.deepCheckUpsell")}
              </p>
            ) : null}
            {enrichmentRuns.length === 0 ? (
              <p className="text-[12px] text-[#7F8C8D]">
                {t("tradeCredit.enrichmentEmpty")}
              </p>
            ) : (
              <ul className="divide-y divide-[#E5E7EB]">
                {enrichmentRuns.map((run) => (
                  <li key={run.id} className="py-2 text-[12px] text-[#34495E]">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[#7F8C8D]">{run.createdAt}</span>
                      {run.riskyTaxpayer != null ? (
                        <span
                          className={
                            run.riskyTaxpayer
                              ? "font-medium text-red-700"
                              : "text-emerald-700"
                          }
                        >
                          {t("tradeCredit.riskyTaxpayer")}:{" "}
                          {run.riskyTaxpayer
                            ? t("tradeCredit.riskyYes")
                            : t("tradeCredit.riskyNo")}
                        </span>
                      ) : null}
                    </div>
                    {run.voenName ? (
                      <p className="mt-1">
                        {t("tradeCredit.voenName")}: {run.voenName}
                      </p>
                    ) : null}
                    {run.voenInactive ? (
                      <p className="mt-1 text-amber-800">
                        {t("tradeCredit.voenInactive")}
                      </p>
                    ) : null}
                    {run.errorMessage ? (
                      <p className="mt-1 text-red-700">{run.errorMessage}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <span className={lbl}>{t("tradeCredit.creditLimit")}</span>
              <input
                className={MODAL_INPUT_CLASS}
                type="number"
                min={0}
                step="0.01"
                value={creditLimit}
              onChange={(e) => setCreditLimit(e.target.value)}
              disabled={busy}
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-[13px] text-[#34495E]">
            <input
              type="checkbox"
              className={MODAL_CHECKBOX_CLASS}
              checked={stopList}
              onChange={(e) => setStopList(e.target.checked)}
              disabled={busy}
            />
            <span>{t("tradeCredit.stopList")}</span>
          </label>
          <CatalogField
            kind="CLOSED_SMALL"
            label={t("tradeCredit.facilityStatus")}
            value={status}
            onChange={(next) =>
              setStatus((Array.isArray(next) ? next[0] : next) as "ACTIVE" | "DISABLED")
            }
            options={[
              { value: "ACTIVE", label: t("tradeCredit.statusActive") },
              { value: "DISABLED", label: t("tradeCredit.statusDisabled") },
            ]}
            emptyLabel={null}
            disabled={busy}
          />
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            disabled={busy}
            onClick={() => void saveFacility()}
          >
            {t("tradeCredit.saveFacility")}
          </button>

          <div className="pt-2 space-y-2">
            <span className={lbl}>{t("tradeCredit.grantAmount")}</span>
            <input
              className={MODAL_INPUT_CLASS}
              type="number"
              min={0.01}
              step="0.01"
              value={grantAmount}
              onChange={(e) => setGrantAmount(e.target.value)}
              disabled={busy}
            />
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={busy}
              onClick={() => void issueGrant()}
            >
              {t("tradeCredit.issueGrant")}
            </button>
            {issuedCode ? (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5 font-mono text-[12px] text-emerald-900">
                {t("tradeCredit.grantCode")}: {issuedCode}
              </p>
            ) : null}
          </div>

          <div className="pt-2 space-y-2">
            <span className={lbl}>{t("tradeCredit.inviteEmail")}</span>
            <input
              type="email"
              className={MODAL_INPUT_CLASS}
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              disabled={busy}
              placeholder="buyer@example.com"
            />
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              disabled={busy || !inviteEmail.trim()}
              onClick={() => void inviteBuyer()}
            >
              {t("tradeCredit.inviteSend")}
            </button>
            {inviteTempPassword ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5">
                <p className="text-[12px] text-amber-900">
                  {t("tradeCredit.inviteTempPassword", {
                    password: inviteTempPassword,
                  })}
                </p>
                <input
                  className={`${MODAL_INPUT_CLASS} mt-1 font-mono text-[12px]`}
                  type="text"
                  readOnly
                  value={inviteTempPassword}
                  onFocus={(e) => e.currentTarget.select()}
                />
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
