"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import {
  EraAppHeader,
  HeaderProfileMenu,
  PRIMARY_BUTTON_CLASS,
  type HeaderProfileMenuItem,
} from "@era/satellite-kit/ui";
import { OrchLanguageSwitcher } from "../locale/orch-language-switcher";
import { OrchNotificationBell } from "../notifications/orch-notification-bell";
import { HeaderOrganizationSwitcher } from "../header-organization-switcher";
import { OrchestratorHeaderTierBar } from "../orchestrator-header-tier-bar";
import type { OrchUser } from "../../lib/auth-context";

/** Finance `MainHeader` — same EraAppHeader slots and props. */
export function OrchHeader({
  onToggleMobileNav,
  mobileNavOpen,
  sidebarCollapsed,
  ready,
  token,
  user,
  onLogout,
  onAddOrganization,
}: {
  onToggleMobileNav: () => void;
  mobileNavOpen: boolean;
  sidebarCollapsed?: boolean;
  ready: boolean;
  token: string | null;
  user: OrchUser | null;
  onLogout: () => void;
  onAddOrganization: () => void;
}) {
  const t = useTranslations("nav");
  const tAuth = useTranslations("auth");
  const tLogin = useTranslations("login");

  const profileItems: HeaderProfileMenuItem[] = [
    { label: t("settings"), href: "/settings" },
    { label: t("organizations"), href: "/organizations" },
  ];

  const guestActions =
    ready && !token ? (
      <div className="flex gap-2 sm:gap-3">
        <Link
          href="/login"
          className="rounded-lg border border-[#D5DADF] bg-white px-2.5 py-2 text-[13px] font-medium text-[#34495E] transition hover:border-[#34495E] hover:bg-[#34495E]/5 sm:px-3"
        >
          {tAuth("loginTitle")}
        </Link>
        <Link
          href="/register"
          className="rounded-lg border border-[#D5DADF] bg-white px-2.5 py-2 text-[13px] font-medium text-[#34495E] transition hover:border-[#34495E]/5 sm:px-3"
        >
          {tLogin("createAccount")}
        </Link>
      </div>
    ) : null;

  return (
    <EraAppHeader
      sidebarCollapsed={sidebarCollapsed}
      mobileNavOpen={mobileNavOpen}
      onToggleMobileNav={onToggleMobileNav}
      left={
        ready && token && user ? (
          <button
            type="button"
            className={`${PRIMARY_BUTTON_CLASS} inline-flex items-center gap-1`}
            onClick={onAddOrganization}
          >
            <Plus className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">{t("addOrg")}</span>
          </button>
        ) : null
      }
      profile={
        ready && token && user ? (
          <HeaderProfileMenu
            displayName={user.email}
            email={user.email}
            items={profileItems}
            onLogout={onLogout}
            logoutLabel={t("logout")}
            menuAriaLabel={t("profileMenuAria")}
          />
        ) : (
          guestActions
        )
      }
      organization={
        ready && token && user ? <HeaderOrganizationSwitcher /> : undefined
      }
      notifications={
        ready && token && user ? (
          <div className="shrink-0">
            <OrchNotificationBell />
          </div>
        ) : undefined
      }
      locale={ready && token ? <OrchLanguageSwitcher /> : undefined}
      tierBar={ready && token && user ? <OrchestratorHeaderTierBar /> : undefined}
    />
  );
}
