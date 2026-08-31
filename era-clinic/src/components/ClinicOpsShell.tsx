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
  type HeaderProfileMenuItem,
} from "@era/satellite-kit/ui";
import { useClinicAuth } from "@/hooks/useClinicAuth";
import { CLINIC_PRESET, type ClinicPresetCode } from "@/domain/presets/clinic-presets";
import { buildClinicNav, CLINIC_NAV, CLINIC_TOP_NAV } from "@/domain/nav/clinic-nav";

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
  const { auth } = useClinicAuth();
  const canAdmin = auth?.canViewClinicAdmin === true;
  const seesAll = canAdmin || auth?.isPlatformSuperAdmin === true;
  const role = auth?.role ?? "";
  const enabledPresets = auth?.enabledPresets ?? [CLINIC_PRESET.OUTPATIENT];

  const { topItems, sections } = useMemo(() => {
    const presetEnabled = (code: ClinicPresetCode) => enabledPresets.includes(code);
    return buildClinicNav({ role, seesAll, presetEnabled }, (key) => t(key as "home"));
  }, [role, seesAll, enabledPresets, t]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const profileItems: HeaderProfileMenuItem[] = [
    { label: t("changePassword"), href: "/account/password" },
    ...(canAdmin
      ? [{ label: t("masterData"), href: "/admin/master-data" }]
      : [{ label: t("settings"), href: "/help" }]),
  ];

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
          displayName={auth?.displayName ?? tMeta("title")}
          email={auth?.email ?? undefined}
          items={profileItems}
          onLogout={() => void logout()}
          logoutLabel={t("logout", { defaultValue: "Logout" })}
        />
      }
      organization={
        <HeaderOrganization
          variant="label"
          organizationName={auth?.organizationName}
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
