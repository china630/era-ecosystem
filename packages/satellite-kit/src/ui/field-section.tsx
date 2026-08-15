"use client";

import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import {
  FIELD_SECTION_BODY_CLASS,
  FIELD_SECTION_CLASS,
  FIELD_SECTION_HEADER_CLASS,
} from "./design-system";

export function FieldSection({
  title,
  defaultOpen = true,
  open: controlledOpen,
  onOpenChange,
  badge,
  children,
  className,
}: {
  title: string;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  badge?: string | number;
  children: ReactNode;
  className?: string;
}) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  function toggle() {
    const next = !open;
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  }

  return (
    <section className={`${FIELD_SECTION_CLASS} ${className ?? ""}`.trim()}>
      <button
        type="button"
        className={FIELD_SECTION_HEADER_CLASS}
        onClick={toggle}
        aria-expanded={open}
      >
        <span className="text-[13px] font-semibold text-[#34495E]">{title}</span>
        <span className="flex items-center gap-2">
          {badge != null && badge !== "" ? (
            <span className="rounded-md bg-white px-1.5 py-0.5 text-[11px] font-medium text-[#7F8C8D] shadow-sm">
              {badge}
            </span>
          ) : null}
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-[#7F8C8D] transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
        </span>
      </button>
      {open ? <div className={FIELD_SECTION_BODY_CLASS}>{children}</div> : null}
    </section>
  );
}
