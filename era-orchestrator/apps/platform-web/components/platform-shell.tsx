"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  APP_MAIN_CONTENT_CLASS,
  EraAppShellLayout,
  readSidebarCollapsed,
  writeSidebarCollapsed,
} from "@era/satellite-kit/ui";
import { useAuth } from "@/lib/auth-context";
import { PlatformHeader } from "./layout/platform-header";
import { PlatformSidebar } from "./layout/platform-sidebar";

export function PlatformShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const { ready, token, user, logout } = useAuth();
  const isLogin = pathname === "/login" || pathname.startsWith("/login/");

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarReady, setSidebarReady] = useState(false);

  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);

  useEffect(() => {
    closeMobileNav();
  }, [pathname, closeMobileNav]);

  useEffect(() => {
    setSidebarCollapsed(readSidebarCollapsed());
    setSidebarReady(true);
  }, []);

  useEffect(() => {
    if (!sidebarReady) return;
    writeSidebarCollapsed(sidebarCollapsed);
  }, [sidebarCollapsed, sidebarReady]);

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

  if (isLogin || !token) {
    return <>{children}</>;
  }

  return (
    <EraAppShellLayout
      mobileNavOpen={mobileNavOpen}
      sidebarCollapsed={sidebarCollapsed}
      onCloseMobileNav={closeMobileNav}
      sidebar={
        <PlatformSidebar
          mobileNavOpen={mobileNavOpen}
          onNavClick={closeMobileNav}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebarCollapsed={() => setSidebarCollapsed((v) => !v)}
        />
      }
      header={
        <PlatformHeader
          onToggleMobileNav={() => setMobileNavOpen((v) => !v)}
          mobileNavOpen={mobileNavOpen}
          sidebarCollapsed={sidebarCollapsed}
          ready={ready}
          token={token}
          user={user}
          onLogout={() => {
            logout();
            window.location.replace("/login");
          }}
        />
      }
    >
      <main
        className={`${APP_MAIN_CONTENT_CLASS} flex min-h-0 min-w-0 flex-1 flex-col overflow-auto`}
      >
        {children}
      </main>
    </EraAppShellLayout>
  );
}
