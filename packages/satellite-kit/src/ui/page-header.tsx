"use client";

import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  leading,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  leading?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 space-y-3">
      <div>
        <h1 className="m-0 text-left text-2xl font-semibold text-[#34495E]">{title}</h1>
        {subtitle != null && subtitle !== "" ? (
          <div className="mt-2 text-left text-sm text-[#7F8C8D]">{subtitle}</div>
        ) : null}
      </div>
      {leading != null && leading !== "" ? (
        <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">{leading}</div>
          {actions ? (
            <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">{actions}</div>
          ) : null}
        </div>
      ) : actions ? (
        <div className="flex w-full min-w-0 flex-wrap items-center justify-end gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
