"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import type { Locale } from "@era/i18n-common";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  Wallet,
  ListChecks,
  Banknote,
  PiggyBank,
  Landmark,
  ShieldAlert,
  FileBarChart,
  CreditCard,
  ArrowLeftRight,
  Building2,
  Factory,
  Moon,
  BookOpen,
  Gauge,
  Scale,
  LineChart,
} from "lucide-react";
import {
  EraAppRouteShell,
  HeaderOrganization,
  HeaderProfileMenu,
  SatelliteHeaderLocale,
  SatelliteNotificationBell,
  useSatelliteOpsSession,
  type EraOpsNavItem,
  type EraOpsNavSection,
  type HeaderProfileMenuItem,
} from "@era/satellite-kit/ui";
import { BankHeaderTierBar } from "@/components/BankHeaderTierBar";
import { EodLockProvider } from "@/components/ops/EodLockProvider";
import { useBankEntitlements } from "@/components/ops/useBankEntitlements";

type NavDef = {
  id: string;
  href: string;
  labelKey: string;
  icon: LucideIcon;
};

export default function BankOpsShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const tMeta = useTranslations("meta");
  const tNotify = useTranslations("notifications");
  const locale = useLocale() as Locale;
  const { session } = useSatelliteOpsSession();
  const { isNavVisible, role } = useBankEntitlements();

  if (
    pathname === "/login" ||
    pathname.startsWith("/sso/") ||
    pathname.startsWith("/help")
  ) {
    return <>{children}</>;
  }

  function mapItem(def: NavDef): EraOpsNavItem | null {
    if (!isNavVisible(def.href)) return null;
    return {
      id: def.id,
      href: def.href,
      label: t(def.labelKey as "dashboard"),
      // Dual lucide-react copies (app vs satellite-kit) — cast for nav contract.
      icon: def.icon as EraOpsNavItem["icon"],
    };
  }

  function section(
    id: string,
    titleKey: string,
    icon: LucideIcon,
    defs: NavDef[],
  ): EraOpsNavSection | null {
    const items = defs.map(mapItem).filter(Boolean) as EraOpsNavItem[];
    if (items.length === 0) return null;
    return {
      id,
      title: t(titleKey as "sectionCore"),
      icon: icon as EraOpsNavSection["icon"],
      items,
    };
  }

  const navSections = useMemo(() => {
    const sections = [
      section("core", "sectionCore", LayoutDashboard, [
        { id: "dashboard", href: "/dashboard", labelKey: "dashboard", icon: LayoutDashboard },
        {
          id: "executive",
          href: "/dashboard/executive",
          labelKey: "executive",
          icon: Gauge,
        },
        { id: "cif", href: "/cif", labelKey: "cif", icon: Users },
        { id: "accounts", href: "/accounts", labelKey: "accounts", icon: Wallet },
        {
          id: "postings",
          href: "/postings/queue",
          labelKey: "postings",
          icon: ListChecks,
        },
        { id: "gl", href: "/gl", labelKey: "gl", icon: BookOpen },
        {
          id: "branches",
          href: "/admin/branches",
          labelKey: "branches",
          icon: Building2,
        },
        {
          id: "product-factory",
          href: "/admin/product-factory",
          labelKey: "productFactory",
          icon: Factory,
        },
        { id: "eod", href: "/admin/eod", labelKey: "eod", icon: Moon },
      ]),
      section("payments", "sectionPayments", Banknote, [
        { id: "payments", href: "/payments", labelKey: "payments", icon: Banknote },
        {
          id: "payments-extras",
          href: "/payments/extras",
          labelKey: "paymentsExtras",
          icon: Banknote,
        },
        { id: "cash", href: "/cash", labelKey: "cash", icon: Banknote },
        { id: "fees", href: "/fees", labelKey: "fees", icon: Banknote },
      ]),
      section("products", "sectionProducts", PiggyBank, [
        { id: "deposits", href: "/deposits", labelKey: "deposits", icon: PiggyBank },
        { id: "loans", href: "/loans", labelKey: "loans", icon: Landmark },
        {
          id: "loan-apps",
          href: "/loans/applications",
          labelKey: "loanApps",
          icon: Landmark,
        },
        {
          id: "credit-lines",
          href: "/loans/credit-lines",
          labelKey: "loanApps",
          icon: Landmark,
        },
        { id: "collections", href: "/collections", labelKey: "collections", icon: Landmark },
        { id: "trade", href: "/trade", labelKey: "trade", icon: Landmark },
        { id: "islamic", href: "/islamic", labelKey: "islamic", icon: Landmark },
        { id: "wealth", href: "/wealth", labelKey: "wealth", icon: PiggyBank },
        { id: "cards", href: "/cards", labelKey: "cards", icon: CreditCard },
        {
          id: "card-txns",
          href: "/card-txns",
          labelKey: "cardTxns",
          icon: ArrowLeftRight,
        },
        {
          id: "card-disputes",
          href: "/cards/disputes",
          labelKey: "cardDisputes",
          icon: CreditCard,
        },
        {
          id: "card-3ds",
          href: "/cards/3ds",
          labelKey: "card3ds",
          icon: CreditCard,
        },
        {
          id: "card-atm",
          href: "/cards/atm",
          labelKey: "cardAtm",
          icon: CreditCard,
        },
      ]),
      section("aml", "sectionAml", ShieldAlert, [
        { id: "aml-alerts", href: "/aml/alerts", labelKey: "aml", icon: ShieldAlert },
        {
          id: "aml-rules",
          href: "/aml/rules",
          labelKey: "amlRules",
          icon: ShieldAlert,
        },
        {
          id: "aml-screen",
          href: "/aml/screen",
          labelKey: "amlScreen",
          icon: ShieldAlert,
        },
        {
          id: "aml-fmn",
          href: "/aml/reports/fmn",
          labelKey: "amlFmn",
          icon: FileBarChart,
        },
        {
          id: "aml-cases",
          href: "/aml/cases",
          labelKey: "amlCases",
          icon: ShieldAlert,
        },
      ]),
      section("reports", "sectionReports", FileBarChart, [
        {
          id: "cbar",
          href: "/reports/cbar",
          labelKey: "reportsCbar",
          icon: FileBarChart,
        },
        {
          id: "fatca",
          href: "/reports/fatca-crs",
          labelKey: "reportsFatca",
          icon: FileBarChart,
        },
      ]),
      section("treasury", "sectionTreasury", Building2, [
        { id: "treasury", href: "/treasury", labelKey: "treasury", icon: Building2 },
        {
          id: "markets",
          href: "/markets",
          labelKey: "markets",
          icon: LineChart,
        },
        {
          id: "fx",
          href: "/treasury/fx-deals",
          labelKey: "treasuryFx",
          icon: LineChart,
        },
        {
          id: "nostro",
          href: "/treasury/nostro-vostro",
          labelKey: "treasuryNostro",
          icon: Building2,
        },
        {
          id: "interbank",
          href: "/treasury/interbank",
          labelKey: "treasuryInterbank",
          icon: Building2,
        },
        {
          id: "gov",
          href: "/treasury/gov-securities",
          labelKey: "treasuryGov",
          icon: Building2,
        },
        {
          id: "gap",
          href: "/treasury/liquidity-gap",
          labelKey: "treasuryGap",
          icon: LineChart,
        },
      ]),
      section("risk", "sectionRisk", Scale, [
        { id: "risk", href: "/risk", labelKey: "riskDashboard", icon: Scale },
        {
          id: "risk-portfolio",
          href: "/risk/portfolio",
          labelKey: "riskPortfolio",
          icon: Scale,
        },
        {
          id: "risk-collateral",
          href: "/risk/collateral",
          labelKey: "riskCollateral",
          icon: Scale,
        },
        {
          id: "risk-ecl",
          href: "/risk/ecl",
          labelKey: "riskEcl",
          icon: Scale,
        },
        {
          id: "risk-capital",
          href: "/risk/capital",
          labelKey: "riskCapital",
          icon: Scale,
        },
        {
          id: "risk-alm",
          href: "/treasury/liquidity-gap",
          labelKey: "riskAlm",
          icon: LineChart,
        },
      ]),
      section("admin", "sectionAdmin", FileBarChart, [
        { id: "audit", href: "/admin/audit", labelKey: "audit", icon: FileBarChart },
      ]),
    ].filter(Boolean) as EraOpsNavSection[];
    return sections;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t + isNavVisible stable enough per render
  }, [t, isNavVisible, role]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const profileItems: HeaderProfileMenuItem[] = [];

  return (
    <EraAppRouteShell
      brandTitle={tMeta("title")}
      navSections={navSections}
      profile={
        <HeaderProfileMenu
          displayName={
            role
              ? `${session?.displayName ?? tMeta("title")} · ${role}`
              : (session?.displayName ?? tMeta("title"))
          }
          email={session?.email ?? undefined}
          items={profileItems}
          onLogout={() => void logout()}
          logoutLabel={t("logout")}
        />
      }
      organization={
        <HeaderOrganization
          variant="label"
          organizationName={session?.organizationName}
        />
      }
      notifications={
        <SatelliteNotificationBell
          labels={{
            bellAria: tNotify("bellAria"),
            title: tNotify("title"),
            empty: tNotify("empty"),
            markAll: tNotify("markAll"),
            close: tNotify("close"),
          }}
        />
      }
      locale={<SatelliteHeaderLocale locale={locale} />}
      tierBar={<BankHeaderTierBar />}
    >
      <EodLockProvider>{children}</EodLockProvider>
    </EraAppRouteShell>
  );
}
