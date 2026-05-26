"use client";

import { useEffect, useState } from "react";
import { CARD_CONTAINER_CLASS } from "@era/satellite-kit/ui";
import { SuperAdminDataTable } from "../../../components/super-admin-data-table";
import { cpAdminFetch } from "../../../lib/cp-admin-fetch";

export default function SuperAdminEarlyAccessPage() {
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [events, setEvents] = useState<Array<Record<string, string>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const [sRes, eRes] = await Promise.all([
        cpAdminFetch("early-access/summary"),
        cpAdminFetch("early-access/events?page=1&pageSize=50"),
      ]);
      if (sRes.ok) setSummary((await sRes.json()) as Record<string, unknown>);
      if (eRes.ok) {
        const data = (await eRes.json()) as {
          items?: Array<Record<string, string>>;
        };
        setEvents(data.items ?? []);
      }
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Early access</h1>
      <pre className={`${CARD_CONTAINER_CLASS} overflow-auto p-4 text-xs`}>
        {summary ? JSON.stringify(summary, null, 2) : "Loading summary…"}
      </pre>
      <h2 className="text-lg font-medium">Recent events</h2>
      <SuperAdminDataTable
        loading={loading}
        columns={["moduleKey", "eventType", "organizationId", "createdAt"]}
        rows={events.map((e) => ({
          moduleKey: e.moduleKey ?? "",
          eventType: e.eventType ?? "",
          organizationId: e.organizationId ?? "",
          createdAt: e.createdAt ?? "",
        }))}
      />
    </div>
  );
}
