"use client";

import type { ReactNode } from "react";
import {
  APP_HEADER_OFFSET_CLASS,
  APP_SIDEBAR_COLLAPSED_OFFSET_CLASS,
  APP_SIDEBAR_OFFSET_CLASS,
  APP_SIDEBAR_WIDTH_CLASS,
  APP_SIDEBAR_COLLAPSED_CLASS,
} from "./design-system";

export type EraAppSidebarProps = {
  id?: string;
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  mobileNavOpen?: boolean;
  sidebarCollapsed?: boolean;
  onNavClick?: () => void;
  className?: string;
  navClassName?: string;
};

/**
 * Left navigation rail — 17.5rem expanded, 4.5rem collapsed; overflow-x hidden.
 * See DESIGN.md § App shell — header & sidebar.
 */
export function EraAppSidebar({
  id = "era-app-sidebar",
  children,
  header,
  footer,
  mobileNavOpen = false,
  sidebarCollapsed = false,
  className = "",
  navClassName = "",
}: EraAppSidebarProps) {
  const widthClass = sidebarCollapsed
    ? `${APP_SIDEBAR_WIDTH_CLASS} ${APP_SIDEBAR_COLLAPSED_CLASS}`
    : APP_SIDEBAR_WIDTH_CLASS;

  const panelClass = [
    "fixed left-0 top-0 z-[50] flex h-screen min-w-0 flex-col overflow-x-hidden border-r border-[#D5DADF] bg-white shadow-xl transition-[transform,width] duration-200 ease-out lg:z-40 lg:shadow-none",
    widthClass,
    mobileNavOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
    className,
  ].join(" ");

  return (
    <aside id={id} className={panelClass}>
      {header ? <div className="shrink-0 border-b border-[#EBEDF0] p-4">{header}</div> : null}
      <nav
        className={[
          "erafinance-sidebar-scroll flex min-h-0 min-w-0 flex-1 flex-col gap-1 overflow-x-hidden overflow-y-auto px-3 pb-3 pt-2",
          navClassName,
        ].join(" ")}
        aria-label="Main navigation"
      >
        {children}
      </nav>
      {footer ? (
        <div className="shrink-0 border-t border-[#EBEDF0] p-3">{footer}</div>
      ) : null}
    </aside>
  );
}

export type EraAppShellLayoutProps = {
  header: ReactNode;
  sidebar: ReactNode;
  children: ReactNode;
  mobileNavOpen?: boolean;
  sidebarCollapsed?: boolean;
  onCloseMobileNav?: () => void;
  className?: string;
};

/** Finance-style shell: fixed header + sidebar offset + scrollable main. */
export function EraAppShellLayout({
  header,
  sidebar,
  children,
  mobileNavOpen = false,
  sidebarCollapsed = false,
  onCloseMobileNav,
  className = "",
}: EraAppShellLayoutProps) {
  const mainOffset = sidebarCollapsed
    ? APP_SIDEBAR_COLLAPSED_OFFSET_CLASS
    : APP_SIDEBAR_OFFSET_CLASS;

  return (
    <div className={`min-h-screen overflow-x-hidden bg-[#EBEDF0] ${className}`}>
      {mobileNavOpen && onCloseMobileNav ? (
        <button
          type="button"
          className="fixed inset-0 z-[45] cursor-default bg-black/40 lg:hidden"
          aria-label="Close menu"
          onClick={onCloseMobileNav}
        />
      ) : null}
      {sidebar}
      {header}
      <div
        className={[
          "min-w-0 transition-[padding] duration-200 ease-out",
          APP_HEADER_OFFSET_CLASS,
          mainOffset,
        ].join(" ")}
      >
        <div className="w-full min-w-0">{children}</div>
      </div>
    </div>
  );
}
