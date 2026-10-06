"use client";

import { useTranslations, useLocale } from "next-intl";
import { usePathname } from "next/navigation";
import type { Locale } from "@era/i18n-common";
import {
  LayoutDashboard,
  Settings,
  ShoppingCart,
  Package,
  BarChart3,
  Upload,
  ShieldCheck,
  Users,
  ClipboardList,
} from "lucide-react";
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

export default function RetailOpsShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("nav");
  const tMeta = useTranslations("meta");
  const pathname = usePathname();
  const locale = useLocale() as Locale;
  const { profile, status } = useOpsNavProfile();
  const executive = profile?.isOwner === true || profile?.isPlatformSuperAdmin === true;

  const navItems: EraOpsNavItem[] = visibleOpsNavItems(
    [
      { href: "/", label: t("home"), icon: LayoutDashboard, permission: P.SCREEN_HOME },
      { href: "/pos", label: t("pos"), icon: ShoppingCart, permission: P.SCREEN_POS },
      { href: "/stock-check", label: t("stockCheck"), icon: Package, permission: P.SCREEN_STOCK_CHECK },
      { href: "/admin/replenishment", label: t("replenishment"), icon: Package, permission: P.ADMIN_IMPORT },
      { href: "/admin/import", label: t("import"), icon: Upload, permission: P.ADMIN_IMPORT },
      { href: "/settings", label: t("settings"), icon: Settings, permission: P.SCREEN_SETTINGS },
      {
        id: "accounts",
        label: t("accounts"),
        icon: Users,
        anyPermission: [P.SCREEN_ADMIN_ACCESS, P.ACCESS_MANAGE],
        children: [
          {
            id: "accounts-users",
            href: "/settings/users",
            label: t("users"),
            icon: Users,
            active: pathname.startsWith("/settings/users"),
            anyPermission: [P.SCREEN_ADMIN_ACCESS, P.ACCESS_MANAGE],
          },
          {
            id: "accounts-access",
            href: "/admin/access",
            label: t("access"),
            icon: ShieldCheck,
            active: pathname.startsWith("/admin/access"),
            anyPermission: [P.SCREEN_ADMIN_ACCESS, P.ACCESS_MANAGE],
          },
          {
            id: "accounts-logins",
            href: "/settings/logins",
            label: t("logins"),
            icon: ClipboardList,
            active: pathname.startsWith("/settings/logins"),
            anyPermission: [P.SCREEN_ADMIN_ACCESS, P.ACCESS_MANAGE],
          },
        ],
      },
      { href: "/executive", label: t("executive"), icon: BarChart3, when: executive },
    ],
    status,
    profile,
  );

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const profileItems: HeaderProfileMenuItem[] = [{ label: t("settings"), href: "/settings" }];

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
