"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import {
  AuthLoginCard,
  buildAuthLoginLabels,
  showApiError,
  assignNoStoreRedirect,
  persistLoginOrgNo,
  useStaffLoginOrgNo,
  StaffLoginOrgNoField,
  LINK_ACCENT_CLASS,
} from "@era/satellite-kit/ui";
import type { Locale } from "@era/i18n-common";

function LoginForm() {
  const searchParams = useSearchParams();
  const tAuth = useTranslations("auth");
  const locale = useLocale() as Locale;
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const { orgNo, setOrgNo, hostBound } = useStaffLoginOrgNo(searchParams);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const payload: { login: string; password: string; orgNo?: string } = {
        login: loginId,
        password,
      };
      const org = orgNo.trim();
      if (org) payload.orgNo = org;
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
      if (org) persistLoginOrgNo(org);
      assignNoStoreRedirect("/");
    } finally {
      setBusy(false);
    }
  }

  const pinHref = orgNo.trim()
    ? `/pin?org=${encodeURIComponent(orgNo.trim())}`
    : "/pin";

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
      formExtras={
        <StaffLoginOrgNoField
          orgNo={orgNo}
          onOrgNoChange={setOrgNo}
          hostBound={hostBound}
          label={tAuth("organizationIdLabel")}
          placeholder={tAuth("organizationIdPlaceholder")}
        />
      }
      extraLinks={
        <p>
          <a href={pinHref} className={LINK_ACCENT_CLASS}>
            {tAuth("pinLogin")}
          </a>
        </p>
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
