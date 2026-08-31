"use client";



import { useTranslations, useLocale } from "next-intl";
import type { Locale } from "@era/i18n-common";

import {

  CalendarDays,

  ChefHat,

  ClipboardList,

  LayoutDashboard,

  LayoutGrid,

  Receipt,

  UtensilsCrossed,
  LayoutPanelTop,
  Upload,

} from "lucide-react";

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



const linkKeys = [

  { href: "/", key: "dashboard", icon: LayoutDashboard },

  { href: "/floor", key: "floor", icon: LayoutGrid },

  { href: "/orders", key: "orders", icon: Receipt },

  { href: "/kds", key: "kds", icon: ChefHat },

  { href: "/admin/menu", key: "menu", icon: UtensilsCrossed },

  { href: "/admin/tables", key: "tables", icon: LayoutPanelTop },

  { href: "/admin/daily-menu", key: "dailyMenu", icon: ClipboardList },

  { href: "/admin/integration", key: "integration", icon: Receipt },

  { href: "/admin/import", key: "import", icon: Upload },

  { href: "/calendar", key: "calendar", icon: CalendarDays },

] as const;



export default function FnbOpsShell({ children }: { children: React.ReactNode }) {

  const t = useTranslations("nav");
  const locale = useLocale() as Locale;

  const { session } = useSatelliteOpsSession();



  const navItems: EraOpsNavItem[] = linkKeys.map((l) => ({

    href: l.href,

    label: t(l.key),

    icon: l.icon,

  }));



  async function logout() {

    await fetch("/api/auth/logout", { method: "POST" });

    window.location.href = "/login";

  }



  const profileItems: HeaderProfileMenuItem[] = [

    { label: t("menu"), href: "/admin/menu" },

  ];



  return (

    <EraAppRouteShell

      brandTitle={t("brand")}

      navItems={navItems}

      profile={

        <HeaderProfileMenu

          displayName={session?.displayName ?? t("brand")}

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

