"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@era/i18n-common";
import {
  AUTH_FIELD_GROUP_CLASS,
  AUTH_FIELD_LABEL_CLASS,
  AUTH_FORM_STACK_CLASS,
  AuthLoginCard,
  AuthPublicShell,
  FORM_INPUT_CLASS,
  LINK_ACCENT_CLASS,
  MODAL_FOOTER_PRIMARY_CLASS,
  buildAuthLoginLabels,
  parseApiError,
} from "@era/satellite-kit/ui";
import { orchFetch } from "../../../lib/orch-api";

type Property = {
  grantId: string;
  organizationId: string;
  organizationName: string;
  agencyId: string;
  agencyCode: string | null;
  agencyVoen: string;
  hotelBaseUrl: string | null;
};

export default function AgencyPortalLoginPage() {
  const tAuth = useTranslations("auth");
  const t = useTranslations("portalLogin");
  const locale = useLocale() as Locale;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "password">("login");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await orchFetch("/agency-portal/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        setError(parseApiError(await res.text().catch(() => null), tAuth("loginFailed")));
        return;
      }
      const data = (await res.json()) as {
        accessToken: string;
        properties: Property[];
      };
      setToken(data.accessToken);
      setProperties(data.properties ?? []);
      if ((data.properties ?? []).length === 1 && data.properties[0]) {
        await openProperty(data.accessToken, data.properties[0].grantId);
      }
    } catch {
      setError(tAuth("loginFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function onChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError(t("passwordMismatch"));
      return;
    }
    setBusy(true);
    try {
      const res = await orchFetch("/agency-portal/set-password", {
        method: "POST",
        body: JSON.stringify({
          email,
          currentPassword,
          newPassword,
        }),
      });
      if (!res.ok) {
        setError(parseApiError(await res.text().catch(() => null), tAuth("loginFailed")));
        return;
      }
      setPassword("");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setNotice(t("passwordChanged"));
      setMode("login");
    } catch {
      setError(tAuth("loginFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function openProperty(accessToken: string, grantId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await orchFetch("/agency-portal/properties/pick", {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({ grantId }),
      });
      if (!res.ok) {
        setError(t("openHotelFailed"));
        return;
      }
      const ticket = (await res.json()) as { launchUrl?: string | null };
      if (!ticket.launchUrl) {
        setError(t("hotelUrlMissing"));
        return;
      }
      window.location.assign(ticket.launchUrl);
    } catch {
      setError(t("openHotelFailed"));
    } finally {
      setBusy(false);
    }
  }

  if (mode === "password") {
    return (
      <AuthPublicShell locale={locale} title={t("changePasswordTitle")}>
        <form className={AUTH_FORM_STACK_CLASS} onSubmit={onChangePassword}>
          <label className={AUTH_FIELD_GROUP_CLASS}>
            <span className={AUTH_FIELD_LABEL_CLASS}>{tAuth("email")}</span>
            <input
              type="email"
              name="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={FORM_INPUT_CLASS}
            />
          </label>
          <label className={AUTH_FIELD_GROUP_CLASS}>
            <span className={AUTH_FIELD_LABEL_CLASS}>{t("currentPassword")}</span>
            <input
              type="password"
              name="currentPassword"
              required
              minLength={8}
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={FORM_INPUT_CLASS}
            />
          </label>
          <label className={AUTH_FIELD_GROUP_CLASS}>
            <span className={AUTH_FIELD_LABEL_CLASS}>{t("newPassword")}</span>
            <input
              type="password"
              name="newPassword"
              required
              minLength={8}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={FORM_INPUT_CLASS}
            />
          </label>
          <label className={AUTH_FIELD_GROUP_CLASS}>
            <span className={AUTH_FIELD_LABEL_CLASS}>{t("confirmPassword")}</span>
            <input
              type="password"
              name="confirmPassword"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={FORM_INPUT_CLASS}
            />
          </label>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button type="submit" disabled={busy} className={`${MODAL_FOOTER_PRIMARY_CLASS} w-full`}>
            {busy ? tAuth("submitBusy") : t("changePassword")}
          </button>
        </form>
        <p className="mt-4 text-center text-sm">
          <button
            type="button"
            className={LINK_ACCENT_CLASS}
            onClick={() => {
              setMode("login");
              setError(null);
            }}
          >
            {t("backToLogin")}
          </button>
        </p>
      </AuthPublicShell>
    );
  }

  if (token) {
    return (
      <AuthPublicShell locale={locale} title={tAuth("loginTitle")}>
        <p className="mb-4 text-sm text-[#7F8C8D]">{t("pickHotel")}</p>
        {properties.length === 0 ? (
          <p className="text-sm text-amber-700">{t("noHotels")}</p>
        ) : (
          <ul className="space-y-2">
            {properties.map((p) => (
              <li key={p.grantId}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => openProperty(token, p.grantId)}
                  className="w-full rounded-lg border border-[#D5DADF] px-4 py-3 text-left hover:bg-[#F4F5F7]"
                >
                  <div className="font-medium text-[#34495E]">{p.organizationName}</div>
                  <div className="text-xs text-[#7F8C8D]">
                    {p.agencyCode ?? p.agencyId} · VÖEN {p.agencyVoen}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </AuthPublicShell>
    );
  }

  return (
    <AuthLoginCard
      locale={locale}
      labels={buildAuthLoginLabels(tAuth, { emailMode: true })}
      loginId={email}
      password={password}
      onLoginIdChange={setEmail}
      onPasswordChange={setPassword}
      onSubmit={onLogin}
      busy={busy}
      error={error ?? undefined}
      emailMode
      passwordMinLength={8}
      showAccountLinks={false}
      formExtras={
        notice ? <p className="text-sm text-[#1E8449]">{notice}</p> : undefined
      }
      extraLinks={
        <button
          type="button"
          className={LINK_ACCENT_CLASS}
          onClick={() => {
            setMode("password");
            setError(null);
            setNotice(null);
          }}
        >
          {t("changePassword")}
        </button>
      }
    />
  );
}
