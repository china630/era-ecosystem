"use client";

import Link from "next/link";
import { parseISO } from "date-fns";
import { useTranslation } from "react-i18next";
import { bakuDateDisplay, bakuYmd } from "@era/satellite-kit/time";
import { LINK_ACCENT_CLASS } from "../lib/design-system";
import { useSubscription } from "../lib/subscription-context";

function firstDayOfNextBakuMonth(at: Date): string {
  const { y, m } = bakuYmd(at);
  const nextM = m === 12 ? 1 : m + 1;
  const nextY = m === 12 ? y + 1 : y;
  return `${nextY}-${String(nextM).padStart(2, "0")}-01`;
}

function isNextBakuCalendarMonth(after: Date, before: Date): boolean {
  const a = bakuYmd(after);
  const b = bakuYmd(before);
  const diff = (a.y - b.y) * 12 + (a.m - b.m);
  return diff === 1;
}

export function TrialBanner() {
  const { t } = useTranslation();
  const { ready, effectiveSnapshot: snapshot } = useSubscription();

  if (!ready || !snapshot) return null;

  const now = new Date();
  const expiresAt = snapshot.expiresAt ? parseISO(snapshot.expiresAt) : null;
  const expiresAtMs = expiresAt?.getTime() ?? null;
  const hasExpired = expiresAtMs != null && expiresAtMs < now.getTime();
  const hasFutureTrial =
    Boolean(snapshot.isTrial) && expiresAtMs != null && expiresAtMs > now.getTime();
  const showPostpaidFirstInvoice =
    !snapshot.isTrial &&
    hasExpired &&
    snapshot.billingStatus === "ACTIVE" &&
    expiresAt != null &&
    isNextBakuCalendarMonth(now, expiresAt);

  if (hasFutureTrial && expiresAt) {
    return (
      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
        {t("trialBanner.demoUntilPaidStart", {
          date: bakuDateDisplay(firstDayOfNextBakuMonth(expiresAt)),
        })}
      </div>
    );
  }

  if (showPostpaidFirstInvoice) {
    return (
      <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-[13px] text-blue-900">
        {t("trialBanner.postpaidFirstInvoiceAt", {
          date: bakuDateDisplay(firstDayOfNextBakuMonth(now)),
        })}
      </div>
    );
  }

  if (snapshot.readOnly) {
    return (
      <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">
        <div className="font-semibold">{t("trialBanner.readOnlyTitle")}</div>
        <div className="mt-1 text-red-700">{t("trialBanner.readOnlyBody")}</div>
        <Link href={`${(process.env.NEXT_PUBLIC_ORCH_WEB_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "")}/settings/subscription`} className={`${LINK_ACCENT_CLASS} mt-2 inline-flex`}>
          {t("trialBanner.readOnlyCta")}
        </Link>
      </div>
    );
  }

  return null;
}
