import type { AuthLoginCardLabels } from "./auth-login-card";

/** Build AuthLoginCard labels from next-intl `auth` namespace (i18n-common). */
export function buildAuthLoginLabels(
  t: (key: string) => string,
  opts?: { emailMode?: boolean },
): AuthLoginCardLabels {
  return {
    loginTitle: t("loginTitle"),
    loginId: opts?.emailMode ? t("email") : t("loginId"),
    email: t("email"),
    password: t("password"),
    submitLogin: t("submitLogin"),
    submitBusy: t("submitBusy"),
    needAccount: t("needAccount"),
    registerOrgLink: t("registerOrgLink"),
    viewPricing: t("viewPricing"),
    userAgreement: t("userAgreement"),
    footerLegalNavAria: t("footerLegalNavAria"),
    footerFaq: t("footerFaq"),
    footerTerms: t("footerTerms"),
    footerPrivacy: t("footerPrivacy"),
    footerStatus: t("footerStatus"),
    localeToggleAria: t("localeToggleAria"),
    localeAz: t("localeAz"),
    localeRu: t("localeRu"),
    localeEn: t("localeEn"),
  };
}
