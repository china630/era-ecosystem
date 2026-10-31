"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import {
  Building2,
  CalendarClock,
  CreditCard,
  Database,
  Gauge,
  Library,
  Package,
  PanelLeftClose,
  PanelRightClose,
  Radio,
  Settings,
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

export function PlatformSidebar({
  mobileNavOpen,
  onNavClick,
  sidebarCollapsed,
  onToggleSidebarCollapsed,
}: {
  mobileNavOpen: boolean;
  onNavClick: () => void;
  sidebarCollapsed: boolean;
  onToggleSidebarCollapsed: () => void;
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

  return (
    <EraAppSidebar
      id="platform-main-sidebar"
      mobileNavOpen={mobileNavOpen}
      sidebarCollapsed={layoutCollapsed}
      navClassName={layoutCollapsed ? "lg:px-2" : ""}
      header={
        <>
          <div className={["shrink-0 p-5", layoutCollapsed ? "lg:px-2 lg:py-4" : ""].join(" ")}>
            <SidebarLogo
              title={t("platformConsoleBrand")}
              subtitle={t("platformConsoleSubtitle")}
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
        <CollapsibleNavSection
          sectionKey="billing"
          title={t("platformBilling")}
          icon={CreditCard}
          sectionActive={pathname.startsWith("/billing")}
        >
          <SideNavItem
            href="/billing/pricing"
            label={t("platformBillingModules")}
            isActive={
              pathname.startsWith("/billing/pricing") &&
              !pathname.startsWith("/billing/pricing/addons")
            }
            icon={Tags}
            nested
            onNavClick={onNavClick}
          />
          <SideNavItem
            href="/billing/pricing/addons"
            label={t("platformBillingAddons")}
            isActive={pathname.startsWith("/billing/pricing/addons")}
            icon={Tags}
            nested
            onNavClick={onNavClick}
          />
          <SideNavItem
            href="/billing/quotas"
            label={t("platformBillingQuotas")}
            isActive={pathname.startsWith("/billing/quotas")}
            icon={Gauge}
            nested
            onNavClick={onNavClick}
          />
          <SideNavItem
            href="/billing/packages"
            label={t("platformBillingPackages")}
            isActive={pathname.startsWith("/billing/packages")}
            icon={Package}
            nested
            onNavClick={onNavClick}
          />
          <SideNavItem
            href="/billing/trial-allowlist"
            label={t("platformTrialAllowlist")}
            isActive={pathname.startsWith("/billing/trial-allowlist")}
            icon={CalendarClock}
            nested
            onNavClick={onNavClick}
          />
          <SideNavItem
            href="/billing/settings"
            label={t("platformBillingSettings")}
            isActive={pathname.startsWith("/billing/settings")}
            icon={Settings}
            nested
            onNavClick={onNavClick}
          />
        </CollapsibleNavSection>

        <SideNavItem
          href="/orgs"
          label={t("platformOrgs")}
          isActive={pathname.startsWith("/orgs")}
          icon={Building2}
          onNavClick={onNavClick}
        />

        <CollapsibleNavSection
          sectionKey="mdm"
          title={t("platformMdm")}
          icon={Database}
          sectionActive={pathname.startsWith("/mdm")}
        >
          <SideNavItem
            href="/mdm"
            label={t("platformMdmOverview")}
            isActive={pathname === "/mdm"}
            icon={Database}
            nested
            onNavClick={onNavClick}
          />
          <SideNavItem
            href="/mdm/companies"
            label={t("platformMdmCompanies")}
            isActive={pathname.startsWith("/mdm/companies")}
            icon={Building2}
            nested
            onNavClick={onNavClick}
          />
          <SideNavItem
            href="/mdm/persons"
            label={t("platformMdmPersons")}
            isActive={pathname.startsWith("/mdm/persons")}
            icon={Users}
            nested
            onNavClick={onNavClick}
          />
        </CollapsibleNavSection>

        <SideNavItem
          href="/reference"
          label={t("platformReference")}
          isActive={pathname.startsWith("/reference")}
          icon={Library}
          onNavClick={onNavClick}
        />
        <SideNavItem
          href="/early-access"
          label={t("platformEarlyAccess")}
          isActive={pathname.startsWith("/early-access")}
          icon={Sparkles}
          onNavClick={onNavClick}
        />
        <SideNavItem
          href="/referrals"
          label={t("platformReferrals")}
          isActive={pathname.startsWith("/referrals")}
          icon={Users}
          onNavClick={onNavClick}
        />
        <SideNavItem
          href="/landing"
          label={t("platformLanding")}
          isActive={pathname.startsWith("/landing")}
          icon={Tags}
          onNavClick={onNavClick}
        />
        <SideNavItem
          href="/security"
          label={t("platformSecurity")}
          isActive={pathname.startsWith("/security")}
          icon={ShieldAlert}
          onNavClick={onNavClick}
        />
        <SideNavItem
          href="/vendors/channex"
          label={t("platformChannex")}
          isActive={pathname.startsWith("/vendors/channex")}
          icon={Radio}
          onNavClick={onNavClick}
        />
      </SidebarLayoutProvider>
    </EraAppSidebar>
  );
}
