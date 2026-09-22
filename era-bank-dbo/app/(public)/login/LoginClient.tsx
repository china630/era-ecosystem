"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@era/i18n-common";
import {
  AuthPublicShell,
  AUTH_FIELD_GROUP_CLASS,
  AUTH_FIELD_LABEL_CLASS,
  AUTH_FORM_STACK_CLASS,
  FORM_INPUT_CLASS,
  MODAL_FOOTER_OUTLINE_CLASS,
  MODAL_FOOTER_PRIMARY_CLASS,
  PublicLegalFooter,
  orchPublicHref,
} from "@era/satellite-kit/ui";

type Channel = "RETAIL" | "CORPORATE";

export default function LoginClient() {
  const t = useTranslations("login");
  const locale = useLocale() as Locale;
  const searchParams = useSearchParams();
  const asanTx = searchParams.get("asanTx");
  const channelParam = searchParams.get("channel") as Channel | null;

  const [channel, setChannel] = useState<Channel>(channelParam ?? "RETAIL");
  const [identifier, setIdentifier] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [asanTxId, setAsanTxId] = useState(asanTx ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function requestOtp() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, channel }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error ?? "OTP request failed");
      setOtpSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("title"));
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, channel, code: otpCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error ?? "OTP verify failed");
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : t("title"));
    } finally {
      setLoading(false);
    }
  }

  async function startAsan() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/asan/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, channel }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "ASAN start failed");
      setAsanTxId(data.transactionId);
      window.location.href = data.redirectUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : t("title"));
    } finally {
      setLoading(false);
    }
  }

  async function completeAsan() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/asan/callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId: asanTxId, identifier, channel }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "ASAN callback failed");
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : t("title"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthPublicShell
      locale={locale}
      title={t("title")}
      footer={
        <PublicLegalFooter
          locale={locale}
          faqHref={orchPublicHref("/help")}
          showFaq={false}
          labels={{
            navAria: t("footerLegalNavAria"),
            faq: t("footerFaq"),
            terms: t("footerTerms"),
            privacy: t("footerPrivacy"),
            status: t("footerStatus"),
          }}
        />
      }
    >
      {error ? (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <div className={AUTH_FORM_STACK_CLASS}>
        <div className="flex rounded-lg border border-[#D5DADF] bg-[#EBEDF0] p-1">
          {(["RETAIL", "CORPORATE"] as Channel[]).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                setChannel(c);
                setOtpSent(false);
              }}
              className={`flex-1 rounded-md py-2 text-sm font-medium ${
                channel === c ? "bg-white text-[#34495E] shadow-sm" : "text-[#7F8C8D]"
              }`}
            >
              {c === "RETAIL" ? t("retailTab") : t("corporateTab")}
            </button>
          ))}
        </div>
        <label className={AUTH_FIELD_GROUP_CLASS}>
          <span className={AUTH_FIELD_LABEL_CLASS}>
            {channel === "RETAIL" ? t("finLabel") : t("voenLabel")}
          </span>
          <input
            className={FORM_INPUT_CLASS}
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value.toUpperCase())}
            placeholder={channel === "RETAIL" ? t("finPlaceholder") : t("voenPlaceholder")}
          />
        </label>
        {!otpSent ? (
          <button
            type="button"
            disabled={loading || !identifier}
            onClick={requestOtp}
            className={`${MODAL_FOOTER_PRIMARY_CLASS} w-full`}
          >
            {t("otpRequest")}
          </button>
        ) : (
          <>
            <label className={AUTH_FIELD_GROUP_CLASS}>
              <span className={AUTH_FIELD_LABEL_CLASS}>{t("otpCode")}</span>
              <input
                className={FORM_INPUT_CLASS}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                inputMode="numeric"
                maxLength={6}
              />
            </label>
            <button
              type="button"
              disabled={loading || otpCode.length < 4}
              onClick={verifyOtp}
              className={`${MODAL_FOOTER_PRIMARY_CLASS} w-full`}
            >
              {t("otpVerify")}
            </button>
          </>
        )}
        <button
          type="button"
          disabled={loading || !identifier}
          onClick={startAsan}
          className={`${MODAL_FOOTER_OUTLINE_CLASS} w-full`}
        >
          {t("asanLogin")}
        </button>
        {asanTxId ? (
          <button
            type="button"
            disabled={loading}
            onClick={completeAsan}
            className={`${MODAL_FOOTER_PRIMARY_CLASS} w-full`}
          >
            {t("asanComplete")}
          </button>
        ) : null}
      </div>
    </AuthPublicShell>
  );
}
