"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";

type Channel = "RETAIL" | "CORPORATE";

export default function LoginClient() {
  const t = useTranslations("login");
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
      if (!res.ok) throw new Error(data.error ?? "OTP request failed");
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
      if (!res.ok) throw new Error(data.error ?? "OTP verify failed");
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
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-4 py-8">
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="mb-4 text-xl font-semibold text-dbo-ink">{t("title")}</h1>

        <div className="mb-4 flex rounded-lg bg-dbo-surface p-1">
          {(["RETAIL", "CORPORATE"] as Channel[]).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                setChannel(c);
                setOtpSent(false);
              }}
              className={`flex-1 rounded-md py-2 text-sm font-medium ${
                channel === c ? "bg-white text-dbo-primary shadow-sm" : "text-dbo-muted"
              }`}
            >
              {c === "RETAIL" ? t("retailTab") : t("corporateTab")}
            </button>
          ))}
        </div>

        <label className="mb-1 block text-xs text-dbo-muted">
          {channel === "RETAIL" ? t("finLabel") : t("voenLabel")}
        </label>
        <input
          className="mb-4 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value.toUpperCase())}
          placeholder={channel === "RETAIL" ? "1234567" : "1234567890"}
        />

        {!otpSent ? (
          <button
            type="button"
            disabled={loading || !identifier}
            onClick={requestOtp}
            className="mb-2 w-full rounded-lg bg-dbo-primary py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {t("otpRequest")}
          </button>
        ) : (
          <>
            <label className="mb-1 block text-xs text-dbo-muted">{t("otpCode")}</label>
            <input
              className="mb-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              inputMode="numeric"
              maxLength={6}
            />
            <button
              type="button"
              disabled={loading || otpCode.length < 4}
              onClick={verifyOtp}
              className="mb-2 w-full rounded-lg bg-dbo-primary py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {t("otpVerify")}
            </button>
          </>
        )}

        <button
          type="button"
          disabled={loading || !identifier}
          onClick={startAsan}
          className="mb-2 w-full rounded-lg border border-dbo-primary py-2.5 text-sm font-medium text-dbo-primary disabled:opacity-50"
        >
          {t("asanLogin")}
        </button>

        {asanTxId ? (
          <button
            type="button"
            disabled={loading}
            onClick={completeAsan}
            className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {t("asanComplete")}
          </button>
        ) : null}

        <p className="mt-4 text-center text-xs text-dbo-muted">{t("devHint")}</p>
        {error ? <p className="mt-2 text-center text-xs text-red-600">{error}</p> : null}
      </div>
    </div>
  );
}
