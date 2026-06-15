"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CARD_CONTAINER_CLASS, PageHeader, SECONDARY_BUTTON_CLASS } from "@era/satellite-kit/ui";

export default function CardDetailPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/cards/${params.id}`);
    setData((await res.json()) as Record<string, unknown>);
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function blockCard() {
    await fetch(`/api/cards/${params.id}/block`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Ops block" }),
    });
    await load();
  }

  async function unblockCard() {
    await fetch(`/api/cards/${params.id}/unblock`, { method: "POST" });
    await load();
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Card detail" subtitle={params.id} />
      {data && (
        <div className={CARD_CONTAINER_CLASS}>
          <pre className="overflow-auto text-xs">{JSON.stringify(data, null, 2)}</pre>
        </div>
      )}
      <div className="flex gap-2">
        <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void blockCard()}>
          Block
        </button>
        <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void unblockCard()}>
          Unblock
        </button>
      </div>
    </div>
  );
}
