"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import {
  CARD_CONTAINER_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { OpsDataTable, OpsModalShell, useOpsModal } from "@/components/ops";
import { OpsError, OpsResult, StatusBadge } from "@/components/ops-ui";

type FxDeal = {
  id: string;
  status?: string;
  baseCurrency?: string;
  quoteCurrency?: string;
  baseAmountMinor?: unknown;
  quoteAmountMinor?: unknown;
  rate?: unknown;
  valueDate?: string;
};

function FxDealsPageInner() {
  const [rows, setRows] = useState<FxDeal[]>([]);
  const [detail, setDetail] = useState<FxDeal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [bookResult, setBookResult] = useState("");
  const [actionResult, setActionResult] = useState("");
  const { mode, entityId, open, close, isOpen } = useOpsModal();

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/treasury/fx-deals", { cache: "no-store" });
      if (!res.ok) {
        setError(`Request failed (${res.status})`);
        return;
      }
      setRows((await res.json()) as FxDeal[]);
    } catch {
      setError("Request failed");
    }
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/treasury/fx-deals/${id}`, { cache: "no-store" });
      if (res.ok) setDetail((await res.json()) as FxDeal);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (mode === "detail" && entityId) {
      void loadDetail(entityId);
    } else {
      setDetail(null);
      setActionResult("");
    }
  }, [mode, entityId, loadDetail]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const form = new FormData(e.currentTarget);
    const baseMinor = Number(form.get("baseMinor") ?? 100000);
    const rate = Number(form.get("rate") ?? 1.7);
    try {
      const res = await fetch("/api/treasury/fx-deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseCurrency: "USD",
          quoteCurrency: "AZN",
          baseAmountMinor: String(baseMinor),
          quoteAmountMinor: String(Math.round(baseMinor * rate)),
          rate,
          valueDate: new Date().toISOString(),
          idempotencyKey: `fx-ui-${Date.now()}`,
        }),
      });
      setBookResult(await res.text());
      if (res.ok) await load();
    } finally {
      setBusy(false);
    }
  }

  async function settleDeal() {
    if (!entityId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/treasury/fx-deals/${entityId}/settle`, { method: "POST" });
      setActionResult(await res.text());
      if (res.ok) {
        await loadDetail(entityId);
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  async function cancelDeal() {
    if (!entityId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/treasury/fx-deals/${entityId}/cancel`, { method: "POST" });
      setActionResult(await res.text());
      if (res.ok) {
        await loadDetail(entityId);
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  function formatMinor(minor: unknown, currency = ""): string {
    const n = Number(minor ?? 0);
    return `${(n / 100).toFixed(2)} ${currency}`;
  }

  return (
    <div className="space-y-6">
      <Link href="/treasury" className="text-sm text-primary">
        ← Treasury
      </Link>
      <PageHeader title="FX deals" subtitle="Spot booking via posting engine" />
      <form onSubmit={submit} className={CARD_CONTAINER_CLASS}>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            name="baseMinor"
            type="number"
            placeholder="USD minor (100000 = 1000 USD)"
            defaultValue={100000}
            className="rounded border px-3 py-2 text-sm"
          />
          <input
            name="rate"
            type="number"
            step="0.0001"
            placeholder="rate"
            defaultValue={1.7}
            className="rounded border px-3 py-2 text-sm"
          />
        </div>
        <button type="submit" className={`${PRIMARY_BUTTON_CLASS} mt-4`} disabled={busy}>
          Book spot deal
        </button>
        <OpsResult text={bookResult} />
      </form>

      <OpsError message={error} />
      <div className={CARD_CONTAINER_CLASS}>
        <div className="mb-3 flex justify-end">
          <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void load()}>
            Refresh
          </button>
        </div>
        <OpsDataTable
          rows={rows}
          emptyLabel="No FX deals"
          onRowClick={(row) => open("detail", row.id)}
          columns={[
            {
              key: "id",
              label: "ID",
              render: (row) => `${row.id.slice(0, 10)}…`,
            },
            {
              key: "status",
              label: "Status",
              render: (row) => (row.status ? <StatusBadge status={row.status} /> : "—"),
            },
            {
              key: "pair",
              label: "Pair",
              render: (row) => `${row.baseCurrency ?? "—"}/${row.quoteCurrency ?? "—"}`,
            },
            {
              key: "baseAmountMinor",
              label: "Base",
              render: (row) => formatMinor(row.baseAmountMinor, row.baseCurrency),
            },
            {
              key: "rate",
              label: "Rate",
              render: (row) => String(row.rate ?? "—"),
            },
          ]}
        />
      </div>

      <OpsModalShell
        open={isOpen && mode === "detail"}
        title="FX deal detail"
        subtitle={entityId ?? undefined}
        onClose={close}
        hideFooter
        maxWidthClass="max-w-2xl"
      >
        {detail ? (
          <div className="space-y-4 text-sm">
            <dl className="grid gap-2 sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Status</dt>
                <dd>{detail.status ? <StatusBadge status={detail.status} /> : "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Pair</dt>
                <dd>
                  {detail.baseCurrency}/{detail.quoteCurrency}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Base amount</dt>
                <dd>{formatMinor(detail.baseAmountMinor, detail.baseCurrency)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Quote amount</dt>
                <dd>{formatMinor(detail.quoteAmountMinor, detail.quoteCurrency)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Value date</dt>
                <dd>{detail.valueDate?.slice(0, 10) ?? "—"}</dd>
              </div>
            </dl>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={PRIMARY_BUTTON_CLASS} disabled={busy} onClick={() => void settleDeal()}>
                Settle
              </button>
              <button type="button" className={SECONDARY_BUTTON_CLASS} disabled={busy} onClick={() => void cancelDeal()}>
                Cancel
              </button>
            </div>
            <OpsResult text={actionResult} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Loading…</p>
        )}
      </OpsModalShell>
    </div>
  );
}

export default function FxDealsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <FxDealsPageInner />
    </Suspense>
  );
}
