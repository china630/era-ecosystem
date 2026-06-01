"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import type { Locale } from "@era/i18n-common";
import {
  AuthRegisterCard,
  FORM_INPUT_CLASS,
  LINK_ACCENT_CLASS,
  showApiError,
} from "@era/satellite-kit/ui";
import { useAuth } from "../../lib/auth-context";
import { orchFetch } from "../../lib/orch-api";
import { REFERRAL_STORAGE_KEY } from "../../lib/referral-storage";

export default function RegisterOrgPage() {
  const router = useRouter();
  const t = useTranslations("registerOrg");
  const locale = useLocale() as Locale;
  const { login, token, ready, user } = useAuth();
  const [name, setName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!token) {
      router.replace("/login");
      return;
    }
    if (user?.organizationId) {
      router.replace("/");
    }
  }, [ready, token, user, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setBusy(true);
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
          taxId: taxId.trim(),
          referralCode: referralCode?.trim() || undefined,
        }),
      });
      if (!res.ok) {
        showApiError(await res.text().catch(() => null), t("registerFailed"));
        return;
      }
      const data = (await res.json()) as {
        accessToken: string;
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
      });
      router.replace("/");
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
      submitLabel={t("submit")}
      submitBusyLabel={t("submit")}
      showLocaleToggle={false}
      fields={
        <>
          <input
            className={FORM_INPUT_CLASS}
            placeholder={t("orgName")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            className={FORM_INPUT_CLASS}
            placeholder={t("taxId")}
            value={taxId}
            onChange={(e) => setTaxId(e.target.value)}
            required
          />
        </>
      }
      footer={
        <p className="mt-6 text-center text-sm">
          <Link href="/" className={LINK_ACCENT_CLASS}>
            {t("back")}
          </Link>
        </p>
      }
    />
  );
}
