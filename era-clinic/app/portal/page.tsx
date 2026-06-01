"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function PatientPortalPage() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/portal/session?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ error: "session_failed" }));
  }, [token]);

  return (
    <main className="mx-auto max-w-lg p-4">
      <h1 className="mb-4 text-xl font-semibold">Patient portal (M8 v2.0)</h1>
      {!token && <p className="text-sm text-gray-600">Missing portal token.</p>}
      {data && (
        <pre className="overflow-auto rounded bg-gray-100 p-3 text-sm">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </main>
  );
}
