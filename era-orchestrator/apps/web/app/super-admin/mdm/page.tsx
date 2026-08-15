"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Building2, Users } from "lucide-react";
import { CARD_CONTAINER_CLASS } from "@era/satellite-kit/ui";
import { cpAdminFetch } from "../../../lib/cp-admin-fetch";

type Health = { ok?: boolean; legalEntityCount?: number };

export default function SuperAdminMdmPage() {
  const t = useTranslations("superAdmin.mdm");
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const res = await cpAdminFetch("mdm/health");
      if (res.ok) setHealth((await res.json()) as Health);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-[#34495E]">{t("title")}</h1>
        <p className="mt-1 text-sm text-[#7F8C8D]">{t("subtitle")}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className={`${CARD_CONTAINER_CLASS} p-4`}>
          <p className="text-xs uppercase tracking-wide text-[#95A5A6]">{t("statusLabel")}</p>
          <p className="mt-1 flex items-center gap-2 text-sm font-semibold">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${
                health?.ok ? "bg-emerald-500" : "bg-red-500"
              }`}
              aria-hidden
            />
            {loading ? t("loading") : health?.ok ? t("statusOk") : t("statusDown")}
          </p>
        </div>
        <div className={`${CARD_CONTAINER_CLASS} p-4`}>
          <p className="text-xs uppercase tracking-wide text-[#95A5A6]">{t("legalEntities")}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-[#34495E]">
            {loading ? "…" : (health?.legalEntityCount ?? 0)}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/super-admin/mdm/companies"
          className={`${CARD_CONTAINER_CLASS} flex items-start gap-3 p-4 transition hover:border-[#2980B9]/40`}
        >
          <Building2 className="mt-0.5 h-5 w-5 text-[#2980B9]" aria-hidden />
          <span>
            <span className="block text-sm font-semibold text-[#34495E]">
              {t("browseCompanies")}
            </span>
            <span className="mt-0.5 block text-xs text-[#7F8C8D]">{t("companiesHint")}</span>
          </span>
        </Link>
        <Link
          href="/super-admin/mdm/persons"
          className={`${CARD_CONTAINER_CLASS} flex items-start gap-3 p-4 transition hover:border-[#2980B9]/40`}
        >
          <Users className="mt-0.5 h-5 w-5 text-[#2980B9]" aria-hidden />
          <span>
            <span className="block text-sm font-semibold text-[#34495E]">{t("openPersons")}</span>
            <span className="mt-0.5 block text-xs text-[#7F8C8D]">{t("personsHint")}</span>
          </span>
        </Link>
      </div>
    </div>
  );
}
