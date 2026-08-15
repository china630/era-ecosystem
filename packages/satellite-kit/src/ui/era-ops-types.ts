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
   * Client-side pagination (default on). Footer uses ListPaginationFooter.
   * Pass translated labels from the host app when available.
   */
  pagination?: boolean;
  paginationLabels?: EraDataGridPaginationLabels;
  defaultPageSize?: number;
};
