"use client";

import type { ReactNode } from "react";
import { Menu } from "lucide-react";
import {
  APP_SIDEBAR_COLLAPSED_LEFT_CLASS,
  APP_SIDEBAR_LEFT_CLASS,
} from "./design-system";

export type EraAppHeaderProps = {
  sidebarCollapsed?: boolean;
  mobileNavOpen?: boolean;
  onToggleMobileNav?: () => void;
  left?: ReactNode;
  profile?: ReactNode;
  organization?: ReactNode;
  notifications?: ReactNode;
  locale?: ReactNode;
  tierBar?: ReactNode;
  className?: string;
};

/**
 * Fixed app header — ERA / Finance order (read right→left): Profile → Org → Bell → Locale → TierBar.
 * DOM (LTR): tierBar, locale, notifications, organization, profile.
 * TierBar (trial/quota) sits left of the language panel and is clickable.
 */
export function EraAppHeader({
  sidebarCollapsed = false,
  mobileNavOpen = false,
  onToggleMobileNav,
  left,
  profile,
  organization,
  notifications,
  locale,
  tierBar,
  className = "",
}: EraAppHeaderProps) {
  const sidebarLeft = sidebarCollapsed
    ? APP_SIDEBAR_COLLAPSED_LEFT_CLASS
    : APP_SIDEBAR_LEFT_CLASS;

  return (
    <header
      className={[
        "fixed top-0 left-0 right-0 z-[60] border-b border-[#2980B9]/15 bg-white/90 backdrop-blur-md transition-[left] duration-200",
        sidebarLeft,
        className,
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-3 px-3 py-3 sm:px-6 sm:py-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          {onToggleMobileNav ? (
            <button
              type="button"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#D5DADF] bg-white text-[#34495E] transition hover:border-[#2980B9]/40 hover:bg-[#2980B9]/10 lg:hidden"
              aria-label="Open menu"
              aria-expanded={mobileNavOpen}
              aria-controls="era-app-sidebar"
              onClick={onToggleMobileNav}
            >
              <Menu className="h-5 w-5" strokeWidth={2} aria-hidden />
            </button>
          ) : null}
          {left}
        </div>

        <div className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-3">
          {tierBar}
          {locale}
          {notifications}
          {organization}
          {profile}
        </div>
      </div>
    </header>
  );
}
