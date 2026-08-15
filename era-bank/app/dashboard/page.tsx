import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  CARD_CONTAINER_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";

export default async function DashboardPage() {
  const t = await getTranslations("home");
  const tNav = await getTranslations("nav");
  const tCommon = await getTranslations("common");

  const links = [
    { href: "/cif", label: tNav("cif") },
    { href: "/accounts", label: tNav("accounts") },
    { href: "/postings/queue", label: tNav("postings") },
    { href: "/gl", label: tNav("gl") },
    { href: "/payments", label: tNav("payments") },
    { href: "/deposits", label: tNav("deposits") },
    { href: "/loans", label: tNav("loans") },
    { href: "/cards", label: tNav("cards") },
    { href: "/card-txns", label: tNav("cardTxns") },
    { href: "/aml/alerts", label: tNav("aml") },
    { href: "/reports/cbar", label: tNav("reportsCbar") },
    { href: "/treasury", label: tNav("treasury") },
    { href: "/risk", label: tNav("riskDashboard") },
    { href: "/admin/branches", label: tNav("branches") },
    { href: "/admin/product-factory", label: tNav("productFactory") },
    { href: "/admin/eod", label: tNav("eod") },
    { href: "/admin/audit", label: tNav("audit") },
  ];

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className={`${CARD_CONTAINER_CLASS} space-y-4 p-6`}>
        <p className="text-[13px] text-[#7F8C8D]">{tCommon("engineNote")}</p>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {links.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className={PRIMARY_BUTTON_CLASS}>
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
