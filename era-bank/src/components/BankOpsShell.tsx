"use client";

import { usePathname } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import type { Locale } from "@era/i18n-common";
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
} from "lucide-react";
import {
  EraAppRouteShell,
  HeaderOrganization,
  HeaderProfileMenu,
  SatelliteHeaderLocale,
  useSatelliteOpsSession,
  type EraOpsNavItem,
  type HeaderProfileMenuItem,
} from "@era/satellite-kit/ui";
import { EodLockProvider } from "@/components/ops/EodLockProvider";
import { useBankEntitlements } from "@/components/ops/useBankEntitlements";

export default function BankOpsShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const tMeta = useTranslations("meta");
  const locale = useLocale() as Locale;
  const { session } = useSatelliteOpsSession();
  const { isNavVisible } = useBankEntitlements();

  if (
    pathname === "/login" ||
    pathname.startsWith("/sso/") ||
    pathname.startsWith("/help")
  ) {
    return <>{children}</>;
  }

  const navItems = ([
    { href: "/dashboard", label: t("dashboard"), icon: LayoutDashboard },
    { href: "/cif", label: t("cif"), icon: Users },
    { href: "/accounts", label: t("accounts"), icon: Wallet },
    { href: "/postings/queue", label: t("postings"), icon: ListChecks },
    { href: "/payments", label: t("payments"), icon: Banknote },
    { href: "/deposits", label: t("deposits"), icon: PiggyBank },
    { href: "/loans", label: t("loans"), icon: Landmark },
    { href: "/aml/alerts", label: t("aml"), icon: ShieldAlert },
    { href: "/aml/rules", label: t("amlRules"), icon: ShieldAlert },
    { href: "/reports/cbar", label: t("reports"), icon: FileBarChart },
    { href: "/cards", label: t("cards"), icon: CreditCard },
    { href: "/card-txns", label: t("cardTxns"), icon: ArrowLeftRight },
    { href: "/treasury", label: t("treasury"), icon: Building2 },
    { href: "/admin/branches", label: t("branches"), icon: Building2 },
    {
      href: "/admin/product-factory",
      label: t("productFactory"),
      icon: Factory,
    },
    { href: "/admin/eod", label: t("eod"), icon: Moon },
    { href: "/admin/audit", label: t("audit"), icon: FileBarChart },
  ] as EraOpsNavItem[]).filter((item) => item.href && isNavVisible(item.href));

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const profileItems: HeaderProfileMenuItem[] = [];

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
          logoutLabel={t("logout")}
        />
      }
      organization={
        <HeaderOrganization
          variant="label"
          organizationName={session?.organizationName}
        />
      }
      locale={<SatelliteHeaderLocale locale={locale} />}
    >
      <EodLockProvider>{children}</EodLockProvider>
    </EraAppRouteShell>
  );
}
