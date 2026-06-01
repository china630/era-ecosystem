"use client";

import { Suspense, FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { AuthLoginCard, buildAuthLoginLabels, showApiError } from "@era/satellite-kit/ui";
import type { Locale } from "@era/i18n-common";
import { useAuth } from "../../lib/auth-context";
import { orchFetch } from "../../lib/orch-api";

function LoginForm() {
  const router = useRouter();
  const t = useTranslations("login");
  const tAuth = useTranslations("auth");
  const tMeta = useTranslations("meta");
  const locale = useLocale() as Locale;
  const { login, token, ready, user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ready || !token) return;
    if (!user?.organizationId && !user?.isSuperAdmin) {
      router.replace("/register-org");
      return;
    }
    router.replace("/");
  }, [ready, token, user, router]);

  if (ready && token) return null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await orchFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password }),
      });
      if (!res.ok) {
        showApiError(await res.text().catch(() => null), tAuth("loginFailed"));
        return;
      }
      const data = (await res.json()) as {
        accessToken: string;
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
      login(data.accessToken, {
        id: data.user.id,
        email: data.user.email,
        organizationId: data.user.organizationId ?? null,
        role: claims.role ?? null,
        isSuperAdmin: Boolean(claims.isSuperAdmin),
      });
      router.replace(
        data.user.organizationId || claims.isSuperAdmin ? "/" : "/register-org",
      );
    } finally {
      setBusy(false);
    }
  }

  let demoHint: string | undefined;
  try {
    demoHint = t("demoHint");
  } catch {
    demoHint = undefined;
  }

  return (
    <AuthLoginCard
      locale={locale}
      labels={{
        ...buildAuthLoginLabels(tAuth, { emailMode: true }),
        loginTitle: tMeta("title"),
      }}
      loginId={email}
      password={password}
      onLoginIdChange={setEmail}
      onPasswordChange={setPassword}
      onSubmit={onSubmit}
      busy={busy}
      subtitle={t("subtitle")}
      ssoHint={demoHint}
      emailMode
      registerHref="/register"
      registerOrgHref="/register-org"
      pricingHref="/pricing"
      faqHref="/help"
      termsHref="/terms"
      legalAppPrefix="ERA365"
    />
  );
}

export default function LoginPage() {
  const tCommon = useTranslations("common");

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#EBEDF0] p-8 text-[#7F8C8D]">
          {tCommon("loading")}
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
