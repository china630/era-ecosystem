"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { AuthLoginCard, buildAuthLoginLabels, showApiError, assignNoStoreRedirect } from "@era/satellite-kit/ui";
import type { Locale } from "@era/i18n-common";

export default function LoginPage() {
  const t = useTranslations("login");
  const tAuth = useTranslations("auth");
  const locale = useLocale() as Locale;
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login: loginId, password }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        showApiError(j, tAuth("loginFailed"));
        return;
      }
      assignNoStoreRedirect("/");
    } finally {
      setBusy(false);
    }
  }

  let subtitle: string | undefined;
  let ssoHint: string | undefined;
  try {
    subtitle = t("subtitle");
  } catch {
    subtitle = undefined;
  }
  try {
    ssoHint = t("ssoHint") || t("demoHint");
  } catch {
    ssoHint = undefined;
  }

  return (
    <AuthLoginCard
      locale={locale}
      labels={buildAuthLoginLabels(tAuth)}
      loginId={loginId}
      password={password}
      onLoginIdChange={setLoginId}
      onPasswordChange={setPassword}
      onSubmit={onSubmit}
      busy={busy}
      subtitle={subtitle}
      ssoHint={ssoHint}
    />
  );
}
