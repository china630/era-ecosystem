"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { DEFAULT_BARE_PUBLIC_PAGE_PREFIXES } from "../auth/middleware-helpers";
import { EraAppHeader, type EraAppHeaderProps } from "./era-app-header";
import { EraAppShellLayout, EraAppSidebar } from "./era-app-shell-layout";
import { EraOpsContent } from "./era-ops-content";
import { EraOpsSidebarSections } from "./era-ops-sidebar-sections";
import { EraOpsSidebarNav } from "./era-ops-sidebar";
import type { EraOpsNavItem, EraOpsNavSection } from "./era-ops-types";

export type EraAppRouteShellProps = {
  children: ReactNode;
  brandTitle: string;
  navItems?: EraOpsNavItem[];
  navSections?: EraOpsNavSection[];
  barePublicPrefixes?: string[];
  contentPadded?: boolean;
  resolveActive?: (pathname: string, href: string) => boolean;
  headerLeft?: ReactNode;
  profile?: EraAppHeaderProps["profile"];
  organization?: EraAppHeaderProps["organization"];
  notifications?: EraAppHeaderProps["notifications"];
  locale?: EraAppHeaderProps["locale"];
  tierBar?: EraAppHeaderProps["tierBar"];
  sidebarFooter?: ReactNode;
};

function defaultActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Standard ERA app shell — fixed header + sidebar (see docs/UI_PLAYBOOK_SATELLITES.md).
 */
export function EraAppRouteShell({
  children,
  brandTitle,
  navItems = [],
  navSections,
  barePublicPrefixes = [],
  contentPadded = true,
  resolveActive = defaultActive,
  headerLeft,
  profile,
  organization,
  notifications,
  locale,
  tierBar,
  sidebarFooter,
}: EraAppRouteShellProps) {
  const pathname = usePathname() ?? "";
  const barePrefixes = [...DEFAULT_BARE_PUBLIC_PAGE_PREFIXES, ...barePublicPrefixes];
  const isBare = barePrefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);

  useEffect(() => {
    closeMobileNav();
  }, [pathname, closeMobileNav]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem("era_app_sidebar_collapsed") === "1") {
      setSidebarCollapsed(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      "era_app_sidebar_collapsed",
      sidebarCollapsed ? "1" : "0",
    );
  }, [sidebarCollapsed]);

  if (isBare) {
    return <>{children}</>;
  }

  const items = navItems.map((item) => ({
    ...item,
    active:
      item.active ??
      (item.href ? resolveActive(pathname, item.href) : false),
  }));

  const sections = navSections?.map((section) => ({
    ...section,
    items: section.items.map((item) => ({
      ...item,
      active:
        item.active ??
        (item.href ? resolveActive(pathname, item.href) : false),
    })),
  }));

  const usesSectionNav = Boolean(sections?.length);
  const effectiveSidebarCollapsed = usesSectionNav ? false : sidebarCollapsed;

  return (
    <EraAppShellLayout
      mobileNavOpen={mobileNavOpen}
      sidebarCollapsed={effectiveSidebarCollapsed}
      onCloseMobileNav={closeMobileNav}
      header={
        <EraAppHeader
          sidebarCollapsed={effectiveSidebarCollapsed}
          mobileNavOpen={mobileNavOpen}
          onToggleMobileNav={() => setMobileNavOpen((v) => !v)}
          left={headerLeft}
          profile={profile}
          organization={organization}
          notifications={notifications}
          locale={locale}
          tierBar={tierBar}
        />
      }
      sidebar={
        <EraAppSidebar
          mobileNavOpen={mobileNavOpen}
          sidebarCollapsed={effectiveSidebarCollapsed}
          header={
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-[13px] font-semibold text-[#34495E]">
                {brandTitle}
              </p>
              {!usesSectionNav ? (
                <button
                  type="button"
                  className="hidden rounded-lg border border-[#D5DADF] px-2 py-1 text-[11px] text-[#7F8C8D] hover:bg-[#F4F5F7] lg:inline"
                  onClick={() => setSidebarCollapsed((v) => !v)}
                  aria-label="Toggle sidebar"
                >
                  {sidebarCollapsed ? "»" : "«"}
                </button>
              ) : null}
            </div>
          }
          footer={sidebarFooter}
        >
          {sections?.length ? (
            <EraOpsSidebarSections
              sections={sections}
              topItems={items}
              resolveActive={resolveActive}
            />
          ) : (
            <EraOpsSidebarNav items={items} />
          )}
        </EraAppSidebar>
      }
    >
      <EraOpsContent padded={contentPadded}>{children}</EraOpsContent>
    </EraAppShellLayout>
  );
}
