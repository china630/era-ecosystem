"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { APP_MAIN_CONTENT_CLASS, EraAppShellLayout } from "@era/satellite-kit/ui";
import { useAuth } from "../lib/auth-context";
import { isBarePublicWebPath } from "../lib/public-routes";
import { OrchHeader } from "./layout/orch-header";
import { OrchSidebar } from "./layout/orch-sidebar";

const SIDEBAR_COLLAPSED_KEY = "erafinance_sidebar_collapsed";

function usesAppShell(pathname: string, token: string | null): boolean {
  if (!isBarePublicWebPath(pathname)) return true;
  // Keep authenticated /help inside the Finance-aligned shell (sidebar nav target).
  if (token && (pathname === "/help" || pathname.startsWith("/help/"))) return true;
  return false;
}

/** Finance `app-shell.tsx` layout — `EraAppShellLayout` + fixed sidebar + fixed header. */
export function ControlPlaneShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const { ready, token, user, logout } = useAuth();

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);
  const toggleMobileNav = useCallback(() => setMobileNavOpen((v) => !v), []);

  useEffect(() => {
    closeMobileNav();
  }, [pathname, closeMobileNav]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1") {
      setSidebarCollapsed(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed ? "1" : "0");
  }, [sidebarCollapsed]);

  useEffect(() => {
    if (!mobileNavOpen) {
      document.body.style.overflow = "";
      return;
    }
    const mq = window.matchMedia("(max-width: 1023px)");
    const sync = () => {
      document.body.style.overflow = mq.matches ? "hidden" : "";
    };
    sync();
    mq.addEventListener("change", sync);
    return () => {
      mq.removeEventListener("change", sync);
      document.body.style.overflow = "";
    };
  }, [mobileNavOpen]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMobileNav();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileNavOpen, closeMobileNav]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onWide = () => {
      if (mq.matches) setMobileNavOpen(false);
    };
    mq.addEventListener("change", onWide);
    return () => mq.removeEventListener("change", onWide);
  }, []);

  if (!usesAppShell(pathname, token)) {
    return <>{children}</>;
  }

  return (
    <EraAppShellLayout
      mobileNavOpen={mobileNavOpen}
      sidebarCollapsed={sidebarCollapsed}
      onCloseMobileNav={closeMobileNav}
      sidebar={
        <OrchSidebar
          mobileNavOpen={mobileNavOpen}
          onNavClick={closeMobileNav}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebarCollapsed={() => setSidebarCollapsed((v) => !v)}
          isSuperAdmin={Boolean(user?.isSuperAdmin)}
        />
      }
      header={
        <OrchHeader
          onToggleMobileNav={toggleMobileNav}
          mobileNavOpen={mobileNavOpen}
          sidebarCollapsed={sidebarCollapsed}
          ready={ready}
          token={token}
          user={user}
          onLogout={() => logout()}
        />
      }
    >
      <main className={APP_MAIN_CONTENT_CLASS}>
        {children}
      </main>
    </EraAppShellLayout>
  );
}
