/**
 * Centralized selectors for emas.sosial.gov.az — update when the portal DOM changes.
 * Bump EMAS_FIELD_MAPPING_VERSION (api-contracts) together with selector / field-map changes.
 * MVP placeholders: adjust after pilot on the real site.
 */

import { EMAS_FIELD_MAPPING_VERSION } from "@erafinance/api-contracts";

export { EMAS_FIELD_MAPPING_VERSION };

export const EmasSelectors = {
  mappingVersion: EMAS_FIELD_MAPPING_VERSION,
  /** Any visible user menu / profile block when logged in. */
  authIndicators: [
    '[class*="user"]',
    '[class*="profile"]',
    '[class*="avatar"]',
    "header a[href*='logout']",
    "header button",
  ],
  /**
   * TODO: validate selectors on real ƏMAS pages and keep only stable ones.
   * For now we search common "profile/company" blocks where VÖEN may appear.
   */
  activeVoenCandidates: [
    '[data-testid*="voen"]',
    '[id*="voen"]',
    '[class*="voen"]',
    '[class*="tax"]',
    '[class*="company"]',
    '[class*="profile"]',
    "header",
  ],
  /** Generic text inputs on employment forms (broad; refine per flow). */
  formInputs: "input[type=text], input:not([type]), textarea",
  /**
   * İmzala / Sign — NEVER auto-click. Listed only so RPA code can assert we do not touch it.
   */
  signButtons: 'button, a, [role="button"]',
} as const;

/**
 * True if element looks like a portal sign/İmzala control (must not be clicked by extension).
 * Normalize Turkish İ/I before match — `"İ".toLowerCase()` yields `i` + combining dot (U+0307).
 */
export function looksLikeEmasSignControl(el: Element): boolean {
  const hay = `${el.textContent ?? ""} ${el.getAttribute("aria-label") ?? ""} ${(el as HTMLElement).title ?? ""}`
    .toLocaleLowerCase("en-US")
    .replace(/\u0130/g, "i")
    .replace(/\u0307/g, "");
  return /imzala|imza|sign|подпис/.test(hay);
}
