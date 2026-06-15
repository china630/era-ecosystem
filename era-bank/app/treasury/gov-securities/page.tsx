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
import { OpsError, OpsResult, StatusBadge, formatAznMinor } from "@/components/ops-ui";

type GovSecurityRow = {
  id: string;
  status?: string;
  isin?: string;
  faceValueMinor?: unknown;
  bookValueMinor?: unknown;
  maturityDate?: string;
};

function GovSecuritiesPageInner() {
  const [rows, setRows] = useState<GovSecurityRow[]>([]);
  const [detail, setDetail] = useState<GovSecurityRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [createResult, setCreateResult] = useState("");
  const [actionResult, setActionResult] = useState("");
  const { mode, entityId, open, close, isOpen } = useOpsModal();

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/treasury/gov-securities", { cache: "no-store" });
      if (!res.ok) {
        setError(`Request failed (${res.status})`);
        return;
      }
      setRows((await res.json()) as GovSecurityRow[]);
    } catch {
      setError("Request failed");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (mode === "detail" && entityId) {
      setDetail(rows.find((r) => r.id === entityId) ?? null);
      setActionResult("");
    } else {
      setDetail(null);
    }
  }, [mode, entityId, rows]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/treasury/gov-securities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isin: form.get("isin"),
          faceValueMinor: form.get("faceValueMinor"),
          bookValueMinor: form.get("bookValueMinor"),
          currency: "AZN",
          maturityDate: form.get("maturityDate"),
          idempotencyKey: `gs-ui-${Date.now()}`,
        }),
      });
      setCreateResult(await res.text());
      if (res.ok) await load();
    } finally {
      setBusy(false);
    }
  }

  async function maturePosition() {
    if (!entityId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/treasury/gov-securities/${entityId}/mature`, { method: "POST" });
      setActionResult(await res.text());
      if (res.ok) {
        close();
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link href="/treasury" className="text-sm text-primary">
        ← Treasury
      </Link>
      <PageHeader title="Government securities" subtitle="Manual position entry (stub)" />
      <form onSubmit={submit} className={CARD_CONTAINER_CLASS}>
        <div className="grid gap-3 sm:grid-cols-2">
          <input name="isin" placeholder="ISIN" defaultValue="AZ0000000001" className="rounded border px-3 py-2 text-sm" />
          <input name="faceValueMinor" type="number" defaultValue={10000000} className="rounded border px-3 py-2 text-sm" />
          <input name="bookValueMinor" type="number" defaultValue={9800000} className="rounded border px-3 py-2 text-sm" />
          <input name="maturityDate" type="date" defaultValue="2027-06-14" className="rounded border px-3 py-2 text-sm" />
        </div>
        <button type="submit" className={`${PRIMARY_BUTTON_CLASS} mt-4`} disabled={busy}>
          Record purchase
        </button>
        <OpsResult text={createResult} />
      </form>

      <OpsError message={error} />
      <div className={CARD_CONTAINER_CLASS}>
        <OpsDataTable
          rows={rows}
          emptyLabel="No positions"
          onRowClick={(row) => open("detail", row.id)}
          columns={[
            { key: "isin", label: "ISIN" },
            {
              key: "status",
              label: "Status",
              render: (row) => (row.status ? <StatusBadge status={row.status} /> : "—"),
            },
            {
              key: "faceValueMinor",
              label: "Face value",
              render: (row) => formatAznMinor(row.faceValueMinor),
            },
            {
              key: "maturityDate",
              label: "Maturity",
              render: (row) => row.maturityDate?.slice(0, 10) ?? "—",
            },
          ]}
        />
      </div>

      <OpsModalShell
        open={isOpen && mode === "detail"}
        title="Gov security position"
        subtitle={detail?.isin ?? entityId ?? undefined}
        onClose={close}
        hideFooter
      >
        {detail ? (
          <div className="space-y-4 text-sm">
            <dl className="grid gap-2 sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Status</dt>
                <dd>{detail.status ? <StatusBadge status={detail.status} /> : "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">ISIN</dt>
                <dd>{detail.isin ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Face value</dt>
                <dd>{formatAznMinor(detail.faceValueMinor)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Book value</dt>
                <dd>{formatAznMinor(detail.bookValueMinor)}</dd>
              </div>
            </dl>
            <button type="button" className={PRIMARY_BUTTON_CLASS} disabled={busy} onClick={() => void maturePosition()}>
              Mature position
            </button>
            <OpsResult text={actionResult} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Loading…</p>
        )}
      </OpsModalShell>
    </div>
  );
}

export default function GovSecuritiesPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <GovSecuritiesPageInner />
    </Suspense>
  );
}
