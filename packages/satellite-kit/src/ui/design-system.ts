/**
 * DESIGN.md — ERA ecosystem visual tokens (shared by industry satellites).
 * Canonical spec: ../../../DESIGN.md
 */

export const DESIGN = {
  primary: "#34495E",
  secondary: "#7F8C8D",
  background: "#EBEDF0",
  action: "#2980B9",
} as const;

export const APP_SHELL_CLASS =
  "min-h-screen bg-[#EBEDF0] text-[#34495E] antialiased font-[Segoe_UI,system-ui,sans-serif]";

export const PRIMARY_BUTTON_CLASS =
  "inline-flex h-8 min-h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg px-4 text-[13px] font-semibold text-white bg-[#2980B9] shadow-sm transition hover:bg-[#2471A3] focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#2980B9] disabled:opacity-50 disabled:pointer-events-none";

export const SECONDARY_BUTTON_CLASS =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[#D5DADF] bg-white px-4 text-[13px] font-medium text-[#34495E] shadow-sm transition hover:bg-[#F4F5F7] focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#2980B9]/40 disabled:opacity-50 disabled:pointer-events-none";

export const GHOST_BUTTON_CLASS =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-transparent bg-transparent px-2 text-[13px] font-medium text-[#7F8C8D] transition hover:bg-[#F4F5F7] focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#2980B9]/30 disabled:opacity-50 disabled:pointer-events-none";

export const CARD_CONTAINER_CLASS =
  "rounded-2xl border border-[#D5DADF] bg-white shadow-sm";

export const MODAL_DIALOG_CONTENT_CLASS =
  "flex w-full max-h-[90vh] min-h-0 flex-col overflow-hidden rounded-2xl border border-[#D5DADF] bg-white p-6 shadow-lg";

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

export const DATA_TABLE_VIEWPORT_CLASS =
  "max-h-[min(70vh,56rem)] overflow-auto rounded-2xl border border-[#D5DADF] bg-white shadow-sm";

export const DATA_TABLE_CLASS = "min-w-full border-collapse text-[13px]";

export const DATA_TABLE_HEAD_ROW_CLASS =
  "sticky top-0 z-10 border-b border-[#D5DADF] bg-[#F8FAFC] shadow-[0_1px_0_0_#D5DADF]";

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
