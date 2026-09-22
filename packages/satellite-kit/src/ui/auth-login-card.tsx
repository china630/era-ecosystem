"use client";

import type { FormEvent, ReactNode } from "react";
import type { Locale } from "@era/i18n-common";
import {
  CARD_CONTAINER_CLASS,
  FORM_INPUT_CLASS,
  LINK_ACCENT_CLASS,
  MODAL_FOOTER_PRIMARY_CLASS,
} from "./design-system";
import { PublicLegalFooter } from "./legal-footer";
import { SatelliteLocaleToggle } from "./satellite-locale-toggle";
import { AuthPageHeader } from "./auth-page-header";
import { orchPublicHref } from "../platform/orch-web-url";

/** Auth-only: label without mb-* so gap comes from the field stack. */
export const AUTH_FIELD_LABEL_CLASS = "block text-[13px] font-semibold text-[#34495E]";
export const AUTH_FIELD_GROUP_CLASS = "flex flex-col gap-2";
export const AUTH_FORM_STACK_CLASS = "flex flex-col gap-5";

export type AuthLoginCardLabels = {
  loginTitle: string;
  loginId: string;
  email?: string;
  password: string;
  submitLogin: string;
  submitBusy: string;
  needAccount: string;
  registerOrgLink: string;
  viewPricing: string;
  userAgreement: string;
  footerLegalNavAria: string;
  footerFaq: string;
  footerTerms: string;
  footerPrivacy: string;
  footerStatus: string;
  localeToggleAria?: string;
  localeAz?: string;
  localeRu?: string;
  localeEn?: string;
};

export type AuthLoginCardProps = {
  locale: Locale;
  labels: AuthLoginCardLabels;
  loginId: string;
  password: string;
  onLoginIdChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  busy?: boolean;
  error?: string;
  /** @deprecated Ignored — product copy must not sit between header and fields. */
  subtitle?: string;
  /** @deprecated Ignored — no demo/SSO/bootstrap hints on login. */
  ssoHint?: ReactNode;
  emailMode?: boolean;
  localeControl?: ReactNode;
  registerHref?: string;
  registerOrgHref?: string;
  pricingHref?: string;
  faqHref?: string;
  termsHref?: string;
  formExtras?: ReactNode;
  extraLinks?: ReactNode;
  passwordMinLength?: number;
  showAccountLinks?: boolean;
  legalAppPrefix?: string;
};

/**
 * Shared login card — fixed slots: header, identity, password, extras, submit.
 */
export function AuthLoginCard({
  locale,
  labels,
  loginId,
  password,
  onLoginIdChange,
  onPasswordChange,
  onSubmit,
  busy = false,
  error,
  emailMode = false,
  localeControl,
  registerHref,
  registerOrgHref,
  pricingHref,
  faqHref,
  termsHref,
  formExtras,
  extraLinks,
  passwordMinLength,
  showAccountLinks = true,
  legalAppPrefix = "ERA",
}: AuthLoginCardProps) {
  const registerUrl = registerHref ?? orchPublicHref("/register");
  const registerOrgUrl = registerOrgHref ?? orchPublicHref("/register-org");
  const pricingUrl = pricingHref ?? orchPublicHref("/pricing");
  const faqUrl = faqHref ?? orchPublicHref("/help");
  const termsUrl = termsHref ?? orchPublicHref("/terms");

  const localeToggle =
    localeControl ?? (
      <SatelliteLocaleToggle
        locale={locale}
        labels={{
          groupAria: labels.localeToggleAria,
          az: labels.localeAz,
          ru: labels.localeRu,
          en: labels.localeEn,
        }}
      />
    );

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#EBEDF0] p-6">
      <div className={`w-full max-w-md p-8 ${CARD_CONTAINER_CLASS}`}>
        <AuthPageHeader title={labels.loginTitle} localeControl={localeToggle} />
        {error ? (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        <form onSubmit={onSubmit} className={AUTH_FORM_STACK_CLASS} autoComplete="on">
          <label className={AUTH_FIELD_GROUP_CLASS}>
            <span className={AUTH_FIELD_LABEL_CLASS}>
              {emailMode ? (labels.email ?? labels.loginId) : labels.loginId}
            </span>
            <input
              type={emailMode ? "email" : "text"}
              name={emailMode ? "email" : "login"}
              required
              autoComplete="username"
              value={loginId}
              onChange={(e) => onLoginIdChange(e.target.value)}
              className={FORM_INPUT_CLASS}
            />
          </label>
          <label className={AUTH_FIELD_GROUP_CLASS}>
            <span className={AUTH_FIELD_LABEL_CLASS}>{labels.password}</span>
            <input
              type="password"
              name="password"
              required
              minLength={passwordMinLength}
              autoComplete="current-password"
              value={password}
              onChange={(e) => onPasswordChange(e.target.value)}
              className={FORM_INPUT_CLASS}
            />
          </label>
          {formExtras}
          <button
            type="submit"
            disabled={busy}
            className={`${MODAL_FOOTER_PRIMARY_CLASS} mt-1 w-full`}
          >
            {busy ? labels.submitBusy : labels.submitLogin}
          </button>
        </form>
        {showAccountLinks ? (
          <>
            <p className="mt-6 text-sm">
              <a href={registerUrl} className={LINK_ACCENT_CLASS}>
                {labels.needAccount}
              </a>
            </p>
            <p className="mt-3 rounded-lg border border-[#D5DADF] bg-[#EBEDF0] px-3 py-2.5 text-center text-sm">
              <a href={registerOrgUrl} className={LINK_ACCENT_CLASS}>
                {labels.registerOrgLink}
              </a>
            </p>
            <div className="mt-4 space-y-2 rounded-lg border border-[#D5DADF] bg-white px-3 py-2.5 text-center text-sm">
              <p>
                <a href={pricingUrl} className={LINK_ACCENT_CLASS}>
                  {labels.viewPricing}
                </a>
              </p>
              <p>
                <a href={faqUrl} className={LINK_ACCENT_CLASS}>
                  {labels.footerFaq}
                </a>
              </p>
              <p>
                <a href={termsUrl} className={LINK_ACCENT_CLASS}>
                  {labels.userAgreement}
                </a>
              </p>
            </div>
          </>
        ) : null}
        {extraLinks ? <div className="mt-4 text-center text-sm">{extraLinks}</div> : null}
        <PublicLegalFooter
          locale={locale}
          faqHref={faqUrl}
          appPrefix={legalAppPrefix}
          showFaq={false}
          labels={{
            navAria: labels.footerLegalNavAria,
            faq: labels.footerFaq,
            terms: labels.footerTerms,
            privacy: labels.footerPrivacy,
            status: labels.footerStatus,
          }}
        />
      </div>
    </main>
  );
}
