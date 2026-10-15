/** One remembered rail for every ERA shell (satellites, finance, orchestrator). */
export const ERA_SIDEBAR_COLLAPSED_KEY = "era.sidebar.collapsed";

const LEGACY_KEYS = ["erafinance_sidebar_collapsed"];

export function readSidebarCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  const current = window.localStorage.getItem(ERA_SIDEBAR_COLLAPSED_KEY);
  if (current === "1" || current === "0") return current === "1";
  return LEGACY_KEYS.some((key) => window.localStorage.getItem(key) === "1");
}

export function writeSidebarCollapsed(collapsed: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ERA_SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0");
}
