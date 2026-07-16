"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import {
  CARD_CONTAINER_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { useCreateOrganization } from "../../components/organizations/create-organization-context";
import { OrgCard } from "../../components/organizations/org-card";
import { useAuth } from "../../lib/auth-context";
import { useRequireAuth } from "../../lib/use-require-auth";

export default function OrganizationsPage() {
  const router = useRouter();
  const { ready, user } = useRequireAuth();
  const { memberships, switchOrganization } = useAuth();
  const { openCreateOrganization } = useCreateOrganization();
  const t = useTranslations("organizations");
  const tCommon = useTranslations("common");

  const roleLabel = useMemo(
    () =>
      (role: string): string => {
        const key = role.toLowerCase();
        try {
          return t(`roles.${key}` as "roles.owner");
        } catch {
          return role;
        }
      },
    [t],
  );

  async function openOrg(organizationId: string) {
    if (user?.organizationId !== organizationId) {
      await switchOrganization(organizationId);
    }
    router.push("/workspace");
  }

  if (!ready) {
    return <p className="text-sm text-[#7F8C8D]">{tCommon("loading")}</p>;
  }

  if (memberships.length === 0) {
    return (
      <>
        <div className={`${CARD_CONTAINER_CLASS} mx-auto max-w-lg p-8 text-center`}>
          <h1 className="text-xl font-semibold text-[#34495E]">{t("emptyTitle")}</h1>
          <p className="mt-2 text-sm text-[#7F8C8D]">{t("emptyHint")}</p>
          <button
            type="button"
            className={`${PRIMARY_BUTTON_CLASS} mt-6`}
            onClick={openCreateOrganization}
          >
            {t("createSubmit")}
          </button>
          <p className="mt-4 text-sm">
            <Link href="/register-org" className="text-[#2980B9] hover:underline">
              {t("fallbackPage")}
            </Link>
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/holdings" className={SECONDARY_BUTTON_CLASS}>
              {t("manageHoldings")}
            </Link>
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              onClick={openCreateOrganization}
            >
              <Plus className="mr-1.5 h-4 w-4" aria-hidden />
              {t("addOrg")}
            </button>
          </div>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {memberships.map((m) => (
          <OrgCard
            key={m.organizationId}
            membership={m}
            isCurrent={user?.organizationId === m.organizationId}
            roleLabel={roleLabel(m.role)}
            workspaceLabel={t("openWorkspace")}
            currentWorkspaceLabel={t("currentWorkspace")}
            onOpen={() => void openOrg(m.organizationId)}
          />
        ))}
      </div>
    </>
  );
}
