"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@era/i18n-common";
import { buildSatelliteSsoLaunchUrlFromTicket } from "@era/satellite-kit/auth/sso-launch";
import {
  AUTH_FIELD_GROUP_CLASS,
  AUTH_FIELD_LABEL_CLASS,
  AUTH_FORM_STACK_CLASS,
  AuthPublicShell,
  FORM_INPUT_CLASS,
  LINK_ACCENT_CLASS,
  MODAL_FOOTER_PRIMARY_CLASS,
  parseApiError,
} from "@era/satellite-kit/ui";
import { orchFetch } from "../../lib/orch-api";
import { useAuth } from "../../lib/auth-context";
import { fetchSatelliteSsoTicket } from "../../lib/open-finance";
import { OrchLanguageSwitcher } from "../../components/locale/orch-language-switcher";

export default function KafeLandingPage() {
  const t = useTranslations("kafe");
  const tAuth = useTranslations("auth");
  const locale = useLocale() as Locale;
  const { login } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    cafeName: "",
    taxId: "",
    zal: false,
    kitchen: false,
    qrMenu: false,
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const taxId = form.taxId.replace(/\D/g, "");
    if (!/^\d{10}$/.test(taxId)) {
      setError(t("invalidVoen"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await orchFetch("/v1/public/kafe/onboard", {
        method: "POST",
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          password: form.password,
          cafeName: form.cafeName.trim(),
          taxId,
          zal: form.zal,
          kitchen: form.kitchen,
          qrMenu: form.qrMenu,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
        accessToken?: string;
        refreshToken?: string;
        claims?: {
          sub?: string;
          email?: string;
          organizationId?: string;
          role?: string;
          isSuperAdmin?: boolean;
        };
        kafe?: {
          poolBaseUrl?: string;
          publicOrgNumber?: number | null;
          organizationId?: string;
        };
      };
      if (!res.ok) {
        const raw = parseApiError(data, t("signupFailed"));
        if (/email already/i.test(raw)) {
          setError(t("emailTaken"));
          return;
        }
        if (/tax|vöen|voen|unique/i.test(raw)) {
          setError(t("voenTaken"));
          return;
        }
        setError(raw);
        return;
      }
      const pool = data.kafe?.poolBaseUrl?.replace(/\/$/, "") ?? "";
      const publicOrgNumber = data.kafe?.publicOrgNumber;
      const organizationId =
        data.kafe?.organizationId ?? data.claims?.organizationId ?? "";
      if (data.accessToken && data.claims?.email) {
        login(
          data.accessToken,
          {
            id: data.claims.sub ?? "",
            email: data.claims.email,
            organizationId: organizationId || null,
            role: data.claims.role,
            isSuperAdmin: data.claims.isSuperAdmin,
          },
          data.refreshToken,
        );
        if (pool && organizationId) {
          const ticket = await fetchSatelliteSsoTicket(
            data.accessToken,
            organizationId,
          );
          if (ticket) {
            window.location.href = buildSatelliteSsoLaunchUrlFromTicket(
              pool,
              ticket,
            );
            return;
          }
        }
      }
      if (pool && publicOrgNumber != null) {
        window.location.href = `${pool}/login?org=${publicOrgNumber}`;
        return;
      }
      if (pool) {
        window.location.href = `${pool}/login`;
        return;
      }
      window.location.href = "/workspace";
    } catch {
      setError(t("networkError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthPublicShell
      locale={locale}
      title={t("title")}
      localeControl={<OrchLanguageSwitcher />}
      footer={
        <p className="mt-4 text-center text-sm text-[#7F8C8D]">
          {t("alreadyHaveAccount")}{" "}
          <Link href="/login" className={LINK_ACCENT_CLASS}>
            {tAuth("loginTitle")}
          </Link>
        </p>
      }
    >
      {error ? (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <form onSubmit={(e) => void onSubmit(e)} className={AUTH_FORM_STACK_CLASS}>
        <label className={AUTH_FIELD_GROUP_CLASS}>
          <span className={AUTH_FIELD_LABEL_CLASS}>{t("firstName")}</span>
          <input
            className={FORM_INPUT_CLASS}
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            required
            maxLength={120}
            autoComplete="given-name"
          />
        </label>
        <label className={AUTH_FIELD_GROUP_CLASS}>
          <span className={AUTH_FIELD_LABEL_CLASS}>{t("lastName")}</span>
          <input
            className={FORM_INPUT_CLASS}
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            required
            maxLength={120}
            autoComplete="family-name"
          />
        </label>
        <label className={AUTH_FIELD_GROUP_CLASS}>
          <span className={AUTH_FIELD_LABEL_CLASS}>{t("email")}</span>
          <input
            className={FORM_INPUT_CLASS}
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
            autoComplete="email"
          />
        </label>
        <label className={AUTH_FIELD_GROUP_CLASS}>
          <span className={AUTH_FIELD_LABEL_CLASS}>{t("password")}</span>
          <input
            className={FORM_INPUT_CLASS}
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
            minLength={8}
            autoComplete="new-password"
          />
          <span className="text-xs text-[#7F8C8D]">{t("passwordHint")}</span>
        </label>
        <label className={AUTH_FIELD_GROUP_CLASS}>
          <span className={AUTH_FIELD_LABEL_CLASS}>{t("cafeName")}</span>
          <input
            className={FORM_INPUT_CLASS}
            value={form.cafeName}
            onChange={(e) => setForm({ ...form, cafeName: e.target.value })}
            required
            maxLength={200}
            autoComplete="organization"
          />
        </label>
        <label className={AUTH_FIELD_GROUP_CLASS}>
          <span className={AUTH_FIELD_LABEL_CLASS}>{t("taxId")}</span>
          <input
            className={FORM_INPUT_CLASS}
            value={form.taxId}
            onChange={(e) =>
              setForm({ ...form, taxId: e.target.value.replace(/\D/g, "").slice(0, 10) })
            }
            required
            inputMode="numeric"
            pattern="\d{10}"
            maxLength={10}
            autoComplete="off"
          />
          <span className="text-xs text-[#7F8C8D]">{t("voenHint")}</span>
        </label>
        <fieldset className="grid gap-2 rounded-lg border border-[#E1E5EA] bg-[#F8F9FA] p-3">
          <legend className="px-1 text-sm font-medium text-[#34495E]">{t("plan")}</legend>
          <label className="flex items-start gap-2 text-sm text-[#34495E]">
            <input
              type="checkbox"
              className="mt-1 pointer-events-none accent-[#27AE60]"
              checked
              readOnly
              tabIndex={-1}
              aria-checked="true"
              aria-readonly="true"
            />
            <span>
              <span className="font-medium">{t("gate")}</span>
              <span className="mt-0.5 block text-xs text-[#7F8C8D]">{t("gateHint")}</span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-[#34495E]">
            <input
              type="checkbox"
              className="mt-1"
              checked={form.zal}
              onChange={(e) => setForm({ ...form, zal: e.target.checked })}
            />
            <span>{t("zal")}</span>
          </label>
          <label className="flex items-start gap-2 text-sm text-[#34495E]">
            <input
              type="checkbox"
              className="mt-1"
              checked={form.kitchen}
              onChange={(e) => setForm({ ...form, kitchen: e.target.checked })}
            />
            <span>{t("kitchen")}</span>
          </label>
          <label className="flex items-start gap-2 text-sm text-[#34495E]">
            <input
              type="checkbox"
              className="mt-1"
              checked={form.qrMenu}
              onChange={(e) => setForm({ ...form, qrMenu: e.target.checked })}
            />
            <span>{t("qrMenu")}</span>
          </label>
        </fieldset>
        <button
          type="submit"
          disabled={busy}
          className={`${MODAL_FOOTER_PRIMARY_CLASS} mt-1 w-full`}
        >
          {busy ? t("busy") : t("submit")}
        </button>
      </form>
    </AuthPublicShell>
  );
}
