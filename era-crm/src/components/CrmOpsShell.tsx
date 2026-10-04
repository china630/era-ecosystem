"use client";

import { useTranslations, useLocale } from "next-intl";
import type { Locale } from "@era/i18n-common";
import { LayoutDashboard, Users, MapPin, Inbox, Settings, Upload, ShieldCheck } from "lucide-react";
import {
  EraAppRouteShell,
  HeaderOrganization,
  HeaderProfileMenu,
  SatelliteHeaderLocale,
  SatelliteNotificationBell,
  SATELLITE_NOTIFICATION_LABELS_EN,
  useOpsNavProfile,
  visibleOpsNavItems,
  type EraOpsNavItem,
  type HeaderProfileMenuItem,
} from "@era/satellite-kit/ui";
import { PERMISSIONS as P } from "@/lib/auth/permissions";

export default function CrmOpsShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("nav");
  const tMeta = useTranslations("meta");
  const locale = useLocale() as Locale;
  const { profile, status } = useOpsNavProfile();

  const navItems: EraOpsNavItem[] = visibleOpsNavItems(
    [
      { href: "/", label: t("home"), icon: LayoutDashboard, permission: P.SCREEN_HOME },
      { href: "/leads", label: t("leads"), icon: Users, permission: P.SCREEN_LEADS },
      { href: "/visits", label: t("visits"), icon: MapPin, permission: P.SCREEN_VISITS },
      { href: "/inbox", label: t("inbox"), icon: Inbox, permission: P.SCREEN_INBOX },
      { href: "/admin/import", label: t("import"), icon: Upload, permission: P.ADMIN_IMPORT },
      { href: "/admin/settings", label: t("settings"), icon: Settings, permission: P.ADMIN_PIPELINE },
      {
        href: "/admin/access",
        label: t("access"),
        icon: ShieldCheck,
        anyPermission: [P.SCREEN_ADMIN_ACCESS, P.ACCESS_MANAGE],
      },
    ],
    status,
    profile,
  );

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const profileItems: HeaderProfileMenuItem[] = profile?.permissions.includes(P.ADMIN_PIPELINE)
    ? [{ label: t("settings"), href: "/admin/settings" }]
    : [];

  return (
    <EraAppRouteShell
      brandTitle={tMeta("title")}
      navItems={navItems}
      profile={
        <HeaderProfileMenu
          displayName={profile?.displayName ?? ""}
          email={profile?.email ?? undefined}
          items={profileItems}
          onLogout={() => void logout()}
          logoutLabel={t("logout", { defaultValue: "Logout" })}
        />
      }
      organization={
        <HeaderOrganization variant="label" organizationName={profile?.organizationName} />
      }
      notifications={<SatelliteNotificationBell labels={SATELLITE_NOTIFICATION_LABELS_EN} />}
      locale={<SatelliteHeaderLocale locale={locale} />}
    >
      {children}
    </EraAppRouteShell>
  );
}
