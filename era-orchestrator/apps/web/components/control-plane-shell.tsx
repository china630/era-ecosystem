"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useCreateOrganization } from "./organizations/create-organization-context";
import { useAuth } from "../lib/auth-context";
import { isBarePublicWebPath } from "../lib/public-routes";
import { OrchHeader } from "./layout/orch-header";
import { OrchSidebar } from "./layout/orch-sidebar";

const SIDEBAR_COLLAPSED_KEY = "erafinance_sidebar_collapsed";

/** Finance `app-shell.tsx` layout — fixed sidebar + fixed header + full-width main. */
export function ControlPlaneShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const { ready, token, user, logout } = useAuth();
  const { openCreateOrganization } = useCreateOrganization();

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

  if (isBarePublicWebPath(pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#EBEDF0]">
      {mobileNavOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-[45] cursor-default bg-black/40 lg:hidden"
          aria-label="Close menu"
          onClick={closeMobileNav}
        />
      ) : null}

      <OrchSidebar
        mobileNavOpen={mobileNavOpen}
        onNavClick={closeMobileNav}
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebarCollapsed={() => setSidebarCollapsed((v) => !v)}
        isSuperAdmin={Boolean(user?.isSuperAdmin)}
      />

      <div
        className={[
          "min-w-0 pt-16 transition-[padding] duration-200 ease-out",
          sidebarCollapsed ? "lg:pl-[4.5rem]" : "lg:pl-[17.5rem]",
        ].join(" ")}
      >
        <OrchHeader
          onToggleMobileNav={toggleMobileNav}
          mobileNavOpen={mobileNavOpen}
          sidebarCollapsed={sidebarCollapsed}
          ready={ready}
          token={token}
          user={user}
          onLogout={() => logout()}
          onAddOrganization={openCreateOrganization}
        />

        <main className="app-shell-main w-full min-w-0 px-4 py-6 pb-24 sm:px-6 sm:py-8 lg:px-8 lg:pb-8">
          {children}
        </main>
      </div>
    </div>
  );
}
