"use client";

import { Suspense, useState } from "react";
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
  persistLoginOrgNo,
  PublicLegalFooter,
  showApiError,
  StaffLoginOrgNoField,
  useStaffLoginOrgNo,
  orchPublicHref,
} from "@era/satellite-kit/ui";

function PinForm() {
  const search = useSearchParams();
  const tAuth = useTranslations("auth");
  const t = useTranslations("pin");
  const locale = useLocale() as Locale;
  const [pin, setPin] = useState("");
  const { orgNo, setOrgNo, hostBound } = useStaffLoginOrgNo(search);
  const [outletId, setOutletId] = useState(search.get("outletId") ?? "");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const org = orgNo.trim();
      const res = await fetch("/api/auth/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pin,
          orgNo: org || undefined,
          outletId,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        showApiError(
          body,
          body?.error === "PIN_OUTLET_UNBOUND" ? t("unbound") : t("invalid"),
        );
        return;
      }
      if (org) persistLoginOrgNo(org);
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
      <form onSubmit={onSubmit} className={AUTH_FORM_STACK_CLASS}>
        <StaffLoginOrgNoField
          orgNo={orgNo}
          onOrgNoChange={setOrgNo}
          hostBound={hostBound}
          label={tAuth("organizationIdLabel")}
          placeholder={tAuth("organizationIdPlaceholder")}
        />
        <label className={AUTH_FIELD_GROUP_CLASS}>
          <span className={AUTH_FIELD_LABEL_CLASS}>{t("outletId")}</span>
          <input
            className={FORM_INPUT_CLASS}
            value={outletId}
            onChange={(e) => setOutletId(e.target.value)}
            autoComplete="off"
          />
        </label>
        <label className={AUTH_FIELD_GROUP_CLASS}>
          <span className={AUTH_FIELD_LABEL_CLASS}>{t("pin")}</span>
          <input
            className={`${FORM_INPUT_CLASS} tracking-[0.3em]`}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            inputMode="numeric"
            required
            autoComplete="off"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className={`${MODAL_FOOTER_PRIMARY_CLASS} mt-1 w-full`}
        >
          {busy ? t("submitBusy") : t("submit")}
        </button>
      </form>
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
