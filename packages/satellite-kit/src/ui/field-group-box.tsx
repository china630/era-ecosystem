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
  children,
  className,
}: {
  title: string;
  badge?: string | number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <fieldset className={`${FIELD_GROUP_BOX_CLASS} ${className ?? ""}`.trim()}>
      <legend className={FIELD_GROUP_BOX_LEGEND_CLASS}>
        <span className="inline-flex items-center gap-2">
          <span>{title}</span>
          {badge != null && badge !== "" ? (
            <span className="rounded-md bg-[#F8FAFC] px-1.5 py-0.5 text-[11px] font-medium text-[#7F8C8D]">
              {badge}
            </span>
          ) : null}
        </span>
      </legend>
      <div className={FIELD_GROUP_BOX_BODY_CLASS}>{children}</div>
    </fieldset>
  );
}
