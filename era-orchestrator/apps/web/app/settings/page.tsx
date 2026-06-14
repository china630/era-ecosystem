"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { CARD_CONTAINER_CLASS, SECONDARY_BUTTON_CLASS } from "@era/satellite-kit/ui";
import { useRequireAuth } from "../../lib/use-require-auth";

export default function SettingsHubPage() {
  const { ready } = useRequireAuth();
  const t = useTranslations("settings");

  if (!ready) return null;

  const links = [
    { href: "/settings/team", title: t("teamLink"), hint: t("teamHint") },
    { href: "/settings/subscription", title: t("subscriptionLink"), hint: t("subscriptionHint") },
  ];

  return (
    <>
      <Link href="/workspace" className={SECONDARY_BUTTON_CLASS}>
        {t("workspace")}
      </Link>
      <h1 className="mt-4 text-xl font-semibold text-[#34495E]">{t("title")}</h1>
      <p className="mt-1 text-sm text-[#7F8C8D]">{t("subtitle")}</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`${CARD_CONTAINER_CLASS} block p-4 transition hover:border-[#2980B9]/40`}
          >
            <strong className="text-[#34495E]">{link.title}</strong>
            <p className="mt-1 text-xs text-[#7F8C8D]">{link.hint}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
