/**
 * L1 — Design token primitives (raw scales).
 *
 * ONLY place in the UI kit where raw hex / absolute sizes may be authored.
 * L2 semantic and L3 component layers must reference these values — never invent
 * parallel hex codes in app code or component classes without updating L1 first.
 *
 * Spec: DESIGN.md section Three-tier design tokens; ADR docs/adr/era-design-tokens-3tier.md
 */

/** Brand + system palette (exact hex). */
export const COLOR = {
  slateBlue: "#34495E",
  asbestos: "#7F8C8D",
  systemGray: "#EBEDF0",
  strongBlue: "#2980B9",
  strongBlueHover: "#2471A3",
  borderMuted: "#D5DADF",
  white: "#FFFFFF",
  disabledFill: "#F4F5F7",
  tableHeadBg: "#F8FAFC",
  tableHeadText: "#475569",
  tableRowHover: "#F1F5F9",
  sidebarHover: "#E2E5E9",
  danger: "#E74C3C",
  dangerHover: "#C0392B",
  success: "#27AE60",
  successHover: "#229954",
  archive: "#BDC3C7",
} as const;

export type ColorPrimitive = keyof typeof COLOR;

/** Type scale (px as documented; Tailwind uses text-[13px] etc.). */
export const FONT_SIZE = {
  /** Table header chrome */
  xs: "11px",
  /** Locale toggle, micro labels */
  sm: "12px",
  /** Base UI — fields, buttons, dense tables */
  base: "13px",
  /** Modal / page titles */
  lg: "18px",
} as const;

/** Control and chrome heights. */
export const SIZE = {
  controlSm: "1.75rem",
  controlToolbar: "2rem",
  controlField: "2.25rem",
  iconHit: "2rem",
  iconHitSm: "1.75rem",
  checkbox: "1rem",
  sidebarExpanded: "17.5rem",
  sidebarCollapsed: "4.5rem",
  headerHeight: "4rem",
} as const;

/** Corner radius — DESIGN.md SaaS scale. */
export const RADIUS = {
  md: "0.375rem",
  lg: "0.5rem",
  xl: "0.75rem",
  "2xl": "1rem",
  full: "9999px",
} as const;

/** Spacing on 4px grid (rem). */
export const SPACE = {
  0: "0",
  0.5: "0.125rem",
  1: "0.25rem",
  1.5: "0.375rem",
  2: "0.5rem",
  3: "0.75rem",
  4: "1rem",
  6: "1.5rem",
  8: "2rem",
} as const;

/** Semantic field widths (ch / rem) — consumed by field-presets / resolveField. */
export const FIELD_CH = {
  count: "6ch",
  time: "7ch",
  date: "12ch",
  dateMin: "10.5rem",
  amount: "12ch",
  voen: "11ch",
  voenMin: "9.5rem",
  fin: "9ch",
  phone: "13ch",
  code: "14ch",
  shortText: "24ch",
  select: "20ch",
} as const;

/** Font stacks. */
export const FONT_FAMILY = {
  ui: "Segoe_UI,system-ui,sans-serif",
} as const;
