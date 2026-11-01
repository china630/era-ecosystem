"use client";

import type { ReactNode } from "react";
import { FieldGroupBox } from "./field-group-box";

/** Static field group (always open) — FO reservation / guest cards. Renders as FieldGroupBox. */
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
    <FieldGroupBox title={title} badge={badge} className={className}>
      {children}
    </FieldGroupBox>
  );
}
