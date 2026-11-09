"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CARD_CONTAINER_CLASS, PageHeader } from "@era/satellite-kit/ui";
import { useAuth } from "@/lib/auth-context";
import { orchFetch } from "@/lib/orch-api";
import type { DepartmentRow } from "@/lib/org-hub-shared";
import { useOrgShell } from "./org-shell";

type ProfileCard = {
  legalName?: string;
  tradeName?: string | null;
  taxId?: string | null;
  directorName?: string | null;
  print?: { "org.phone"?: string; "org.email"?: string; "org.legalAddress"?: string };
};

export default function OrgCardPage() {
  const { orgId, meta, mode } = useOrgShell();
  const { token } = useAuth();
  const t = useTranslations("superAdmin.orgCard");
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [profile, setProfile] = useState<ProfileCard | null>(null);

  useEffect(() => {
    if (!token || !orgId) return;
    let cancelled = false;
    void (async () => {
      const [deptRes, profileRes] = await Promise.all([
        orchFetch(`/v1/admin/orgs/${orgId}/departments`, { token }),
        orchFetch(`/platform/v1/organizations/${orgId}/profile`, { token }),
      ]);
      if (cancelled) return;
      if (deptRes.ok) setDepartments((await deptRes.json()) as DepartmentRow[]);
      if (profileRes.ok) setProfile((await profileRes.json()) as ProfileCard);
    })();
    return () => {
      cancelled = true;
    };
  }, [token, orgId]);

  const phone = profile?.print?.["org.phone"] || "—";
  const email = profile?.print?.["org.email"] || "—";
  const address = profile?.print?.["org.legalAddress"] || "—";

  return (
    <div className="space-y-4">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <section className={`${CARD_CONTAINER_CLASS} space-y-2 p-4 text-sm text-[#34495E]`}>
        <h2 className="font-medium">{t("legalTitle")}</h2>
        <p>
          {t("legalName")}: {profile?.legalName || meta.name || "—"}
        </p>
        <p>
          {t("tradeName")}: {profile?.tradeName || "—"}
        </p>
        <p>
          {t("taxId")}: {profile?.taxId || "—"}
        </p>
        <p>
          {t("director")}: {profile?.directorName || "—"}
        </p>
        <p>
          {t("phone")}: {phone}
        </p>
        <p>
          {t("email")}: {email}
        </p>
        <p>
          {t("address")}: {address}
        </p>
        <p className="text-xs text-[#7F8C8D]">{t("legalHint")}</p>
      </section>

      <section className={`${CARD_CONTAINER_CLASS} space-y-2 p-4 text-sm text-[#34495E]`}>
        <h2 className="font-medium">{t("structureTitle")}</h2>
        <p>
          {mode?.mode === "DEPARTMENT" ? t("isDepartment") : t("isStandalone")}
          {mode?.parentOrgId ? (
            <>
              {" · "}
              <Link href={`/orgs/${mode.parentOrgId}`} className="text-[#2980B9] hover:underline">
                {t("openParent")}
              </Link>
            </>
          ) : null}
        </p>
        <p>
          {t("children", { count: departments.length })}
          {" · "}
          <Link href={`/orgs/${orgId}/structure`} className="text-[#2980B9] hover:underline">
            {t("editStructure")}
          </Link>
        </p>
      </section>

      <section className={`${CARD_CONTAINER_CLASS} space-y-2 p-4 text-sm text-[#34495E]`}>
        <h2 className="font-medium">{t("accessTitle")}</h2>
        <p className="flex flex-wrap gap-3 text-[#2980B9]">
          <Link href={`/orgs/${orgId}/subscription`} className="hover:underline">
            {t("openLicense")}
          </Link>
          <Link href={`/orgs/${orgId}/modules`} className="hover:underline">
            {t("openModules")}
          </Link>
          <Link href={`/orgs/${orgId}/connections`} className="hover:underline">
            {t("openEndpoints")}
          </Link>
        </p>
      </section>
    </div>
  );
}
