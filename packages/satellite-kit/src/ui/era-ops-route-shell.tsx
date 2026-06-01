"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { DEFAULT_BARE_PUBLIC_PAGE_PREFIXES } from "../auth/middleware-helpers";
import { EraOpsContent } from "./era-ops-content";
import { EraOpsShell } from "./era-ops-shell";
import { EraOpsSidebarSections } from "./era-ops-sidebar-sections";
import { EraOpsSidebar, EraOpsSidebarNav } from "./era-ops-sidebar";
import { EraOpsTopBar } from "./era-ops-top-bar";
import type { EraOpsNavItem, EraOpsNavSection, EraOpsQuickLink } from "./era-ops-types";

export type EraOpsRouteShellProps = {
  children: ReactNode;
  brandTitle: string;
  /** Flat nav (legacy satellites). Ignored when `navSections` is set. */
  navItems?: EraOpsNavItem[];
  /** Collapsible module sections (hotel). */
  navSections?: EraOpsNavSection[];
  quickLinks?: EraOpsQuickLink[];
  sidebarFooter?: ReactNode;
  topBarTitle?: string;
  topBarActions?: ReactNode;
  /** Paths without ops chrome (login, help, …). */
  barePublicPrefixes?: string[];
  contentPadded?: boolean;
  resolveActive?: (pathname: string, href: string) => boolean;
};

function defaultActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function EraOpsRouteShell({
  children,
  brandTitle,
  navItems = [],
  navSections,
  quickLinks,
  sidebarFooter,
  topBarTitle,
  topBarActions,
  barePublicPrefixes = [],
  contentPadded = true,
  resolveActive = defaultActive,
}: EraOpsRouteShellProps) {
  const pathname = usePathname() ?? "";
  const barePrefixes = [...DEFAULT_BARE_PUBLIC_PAGE_PREFIXES, ...barePublicPrefixes];
  const isBare = barePrefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));

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

  return (
    <EraOpsShell
      topBar={
        <EraOpsTopBar title={topBarTitle} quickLinks={quickLinks} actions={topBarActions} />
      }
      sidebar={
        <EraOpsSidebar title={brandTitle} footer={sidebarFooter}>
          {sections?.length ? (
            <EraOpsSidebarSections sections={sections} resolveActive={resolveActive} />
          ) : (
            <EraOpsSidebarNav items={items} />
          )}
        </EraOpsSidebar>
      }
    >
      <EraOpsContent padded={contentPadded}>{children}</EraOpsContent>
    </EraOpsShell>
  );
}
