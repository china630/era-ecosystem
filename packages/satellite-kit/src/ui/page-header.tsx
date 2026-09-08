"use client";

import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  leading,
  actions,
  className = "",
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  leading?: ReactNode;
  actions?: ReactNode;
  /** Extra classes on `<header>` (e.g. `!mb-0` inside LIST_PAGE_SHELL). */
  className?: string;
}) {
  const hasLeading = leading != null && leading !== "";
  return (
    <header
      className={[
        hasLeading ? "mb-3 space-y-2" : "mb-3",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <div className="min-w-0">
          <h1 className="m-0 text-left text-xl font-semibold leading-tight text-[#34495E]">
            {title}
          </h1>
          {subtitle != null && subtitle !== "" ? (
            <div className="mt-0.5 text-left text-xs leading-snug text-[#7F8C8D]">
              {subtitle}
            </div>
          ) : null}
        </div>
        {actions ? (
          <div className="flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-2">
            {actions}
          </div>
        ) : null}
      </div>
      {hasLeading ? (
        <div className="flex w-full min-w-0 flex-wrap items-center gap-2">{leading}</div>
      ) : null}
    </header>
  );
}
