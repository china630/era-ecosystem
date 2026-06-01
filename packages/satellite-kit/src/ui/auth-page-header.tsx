"use client";

import type { ReactNode } from "react";

/** Title row — locale control aligned top-right, same as Finance login. */
export function AuthPageHeader({
  title,
  localeControl,
}: {
  title: string;
  localeControl: ReactNode;
}) {
  return (
    <div className="mb-6 flex items-center justify-between gap-4">
      <h1 className="min-w-0 flex-1 text-2xl font-semibold leading-snug text-[#34495E]">
        {title}
      </h1>
      <div className="flex shrink-0 items-center self-start pt-0.5">
        {localeControl}
      </div>
    </div>
  );
}
