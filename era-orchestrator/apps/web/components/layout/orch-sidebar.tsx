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
        pathname.startsWith("/holdings") ||
        pathname.startsWith("/settings/team"),
      workforce: pathname.startsWith("/workspace/workforce"),
      resources: pathname === "/pricing" || pathname.startsWith("/help"),
      settings:
        pathname === "/settings" ||
        pathname.startsWith("/settings/subscription"),
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
            href="/holdings"
            label={t("holdings")}
            isActive={pathname === "/holdings" || pathname.startsWith("/holdings/")}
            icon={Building2}
            nested
            onNavClick={onNavClick}
          />
        </CollapsibleNavSection>

        <CollapsibleNavSection
          sectionKey="workforce"
          title={t("sectionWorkforce")}
          icon={Users}
          sectionActive={sections.workforce}
        >
          <SideNavItem
            href="/workspace/workforce/employments"
            label={t("wfEmployments")}
            isActive={pathname.startsWith("/workspace/workforce/employments")}
            icon={Users}
            nested
            onNavClick={onNavClick}
          />
          <SideNavItem
            href="/workspace/workforce/org-structure"
            label={t("wfOrgStructure")}
            isActive={pathname.startsWith("/workspace/workforce/org-structure")}
            icon={Building2}
            nested
            onNavClick={onNavClick}
          />
          <SideNavItem
            href="/workspace/workforce/positions"
            label={t("wfPositions")}
            isActive={pathname.startsWith("/workspace/workforce/positions")}
            icon={Tags}
            nested
            onNavClick={onNavClick}
          />
          <SideNavItem
            href="/workspace/workforce/absences"
            label={t("wfAbsences")}
            isActive={pathname.startsWith("/workspace/workforce/absences")}
            icon={CalendarClock}
            nested
            onNavClick={onNavClick}
          />
          <CollapsibleNavSection
            sectionKey="workforce-security"
            title={t("wfSecurity")}
            icon={ShieldAlert}
            sectionActive={pathname.startsWith("/workspace/workforce/security")}
          >
            <SideNavItem
              href="/workspace/workforce/security"
              label={t("wfSecurityMatrix")}
              isActive={
                pathname === "/workspace/workforce/security" ||
                pathname === "/workspace/workforce/security/"
              }
              icon={ShieldAlert}
              nested
              onNavClick={onNavClick}
            />
            <SideNavItem
              href="/workspace/workforce/security/grants"
              label={t("wfSecurityGrants")}
              isActive={pathname.startsWith("/workspace/workforce/security/grants")}
              icon={Shield}
              nested
              onNavClick={onNavClick}
            />
            <SideNavItem
              href="/workspace/workforce/security/bindings"
              label={t("wfSecurityBindings")}
              isActive={pathname.startsWith("/workspace/workforce/security/bindings")}
              icon={Users}
              nested
              onNavClick={onNavClick}
            />
            <SideNavItem
              href="/workspace/workforce/security/audit"
              label={t("wfSecurityAudit")}
              isActive={pathname.startsWith("/workspace/workforce/security/audit")}
              icon={ShieldAlert}
              nested
              onNavClick={onNavClick}
            />
          </CollapsibleNavSection>
          <SideNavItem
            href="/workspace/workforce/export"
            label={t("wfExport")}
            isActive={pathname.startsWith("/workspace/workforce/export")}
            icon={Package}
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

        <CollapsibleNavSection
          sectionKey="settings"
          title={t("sectionSettings")}
          icon={Settings}
          sectionActive={sections.settings}
        >
          <SideNavItem
            href="/settings/subscription"
            label={t("subscription")}
            isActive={pathname.startsWith("/settings/subscription")}
            icon={CreditCard}
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
        </CollapsibleNavSection>

        {isSuperAdmin ? (
          <CollapsibleNavSection
            sectionKey="platform"
            title={t("sectionPlatform")}
            icon={Shield}
            sectionActive={sections.platform}
          >
            <CollapsibleNavSection
              sectionKey="platform-billing"
              title={t("platformBilling")}
              icon={CreditCard}
              sectionActive={pathname.startsWith("/super-admin/billing")}
            >
              <SideNavItem
                href="/super-admin/billing/pricing"
                label={t("platformBillingModules")}
                isActive={
                  pathname.startsWith("/super-admin/billing/pricing") &&
                  !pathname.startsWith("/super-admin/billing/pricing/addons")
                }
                icon={Tags}
                nested
                onNavClick={onNavClick}
              />
              <SideNavItem
                href="/super-admin/billing/pricing/addons"
                label={t("platformBillingAddons")}
                isActive={pathname.startsWith("/super-admin/billing/pricing/addons")}
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
                href="/super-admin/billing/settings"
                label={t("platformBillingSettings")}
                isActive={pathname.startsWith("/super-admin/billing/settings")}
                icon={Settings}
                nested
                onNavClick={onNavClick}
              />
            </CollapsibleNavSection>
            <CollapsibleNavSection
              sectionKey="platform-mdm"
              title={t("platformMdm")}
              icon={Database}
              sectionActive={pathname.startsWith("/super-admin/mdm")}
            >
              <SideNavItem
                href="/super-admin/mdm"
                label={t("platformMdmOverview")}
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
                icon={Users}
                nested
                onNavClick={onNavClick}
              />
            </CollapsibleNavSection>
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
