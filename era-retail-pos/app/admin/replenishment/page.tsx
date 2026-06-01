"use client";

import { useEffect, useState } from "react";

export default function ReplenishmentPage() {
  const [data, setData] = useState<{ suggestions?: unknown[] } | null>(null);

  useEffect(() => {
    fetch("/api/replenishment/suggestions")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ suggestions: [] }));
  }, []);

  return (
    <main className="mx-auto max-w-2xl p-4">
      <h1 className="mb-4 text-xl font-semibold">Replenishment (M15)</h1>
      <ul className="space-y-2">
        {(data?.suggestions as { sku?: string; suggestedQty?: number }[] | undefined)?.map(
          (s, i) => (
            <li key={i} className="rounded border p-2 text-sm">
              {s.sku} — suggest {s.suggestedQty}
            </li>
          ),
        )}
      </ul>
      {!data?.suggestions?.length && (
        <p className="text-sm text-gray-600">No suggestions (stub or all stocked).</p>
      )}
    </main>
  );
}
