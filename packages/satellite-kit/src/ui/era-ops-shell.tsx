"use client";

import { APP_SHELL_CLASS } from "./design-system";
import type { EraOpsShellProps } from "./era-ops-types";

export function EraOpsShell({ sidebar, topBar, children, className = "" }: EraOpsShellProps) {
  return (
    <div className={`${APP_SHELL_CLASS} flex min-h-[calc(100vh-2.5rem)] min-w-0 flex-col ${className}`}>
      {topBar}
      <div className="flex min-h-0 min-w-0 flex-1">
        {sidebar}
        {children}
      </div>
    </div>
  );
}
