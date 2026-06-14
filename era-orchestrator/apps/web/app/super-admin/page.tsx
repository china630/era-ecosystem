"use client";

import { useTranslations } from "next-intl";
import { CARD_CONTAINER_CLASS } from "@era/satellite-kit/ui";
export default function SuperAdminHubPage() {
  const t = useTranslations("superAdmin.hub");

  return (
    <>
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      <p className="mt-1 text-sm text-[#7F8C8D]">{t("subtitle")}</p>
      <ul className={`${CARD_CONTAINER_CLASS} mt-6 list-disc space-y-2 p-6 pl-10 text-sm`}>
        <li>{t("billingLink")}</li>
        <li>{t("mdmLink")}</li>
        <li>{t("earlyAccessLink")}</li>
        <li>{t("securityLink")}</li>
      </ul>
    </>
  );
}
