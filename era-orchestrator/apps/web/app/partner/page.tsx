"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  CARD_CONTAINER_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { useAuth } from "../../lib/auth-context";
import { orchFetch } from "../../lib/orch-api";

type PartnerDashboard = {
  partner: {
    id: string;
    code: string;
    displayName: string;
    isCorporate: boolean;
    fixedRatePercent: string | null;
  };
  referralUrl: string;
  stats: {
    referredOrganizationsTotal: number;
    activeReferrals: number;
    pendingCommissionAzn: number;
  };
};

export default function PartnerPage() {
  const t = useTranslations("partner");
  const { token, ready } = useAuth();
  const [data, setData] = useState<PartnerDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await orchFetch("/v1/partner/dashboard", { token });
      if (!res.ok) {
        setData(null);
        setError(t("notPartner"));
        return;
      }
      setData((await res.json()) as PartnerDashboard);
    } finally {
      setLoading(false);
    }
  }, [token, t]);

  useEffect(() => {
    if (!ready) return;
    if (!token) return;
    void load();
  }, [ready, token, load]);

  useEffect(() => {
    if (!data || !token) {
      setQrUrl(null);
      return;
    }
    let revoked = false;
    void (async () => {
      const res = await orchFetch("/v1/partner/qr.png", { token });
      if (!res.ok || revoked) return;
      const blob = await res.blob();
      if (revoked) return;
      setQrUrl(URL.createObjectURL(blob));
    })();
    return () => {
      revoked = true;
      setQrUrl((u) => {
        if (u) URL.revokeObjectURL(u);
        return null;
      });
    };
  }, [data, token]);

  if (!ready) {
    return <p className="p-8 text-center text-[#7F8C8D]">{t("loading")}</p>;
  }

  if (!token) {
    return (
      <main className="mx-auto max-w-md p-8 text-center">
        <p className="mb-4 text-[#7F8C8D]">{t("loginRequired")}</p>
        <Link href="/login" className={PRIMARY_BUTTON_CLASS}>
          {t("login")}
        </Link>
      </main>
    );
  }

  if (loading) {
    return <p className="p-8 text-center text-[#7F8C8D]">{t("loading")}</p>;
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-md p-8 text-center">
        <p className="text-[#7F8C8D]">{error ?? t("notPartner")}</p>
        <Link href="/" className={`${SECONDARY_BUTTON_CLASS} mt-4 inline-flex`}>
          {t("back")}
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg p-6">
      <h1 className="mb-2 text-2xl font-semibold text-[#34495E]">{t("title")}</h1>
      <p className="mb-6 text-sm text-[#7F8C8D]">{data.partner.displayName}</p>
      <div className={`${CARD_CONTAINER_CLASS} space-y-4 p-6`}>
        <div>
          <p className="text-xs text-[#7F8C8D]">{t("referralLink")}</p>
          <p className="break-all text-[13px] text-[#2980B9]">{data.referralUrl}</p>
          <button
            type="button"
            className={`${SECONDARY_BUTTON_CLASS} mt-2`}
            onClick={() => void navigator.clipboard.writeText(data.referralUrl)}
          >
            {t("copyLink")}
          </button>
        </div>
        {qrUrl ? (
          <div>
            <p className="mb-2 text-xs text-[#7F8C8D]">{t("qr")}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrUrl} alt={t("qr")} className="h-40 w-40 rounded-lg border border-[#D5DADF]" />
          </div>
        ) : null}
        <dl className="grid grid-cols-2 gap-3 text-[13px]">
          <div>
            <dt className="text-[#7F8C8D]">{t("statsTotal")}</dt>
            <dd className="font-semibold">{data.stats.referredOrganizationsTotal}</dd>
          </div>
          <div>
            <dt className="text-[#7F8C8D]">{t("statsActive")}</dt>
            <dd className="font-semibold">{data.stats.activeReferrals}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-[#7F8C8D]">{t("statsPending")}</dt>
            <dd className="font-semibold">{data.stats.pendingCommissionAzn} AZN</dd>
          </div>
        </dl>
      </div>
    </main>
  );
}
