"use client";

import { Building2 } from "lucide-react";
import type { MembershipRow } from "../../lib/auth-context";

export function OrgCard({
  membership,
  isCurrent,
  roleLabel,
  workspaceLabel,
  currentWorkspaceLabel,
  onOpen,
}: {
  membership: MembershipRow;
  isCurrent: boolean;
  roleLabel: string;
  workspaceLabel: string;
  currentWorkspaceLabel: string;
  onOpen: () => void;
}) {
  const name = membership.organizationName ?? membership.organizationId;
  const initials = name
    .split(/\s+/)
    .map((x) => x[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="group flex min-h-36 cursor-pointer flex-col rounded-2xl border border-[#D5DADF] bg-white p-4 text-left shadow-sm transition hover:border-[#2980B9]/40 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#2980B9]/30"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#D5DADF] bg-[#EBEDF0] text-xs font-semibold text-[#34495E]">
            {initials || <Building2 className="h-4 w-4" aria-hidden />}
          </div>
          <p className="truncate text-sm font-semibold text-[#34495E]">{name}</p>
        </div>
        <span className="shrink-0 rounded-full bg-[#EBEDF0] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#475569]">
          {roleLabel}
        </span>
      </div>
      <p className="mt-auto pt-4 text-xs text-[#7F8C8D]">
        {isCurrent ? currentWorkspaceLabel : workspaceLabel}
      </p>
    </article>
  );
}
