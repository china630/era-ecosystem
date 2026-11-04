"use client";

/**
 * Ops Structure entry on platform console.
 * Full owner tree lives on app `/workspace/structure`; platform uses the same APIs
 * with admin session (deep-link org hub remains under /orgs).
 */
import Link from "next/link";
import { useTranslations } from "next-intl";
import { PageHeader, CARD_CONTAINER_CLASS, PRIMARY_BUTTON_CLASS } from "@era/satellite-kit/ui";

export default function PlatformStructurePage() {
  const t = useTranslations("platformStructurePage");
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className={`${CARD_CONTAINER_CLASS} space-y-3 p-4 text-sm text-[#5D6D7E]`}>
        <p>{t("body")}</p>
        <Link href="/orgs" className={PRIMARY_BUTTON_CLASS}>
          {t("openOrgs")}
        </Link>
      </div>
    </div>
  );
}
