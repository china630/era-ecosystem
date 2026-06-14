"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("register");
  const tAuth = useTranslations("auth");
  const locale = useLocale() as Locale;
  const { login } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref?.trim()) {
      try {
        sessionStorage.setItem(REFERRAL_STORAGE_KEY, ref.trim());
      } catch {
        // ignore
      }
    }
  }, [searchParams]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await orchFetch("/auth/register-user", {
        method: "POST",
        body: JSON.stringify({
          email: email.trim(),
          password,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
        }),
      });
      if (!res.ok) {
        setError(parseApiError(await res.text().catch(() => null), t("registerFailed")));
        return;
      }
      const data = (await res.json()) as {
        accessToken: string;
        user: { id: string; email: string; organizationId: string | null };
        claims?: { isSuperAdmin?: boolean };
      };
      login(data.accessToken, {
        id: data.user.id,
        email: data.user.email,
        organizationId: null,
        isSuperAdmin: data.claims?.isSuperAdmin,
      });
      router.replace("/organizations");
    } finally {
      setBusy(false);
    }
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
            <span className={MODAL_FIELD_LABEL_CLASS}>{t("firstName")}</span>
            <input
              className={`${FORM_INPUT_CLASS} mt-1.5`}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              autoComplete="given-name"
            />
          </label>
          <label className={FORM_FIELD_GROUP_CLASS}>
            <span className={MODAL_FIELD_LABEL_CLASS}>{t("lastName")}</span>
            <input
              className={`${FORM_INPUT_CLASS} mt-1.5`}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              autoComplete="family-name"
            />
          </label>
          <label className={FORM_FIELD_GROUP_CLASS}>
            <span className={MODAL_FIELD_LABEL_CLASS}>{t("email")}</span>
            <input
              type="email"
              className={`${FORM_INPUT_CLASS} mt-1.5`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
            />
          </label>
          <label className={FORM_FIELD_GROUP_CLASS}>
            <span className={MODAL_FIELD_LABEL_CLASS}>{t("password")}</span>
            <input
              type="password"
              className={`${FORM_INPUT_CLASS} mt-1.5`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </label>
        </>
      }
      footer={
        <p className="mt-6 text-center text-sm">
          <Link href="/login" className={LINK_ACCENT_CLASS}>
            {t("alreadyHaveAccount")}
          </Link>
        </p>
      }
    />
  );
}

export default function RegisterPage() {
  const t = useTranslations("common");
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#EBEDF0] p-8 text-[#7F8C8D]">
          {t("loading")}
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
