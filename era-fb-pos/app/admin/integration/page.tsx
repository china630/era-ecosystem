"use client";

import { useEffect, useState } from "react";
import FbPosNav from "@/components/FbPosNav";

type IntegrationSettings = {
  organizationId: string | null;
  controlPlaneUrl: string | null;
  platformSubscription: unknown;
  kkmDriver: string;
  stockConsumptionEnabled: boolean;
};

export default function IntegrationAdminPage() {
  const [data, setData] = useState<IntegrationSettings | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/integration-settings")
      .then(async (res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        setData(await res.json());
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);

  return (
    <>
      <FbPosNav />
      <h1 className="mb-4 text-xl font-semibold">Integration & billing</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!data && !error && <p className="text-sm text-gray-500">Loading…</p>}
      {data && (
        <div className="space-y-4 text-sm">
          <p>
            <span className="font-medium">Organization:</span>{" "}
            {data.organizationId ?? "—"}
          </p>
          <p>
            <span className="font-medium">KKM driver:</span> {data.kkmDriver}
          </p>
          <p>
            <span className="font-medium">E8 consumption:</span>{" "}
            {data.stockConsumptionEnabled ? "enabled" : "disabled (env)"}
          </p>
          <div>
            <p className="mb-1 font-medium">Platform subscription (read-only)</p>
            <pre className="max-h-64 overflow-auto rounded border bg-gray-50 p-3 text-xs">
              {JSON.stringify(data.platformSubscription, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </>
  );
}
