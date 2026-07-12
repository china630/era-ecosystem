"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { PageHeader } from "../../../../components/layout/page-header";
import { CARD_CONTAINER_CLASS, PRIMARY_BUTTON_CLASS } from "../../../../lib/design-system";

/**
 * Customs tariffs moved to era-data-hub (Phase 2). Local table dropped.
 */
export default function DataHubCustomsTariffsPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("superAdmin.dataHubCustoms")}
        subtitle={t("superAdmin.dataHubReadOnly")}
      />
      <div className={`${CARD_CONTAINER_CLASS} p-4 space-y-3`}>
        <p className="text-sm text-[#34495E]">
          Customs HS tariffs are owned by era-data-hub. Finance no longer stores or edits{" "}
          <code className="text-xs">customs_tariff_rates</code>. Use hub{" "}
          <code className="text-xs">GET /registry/v1/hs/:code/tariff</code>.
        </p>
        <Link
          href="/admin/data/reference"
          className={`${PRIMARY_BUTTON_CLASS} inline-flex`}
        >
          {t("superAdmin.dataHubReference")}
        </Link>
      </div>
    </div>
  );
}
