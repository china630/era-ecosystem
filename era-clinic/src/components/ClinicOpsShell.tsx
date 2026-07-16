"use client";

import { useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import type { Locale } from "@era/i18n-common";
import {
  LayoutDashboard,
  Stethoscope,
  Calendar,
  FlaskConical,
  HeartPulse,
  Settings,
  UserRound,
  Syringe,
  ListOrdered,
  Wallet,
  BedDouble,
  FileSpreadsheet,
  GitBranch,
  Users,
  Database,
  BookOpen,
  ScrollText,
  Shield,
  Star,
} from "lucide-react";
import {
  EraAppRouteShell,
  HeaderOrganization,
  HeaderProfileMenu,
  SatelliteHeaderLocale,
  SatelliteNotificationBell,
  SATELLITE_NOTIFICATION_LABELS_EN,
  type EraOpsNavItem,
  type EraOpsNavSection,
  type HeaderProfileMenuItem,
} from "@era/satellite-kit/ui";
import { useClinicAuth } from "@/hooks/useClinicAuth";
import { CLINIC_PRESET, type ClinicPresetCode } from "@/domain/presets/clinic-presets";

export default function ClinicOpsShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("nav");
  const tMeta = useTranslations("meta");
  const locale = useLocale() as Locale;
  const { auth } = useClinicAuth();
  const canAdmin = auth?.canViewClinicAdmin === true;
  const enabledPresets = auth?.enabledPresets ?? [CLINIC_PRESET.OUTPATIENT];

  function presetEnabled(code: ClinicPresetCode): boolean {
    return enabledPresets.includes(code);
  }

  const navSections: EraOpsNavSection[] = useMemo(() => {
    const opsItems: EraOpsNavItem[] = [
      { href: "/", label: t("home"), icon: LayoutDashboard },
      { href: "/appointments", label: t("appointments"), icon: Stethoscope },
      { href: "/patients", label: t("patients"), icon: Users },
      { href: "/reception/queue", label: t("queue"), icon: ListOrdered },
      { href: "/scheduling", label: t("scheduling"), icon: Calendar },
      { href: "/lab-orders", label: t("labOrders"), icon: FlaskConical },
    ];
    if (presetEnabled(CLINIC_PRESET.INPATIENT_DAY)) {
      opsItems.push({ href: "/inpatient", label: t("inpatient"), icon: BedDouble });
    }
    if (presetEnabled(CLINIC_PRESET.SANATORIUM_CLINICAL)) {
      opsItems.push({ href: "/sanatorium", label: t("sanatorium"), icon: HeartPulse });
    }
    opsItems.push(
      { href: "/doctor", label: t("doctor"), icon: UserRound },
      { href: "/nurse", label: t("nurse"), icon: Syringe },
      { href: "/cashier", label: t("cashier"), icon: Wallet },
    );

    const sections: EraOpsNavSection[] = [
      {
        id: "clinic_ops",
        title: t("sectionOps"),
        icon: Stethoscope,
        items: opsItems,
      },
    ];

    if (canAdmin) {
      sections.push({
        id: "clinic_admin",
        title: t("sectionAdmin"),
        icon: Shield,
        items: [
          {
            href: "/admin/master-data",
            label: t("masterData"),
            icon: Database,
          },
          { href: "/admin/wards", label: t("inpatient"), icon: BedDouble },
          { href: "/admin/catalog", label: t("catalog"), icon: BookOpen },
          { href: "/admin/catalog-favorites", label: t("catalogFavorites"), icon: Star },
          { href: "/admin/templates", label: t("templates"), icon: FileSpreadsheet },
          {
            href: "/admin/lis-profiles",
            label: t("lisProfiles"),
            icon: FlaskConical,
          },
          {
            href: "/admin/procedure-rules",
            label: t("procedureRules"),
            icon: GitBranch,
          },
          { href: "/admin/audit", label: t("audit"), icon: ScrollText },
          { href: "/admin/settings", label: t("settings"), icon: Settings },
        ],
      });
    }

    return sections;
  }, [canAdmin, enabledPresets, t]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const profileItems: HeaderProfileMenuItem[] = canAdmin
    ? [{ label: t("masterData"), href: "/admin/master-data" }]
    : [{ label: t("settings"), href: "/help" }];

  return (
    <EraAppRouteShell
      brandTitle={tMeta("title")}
      navSections={navSections}
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
