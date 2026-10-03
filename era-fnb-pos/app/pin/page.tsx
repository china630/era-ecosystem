"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@era/i18n-common";
import {
  AuthPublicShell,
  AUTH_FIELD_GROUP_CLASS,
  AUTH_FIELD_LABEL_CLASS,
  AUTH_FORM_STACK_CLASS,
  FORM_INPUT_CLASS,
  LINK_ACCENT_CLASS,
  MODAL_FOOTER_PRIMARY_CLASS,
  PublicLegalFooter,
  showApiError,
  StaffLoginOrgNoField,
  useStaffLoginOrgNo,
  orchPublicHref,
  persistLoginOrgNo,
} from "@era/satellite-kit/ui";

type StaffChip = { id: string; fullName: string };

function PinForm() {
  const search = useSearchParams();
  const tAuth = useTranslations("auth");
  const tLogin = useTranslations("login");
  const t = useTranslations("pin");
  const locale = useLocale() as Locale;
  const [phase, setPhase] = useState<"loading" | "pair" | "names">("loading");
  const [staff, setStaff] = useState<StaffChip[]>([]);
  const [staffId, setStaffId] = useState("");
  const [pin, setPin] = useState("");
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const { orgNo, setOrgNo, hostBound } = useStaffLoginOrgNo(search);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetch("/api/auth/terminal")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.bound && Array.isArray(data.staff)) {
          setStaff(data.staff);
          setPhase("names");
          return;
        }
        setPhase("pair");
      })
      .catch(() => setPhase("pair"));
  }, []);

  function pinError(body: { error?: string } | null, status: number) {
    if (body?.error === "PIN_LOCKED" || status === 429) return t("locked");
    if (body?.error === "TERMINAL_REQUIRED") return t("terminalRequired");
    if (body?.error === "TERMINAL_BIND_DENIED") return t("bindDenied");
    if (status === 401) return t("invalid");
    return t("invalid");
  }

  async function pair(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const org = orgNo.trim();
      const res = await fetch("/api/auth/terminal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          login: loginId,
          password,
          orgNo: org || undefined,
        }),
      });
      const body = (await res.json().catch(() => null)) as {
        error?: string;
        bound?: boolean;
        staff?: StaffChip[];
      } | null;
      if (!res.ok || !body?.bound) {
        showApiError(body, pinError(body, res.status));
        return;
      }
      if (org) persistLoginOrgNo(org);
      setStaff(Array.isArray(body.staff) ? body.staff : []);
      setPassword("");
      setPhase("names");
    } finally {
      setBusy(false);
    }
  }

  async function enter(e: React.FormEvent) {
    e.preventDefault();
    if (!staffId) {
      showApiError({ error: t("pickName") });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId, pin }),
      });
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        showApiError(body, pinError(body, res.status));
        return;
      }
      window.location.href = "/floor";
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthPublicShell
      locale={locale}
      title={tAuth("loginTitle")}
      localeLabels={{
        groupAria: tAuth("localeToggleAria"),
        az: tAuth("localeAz"),
        ru: tAuth("localeRu"),
        en: tAuth("localeEn"),
      }}
      footer={
        <>
          <p className="mt-6 text-center text-sm">
            <a href="/login" className={LINK_ACCENT_CLASS}>
              {t("backToLogin")}
            </a>
          </p>
          <PublicLegalFooter
            locale={locale}
            faqHref={orchPublicHref("/help")}
            showFaq={false}
            labels={{
              navAria: tAuth("footerLegalNavAria"),
              faq: tAuth("footerFaq"),
              terms: tAuth("footerTerms"),
              privacy: tAuth("footerPrivacy"),
              status: tAuth("footerStatus"),
            }}
          />
        </>
      }
    >
      {phase === "loading" ? null : phase === "pair" ? (
        <form onSubmit={(e) => void pair(e)} className={AUTH_FORM_STACK_CLASS}>
          <p className="text-sm text-[#7F8C8D]">{t("pairHint")}</p>
          <label className={AUTH_FIELD_GROUP_CLASS}>
            <span className={AUTH_FIELD_LABEL_CLASS}>{tLogin("login")}</span>
            <input
              className={FORM_INPUT_CLASS}
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label className={AUTH_FIELD_GROUP_CLASS}>
            <span className={AUTH_FIELD_LABEL_CLASS}>{tLogin("password")}</span>
            <input
              className={FORM_INPUT_CLASS}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <StaffLoginOrgNoField
            orgNo={orgNo}
            onOrgNoChange={setOrgNo}
            hostBound={hostBound}
            label={tAuth("organizationIdLabel")}
            placeholder={tAuth("organizationIdPlaceholder")}
          />
          <button type="submit" disabled={busy} className={`${MODAL_FOOTER_PRIMARY_CLASS} mt-1 w-full`}>
            {busy ? t("submitBusy") : t("pairSubmit")}
          </button>
        </form>
      ) : (
        <form onSubmit={(e) => void enter(e)} className={AUTH_FORM_STACK_CLASS}>
          <p className="text-sm text-[#7F8C8D]">{t("namesHint")}</p>
          {staff.length === 0 ? (
            <p className="text-sm text-[#34495E]">{t("noStaff")}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {staff.map((person) => (
                <button
                  key={person.id}
                  type="button"
                  className={`rounded px-3 py-2 text-sm font-medium ${
                    staffId === person.id
                      ? "bg-[#2980B9] text-white"
                      : "bg-[#EBEDF0] text-[#34495E]"
                  }`}
                  onClick={() => setStaffId(person.id)}
                >
                  {person.fullName}
                </button>
              ))}
            </div>
          )}
          <label className={AUTH_FIELD_GROUP_CLASS}>
            <span className={AUTH_FIELD_LABEL_CLASS}>{t("pin")}</span>
            <input
              className={`${FORM_INPUT_CLASS} tracking-[0.3em]`}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              inputMode="numeric"
              autoComplete="off"
              required
            />
          </label>
          <button type="submit" disabled={busy || !staffId} className={`${MODAL_FOOTER_PRIMARY_CLASS} mt-1 w-full`}>
            {busy ? t("submitBusy") : t("submit")}
          </button>
        </form>
      )}
    </AuthPublicShell>
  );
}

export default function PinPage() {
  const t = useTranslations("common");
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#EBEDF0] p-8 text-[#7F8C8D]">
          {t("loading")}
        </div>
      }
    >
      <PinForm />
    </Suspense>
  );
}
