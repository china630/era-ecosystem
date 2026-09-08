import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type EraOpsNavItem = {
  id?: string;
  href?: string;
  label: string;
  icon?: LucideIcon;
  external?: boolean;
  active?: boolean;
  hidden?: boolean;
  onClick?: () => void;
};

export type EraOpsNavSection = {
  id: string;
  title: string;
  icon?: LucideIcon;
  items: EraOpsNavItem[];
  hidden?: boolean;
  /** Single link without collapsible group (Finance-style Home). */
  flat?: boolean;
};

export type EraOpsQuickLink = {
  href?: string;
  label: string;
  icon: LucideIcon;
  external?: boolean;
  onClick?: () => void;
};

export type EraOpsShellProps = {
  sidebar: ReactNode;
  topBar?: ReactNode;
  children: ReactNode;
  className?: string;
};

export type EraOpsSidebarProps = {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  widthClass?: string;
};

export type EraOpsTopBarProps = {
  title?: string;
  quickLinks?: EraOpsQuickLink[];
  actions?: ReactNode;
};

export type EraOpsContentProps = {
  children: ReactNode;
  className?: string;
  /** When false, content is flush (operational canvases). */
  padded?: boolean;
};

export type EraDataGridColumn<T> = {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  className?: string;
};

export type EraDataGridPaginationLabels = {
  rowsPerPage: string;
  pageOf: string;
  prev: string;
  next: string;
};

export type EraDataGridPaginationMode = "client" | "server";
export type EraDataGridLayout = "flow" | "fill";

export type EraDataGridProps<T extends Record<string, unknown>> = {
  title?: string;
  columns: EraDataGridColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onAdd?: () => void;
  addLabel?: string;
  emptyMessage?: string;
  toolbar?: ReactNode;
  /**
   * When true, shows ListPaginationFooter (default on for client mode).
   * Prefer false inside EraListWorkspace (footer slot owns the pager).
   */
  pagination?: boolean;
  paginationLabels?: EraDataGridPaginationLabels;
  defaultPageSize?: number;
  /**
   * `client` (default): slice `rows` locally; total = rows.length.
   * `server`: render `rows` as-is; controlled page/total from the parent.
   */
  paginationMode?: EraDataGridPaginationMode;
  /**
   * `flow` (default): DATA_TABLE_SCROLL_CLASS (70vh cap).
   * `fill`: flex-1 min-h-0 scroll — use inside EraListWorkspace when the grid owns chrome.
   */
  layout?: EraDataGridLayout;
  /**
   * When true, render only the `<table>` (no shell/scroll/footer).
   * Use inside EraListWorkspace `table` slot with `tableShell` (default).
   * Prefer pairing with `paginationMode="server"`.
   */
  embedded?: boolean;
  /** Extra class names on each data row (status tint, etc.). */
  rowClassName?: (row: T) => string | undefined;
  /** Server mode: current page (1-based). */
  page?: number;
  /** Server mode: page size. */
  pageSize?: number;
  /** Server mode: total matching rows (COUNT). */
  total?: number;
  /** Server mode: page change. */
  onPageChange?: (page: number) => void;
  /** Server mode: page size change (should reset page to 1). */
  onPageSizeChange?: (pageSize: number) => void;
};
