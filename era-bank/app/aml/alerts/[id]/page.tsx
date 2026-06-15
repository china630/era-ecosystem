"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  CARD_CONTAINER_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";

export default function AmlAlertDetailPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [screenName, setScreenName] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/aml/alerts/${params.id}`, { cache: "no-store" });
      if (!res.ok) {
        setError(`Failed (${res.status})`);
        return;
      }
      setData((await res.json()) as Record<string, unknown>);
    } catch {
      setError("Request failed");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function patchStatus(status: string) {
    await fetch(`/api/aml/alerts/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, resolutionNote: note || undefined }),
    });
    await load();
  }

  async function runScreen() {
    if (!screenName.trim()) return;
    await fetch("/api/aml/screen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: screenName, alertId: params.id }),
    });
    await load();
  }

  return (
    <div className="space-y-6">
      <PageHeader title="AML Alert" subtitle={params.id} />
      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {data && (
        <div className={CARD_CONTAINER_CLASS}>
          <pre className="overflow-auto text-xs">{JSON.stringify(data, null, 2)}</pre>
        </div>
      )}
      <div className={CARD_CONTAINER_CLASS}>
        <h3 className="mb-2 font-medium">Screening</h3>
        <input
          className="mb-2 w-full rounded border px-3 py-2 text-sm"
          placeholder="Counterparty name"
          value={screenName}
          onChange={(e) => setScreenName(e.target.value)}
        />
        <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void runScreen()}>
          Screen
        </button>
      </div>
      <div className={CARD_CONTAINER_CLASS}>
        <h3 className="mb-2 font-medium">Workflow</h3>
        <textarea
          className="mb-2 w-full rounded border px-3 py-2 text-sm"
          placeholder="Resolution note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            onClick={() => void patchStatus("UNDER_REVIEW")}
          >
            Under review
          </button>
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            onClick={() => void patchStatus("CLOSED")}
          >
            Close
          </button>
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            onClick={() => void patchStatus("ESCALATED")}
          >
            Escalate
          </button>
        </div>
      </div>
    </div>
  );
}
