"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { EngineListPage } from "@/components/EngineListPage";

export default function CbarReportsPage() {
  const t = useTranslations("pages.reports");
  const tCommon = useTranslations("common");

  return (
    <div className="space-y-4">
      <EngineListPage
        title={t("title")}
        subtitle={t("subtitle")}
        apiPath="/api/reports/cbar/CBAR_TRIAL_BALANCE?periodFrom=2026-01-01&periodTo=2026-01-31"
        engineNote={tCommon("engineNote")}
        emptyLabel={tCommon("empty")}
        refreshLabel={tCommon("refresh")}
        errorLabel={tCommon("error")}
        loadingLabel={tCommon("loading")}
      />
      <p className="text-sm text-muted-foreground">
        <Link href="/reports/fatca-crs" className="underline">
          FATCA/CRS + CBAR generate
        </Link>
        {" · "}
        <Link href="/aml/reports/fmn" className="underline">
          FMN export
        </Link>
      </p>
    </div>
  );
}
