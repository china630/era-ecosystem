"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { uiLang } from "@era/i18n-common";
import { AuthLoginCard, showApiError } from "@era/satellite-kit/ui";
import { apiBaseUrl, apiFetch, emitClientApiError } from "../../lib/api-client";
import type { AuthUser, OrgSummary } from "../../lib/auth-context";
import { useAuth } from "../../lib/auth-context";
import { LanguageSwitcher } from "../language-switcher";

const LOGIN_RECENT_EMAILS_KEY = "erafinance_login_recent_emails";
const MAX_RECENT_EMAILS = 10;

function loadRecentLoginEmails(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOGIN_RECENT_EMAILS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string" && x.trim().includes("@"));
  } catch {
    return [];
  }
}

function rememberLoginEmail(email: string) {
  const trimmed = email.trim();
  if (!trimmed || !trimmed.includes("@")) return;
  const lower = trimmed.toLowerCase();
  const existing = loadRecentLoginEmails();
  const without = existing.filter((e) => e.trim().toLowerCase() !== lower);
  const next = [trimmed, ...without].slice(0, MAX_RECENT_EMAILS);
  try {
    localStorage.setItem(LOGIN_RECENT_EMAILS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export default function LoginPage() {
  const { t, i18n } = useTranslation();
  const locale = uiLang(i18n.language);
  const { login, token, ready, user } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [recentEmails, setRecentEmails] = useState<string[]>([]);

  useEffect(() => {
    const recent = loadRecentLoginEmails();
    setRecentEmails(recent);
    if (recent.length > 0) setEmail(recent[0]);
  }, []);

  useEffect(() => {
    if (!ready || !token || !user) return;
    if (!user.organizationId) {
      router.replace("/companies");
      return;
    }
    router.replace("/home");
  }, [ready, token, user, router]);

  if (ready && token && user) return null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await apiFetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        showApiError(await res.text().catch(() => null), t("auth.loginFailed"));
        return;
      }
      const data = (await res.json()) as {
        accessToken: string;
        user: AuthUser;
        organizations: OrgSummary[];
      };
      const orgs = data.organizations ?? [];
      rememberLoginEmail(email);
      login(data.accessToken, data.user, orgs);
      const target = orgs.length === 0 ? "/companies" : orgs.length > 1 ? "/companies" : "/";
      window.location.assign(target);
    } catch {
      emitClientApiError(503, t("auth.apiUnreachable", { url: apiBaseUrl() }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLoginCard
      locale={locale}
      emailMode
      localeControl={<LanguageSwitcher />}
      legalAppPrefix="ERAFINANCE"
      labels={{
        loginTitle: t("auth.loginTitle"),
        loginId: t("auth.email"),
        email: t("auth.email"),
        password: t("auth.password"),
        submitLogin: t("auth.submitLogin"),
        submitBusy: t("auth.submitBusy"),
        needAccount: t("auth.needAccount"),
        registerOrgLink: t("auth.registerOrgLink"),
        viewPricing: t("auth.viewPricing"),
        userAgreement: t("auth.userAgreement"),
        footerLegalNavAria: t("auth.footerLegalNavAria"),
        footerFaq: t("auth.footerFaq"),
        footerTerms: t("auth.footerTerms"),
        footerPrivacy: t("auth.footerPrivacy"),
        footerStatus: t("auth.footerStatus"),
        localeToggleAria: t("language"),
        localeAz: t("az"),
        localeRu: t("ru"),
        localeEn: "EN",
      }}
      loginId={email}
      password={password}
      onLoginIdChange={setEmail}
      onPasswordChange={setPassword}
      onSubmit={onSubmit}
      busy={busy}
      formExtras={
        <datalist id="erafinance-login-recent-emails">
          {recentEmails.map((e) => (
            <option key={e} value={e} />
          ))}
        </datalist>
      }
    />
  );
}
