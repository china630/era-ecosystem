"use client";

import type { ReactNode } from "react";
import {
  FIELD_PANEL_BODY_CLASS,
  FIELD_PANEL_CLASS,
  FIELD_PANEL_HEADER_CLASS,
} from "./design-system";

/** Static field group (always open) — FO reservation / guest cards. */
export function FieldPanel({
  title,
  badge,
  children,
  className,
}: {
  title: string;
  badge?: string | number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`${FIELD_PANEL_CLASS} ${className ?? ""}`.trim()}>
      <div className={FIELD_PANEL_HEADER_CLASS}>
        <span className="flex items-center justify-between gap-2">
          <span>{title}</span>
          {badge != null && badge !== "" ? (
            <span className="rounded-md bg-white px-1.5 py-0.5 text-[11px] font-medium text-[#7F8C8D] shadow-sm">
              {badge}
            </span>
          ) : null}
        </span>
      </div>
      <div className={FIELD_PANEL_BODY_CLASS}>{children}</div>
    </section>
  );
}
