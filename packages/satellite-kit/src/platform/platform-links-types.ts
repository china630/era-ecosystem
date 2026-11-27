/** Shared platform-links DTO — no Node / React imports (safe for Edge + Nest + client). */
export type PlatformLinksBody = {
  appOrigin: string | null;
  registerUrl: string | null;
  registerOrgUrl: string | null;
  pricingUrl: string | null;
  helpUrl: string | null;
  termsUrl: string | null;
};
