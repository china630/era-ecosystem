"use client";

import type { ReactNode } from "react";
import {
  FIELD_GROUP_BOX_BODY_CLASS,
  FIELD_GROUP_BOX_CLASS,
  FIELD_GROUP_BOX_LEGEND_CLASS,
} from "./design-system";

/**
 * Win32-style group box: thin border, title in the top-edge gap, rounded-xl.
 * Preferred for FO reservation / guest card left columns.
 */
export function FieldGroupBox({
  title,
  badge,
  actions,
  children,
  className,
}: {
  title: string;
  badge?: string | number;
  /** Buttons on the top edge, opposite the title. */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <fieldset className={`relative ${FIELD_GROUP_BOX_CLASS} ${className ?? ""}`.trim()}>
      <legend className={`${FIELD_GROUP_BOX_LEGEND_CLASS} max-w-[70%]`}>
        <span className="inline-flex items-center gap-2">
          <span>{title}</span>
          {badge != null && badge !== "" ? (
            <span className="rounded-md bg-[#F8FAFC] px-1.5 py-0.5 text-[11px] font-medium text-[#7F8C8D]">
              {badge}
            </span>
          ) : null}
        </span>
      </legend>
      {actions ? (
        <div className="absolute right-3 top-0 z-10 flex -translate-y-1/2 items-center gap-1 bg-white px-1">
          {actions}
        </div>
      ) : null}
      <div className={FIELD_GROUP_BOX_BODY_CLASS}>{children}</div>
    </fieldset>
  );
}
