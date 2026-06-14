"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  CalendarClock,
  CircleHelp,
  CreditCard,
  Database,
  Gauge,
  LayoutGrid,
  Package,
  PanelLeftClose,
  PanelRightClose,
  Settings,
  Shield,
  ShieldAlert,
  Sparkles,
  Tags,
  Users,
} from "lucide-react";
import { EraAppSidebar } from "@era/satellite-kit/ui";
import {
  CollapsibleNavSection,
  SideNavItem,
  SidebarLayoutProvider,
  SidebarLogo,
} from "./sidebar-primitives";

export function OrchSidebar({
  mobileNavOpen,
  onNavClick,
  sidebarCollapsed,
  onToggleSidebarCollapsed,
  isSuperAdmin,
}: {
  mobileNavOpen: boolean;
  onNavClick: () => void;
  sidebarCollapsed: boolean;
  onToggleSidebarCollapsed: () => void;
  isSuperAdmin: boolean;
}) {
  const pathname = usePathname() ?? "";
  const t = useTranslations("nav");
  const [layoutWide, setLayoutWide] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setLayoutWide(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const layoutCollapsed = Boolean(sidebarCollapsed && layoutWide);

  const sections = useMemo(
    () => ({
      organization:
        pathname.startsWith("/organizations") ||
        pathname === "/settings" ||
        pathname.startsWith("/settings/"),
      resources: pathname === "/pricing" || pathname.startsWith("/help"),
      platform: pathname.startsWith("/super-admin"),
    }),
    [pathname],
  );

  return (
    <EraAppSidebar
      id="orch-main-sidebar"
      mobileNavOpen={mobileNavOpen}
      sidebarCollapsed={layoutCollapsed}
      navClassName={layoutCollapsed ? "lg:px-2" : ""}
      header={
        <>
          <div className={["shrink-0 p-5", layoutCollapsed ? "lg:px-2 lg:py-4" : ""].join(" ")}>
            <SidebarLogo
              title="ERA 365"
              subtitle={t("controlPlane")}
              layoutCollapsed={layoutCollapsed}
            />
          </div>
          <div className="mx-3 h-px shrink-0 bg-gray-200" />
        </>
      }
      footer={
        <button
          type="button"
          className="hidden w-full items-center justify-center rounded-lg border border-transparent p-2 text-gray-600 transition hover:border-gray-200 hover:bg-white/70 lg:flex"
          onClick={onToggleSidebarCollapsed}
          aria-label={
            sidebarCollapsed ? t("sidebarExpandAria") : t("sidebarCollapseAria")
          }
        >
          {sidebarCollapsed ? (
            <PanelRightClose className="h-5 w-5 shrink-0" aria-hidden />
          ) : (
            <PanelLeftClose className="h-5 w-5 shrink-0" aria-hidden />
          )}
        </button>
      }
    >
      <SidebarLayoutProvider layoutCollapsed={layoutCollapsed}>
        <SideNavItem
          href="/workspace"
          label={t("workspace")}
          isActive={pathname === "/workspace" || pathname.startsWith("/industry/")}
          icon={LayoutGrid}
          onNavClick={onNavClick}
        />

        <CollapsibleNavSection
          sectionKey="organization"
          title={t("sectionOrganization")}
          icon={Building2}
          sectionActive={sections.organization}
        >
          <SideNavItem
            href="/organizations"
            label={t("organizations")}
            isActive={
              pathname === "/organizations" || pathname.startsWith("/organizations/")
            }
            icon={Building2}
            nested
            onNavClick={onNavClick}
          />
          <SideNavItem
            href="/settings"
            label={t("settings")}
            isActive={pathname === "/settings"}
            icon={Settings}
            nested
            onNavClick={onNavClick}
          />
          <SideNavItem
            href="/settings/team"
            label={t("team")}
            isActive={pathname.startsWith("/settings/team")}
            icon={Users}
            nested
            onNavClick={onNavClick}
          />
          <SideNavItem
            href="/settings/subscription"
            label={t("subscription")}
            isActive={pathname.startsWith("/settings/subscription")}
            icon={CreditCard}
            nested
            onNavClick={onNavClick}
          />
        </CollapsibleNavSection>

        <CollapsibleNavSection
          sectionKey="resources"
          title={t("sectionResources")}
          icon={CircleHelp}
          sectionActive={sections.resources}
        >
          <SideNavItem
            href="/pricing"
            label={t("pricing")}
            isActive={pathname === "/pricing" || pathname.startsWith("/pricing/")}
            icon={Tags}
            nested
            onNavClick={onNavClick}
          />
          <SideNavItem
            href="/help"
            label={t("help")}
            isActive={pathname === "/help" || pathname.startsWith("/help/")}
            icon={CircleHelp}
            nested
            onNavClick={onNavClick}
          />
        </CollapsibleNavSection>

        {isSuperAdmin ? (
          <CollapsibleNavSection
            sectionKey="platform"
            title={t("sectionPlatform")}
            icon={Shield}
            sectionActive={sections.platform}
          >
            <SideNavItem
              href="/super-admin"
              label={t("platformHub")}
              isActive={pathname === "/super-admin"}
              icon={Shield}
              nested
              onNavClick={onNavClick}
            />
            <SideNavItem
              href="/super-admin/billing/pricing"
              label={t("platformBillingPricing")}
              isActive={pathname.startsWith("/super-admin/billing/pricing")}
              icon={Tags}
              nested
              onNavClick={onNavClick}
            />
            <SideNavItem
              href="/super-admin/billing/quotas"
              label={t("platformBillingQuotas")}
              isActive={pathname.startsWith("/super-admin/billing/quotas")}
              icon={Gauge}
              nested
              onNavClick={onNavClick}
            />
            <SideNavItem
              href="/super-admin/billing/packages"
              label={t("platformBillingPackages")}
              isActive={pathname.startsWith("/super-admin/billing/packages")}
              icon={Package}
              nested
              onNavClick={onNavClick}
            />
            <SideNavItem
              href="/super-admin/billing/trial-allowlist"
              label={t("platformTrialAllowlist")}
              isActive={pathname.startsWith("/super-admin/billing/trial-allowlist")}
              icon={CalendarClock}
              nested
              onNavClick={onNavClick}
            />
            <SideNavItem
              href="/super-admin/mdm"
              label={t("platformMdm")}
              isActive={pathname === "/super-admin/mdm"}
              icon={Database}
              nested
              onNavClick={onNavClick}
            />
            <SideNavItem
              href="/super-admin/mdm/companies"
              label={t("platformMdmCompanies")}
              isActive={pathname.startsWith("/super-admin/mdm/companies")}
              icon={Building2}
              nested
              onNavClick={onNavClick}
            />
            <SideNavItem
              href="/super-admin/mdm/persons"
              label={t("platformMdmPersons")}
              isActive={pathname.startsWith("/super-admin/mdm/persons")}
              icon={Building2}
              nested
              onNavClick={onNavClick}
            />
            <SideNavItem
              href="/super-admin/early-access"
              label={t("platformEarlyAccess")}
              isActive={pathname.startsWith("/super-admin/early-access")}
              icon={Sparkles}
              nested
              onNavClick={onNavClick}
            />
            <SideNavItem
              href="/super-admin/security"
              label={t("platformSecurity")}
              isActive={pathname.startsWith("/super-admin/security")}
              icon={ShieldAlert}
              nested
              onNavClick={onNavClick}
            />
          </CollapsibleNavSection>
        ) : null}
      </SidebarLayoutProvider>
    </EraAppSidebar>
  );
}
