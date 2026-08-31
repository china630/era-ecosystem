"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import {
  AuthLoginCard,
  buildAuthLoginLabels,
  FORM_FIELD_GROUP_CLASS,
  FORM_INPUT_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  showApiError,
  assignNoStoreRedirect,
} from "@era/satellite-kit/ui";
import type { Locale } from "@era/i18n-common";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function LoginForm() {
  const searchParams = useSearchParams();
  const t = useTranslations("login");
  const tAuth = useTranslations("auth");
  const locale = useLocale() as Locale;
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [showOrgField, setShowOrgField] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const fromQuery = searchParams.get("organizationId")?.trim() ?? "";
    const fromEnv =
      (typeof process !== "undefined" &&
        (process.env.NEXT_PUBLIC_ERA_SATELLITE_ORGANIZATION_ID ?? "").trim()) ||
      "";
    const bound = fromQuery || fromEnv;
    if (bound && UUID_RE.test(bound)) {
      setOrganizationId(bound);
      setShowOrgField(!!fromQuery || !fromEnv);
    }
  }, [searchParams]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const payload: { login: string; password: string; organizationId?: string } = {
        login: loginId,
        password,
      };
      const org = organizationId.trim();
      if (org) payload.organizationId = org;
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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

  let provisionHint: string | undefined;
  try {
    provisionHint = t("provisionHint") || undefined;
  } catch {
    provisionHint = undefined;
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
      ssoHint={
        [ssoHint, provisionHint].filter(Boolean).join(" · ") || undefined
      }
      formExtras={
        showOrgField ? (
          <label className={FORM_FIELD_GROUP_CLASS}>
            <span className={MODAL_FIELD_LABEL_CLASS}>{tAuth("organizationIdLabel")}</span>
            <input
              className={`${FORM_INPUT_CLASS} font-mono text-sm`}
              value={organizationId}
              onChange={(e) => setOrganizationId(e.target.value)}
              placeholder={tAuth("organizationIdPlaceholder")}
              autoComplete="off"
              spellCheck={false}
              name="organizationId"
            />
            <span className="mt-1 block text-xs text-[#7F8C8D]">{tAuth("organizationIdHint")}</span>
          </label>
        ) : null
      }
    />
  );
}

export default function LoginPage() {
  const t = useTranslations("common");
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#EBEDF0] p-8 text-[#7F8C8D]">
          {t("loading")}
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
