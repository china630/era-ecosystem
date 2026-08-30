"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { PageHeader, showApiError } from "@era/satellite-kit/ui";
import { ImportWizard } from "@/components/import/ImportWizard";

type ImportEntity = {
  entity: string;
  label: string;
  order: number;
  templateHint: string;
};

export default function RetailImportPage() {
  const t = useTranslations("cutoverImport");
  const [entities, setEntities] = useState<ImportEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    fetch("/api/import")
      .then(async (r) => {
        const data = await r.json();
        if (r.status === 401 || r.status === 403) {
          setForbidden(true);
          return;
        }
        if (!r.ok) {
          showApiError(data, t("loadError"));
          return;
        }
        setEntities(Array.isArray(data) ? data : []);
      })
      .catch((e) => showApiError({ error: e instanceof Error ? e.message : t("loadError") }))
      .finally(() => setLoading(false));
  }, [t]);

  if (loading) {
    return <p className="text-sm text-[#7F8C8D]">{t("loading")}</p>;
  }

  if (forbidden) {
    return <p className="text-sm text-[#7F8C8D]">{t("superAdminOnly")}</p>;
  }

  return (
    <div className="max-w-3xl">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <ImportWizard entities={entities} />
    </div>
  );
}
