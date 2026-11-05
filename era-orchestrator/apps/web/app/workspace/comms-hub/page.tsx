"use client";

import { useTranslations } from "next-intl";
import { PageHeader, CARD_CONTAINER_CLASS } from "@era/satellite-kit/ui";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { useAuth } from "../../../lib/auth-context";

/**
 * Comms Hub slot in Control Home (ADR control-home-ia).
 * Full inbox lands after orch topology/billing/cutover wave.
 */
export default function CommsHubPage() {
  const { ready } = useRequireAuth();
  const { user } = useAuth();
  const t = useTranslations("commsHub");

  if (!ready || !user) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className={`${CARD_CONTAINER_CLASS} space-y-2 p-4 text-sm text-[#5D6D7E]`}>
        <p>{t("scopedOrg")}</p>
        <p className="font-mono text-[12px] text-[#34495E]">{user.organizationId}</p>
        <p>{t("comingSoon")}</p>
      </div>
    </div>
  );
}
