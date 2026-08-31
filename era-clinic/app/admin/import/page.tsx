"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { PageHeader, showApiError } from "@era/satellite-kit/ui";
import { ImportWizard } from "@/components/import/ImportWizard";
import { useClinicAuth } from "@/hooks/useClinicAuth";

type ImportEntity = {
  entity: string;
  label: string;
  order: number;
  templateHint: string;
  fileless?: boolean;
  allowMultiple?: boolean;
};

export default function AdminImportPage() {
  const t = useTranslations("naftaImport");
  const { auth, loading } = useClinicAuth();
  const allowed = Boolean(auth?.canViewClinicAdmin || auth?.isPlatformSuperAdmin);
  const [entities, setEntities] = useState<ImportEntity[]>([]);

  useEffect(() => {
    if (!allowed) return;
    fetch("/api/import")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) {
          showApiError(data, t("loadError"));
          return;
        }
        setEntities(Array.isArray(data) ? data : (data.data ?? []));
      })
      .catch((e) => showApiError({ error: e instanceof Error ? e.message : t("loadError") }));
  }, [allowed, t]);

  if (loading) {
    return <p className="text-sm text-[#7F8C8D]">{t("loading")}</p>;
  }

  if (!allowed) {
    return <p className="text-sm text-[#7F8C8D]">{t("adminOnly")}</p>;
  }

  return (
    <div className="max-w-3xl">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <ImportWizard entities={entities} />
    </div>
  );
}
