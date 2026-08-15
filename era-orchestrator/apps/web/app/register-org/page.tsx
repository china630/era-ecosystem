"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import type { Locale } from "@era/i18n-common";
import {
  AuthRegisterCard,
  FORM_FIELD_GROUP_CLASS,
  FORM_INPUT_CLASS,
  LINK_ACCENT_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  parseApiError,
} from "@era/satellite-kit/ui";
import { useAuth } from "../../lib/auth-context";
import { orchFetch } from "../../lib/orch-api";
import { REFERRAL_STORAGE_KEY } from "../../lib/referral-storage";

export default function RegisterOrgPage() {
  const router = useRouter();
  const t = useTranslations("registerOrg");
  const tAuth = useTranslations("auth");
  const locale = useLocale() as Locale;
  const { login, token, ready, user } = useAuth();
  const [name, setName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!token) {
      router.replace("/login");
      return;
    }
    if (user?.organizationId) {
      router.replace("/workspace");
    }
  }, [ready, token, user, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    const digits = taxId.replace(/\D/g, "").slice(0, 10);
    if (digits.length !== 10) {
      setError(t("invalidVoen"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      let referralCode: string | undefined;
      try {
        referralCode = sessionStorage.getItem(REFERRAL_STORAGE_KEY) ?? undefined;
      } catch {
        referralCode = undefined;
      }
      const res = await orchFetch("/auth/register-organization", {
        method: "POST",
        token,
        body: JSON.stringify({
          name: name.trim(),
          taxId: digits,
          referralCode: referralCode?.trim() || undefined,
        }),
      });
      if (!res.ok) {
        setError(parseApiError(await res.text().catch(() => null), t("registerFailed")));
        return;
      }
      const data = (await res.json()) as {
        accessToken: string;
        refreshToken?: string;
        claims: {
          sub: string;
          email: string;
          organizationId: string;
          role: string;
          isSuperAdmin?: boolean;
        };
      };
      try {
        sessionStorage.removeItem(REFERRAL_STORAGE_KEY);
      } catch {
        // ignore
      }
      login(data.accessToken, {
        id: data.claims.sub,
        email: data.claims.email,
        organizationId: data.claims.organizationId,
        role: data.claims.role,
        isSuperAdmin: data.claims.isSuperAdmin,
      }, data.refreshToken);
      router.replace("/workspace");
    } finally {
      setBusy(false);
    }
  }

  if (!ready || !token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#EBEDF0] p-8 text-[#7F8C8D]">
        …
      </div>
    );
  }

  return (
    <AuthRegisterCard
      locale={locale}
      title={t("title")}
      subtitle={t("subtitle")}
      onSubmit={onSubmit}
      busy={busy}
      error={error}
      submitLabel={t("submit")}
      submitBusyLabel={t("busy")}
      localeLabels={{
        groupAria: tAuth("localeToggleAria"),
        az: tAuth("localeAz"),
        ru: tAuth("localeRu"),
        en: tAuth("localeEn"),
      }}
      fields={
        <>
          <label className={FORM_FIELD_GROUP_CLASS}>
            <span className={MODAL_FIELD_LABEL_CLASS}>{t("orgName")}</span>
            <input
              className={`${FORM_INPUT_CLASS} mt-1.5`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="organization"
            />
          </label>
          <label className={FORM_FIELD_GROUP_CLASS}>
            <span className={MODAL_FIELD_LABEL_CLASS}>{t("taxId")}</span>
            <input
              className={`${FORM_INPUT_CLASS} mt-1.5`}
              value={taxId}
              onChange={(e) => setTaxId(e.target.value.replace(/\D/g, "").slice(0, 10))}
              inputMode="numeric"
              pattern="\d{10}"
              required
              autoComplete="off"
            />
            <p className="mt-1 text-xs text-[#7F8C8D]">{t("voenHint")}</p>
          </label>
        </>
      }
      footer={
        <p className="mt-6 text-center text-sm">
          <Link href="/organizations" className={LINK_ACCENT_CLASS}>
            {t("back")}
          </Link>
        </p>
      }
    />
  );
}
