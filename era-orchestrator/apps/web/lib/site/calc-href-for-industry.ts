import type { Locale } from "@era/i18n-common";
import type { CalcState } from "../pricing/quote-calculator";
import { serializeCalcState } from "../pricing/quote-selection";
import type { CalcPrefillJson, PublicSiteIndustry } from "./site-catalog-types";

function calcQueryFromPrefill(prefill: CalcPrefillJson | null): string | null {
  if (!prefill || typeof prefill !== "object") return null;
  const moduleKeys = Array.isArray(prefill.moduleKeys) ? prefill.moduleKeys.filter(Boolean) : [];
  if (moduleKeys.length === 0) return null;
  const payload: Record<string, unknown> = { moduleKeys };
  if (prefill.capacity && typeof prefill.capacity === "object") {
    payload.capacity = prefill.capacity;
  }
  return serializeCalcState(payload as CalcState);
}

/** Unprefixed `/calc` (CalcPageView owns `?q=` history). Locale via cookie. */
export function calcPublicHref(query?: string | null): string {
  if (query) return `/calc?q=${encodeURIComponent(query)}`;
  return "/calc";
}

/** `/calc?q=` from industry `calcPrefill`, or bare `/calc`. */
export function calcHrefForIndustry(
  _locale: Locale,
  industry: Pick<PublicSiteIndustry, "slug" | "calcPrefill">,
): string {
  return calcPublicHref(calcQueryFromPrefill(industry.calcPrefill));
}
