/**
 * L2 — Semantic design tokens (role aliases).
 *
 * Maps UI roles to L1 primitives. Component classes (L3) and resolveField must
 * consume these aliases — not invent new hex values.
 *
 * Spec: DESIGN.md section Three-tier design tokens; ADR docs/adr/era-design-tokens-3tier.md
 */

import { COLOR, FONT_SIZE, RADIUS, SIZE, SPACE } from "./primitives";

export const text = {
  primary: COLOR.slateBlue,
  muted: COLOR.asbestos,
  inverse: COLOR.white,
  tableHead: COLOR.tableHeadText,
  danger: COLOR.danger,
  action: COLOR.strongBlue,
  actionHover: COLOR.strongBlueHover,
  archive: COLOR.archive,
} as const;

export const surface = {
  app: COLOR.systemGray,
  card: COLOR.white,
  disabled: COLOR.disabledFill,
  tableHead: COLOR.tableHeadBg,
  tableRowHover: COLOR.tableRowHover,
  sidebarHover: COLOR.sidebarHover,
} as const;

export const border = {
  muted: COLOR.borderMuted,
  transparent: "transparent",
} as const;

export const action = {
  fill: COLOR.strongBlue,
  fillHover: COLOR.strongBlueHover,
  focusRing: COLOR.strongBlue,
} as const;

export const danger = {
  fill: COLOR.danger,
  fillHover: COLOR.dangerHover,
  text: COLOR.danger,
} as const;

export const success = {
  fill: COLOR.success,
  fillHover: COLOR.successHover,
  text: COLOR.success,
} as const;

export const radius = {
  control: RADIUS.lg,
  shell: RADIUS["2xl"],
  section: RADIUS.xl,
  pill: RADIUS.md,
  full: RADIUS.full,
} as const;

export const size = {
  controlToolbar: SIZE.controlToolbar,
  controlField: SIZE.controlField,
  controlSm: SIZE.controlSm,
  iconHit: SIZE.iconHit,
  sidebarExpanded: SIZE.sidebarExpanded,
  sidebarCollapsed: SIZE.sidebarCollapsed,
  header: SIZE.headerHeight,
} as const;

export const space = {
  labelGap: SPACE[1.5],
  fieldStack: SPACE[4],
  fieldStackTight: SPACE[3],
  modalPad: SPACE[6],
  tableCellX: SPACE[4],
  tableCellY: SPACE[2],
} as const;

export const fontSize = {
  micro: FONT_SIZE.xs,
  caption: FONT_SIZE.sm,
  ui: FONT_SIZE.base,
  title: FONT_SIZE.lg,
} as const;

/** Legacy DESIGN bag — kept for callers that import DESIGN.primary etc. */
export const DESIGN = {
  primary: text.primary,
  secondary: text.muted,
  background: surface.app,
  action: action.fill,
} as const;
