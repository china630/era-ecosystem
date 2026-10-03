"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import type { Locale } from "@era/i18n-common";
import {
  ChefHat,
  LayoutDashboard,
  LayoutGrid,
  Receipt,
  UtensilsCrossed,
  LayoutPanelTop,
  ScrollText,
  Settings,
  Shield,
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
import OfflineReplayBridge from "@/components/OfflineReplayBridge";
import { bakuDateTimeDisplay } from "@era/satellite-kit/time";
import { PERMISSIONS, type Permission } from "@/lib/auth/permissions";
import {
  sessionHasFnbPermission,
  type FnbPermissionSession,
} from "@/lib/auth/permission-check";

const LINK_SCREENS: Record<string, Permission> = {
  "/": PERMISSIONS.SCREEN_HOME,
  "/floor": PERMISSIONS.SCREEN_FLOOR,
  "/orders": PERMISSIONS.SCREEN_ORDERS,
  "/kds": PERMISSIONS.SCREEN_KDS,
  "/admin/menu": PERMISSIONS.SCREEN_ADMIN_MENU,
  "/admin/tables": PERMISSIONS.SCREEN_ADMIN_TABLES,
  "/admin/settings": PERMISSIONS.SCREEN_ADMIN_SETTINGS,
  "/admin/access": PERMISSIONS.SCREEN_ADMIN_ACCESS,
  "/sales": PERMISSIONS.SCREEN_ORDERS,
};

const hotelLinks = [
  { href: "/", key: "dashboard", icon: LayoutDashboard },
  { href: "/floor", key: "floor", icon: LayoutGrid },
  { href: "/orders", key: "orders", icon: Receipt },
  { href: "/kds", key: "kds", icon: ChefHat },
  { href: "/admin/menu", key: "menu", icon: UtensilsCrossed },
  { href: "/admin/tables", key: "tables", icon: LayoutPanelTop },
  { href: "/sales", key: "sales", icon: ScrollText },
  { href: "/admin/settings", key: "settings", icon: Settings },
  { href: "/admin/access", key: "access", icon: Shield },
] as const;

const kafeLinks = [
  { href: "/", key: "dashboard", icon: LayoutDashboard },
  { href: "/floor", key: "floor", icon: LayoutGrid },
  { href: "/orders", key: "orders", icon: Receipt },
  { href: "/admin/menu", key: "menu", icon: UtensilsCrossed },
  { href: "/admin/tables", key: "tables", icon: LayoutPanelTop },
  { href: "/sales", key: "sales", icon: ScrollText },
  { href: "/admin/settings", key: "settings", icon: Settings },
  { href: "/admin/access", key: "access", icon: Shield },
] as const;

type MePayload = {
  permissions?: string[];
  role?: string;
  login?: string;
  email?: string | null;
  isOwner?: boolean;
  pin?: boolean;
};

function BakuNow() {
  const [label, setLabel] = useState("");
  useEffect(() => {
    const tick = () => setLabel(bakuDateTimeDisplay(new Date()));
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);
  if (!label) return null;
  return (
    <p className="whitespace-nowrap text-sm font-semibold tabular-nums text-[#2C3E50]">{label}</p>
  );
}

export default function FnbOpsShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("nav");
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const { session } = useSatelliteOpsSession();
  const [edition, setEdition] = useState<string | null>(null);
  const [modules, setModules] = useState<string[]>([]);
  const [me, setMe] = useState<MePayload | null>(null);

  useEffect(() => {
    void fetch("/api/edition")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setEdition(String(d.edition ?? "hotel"));
        setModules(Array.isArray(d.activeModules) ? d.activeModules : []);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    void fetch("/api/auth/me")
      .then(async (r) => (r.ok ? ((await r.json()) as MePayload) : null))
      .then((d) => setMe(d))
      .catch(() => setMe(null));
  }, []);

  const permSession: FnbPermissionSession = useMemo(
    () => ({
      login: me?.login ?? session?.displayName ?? "",
      email: me?.email ?? session?.email ?? undefined,
      role: me?.role ?? "",
      permissions: me?.permissions,
      isOwner: me?.isOwner,
      pin: me?.pin,
    }),
    [me, session],
  );

  const bare =
    pathname === "/login" ||
    pathname === "/pin" ||
    pathname.startsWith("/m/");
  if (bare) {
    return <>{children}</>;
  }

  const can = (p: Permission) =>
    me != null && sessionHasFnbPermission(permSession, p);

  const kafe = edition == null || edition.toLowerCase() === "kafe";
  const links = kafe ? [...kafeLinks] : [...hotelLinks];
  if (kafe && modules.includes("fnb_kitchen_kds")) {
    const hasKds = links.some((l) => l.href === "/kds");
    if (!hasKds) {
      links.splice(3, 0, { href: "/kds", key: "kds", icon: ChefHat });
    }
  }

  const navItems: EraOpsNavItem[] = links
    .filter((l) => {
      const screen = LINK_SCREENS[l.href];
      if (!screen) return true;
      if (l.href === "/kds" && kafe && !modules.includes("fnb_kitchen_kds")) {
        return false;
      }
      const grants = me?.permissions;
      if (!Array.isArray(grants) || grants.length === 0) return true;
      return can(screen);
    })
    .map((l) => ({
      href: l.href,
      label: t(l.key),
      icon: l.icon,
    }));

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const profileItems: HeaderProfileMenuItem[] = [];
  if (can(PERMISSIONS.SCREEN_ADMIN_SETTINGS)) {
    profileItems.push({ label: t("settings"), href: "/admin/settings" });
  }
  if (can(PERMISSIONS.SCREEN_ADMIN_MENU)) {
    profileItems.push({ label: t("menu"), href: "/admin/menu" });
  }
  if (can(PERMISSIONS.SCREEN_ADMIN_ACCESS)) {
    profileItems.push({
      label: t("access", { defaultValue: "Access" }),
      href: "/admin/access",
    });
  }

  return (
    <EraAppRouteShell
      brandTitle={kafe ? t("brandKafe") : t("brand")}
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
      tierBar={<BakuNow />}
    >
      <OfflineReplayBridge />
      {children}
    </EraAppRouteShell>
  );
}
