"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Field,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  showApiError,
} from "@era/satellite-kit/ui";
import { CARD_CLASS } from "@/lib/design-system";

type ChefWarning = {
  code: string;
  message: string;
  count?: number;
};

type HybridHandoffPayload = {
  buffetCostModel?: string;
  pos: {
    saleAttributedAzn: number;
    compAttributedAzn: number;
    posAttributedAzn: number;
    saleLineCount: number;
    compLineCount: number;
    warnings: Array<{ code: string; message: string; plu: string | null }>;
  };
  outlet?: { id: string; code: string; name: string };
  staff: {
    staffGross: number;
    staffGrossComputed?: number;
    staffCoversTotal?: number;
    staffMealAznPerCover?: number;
    staffGrossSource?: string;
    staffNet: number;
    buffetCoveredFromStaff: number;
  };
  theoretical: {
    guestNights: number;
    bandCode: string | null;
    theoreticalAzn: number;
    theoreticalBySku: Record<string, number>;
  };
  financeHandoffQuery: string;
  chefWarnings: ChefWarning[];
};

type Props = {
  outletId: string;
  fromDate: string;
  toDate: string;
  onGoForecast?: () => void;
};

function financeBuffetCostHref(financeHandoffQuery: string): string | null {
  const base = process.env.NEXT_PUBLIC_FINANCE_WEB_URL?.trim();
  if (!base) return null;
  return `${base.replace(/\/$/, "")}/inventory/buffet-food-cost?${financeHandoffQuery}`;
}

export default function BuffetCostRunPanel({
  outletId,
  fromDate,
  toDate,
  onGoForecast,
}: Props) {
  const t = useTranslations("admin.buffet");
  /** Empty = use server-computed staff gross from plan × rate. */
  const [staffGrossOverride, setStaffGrossOverride] = useState("");
  const [staffOverrideOpen, setStaffOverrideOpen] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [payload, setPayload] = useState<HybridHandoffPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [dateError, setDateError] = useState(false);

  const loadHandoff = useCallback(
    (opts?: { staffGrossOverride: string }) => {
      if (!outletId || !fromDate || !toDate) {
        setPayload(null);
        setDateError(false);
        return;
      }
      if (fromDate > toDate) {
        setDateError(true);
        setPayload(null);
        return;
      }
      setDateError(false);
      const overrideRaw = opts?.staffGrossOverride ?? staffGrossOverride;
      setLoading(true);
      const q = new URLSearchParams({
        outletId,
        from: fromDate,
        to: toDate,
      });
      if (overrideRaw.trim() !== "") {
        q.set("staffGrossAzn", String(Math.max(0, Number(overrideRaw) || 0)));
      }
      return fetch(`/api/admin/buffet/hybrid-handoff?${q}`)
        .then(async (r) => {
          const data = await r.json().catch(() => null);
          if (!r.ok) {
            showApiError(data, t("costRunLoadFailed"));
            setPayload(null);
            return;
          }
          setPayload(data as HybridHandoffPayload);
        })
        .catch(() => setPayload(null))
        .finally(() => setLoading(false));
    },
    [outletId, fromDate, toDate, staffGrossOverride, t],
  );

  useEffect(() => {
    void loadHandoff();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- drafts apply via Refresh
  }, [outletId, fromDate, toDate]);

  const financeHref = payload
    ? financeBuffetCostHref(payload.financeHandoffQuery)
    : null;
  const financeUrlMissing =
    payload?.chefWarnings.some((w) => w.code === "FINANCE_URL_MISSING") ?? false;

  return (
    <div className="space-y-4">
      <div className={`${CARD_CLASS} space-y-3 p-4`}>
        <p className="text-sm text-[#7F8C8D]">{t("costRunHint")}</p>
        {payload?.outlet?.code ? (
          <p className="m-0 text-xs text-[#7F8C8D]">
            {t("costRunOutletCode", { code: payload.outlet.code })}
          </p>
        ) : null}
        {payload?.staff.staffGrossComputed != null ? (
          <p className="m-0 text-xs text-[#7F8C8D]">
            {t("costRunStaffGrossComputed", {
              azn: payload.staff.staffGrossComputed.toFixed(2),
              covers: payload.staff.staffCoversTotal ?? 0,
              rate: payload.staff.staffMealAznPerCover ?? 0,
            })}
          </p>
        ) : null}
        <div className="flex flex-wrap items-end gap-3">
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            disabled={!outletId || loading}
            onClick={() => void loadHandoff({ staffGrossOverride })}
          >
            {t("costRunRefresh")}
          </button>
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            onClick={() => setStaffOverrideOpen((v) => !v)}
          >
            {staffOverrideOpen
              ? t("costRunStaffOverrideHide")
              : t("costRunStaffOverrideShow")}
          </button>
        </div>
        {staffOverrideOpen ? (
          <Field
            label={t("costRunStaffGrossOverride")}
            preset="shortText"
            type="number"
            min={0}
            value={staffGrossOverride}
            onChange={(e) => setStaffGrossOverride(e.target.value)}
            placeholder={
              payload?.staff.staffGrossComputed != null
                ? String(payload.staff.staffGrossComputed)
                : t("costRunStaffGrossAutoPh")
            }
          />
        ) : null}
        {dateError ? (
          <p className="text-sm text-[#E74C3C]">{t("costRunDateOrder")}</p>
        ) : null}
      </div>

      {payload ? (
        <div className={`${CARD_CLASS} space-y-3 p-4`}>
          {payload.buffetCostModel === "OFF" ? (
            <p className="text-sm text-[#E67E22]">{t("costRunModelOff")}</p>
          ) : payload.buffetCostModel ? (
            <p className="text-sm text-[#7F8C8D]">
              {t("costRunModelLabel", { model: payload.buffetCostModel })}
            </p>
          ) : null}
          <div className="text-sm font-semibold text-[#2C3E50]">{t("costRunBuckets")}</div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <BucketCard
              label={t("costRunSale")}
              value={`${payload.pos.saleAttributedAzn.toFixed(2)} AZN`}
              hint={`${payload.pos.saleLineCount} ${t("costRunLines")}`}
            />
            <BucketCard
              label={t("costRunComp")}
              value={`${payload.pos.compAttributedAzn.toFixed(2)} AZN`}
              hint={`${payload.pos.compLineCount} ${t("costRunLines")}`}
              emphasis
            />
            <BucketCard
              label={t("costRunStaffNet")}
              value={`${payload.staff.staffNet.toFixed(2)} AZN`}
            />
            <BucketCard
              label={t("costRunTheoretical")}
              value={`${payload.theoretical.theoreticalAzn.toFixed(2)} AZN`}
              hint={payload.theoretical.bandCode ?? undefined}
            />
            <BucketCard
              label={t("costRunGuestNights")}
              value={String(payload.theoretical.guestNights)}
            />
            <BucketCard
              label={t("costRunPosTotal")}
              value={`${payload.pos.posAttributedAzn.toFixed(2)} AZN`}
            />
          </div>

          {payload.chefWarnings.some(
            (w) => w.code === "NO_GUEST_NIGHTS" || w.code === "NORMS_ALL_ZERO",
          ) || payload.theoretical.theoreticalAzn <= 0 ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
              <p className="m-0 font-medium">{t("costRunTheoBlockedTitle")}</p>
              <p className="mt-1 m-0 text-amber-900">{t("costRunTheoBlockedBody")}</p>
              {onGoForecast ? (
                <button
                  type="button"
                  className={`${SECONDARY_BUTTON_CLASS} mt-2`}
                  onClick={onGoForecast}
                >
                  {t("costRunGoForecast")}
                </button>
              ) : null}
            </div>
          ) : null}

          {payload.chefWarnings.length > 0 ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
              <div className="text-sm font-medium text-amber-900">{t("costRunChefWarnings")}</div>
              <ul className="mt-1 list-inside list-disc text-xs text-amber-800">
                {payload.chefWarnings.map((w) => {
                  const key = `chefWarning.${w.code}`;
                  const localized = t.has(key) ? t(key as "chefWarning.MODEL_OFF") : w.message;
                  return (
                    <li key={w.code}>
                      {w.code}
                      {w.count != null ? ` (${w.count})` : ""} — {localized}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <p className="text-xs text-[#27AE60]">{t("costRunNoChefWarnings")}</p>
          )}

          {financeHref && !financeUrlMissing ? (
            <a
              href={financeHref}
              target="_blank"
              rel="noreferrer"
              className={`${PRIMARY_BUTTON_CLASS} inline-flex no-underline`}
            >
              {t("costRunOpenFinance")}
            </a>
          ) : (
            <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-sm text-amber-900">
              {t("costRunFinanceLinkMissing")}
            </p>
          )}

          <div className="border-t border-[#ECF0F1] pt-3">
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              onClick={() => setDemoOpen((v) => !v)}
            >
              {demoOpen ? t("costRunDemoHide") : t("costRunDemoShow")}
            </button>
            {demoOpen ? (
              <p className="mt-3 text-xs text-[#7F8C8D]">{t("costRunDemoHint")}</p>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="text-sm text-[#7F8C8D]">
          {loading
            ? t("costRunLoading")
            : dateError
              ? t("costRunDateOrder")
              : t("costRunEmpty")}
        </p>
      )}
    </div>
  );
}

function BucketCard({
  label,
  value,
  hint,
  emphasis,
}: {
  label: string;
  value: string;
  hint?: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        emphasis ? "border-[#2C3E50] bg-[#F8FAFC]" : "border-[#E5E7EB] bg-white"
      }`}
    >
      <div className="text-xs uppercase tracking-wide text-[#9CA3AF]">{label}</div>
      <div
        className={`mt-1 text-lg font-semibold tabular-nums ${
          emphasis ? "text-[#2C3E50]" : "text-[#111827]"
        }`}
      >
        {value}
      </div>
      {hint ? <div className="mt-0.5 text-xs text-[#7F8C8D]">{hint}</div> : null}
    </div>
  );
}
