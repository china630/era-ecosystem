"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { CouncilChamberPanel } from "../../components/council-chamber-panel";
import { PageHeader } from "../../../../components/layout/page-header";
import { SECONDARY_BUTTON_CLASS } from "../../../../lib/design-system";
import { useOrgPermissions } from "../../../../lib/use-org-permissions";
import { CP_PERMISSION } from "../../../../lib/role-utils";
import { useRequireAuth } from "../../../../lib/use-require-auth";

export default function CouncilChamberPage() {
  const { t } = useTranslation();
  const params = useParams();
  const verdictId = typeof params.verdictId === "string" ? params.verdictId : "";
  const { ready, token } = useRequireAuth();
  const perms = useOrgPermissions();

  const canMitigate =
    perms.can(CP_PERMISSION.ADMIN_ORG_SETTINGS) || perms.isSuperAdmin;

  if (!ready || !token || !verdictId) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("compliance.council.chamberTitle")}
        subtitle={t("compliance.council.chamberSubtitle")}
        actions={
          <Link href="/compliance" className={SECONDARY_BUTTON_CLASS}>
            {t("compliance.council.backToCompliance")}
          </Link>
        }
      />
      <CouncilChamberPanel verdictId={verdictId} canMitigate={!!canMitigate} />
    </div>
  );
}
