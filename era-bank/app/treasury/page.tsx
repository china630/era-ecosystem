"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

const links = [
  { href: "/treasury/liquidity-gap", key: "gap" },
  { href: "/treasury/fx-deals", key: "fx" },
  { href: "/treasury/interbank", key: "interbank" },
  { href: "/treasury/nostro-vostro", key: "nostro" },
  { href: "/treasury/gov-securities", key: "gov" },
] as const;

export default function TreasuryDashboardPage() {
  const t = useTranslations("pages.treasury");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {links.map(({ href, key }) => (
          <li key={href}>
            <Link
              href={href}
              className="block rounded-lg border bg-card p-4 shadow-sm hover:border-primary"
            >
              <span className="font-medium">{t(`sections.${key}`)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
