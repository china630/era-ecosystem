"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import {
  EraAppHeader,
  HeaderProfileMenu,
  type HeaderProfileMenuItem,
} from "@era/satellite-kit/ui";
import { HeaderSubscriptionStrip } from "../header-subscription-strip";
import { LanguageSwitcher } from "../../app/language-switcher";
import { ApiHealthIndicator } from "../api-health-indicator";
import { HeaderOrganizationSwitcher } from "./header-organization-switcher";
import type { AuthUser } from "../../lib/auth-context";

export function MainHeader({
  onToggleMobileNav,
  mobileNavOpen,
  sidebarCollapsed,
  ready,
  token,
  user,
  ledgerToggle,
  quickActionsDropdown,
  notificationsBell,
  onLogout,
  riskIndicator,
}: {
  onToggleMobileNav: () => void;
  mobileNavOpen: boolean;
  sidebarCollapsed?: boolean;
  ready: boolean;
  token: string | null;
  user: AuthUser | null;
  ledgerToggle: React.ReactNode;
  quickActionsDropdown: React.ReactNode;
  notificationsBell?: React.ReactNode;
  onLogout: () => void | Promise<void>;
  riskIndicator?: React.ReactNode;
}) {
  const { t } = useTranslation();

  const profileItems: HeaderProfileMenuItem[] = [
    { label: t("nav.profile", { defaultValue: "Profile" }), href: "/settings/profile" },
    {
      label: t("nav.settingsOrganization", { defaultValue: "Organization" }),
      href: "/settings/organization",
    },
  ];

  const displayName =
    user?.fullName?.trim() ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.email ||
    "";

  const guestActions =
    ready && !token ? (
      <div className="flex gap-2 sm:gap-3">
        <Link
          href="/login"
          className="rounded-lg border border-[#D5DADF] bg-white px-2.5 py-2 text-[13px] font-medium text-[#34495E] transition hover:border-[#34495E] hover:bg-[#34495E]/5 sm:px-3"
        >
          {t("nav.login")}
        </Link>
        <Link
          href="/register"
          className="rounded-lg border border-[#D5DADF] bg-white px-2.5 py-2 text-[13px] font-medium text-[#34495E] transition hover:border-[#34495E]/5 sm:px-3"
        >
          {t("nav.register")}
        </Link>
      </div>
    ) : null;

  return (
    <EraAppHeader
      sidebarCollapsed={sidebarCollapsed}
      mobileNavOpen={mobileNavOpen}
      onToggleMobileNav={onToggleMobileNav}
      left={
        <>
          <ApiHealthIndicator />
          {ledgerToggle}
          {ready && token ? quickActionsDropdown : null}
          {ready && token ? riskIndicator : null}
        </>
      }
      profile={
        ready && token && user ? (
          <HeaderProfileMenu
            displayName={displayName}
            email={user.email}
            avatarUrl={user.avatarUrl}
            items={profileItems}
            onLogout={() => void onLogout()}
            logoutLabel={t("nav.logout")}
            menuAriaLabel={t("nav.profileMenuAria", { defaultValue: "Account menu" })}
          />
        ) : (
          guestActions
        )
      }
      organization={
        ready && token && user ? <HeaderOrganizationSwitcher /> : undefined
      }
      notifications={
        ready && token && notificationsBell ? (
          <div className="shrink-0">{notificationsBell}</div>
        ) : undefined
      }
      locale={ready && token ? <LanguageSwitcher /> : undefined}
      tierBar={ready && token && user ? <HeaderSubscriptionStrip /> : undefined}
    />
  );
}
