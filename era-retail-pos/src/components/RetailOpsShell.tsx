"use client";



import { useTranslations, useLocale } from "next-intl";
import type { Locale } from "@era/i18n-common";

import { LayoutDashboard, Settings, ShoppingCart, Package, BarChart3 } from "lucide-react";

import {

  EraAppRouteShell,

  HeaderOrganization,

  HeaderProfileMenu,

  SatelliteHeaderLocale,

  SatelliteNotificationBell,

  SATELLITE_NOTIFICATION_LABELS_EN,

  useSatelliteOpsSession,

  type EraOpsNavItem,

  type HeaderProfileMenuItem,

} from "@era/satellite-kit/ui";



export default function RetailOpsShell({ children }: { children: React.ReactNode }) {

  const t = useTranslations("nav");

  const tMeta = useTranslations("meta");
  const locale = useLocale() as Locale;

  const { session } = useSatelliteOpsSession();



  const navItems: EraOpsNavItem[] = [

    { href: "/", label: t("home"), icon: LayoutDashboard },

    { href: "/pos", label: t("pos"), icon: ShoppingCart },

    { href: "/stock-check", label: t("stockCheck"), icon: Package },

    { href: "/admin/replenishment", label: t("replenishment"), icon: Package },

    { href: "/settings", label: t("settings"), icon: Settings },

    { href: "/executive", label: t("executive"), icon: BarChart3 },

  ];



  async function logout() {

    await fetch("/api/auth/logout", { method: "POST" });

    window.location.href = "/login";

  }



  const profileItems: HeaderProfileMenuItem[] = [

    { label: t("settings"), href: "/settings" },

  ];



  return (

    <EraAppRouteShell

      brandTitle={tMeta("title")}

      navItems={navItems}

      profile={

        <HeaderProfileMenu

          displayName={session?.displayName ?? tMeta("title")}

          email={session?.email ?? undefined}

          items={profileItems}

          onLogout={() => void logout()}

          logoutLabel={t("logout", { defaultValue: "Logout" })}

        />

      }

      organization={

        <HeaderOrganization variant="label" organizationName={session?.organizationName} />

      }

      notifications={<SatelliteNotificationBell labels={SATELLITE_NOTIFICATION_LABELS_EN} />}

      locale={<SatelliteHeaderLocale locale={locale} />}

    >

      {children}

    </EraAppRouteShell>

  );

}

