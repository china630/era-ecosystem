"use client";

import Link from "next/link";
import { GHOST_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from "@era/satellite-kit/ui";
import { useAuth } from "../lib/auth-context";

export function ShellHeader() {
  const { user, memberships, logout, switchOrganization } = useAuth();

  return (
    <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-[#D5DADF] pb-4">
      <div>
        <Link href="/" className="text-lg font-semibold text-[#34495E]">
          ERA 365
        </Link>
        <p className="text-xs text-[#7F8C8D]">Control plane</p>
      </div>
      <nav className="flex flex-wrap items-center gap-2 text-sm">
        {memberships.length > 1 && user?.organizationId ? (
          <select
            className="h-8 rounded-lg border border-[#D5DADF] px-2 text-[13px]"
            value={user.organizationId}
            onChange={(e) => void switchOrganization(e.target.value)}
          >
            {memberships.map((m) => (
              <option key={m.organizationId} value={m.organizationId}>
                {m.organizationName ?? m.organizationId}
              </option>
            ))}
          </select>
        ) : null}
        <Link href="/settings/team" className={GHOST_BUTTON_CLASS}>
          Team
        </Link>
        <Link href="/settings/subscription" className={GHOST_BUTTON_CLASS}>
          Subscription
        </Link>
        {user?.isSuperAdmin ? (
          <Link href="/super-admin" className={GHOST_BUTTON_CLASS}>
            Super admin
          </Link>
        ) : null}
        <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={logout}>
          Log out
        </button>
      </nav>
    </header>
  );
}
