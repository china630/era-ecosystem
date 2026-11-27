/**
 * Shared hover for marketing landing cards — brand tokens only, no scale/indigo.
 */
export const LANDING_CARD_HOVER_CLASS =
  "transition-[border-color,box-shadow] duration-200 ease-out hover:border-[#2980B9]/40 hover:shadow-[0_8px_24px_rgba(52,73,94,0.06)]";

/** Premium glass panel for pricing matrix and add-on cards. */
export const PRICING_GLASS_CARD_CLASS =
  "rounded-2xl border border-[#D5DADF]/70 bg-white/70 shadow-[0_4px_30px_rgba(0,0,0,0.015)] backdrop-blur-md transition-all duration-300";

/** Unified live-card hover — border only (pricing storefront). */
export const PRICING_CARD_HOVER_CLASS =
  "transition-[border-color,box-shadow] duration-200 hover:border-[#2980B9]/50 hover:shadow-sm";

/** Dense matrix row shell. */
export const PRICING_MATRIX_ROW_CLASS =
  "mb-1.5 rounded-xl border border-[#D5DADF]/60 bg-white/40";

/** Brand-primary CTA (matches landing / DESIGN.md #2980B9). */
export const PRICING_PRIMARY_CTA_CLASS =
  "inline-flex h-9 w-full items-center justify-center rounded-lg bg-[#2980B9] px-3 text-center text-[12px] font-semibold text-white no-underline shadow-sm transition-colors duration-200 hover:bg-[#2471A3] focus:outline-none focus:ring-2 focus:ring-[#2980B9]/40 focus:ring-offset-1";
