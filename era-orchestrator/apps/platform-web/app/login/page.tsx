"use client";

import { Suspense, FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { AuthLoginCard, buildAuthLoginLabels, parseApiError } from "@era/satellite-kit/ui";
import type { Locale } from "@era/i18n-common";
import { orchPublicHref } from "@era/satellite-kit/ui";
import { OrchLanguageSwitcher } from "@/components/locale/orch-language-switcher";
import { useAuth, type OrchUser } from "@/lib/auth-context";
import { clearOrchTokens, orchFetch } from "@/lib/orch-api";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tAuth = useTranslations("auth");
  const locale = useLocale() as Locale;
  const { login, token, ready, user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("reason") === "expired") {
      setError(tAuth("sessionExpired"));
    }
  }, [searchParams, tAuth]);

  useEffect(() => {
    if (!ready || !token) return;
    if (user?.isSuperAdmin) {
      router.replace("/");
    }
  }, [ready, token, user, router]);

  if (ready && token && user?.isSuperAdmin) return null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await orchFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password }),
      });
      if (!res.ok) {
        setError(parseApiError(await res.text().catch(() => null), tAuth("loginFailed")));
        return;
      }
      const data = (await res.json()) as {
        accessToken: string;
        refreshToken?: string;
        user: { id: string; email: string; organizationId?: string | null };
        claims?: { isSuperAdmin?: boolean; role?: string };
      };
      const claims =
        data.claims ??
        (() => {
          try {
            return JSON.parse(atob(data.accessToken.split(".")[1] ?? "")) as {
              isSuperAdmin?: boolean;
              role?: string;
            };
          } catch {
            return {};
          }
        })();
      if (!claims.isSuperAdmin) {
        clearOrchTokens();
        setError(tAuth("operatorOnly"));
        return;
      }
      const nextUser: OrchUser = {
        id: data.user.id,
        email: data.user.email,
        organizationId: data.user.organizationId ?? null,
        role: claims.role ?? null,
        isSuperAdmin: true,
      };
      login(data.accessToken, nextUser, data.refreshToken);
      router.replace("/");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLoginCard
      locale={locale}
      localeControl={<OrchLanguageSwitcher />}
      labels={buildAuthLoginLabels(tAuth, { emailMode: true })}
      loginId={email}
      password={password}
      onLoginIdChange={setEmail}
      onPasswordChange={setPassword}
      onSubmit={onSubmit}
      busy={busy}
      error={error ?? undefined}
      emailMode
      showAccountLinks={false}
      faqHref={orchPublicHref("/help")}
      termsHref={orchPublicHref("/terms")}
      legalAppPrefix="ERA365"
    />
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
