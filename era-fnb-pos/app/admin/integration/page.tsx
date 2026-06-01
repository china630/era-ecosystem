"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import FbPosNav from "@/components/FbPosNav";

type IntegrationSettings = {
  organizationId: string | null;
  controlPlaneUrl: string | null;
  platformSubscription: unknown;
  kkmDriver: string;
  stockConsumptionEnabled: boolean;
};

export default function IntegrationAdminPage() {
  const t = useTranslations("admin.integration");
  const tc = useTranslations("common");
  const [data, setData] = useState<IntegrationSettings | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/integration-settings")
      .then(async (res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        setData(await res.json());
      })
      .catch((e) => setError(e instanceof Error ? e.message : t("loadFailed")));
  }, []);

  return (
    <>
      <FbPosNav />
      <h1 className="mb-4 text-xl font-semibold">{t("title")}</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!data && !error && <p className="text-sm text-gray-500">{tc("loading")}</p>}
      {data && (
        <div className="space-y-4 text-sm">
          <p>
            <span className="font-medium">{t("organization")}:</span>{" "}
            {data.organizationId ?? tc("emDash")}
          </p>
          <p>
            <span className="font-medium">{t("kkmDriver")}:</span> {data.kkmDriver}
          </p>
          <p>
            <span className="font-medium">{t("e8Consumption")}:</span>{" "}
            {data.stockConsumptionEnabled ? t("enabled") : t("disabledEnv")}
          </p>
          <div>
            <p className="mb-1 font-medium">{t("platformSubscription")}</p>
            <pre className="max-h-64 overflow-auto rounded border bg-gray-50 p-3 text-xs">
              {JSON.stringify(data.platformSubscription, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </>
  );
}
