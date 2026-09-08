"use client";

import type { ReactNode } from "react";
import {
  DATA_TABLE_SHELL_CLASS,
  LIST_PAGE_FILL_CLASS,
  LIST_WORKSPACE_CLASS,
} from "./design-system";

export type EraListWorkspaceProps = {
  /** Filter panel (typically EraListFilterBar). */
  filter?: ReactNode;
  /** Optional row under filters (e.g. ColorLegend) — not inside table scroll. */
  toolbar?: ReactNode;
  /**
   * Table body only (thead+tbody). Prefer a fill-scroll table without its own
   * 70vh max-height or footer — workspace docks the paginator.
   */
  table: ReactNode;
  /** ListPaginationFooter (or equivalent) — docked at bottom of the column. */
  footer?: ReactNode;
  /** Wrap table in DATA_TABLE_SHELL_CLASS (default true). Pass false if table brings its own shell. */
  tableShell?: boolean;
  className?: string;
  /**
   * When true (default), flex-1 under LIST_PAGE_SHELL_CLASS so only the table
   * body scrolls. Set false for nested/partial embeds.
   */
  fill?: boolean;
};

/**
 * Canonical unbounded-list layout: filter / optional toolbar / scrollable table /
 * docked paginator. Wrap PageHeader + this component in LIST_PAGE_SHELL_CLASS.
 *
 * Pair with server pagination (COUNT + page). Do not use DATA_TABLE_SCROLL_CLASS
 * (70vh) inside — workspace scroll region is flex-1 min-h-0 overflow-auto.
 */
export function EraListWorkspace({
  filter,
  toolbar,
  table,
  footer,
  tableShell = true,
  className = "",
  fill = true,
}: EraListWorkspaceProps) {
  const rootClass = [
    fill ? LIST_PAGE_FILL_CLASS : LIST_WORKSPACE_CLASS,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClass}>
      {filter ? <div className="shrink-0">{filter}</div> : null}
      {toolbar ? <div className="shrink-0">{toolbar}</div> : null}
      <div
        className={
          tableShell
            ? `${DATA_TABLE_SHELL_CLASS} flex min-h-0 flex-1 flex-col`
            : "flex min-h-0 flex-1 flex-col overflow-hidden"
        }
      >
        <div className="min-h-0 flex-1 overflow-auto">{table}</div>
        {footer ? <div className="shrink-0 bg-white">{footer}</div> : null}
      </div>
    </div>
  );
}
