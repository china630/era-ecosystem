"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CARD_CONTAINER_CLASS, GHOST_BUTTON_CLASS } from "@era/satellite-kit/ui";
import { cpAdminFetch } from "../../../lib/cp-admin-fetch";

export default function SuperAdminMdmPage() {
  const t = useTranslations("superAdmin.mdm");
  const [health, setHealth] = useState<unknown>(null);

  useEffect(() => {
    void (async () => {
      const res = await cpAdminFetch("mdm/health");
      if (res.ok) setHealth(await res.json());
    })();
  }, []);

  return (
    <div>
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      <p className="mt-1 text-sm text-[#7F8C8D]">
        {t("subtitlePrefix")}{" "}
        <Link href="/super-admin/mdm/companies" className="text-[#2980B9]">
          {t("browseCompanies")}
        </Link>
      </p>
      <Link href="/super-admin/mdm/companies" className={`${GHOST_BUTTON_CLASS} mt-4 inline-flex`}>
        {t("openCompanyList")}
      </Link>
      <pre className={`${CARD_CONTAINER_CLASS} mt-4 overflow-auto p-4 text-xs`}>
        {JSON.stringify(health, null, 2)}
      </pre>
    </div>
  );
}
