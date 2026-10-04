"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import type { Locale } from "@era/i18n-common";
import {
  EraAppRouteShell,
  HeaderOrganization,
  HeaderProfileMenu,
  SatelliteHeaderLocale,
  SatelliteNotificationBell,
  SATELLITE_NOTIFICATION_LABELS_EN,
  useOpsNavProfile,
  visibleOpsNavItems,
  visibleOpsNavSections,
  type HeaderProfileMenuItem,
} from "@era/satellite-kit/ui";
import { CLINIC_AUTH_REFRESH_EVENT } from "@/hooks/useClinicAuth";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { clinicNavCatalog, CLINIC_NAV, CLINIC_TOP_NAV } from "@/domain/nav/clinic-nav";

const REFRESH_EVENTS = [CLINIC_AUTH_REFRESH_EVENT] as const;

const ALL_NAV_HREFS = [...CLINIC_TOP_NAV, ...CLINIC_NAV].map((entry) => entry.href);

export function resolveClinicActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (pathname === href) return true;
  if (!pathname.startsWith(`${href}/`)) return false;
  const hasLongerMatch = ALL_NAV_HREFS.some(
    (other) =>
      other !== href &&
      other.startsWith(`${href}/`) &&
      (pathname === other || pathname.startsWith(`${other}/`)),
  );
  return !hasLongerMatch;
}

export default function ClinicOpsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const t = useTranslations("nav");
  const tMeta = useTranslations("meta");
  const locale = useLocale() as Locale;
  const { profile, status } = useOpsNavProfile({ refreshEvents: REFRESH_EVENTS });
  const navReady = status === "ready" && profile != null;
  const canAdmin = profile?.raw.canViewClinicAdmin === true;
  const canMasterData =
    (profile?.permissions ?? []).includes(CLINIC_PERMISSION.SCREEN_ADMIN_MASTER_DATA) || canAdmin;

  const catalog = useMemo(() => clinicNavCatalog((key) => t(key as "home")), [t]);
  const topItems = useMemo(
    () => visibleOpsNavItems(catalog.topItems, status, profile),
    [catalog, status, profile],
  );
  const sections = useMemo(
    () => visibleOpsNavSections(catalog.sections, status, profile),
    [catalog, status, profile],
  );

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const profileItems: HeaderProfileMenuItem[] = navReady
    ? [
        { label: t("changePassword"), href: "/account/password" },
        canMasterData
          ? { label: t("masterData"), href: "/admin/master-data" }
          : { label: t("settings"), href: "/help" },
      ]
    : [];

  if (pathname.startsWith("/print")) {
    return <>{children}</>;
  }

  return (
    <EraAppRouteShell
      brandTitle={tMeta("title")}
      navItems={topItems}
      navSections={sections}
      resolveActive={resolveClinicActive}
      profile={
        <HeaderProfileMenu
          displayName={navReady ? profile.displayName : ""}
          email={profile?.email ?? undefined}
          items={profileItems}
          onLogout={() => void logout()}
          logoutLabel={t("logout", { defaultValue: "Logout" })}
        />
      }
      organization={
        <HeaderOrganization
          variant="label"
          organizationName={profile?.organizationName}
        />
      }
      notifications={
        <SatelliteNotificationBell labels={SATELLITE_NOTIFICATION_LABELS_EN} />
      }
      locale={<SatelliteHeaderLocale locale={locale} />}
    >
      {children}
    </EraAppRouteShell>
  );
}
