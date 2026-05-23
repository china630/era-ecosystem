/**
 * ERA ecosystem UI tokens — canonical source: ../../DESIGN.md (umbrella root).
 * F&B POS uses the light shell (#EBEDF0) for long waiter shifts.
 */

export const COLORS = {
  primary: "#34495E",
  secondary: "#7F8C8D",
  background: "#EBEDF0",
  action: "#2980B9",
  border: "#D5DADF",
  surface: "#FFFFFF",
} as const;

export const SHELL_CLASS = "min-h-screen bg-[#EBEDF0] text-[#34495E] antialiased";
export const CARD_CLASS = "rounded-2xl border border-[#D5DADF] bg-white shadow-sm";
export const INPUT_CLASS =
  "h-9 min-h-9 box-border rounded-lg border border-[#D5DADF] bg-white px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#2980B9]";
export const PRIMARY_BTN_CLASS =
  "rounded-lg bg-[#2980B9] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50";
export const SECONDARY_BTN_CLASS =
  "rounded-lg border border-[#D5DADF] bg-white px-4 py-2 text-sm font-medium text-[#34495E] hover:bg-[#EBEDF0]";
