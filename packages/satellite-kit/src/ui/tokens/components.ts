/**
 * L3 — Component design tokens (Tailwind class strings).
 *
 * Hex literals in these classes MUST match L1 primitives (COLOR.*) —
 * enforced by scripts/lint-token-layers.mjs.
 *
 * Why literals? Tailwind JIT scans source for complete class names; dynamic
 * template classes are not detected. Hybrid model: L1/L2 = value truth;
 * L3 = static class composition aligned to those values.
 *
 * Spec: DESIGN.md section Three-tier design tokens; ADR docs/adr/era-design-tokens-3tier.md
 *
 * Consumers: re-exported via ../design-system.ts and @era/satellite-kit/ui.
 */

import { DESIGN as SEMANTIC_DESIGN } from "./semantic";

/** Align public DESIGN bag with L2 semantic aliases. */
export const DESIGN = SEMANTIC_DESIGN;

export const APP_SHELL_CLASS =
  "min-h-screen bg-[#EBEDF0] text-[#34495E] antialiased font-[Segoe_UI,system-ui,sans-serif]";

export const PRIMARY_BUTTON_CLASS =
  "inline-flex h-8 min-h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg px-4 text-[13px] font-semibold text-white bg-[#2980B9] shadow-sm transition hover:bg-[#2471A3] focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#2980B9] disabled:opacity-50 disabled:pointer-events-none";

export const SECONDARY_BUTTON_CLASS =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[#D5DADF] bg-white px-4 text-[13px] font-medium text-[#34495E] shadow-sm transition hover:bg-[#F4F5F7] focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#2980B9]/40 disabled:opacity-50 disabled:pointer-events-none";

export const GHOST_BUTTON_CLASS =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-transparent bg-transparent px-2 text-[13px] font-medium text-[#7F8C8D] transition hover:bg-[#F4F5F7] focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#2980B9]/30 disabled:opacity-50 disabled:pointer-events-none";

export const SUCCESS_BUTTON_CLASS =
  "inline-flex h-8 min-h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg px-4 text-[13px] font-semibold text-white bg-[#27AE60] shadow-sm transition hover:bg-[#229954] focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#27AE60] disabled:opacity-50 disabled:pointer-events-none";

export const DANGER_BUTTON_CLASS =
  "inline-flex h-8 min-h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg px-4 text-[13px] font-semibold text-white bg-[#E74C3C] shadow-sm transition hover:bg-[#C0392B] focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#E74C3C] disabled:opacity-50 disabled:pointer-events-none";

export const CARD_CONTAINER_CLASS =
  "rounded-2xl border border-[#D5DADF] bg-white shadow-sm";

export const MODAL_DIALOG_CONTENT_CLASS =
  "flex w-full max-h-[90vh] min-h-0 flex-col overflow-hidden rounded-2xl border border-[#D5DADF] bg-white p-6 shadow-lg";

/** Wide ops card (reservation / guest) — pair with ModalShell bodyClassName overflow-hidden. */
export const MODAL_WIDE_CLASS =
  "max-w-[min(96vw,1400px)] w-full min-h-[min(70vh,42rem)] max-h-[92vh]";

/** Near-fullscreen ops card (ElektraWeb-style reservation / guest). Prefer over MODAL_WIDE for FO cards. */
export const MODAL_FULL_CLASS =
  "max-w-[min(98vw,1600px)] w-full min-h-[min(75vh,48rem)] max-h-[90vh]";

export const MODAL_CLOSE_BUTTON_CLASS =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-transparent bg-transparent text-[#7F8C8D] transition hover:bg-[#F4F5F7] focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#2980B9]/30";

export const MODAL_FOOTER_ACTIONS_CLASS = "mt-6 flex justify-end gap-2";

export const MODAL_FOOTER_BUTTON_CLASS =
  "inline-flex h-9 min-h-9 shrink-0 items-center justify-center rounded-lg px-4 text-[13px] font-semibold disabled:opacity-50 disabled:pointer-events-none";

export const MODAL_FOOTER_PRIMARY_CLASS = `${MODAL_FOOTER_BUTTON_CLASS} bg-[#2980B9] text-white hover:bg-[#2471A3] focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#2980B9]`;

export const MODAL_FOOTER_OUTLINE_CLASS = `${MODAL_FOOTER_BUTTON_CLASS} border border-[#D5DADF] bg-white font-medium text-[#34495E] hover:bg-[#F4F5F7] focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#2980B9]/40`;

export const MODAL_FIELD_LABEL_CLASS =
  "mb-1.5 block text-[13px] font-semibold text-[#34495E]";

const MODAL_INPUT_BASE =
  "w-full rounded-lg border border-[#D5DADF] bg-white px-3 text-[13px] text-[#34495E] shadow-sm placeholder:text-[#7F8C8D] focus:outline-none focus:ring-1 focus:ring-[#2980B9] disabled:bg-[#F4F5F7] disabled:text-[#7F8C8D]";

export const MODAL_INPUT_CLASS = `${MODAL_INPUT_BASE} box-border h-9 min-h-9 leading-normal`;

export const MODAL_TEXTAREA_CLASS = `${MODAL_INPUT_BASE} min-h-[4.5rem] resize-y py-2 leading-normal`;

export const MODAL_CHECKBOX_CLASS =
  "h-4 w-4 shrink-0 rounded-lg border border-[#D5DADF] accent-[#2980B9]";

/**
 * Outer table chrome — overflow-hidden so sticky thead cannot paint over rounded corners.
 * Pair with DATA_TABLE_SCROLL_CLASS for the scrollable body.
 */
export const DATA_TABLE_SHELL_CLASS =
  "overflow-hidden rounded-2xl border border-[#D5DADF] bg-white shadow-sm";

/** Inner scroll region (no border/radius — belongs on the shell). */
export const DATA_TABLE_SCROLL_CLASS = "max-h-[min(70vh,56rem)] overflow-auto";

/**
 * Fill-height table scroll (EraListWorkspace / layout="fill").
 * No 70vh cap — parent flex column owns the height.
 */
export const DATA_TABLE_SCROLL_FILL_CLASS = "min-h-0 flex-1 overflow-auto";

/**
 * Page root for unbounded lists: fills viewport under fixed header (4rem),
 * counters main `pb-24` / `lg:pb-8` so the page itself does not scroll.
 * Put PageHeader + EraListWorkspace inside.
 */
export const LIST_PAGE_SHELL_CLASS =
  "flex h-[calc(100dvh-4rem)] min-h-0 flex-col overflow-hidden -mb-16 pb-3 lg:-mb-8 lg:pb-2";

/** Flex column used by EraListWorkspace when fill=true (parent is LIST_PAGE_SHELL_CLASS). */
export const LIST_PAGE_FILL_CLASS =
  "flex min-h-0 flex-1 flex-col gap-3 overflow-hidden";

/** Non-fill workspace (nested / partial embeds). */
export const LIST_WORKSPACE_CLASS = "flex min-h-0 flex-1 flex-col gap-3";

/**
 * Legacy single-wrapper viewport (shell + scroll). Prefer SHELL + SCROLL for new code.
 * clip-path keeps sticky thead from painting over rounded corners while overflow-auto scrolls.
 */
export const DATA_TABLE_VIEWPORT_CLASS =
  "max-h-[min(70vh,56rem)] overflow-auto overflow-x-auto rounded-2xl border border-[#D5DADF] bg-white shadow-sm [clip-path:inset(0_round_1rem)]";

export const DATA_TABLE_CLASS = "min-w-full border-collapse text-[13px]";

export const DATA_TABLE_HEAD_ROW_CLASS =
  "sticky top-0 z-10 border-b border-[#D5DADF] bg-[#F8FAFC] shadow-[0_1px_0_0_#D5DADF] [&>th:first-child]:rounded-tl-[0.95rem] [&>th:last-child]:rounded-tr-[0.95rem]";

export const DATA_TABLE_TH_LEFT_CLASS =
  "px-4 py-2 text-left text-xs font-bold leading-tight text-[#475569]";

export const DATA_TABLE_TH_RIGHT_CLASS =
  "px-4 py-2 text-right text-xs font-bold leading-tight text-[#475569]";

export const DATA_TABLE_TR_CLASS =
  "border-b border-[#D5DADF] bg-white transition-colors hover:bg-[#F1F5F9]";

export const DATA_TABLE_TD_CLASS = "px-4 py-2 align-middle text-[13px] text-[#34495E]";

export const TABLE_ROW_ICON_BTN_CLASS =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-transparent bg-transparent transition-colors hover:bg-[#EBEDF0] focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#2980B9]/25 disabled:pointer-events-none disabled:opacity-50";

export const SIDEBAR_LINK_CLASS =
  "flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium text-[#34495E] transition hover:bg-[#E2E5E9]";

export const SIDEBAR_LINK_ACTIVE_CLASS =
  "flex items-center gap-2 rounded-lg bg-[#2980B9]/10 px-3 py-2 text-[13px] font-semibold text-[#2980B9]";

export const FORM_FIELD_GROUP_CLASS = "space-y-1.5";

export const FORM_STACK_CLASS = "space-y-4";

export const LINK_ACCENT_CLASS =
  "text-[13px] font-medium text-[#2980B9] hover:text-[#2471A3] hover:underline";

/** Underline tabs (reservation card, guest card, settings). */
export const TAB_STRIP_CLASS = "mb-2 flex flex-wrap gap-1 border-b border-[#D5DADF]";

export const TAB_ITEM_CLASS =
  "border-b-2 border-transparent px-3 py-2 text-[13px] font-medium text-[#7F8C8D] transition hover:text-[#34495E]";

export const TAB_ITEM_ACTIVE_CLASS =
  "border-b-2 border-[#2980B9] px-3 py-2 text-[13px] font-medium text-[#2980B9]";

/** Compact filter / sub-tab chips (folio subtabs) — light tray + white inactive pills. */
export const CHIP_GROUP_CLASS =
  "flex flex-wrap gap-1.5 rounded-xl border border-[#D5DADF] bg-[#F8FAFC] p-1.5";

export const CHIP_CLASS =
  "rounded-lg border border-transparent bg-white px-2.5 py-1 text-[12px] font-medium text-[#34495E] shadow-sm transition hover:bg-[#F4F5F7]";

export const CHIP_ACTIVE_CLASS =
  "rounded-lg border border-transparent bg-[#2980B9] px-2.5 py-1 text-[12px] font-medium text-white shadow-sm";

/** Collapsible FieldSection shell + light header strip. */
export const FIELD_SECTION_CLASS =
  "overflow-hidden rounded-xl border border-[#D5DADF] bg-white";

export const FIELD_SECTION_HEADER_CLASS =
  "flex w-full items-center justify-between gap-2 bg-[#F8FAFC] px-3 py-2 text-left transition hover:bg-[#F1F5F9]";

export const FIELD_SECTION_BODY_CLASS = "space-y-4 border-t border-[#D5DADF] px-3 pb-3 pt-3";

/**
 * Static (non-collapsible) field group panel — same chrome as FieldSection.
 * Use for FO cards (reservation / guest) where sections stay always open.
 */
export const FIELD_PANEL_CLASS =
  "overflow-hidden rounded-xl border border-[#D5DADF] bg-white";

export const FIELD_PANEL_HEADER_CLASS =
  "bg-[#F8FAFC] px-3 py-2 text-[13px] font-semibold text-[#34495E]";

export const FIELD_PANEL_BODY_CLASS = "space-y-3 border-t border-[#D5DADF] px-3 pb-3 pt-3";

/** Nested summary / balance blocks inside FieldSection / FieldPanel. */
export const SUBSECTION_SURFACE_CLASS = "rounded-lg bg-[#F8FAFC] p-2 text-[12px] text-[#34495E]";
export const TEXT_SUCCESS_CLASS = "text-[#27AE60]";

export const TEXT_DANGER_CLASS = "text-[#E74C3C]";

export const TEXT_MUTED_CLASS = "text-[#7F8C8D]";

/** Floating menus under toolbar buttons. */
export const DROPDOWN_PANEL_CLASS =
  "absolute right-0 top-full z-10 mt-1 min-w-[160px] rounded-lg border border-[#D5DADF] bg-white py-1 shadow-lg";

export const DROPDOWN_ITEM_CLASS =
  "block w-full px-3 py-2 text-left text-[13px] text-[#34495E] transition hover:bg-[#F8FAFC]";

/** Segmented AZ / RU / EN control — auth header + app header (DESIGN.md public auth). */
export const LOCALE_TOGGLE_GROUP_CLASS =
  "inline-flex shrink-0 rounded-lg border border-[#D5DADF] bg-white p-0.5 shadow-sm";
export const LOCALE_TOGGLE_ACTIVE_CLASS =
  "inline-flex h-7 min-w-[2.25rem] items-center justify-center rounded-md px-2 text-[12px] font-semibold bg-[#2980B9] text-white transition";

export const LOCALE_TOGGLE_INACTIVE_CLASS =
  "inline-flex h-7 min-w-[2.25rem] items-center justify-center rounded-md px-2 text-[12px] font-semibold text-[#7F8C8D] transition hover:bg-[#F4F5F7] hover:text-[#34495E]";

export const FORM_INPUT_CLASS =
  "box-border h-9 min-h-9 w-full rounded-lg border border-[#D5DADF] bg-white px-3 text-[13px] text-[#34495E] placeholder:text-[#7F8C8D] focus:outline-none focus:ring-1 focus:ring-[#2980B9] disabled:bg-[#F4F5F7]";

/** Expanded sidebar width (280px) — matches Finance MainSidebar. */
export const APP_SIDEBAR_WIDTH = "17.5rem";
export const APP_SIDEBAR_WIDTH_CLASS = "w-[17.5rem]";
export const APP_SIDEBAR_COLLAPSED_CLASS = "lg:w-[4.5rem]";
export const APP_SIDEBAR_OFFSET_CLASS = "lg:pl-[17.5rem]";
export const APP_SIDEBAR_COLLAPSED_OFFSET_CLASS = "lg:pl-[4.5rem]";
export const APP_SIDEBAR_LEFT_CLASS = "lg:left-[17.5rem]";
export const APP_SIDEBAR_COLLAPSED_LEFT_CLASS = "lg:left-[4.5rem]";
export const APP_HEADER_OFFSET_CLASS = "pt-16";

/**
 * Canonical main content padding under the fixed app header.
 * Single source of truth for orchestrator, finance, and industry satellites —
 * do not fork these classes in app shells.
 */
export const APP_MAIN_CONTENT_PADDED_CLASS =
  "px-4 py-6 pb-24 sm:px-6 sm:py-8 lg:px-8 lg:pb-8";

/** `<main>` chrome for shells that render raw main (orch / finance). */
export const APP_MAIN_CONTENT_CLASS = `app-shell-main w-full min-w-0 ${APP_MAIN_CONTENT_PADDED_CLASS}`;
