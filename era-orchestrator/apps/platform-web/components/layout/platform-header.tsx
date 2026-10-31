"use client";

import { useTranslations } from "next-intl";
import {
  EraAppHeader,
  HeaderProfileMenu,
} from "@era/satellite-kit/ui";
import { OrchLanguageSwitcher } from "../locale/orch-language-switcher";
import type { OrchUser } from "@/lib/auth-context";

export function PlatformHeader({
  onToggleMobileNav,
  mobileNavOpen,
  sidebarCollapsed,
  ready,
  token,
  user,
  onLogout,
}: {
  onToggleMobileNav: () => void;
  mobileNavOpen: boolean;
  sidebarCollapsed?: boolean;
  ready: boolean;
  token: string | null;
  user: OrchUser | null;
  onLogout: () => void | Promise<void>;
}) {
  const t = useTranslations("nav");
  const displayName = user?.email?.trim() ?? "";

  return (
    <EraAppHeader
      sidebarCollapsed={sidebarCollapsed}
      mobileNavOpen={mobileNavOpen}
      onToggleMobileNav={onToggleMobileNav}
      profile={
        ready && token && user ? (
          <HeaderProfileMenu
            displayName={displayName}
            email={user.email}
            items={[]}
            onLogout={() => void onLogout()}
            logoutLabel={t("logout")}
            menuAriaLabel={t("profileMenuAria")}
          />
        ) : null
      }
      locale={<OrchLanguageSwitcher />}
    />
  );
}
