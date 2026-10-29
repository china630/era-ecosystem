"use client";

import { useCallback, useEffect, useState } from "react";
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
  Upload,
  Shield,
  Soup,
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
  type OpsNavCondition,
  type OpsNavProfile,
} from "@era/satellite-kit/ui";
import OfflineReplayBridge from "@/components/OfflineReplayBridge";
import { bakuDateTimeDisplay } from "@era/satellite-kit/time";
import { PERMISSIONS, type Permission } from "@/lib/auth/permissions";
import { sessionHasFnbPermission } from "@/lib/auth/permission-check";

const LINK_SCREENS: Record<string, Permission> = {
  "/": PERMISSIONS.SCREEN_HOME,
  "/floor": PERMISSIONS.SCREEN_FLOOR,
  "/orders": PERMISSIONS.SCREEN_ORDERS,
  "/kds": PERMISSIONS.SCREEN_KDS,
  "/admin/menu": PERMISSIONS.SCREEN_ADMIN_MENU,
  "/admin/tables": PERMISSIONS.SCREEN_ADMIN_TABLES,
  "/admin/buffet": PERMISSIONS.SCREEN_ADMIN_BUFFET,
  "/admin/buffet/templates": PERMISSIONS.SCREEN_ADMIN_BUFFET,
  "/admin/buffet/management": PERMISSIONS.SCREEN_ADMIN_BUFFET,
  "/admin/buffet/forecast": PERMISSIONS.SCREEN_ADMIN_BUFFET,
  "/admin/buffet/norms": PERMISSIONS.SCREEN_ADMIN_BUFFET,
  "/admin/buffet/cost-run": PERMISSIONS.SCREEN_ADMIN_BUFFET,
  "/admin/settings": PERMISSIONS.SCREEN_ADMIN_SETTINGS,
  "/admin/import": PERMISSIONS.SCREEN_ADMIN_IMPORT,
  "/admin/access": PERMISSIONS.SCREEN_ADMIN_ACCESS,
  "/admin/audit": PERMISSIONS.SCREEN_ADMIN_SETTINGS,
  "/sales": PERMISSIONS.SCREEN_SALES,
};

const HALLS = ["cafe", "restaurant"] as const;

type ShellLink = OpsNavCondition & {
  href?: string;
  key: string;
  icon: typeof LayoutDashboard;
  children?: ShellLink[];
};

type CapFlags = { till: boolean; tables: boolean; buffetPlanner: boolean };

function capsFromProfile(profile: OpsNavProfile | null): CapFlags {
  const raw = profile?.raw?.selectedOutlet;
  const c =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as { capabilities?: CapFlags }).capabilities
      : null;
  if (c && typeof c === "object") {
    return {
      till: c.till !== false,
      tables: c.tables !== false,
      buffetPlanner: c.buffetPlanner === true,
    };
  }
  // No selected outlet yet — show union until gate picks one.
  return { till: true, tables: true, buffetPlanner: true };
}

/** Catalog order. Several enabled halls give the union of their screens. */
function buildShellLinks(caps: CapFlags): ShellLink[] {
  return [
    { href: "/", key: "dashboard", icon: LayoutDashboard, preset: HALLS },
    {
      href: "/floor",
      key: "floor",
      icon: LayoutGrid,
      preset: HALLS,
      when: caps.till,
    },
    { href: "/orders", key: "orders", icon: Receipt, preset: HALLS, when: caps.till },
    {
      href: "/kds",
      key: "kds",
      icon: ChefHat,
      preset: HALLS,
      module: "fnb_kitchen_kds",
      when: caps.till,
    },
    { href: "/admin/menu", key: "menu", icon: UtensilsCrossed, preset: HALLS },
    {
      href: "/admin/tables",
      key: "tables",
      icon: LayoutPanelTop,
      preset: HALLS,
      when: caps.tables,
    },
    {
      key: "buffet",
      icon: Soup,
      preset: HALLS,
      module: "fnb_buffet_planner",
      when: caps.buffetPlanner,
      children: [
        {
          href: "/admin/buffet",
          key: "buffetPlans",
          icon: Soup,
          preset: HALLS,
          module: "fnb_buffet_planner",
          when: caps.buffetPlanner,
        },
        {
          href: "/admin/buffet/templates",
          key: "buffetTemplates",
          icon: Soup,
          preset: HALLS,
          module: "fnb_buffet_planner",
          when: caps.buffetPlanner,
        },
        {
          href: "/admin/buffet/management",
          key: "buffetManagement",
          icon: Soup,
          preset: HALLS,
          module: "fnb_buffet_planner",
          when: caps.buffetPlanner,
        },
        {
          href: "/admin/buffet/forecast",
          key: "buffetForecast",
          icon: Soup,
          preset: HALLS,
          module: "fnb_buffet_planner",
          when: caps.buffetPlanner,
        },
        {
          href: "/admin/buffet/norms",
          key: "buffetNorms",
          icon: Soup,
          preset: HALLS,
          module: "fnb_buffet_planner",
          when: caps.buffetPlanner,
        },
        {
          href: "/admin/buffet/cost-run",
          key: "buffetCostRun",
          icon: Soup,
          preset: HALLS,
          module: "fnb_buffet_planner",
          when: caps.buffetPlanner,
        },
      ],
    },
    { href: "/sales", key: "sales", icon: ScrollText, preset: HALLS, when: caps.till },
    { href: "/admin/import", key: "import", icon: Upload, preset: HALLS },
    { href: "/admin/settings", key: "settings", icon: Settings, preset: HALLS },
    { href: "/admin/audit", key: "audit", icon: ScrollText, preset: HALLS },
    { href: "/admin/access", key: "access", icon: Shield, preset: HALLS },
  ];
}

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

function allowLink(permission: string, profile: OpsNavProfile): boolean {
  return sessionHasFnbPermission(
    {
      login: profile.login,
      email: profile.email ?? undefined,
      role: profile.role,
      permissions: profile.permissions,
      isOwner: profile.isOwner,
      pin: profile.pin,
    },
    permission as Permission,
  );
}

export default function FnbOpsShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("nav");
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const { profile, status: navStatus } = useOpsNavProfile();

  const logout = useCallback(async () => {
    let pin = profile?.pin === true;
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      const data = (await res.json()) as { pin?: boolean };
      if (data?.pin === true) pin = true;
    } catch {
      /* keep the flag we already have */
    }
    window.location.href = pin ? "/pin" : "/login";
  }, [profile?.pin]);

  useEffect(() => {
    if (navStatus !== "ready" || !profile) return;
    const caps = capsFromProfile(profile);
    if (pathname.startsWith("/admin/buffet") && !caps.buffetPlanner) {
      window.location.replace("/");
      return;
    }
    if (
      (pathname === "/floor" ||
        pathname.startsWith("/floor/") ||
        pathname === "/orders" ||
        pathname.startsWith("/orders/") ||
        pathname === "/sales" ||
        pathname.startsWith("/sales/")) &&
      !caps.till
    ) {
      window.location.replace(caps.buffetPlanner ? "/admin/buffet" : "/");
      return;
    }
    if (
      (pathname === "/admin/tables" || pathname.startsWith("/admin/tables/")) &&
      !caps.tables
    ) {
      window.location.replace("/");
    }
  }, [navStatus, profile, pathname]);

  useEffect(() => {
    if (!profile?.pin) return;
    const idleMs = 5 * 60 * 1000;
    let timer = window.setTimeout(() => {
      void logout();
    }, idleMs);
    const bump = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void logout();
      }, idleMs);
    };
    window.addEventListener("pointerdown", bump);
    window.addEventListener("keydown", bump);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointerdown", bump);
      window.removeEventListener("keydown", bump);
    };
  }, [profile?.pin, logout]);

  const bare =
    pathname === "/login" ||
    pathname === "/pin" ||
    pathname === "/select-outlet" ||
    pathname.startsWith("/m/");
  if (bare) {
    return <>{children}</>;
  }

  const editionKnown = navStatus === "ready" && profile != null;
  const kafe = profile?.edition === "kafe";

  function mapShellLink(link: ShellLink): OpsNavCondition & {
    href?: string;
    label: string;
    icon: typeof LayoutDashboard;
    children?: ReturnType<typeof mapShellLink>[];
    permission?: string;
  } {
    const { key, children, href, ...rest } = link;
    return {
      ...rest,
      href,
      label: t(key as "buffet"),
      permission: href ? LINK_SCREENS[href] : undefined,
      children: children?.map(mapShellLink),
    };
  }
  const caps = capsFromProfile(profile);
  const onBuffetRoutes = pathname.startsWith("/admin/buffet");
  // Chef chrome on buffet routes: hide till/floor ops even if outlet also has till.
  const shellCaps: CapFlags = onBuffetRoutes
    ? { till: false, tables: false, buffetPlanner: caps.buffetPlanner }
    : caps;
  const catalog = buildShellLinks(shellCaps).map(mapShellLink);
  const navItems: EraOpsNavItem[] = visibleOpsNavItems(catalog, navStatus, profile, allowLink);

  const personName =
    navStatus !== "ready"
      ? ""
      : profile?.displayName ||
        (profile?.role === "FB_CASHIER"
          ? t("cashier")
          : profile?.role === "FB_WAITER"
            ? t("waiter")
            : profile?.role === "FB_MANAGER"
              ? t("manager")
              : t("staff"));

  const can = (permission: Permission) =>
    navStatus === "ready" && profile != null && allowLink(permission, profile);

  const profileItems: HeaderProfileMenuItem[] = [];
  if (!profile?.pin) {
    profileItems.push({
      label: t("switchOutlet", { defaultValue: "Switch outlet" }),
      href: "/select-outlet",
    });
  }
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
      brandTitle={editionKnown ? (kafe ? t("brandKafe") : t("brand")) : ""}
      navItems={navItems}
      profile={
        <HeaderProfileMenu
          displayName={personName}
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
      tierBar={<BakuNow />}
    >
      <OfflineReplayBridge />
      {children}
    </EraAppRouteShell>
  );
}
