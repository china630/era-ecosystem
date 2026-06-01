"use client";

import type { ReactNode } from "react";

export type HeaderOrganizationProps =
  | {
      variant: "label";
      organizationName?: string | null;
      className?: string;
    }
  | {
      variant: "switcher";
      children: ReactNode;
      className?: string;
    };

/** Organization context in app header — Finance uses switcher slot; satellites use static label. */
export function HeaderOrganization(props: HeaderOrganizationProps) {
  if (props.variant === "switcher") {
    return <div className={props.className ?? "min-w-0 shrink-0"}>{props.children}</div>;
  }

  const name = props.organizationName?.trim();
  if (!name) return null;

  return (
    <span
      className={[
        "max-w-[140px] truncate text-[13px] font-semibold text-[#34495E] sm:max-w-[240px] sm:text-sm",
        props.className ?? "",
      ].join(" ")}
      title={name}
    >
      {name}
    </span>
  );
}
