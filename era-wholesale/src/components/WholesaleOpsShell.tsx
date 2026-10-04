"use client";

import { useTranslations, useLocale } from "next-intl";
import type { Locale } from "@era/i18n-common";
import { LayoutDashboard, ClipboardList, Package, Settings, ShieldCheck, Upload } from "lucide-react";
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

export default function WholesaleOpsShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("nav");
  const tMeta = useTranslations("meta");
  const locale = useLocale() as Locale;
  const { profile, status } = useOpsNavProfile();

  const navItems: EraOpsNavItem[] = visibleOpsNavItems(
    [
      { href: "/", label: t("home"), icon: LayoutDashboard, permission: P.SCREEN_HOME },
      { href: "/orders", label: t("orders"), icon: ClipboardList, permission: P.SCREEN_ORDERS },
      { href: "/pick-lists", label: t("pickLists"), icon: Package, permission: P.SCREEN_PICK_LISTS },
      {
        href: "/admin/import-orders",
        label: t("importOrders"),
        icon: Upload,
        permission: P.SCREEN_ADMIN_IMPORT_ORDERS,
      },
      { href: "/admin/settings", label: t("settings"), icon: Settings, permission: P.SCREEN_ADMIN_SETTINGS },
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

  const profileItems: HeaderProfileMenuItem[] = profile?.permissions.includes(P.SCREEN_ADMIN_SETTINGS)
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
