"use client";

import { useTranslations } from "next-intl";
import { BillingProvider } from "./billing-context";

export default function SuperAdminBillingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations("superAdmin.billing");

  return (
    <BillingProvider>
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-[#34495E]">{t("title")}</h1>
          <p className="mt-1 text-sm text-[#7F8C8D]">{t("subtitle")}</p>
        </div>
        {children}
      </div>
    </BillingProvider>
  );
}
