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

type InterbankRow = {
  id: string;
  status?: string;
  counterpartyId?: string;
  principalMinor?: unknown;
  currency?: string;
  rateAnnual?: unknown;
  maturityDate?: string;
};

function InterbankPageInner() {
  const [nostroId, setNostroId] = useState("");
  const [cpId, setCpId] = useState("");
  const [rows, setRows] = useState<InterbankRow[]>([]);
  const [detail, setDetail] = useState<InterbankRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [createResult, setCreateResult] = useState("");
  const [actionResult, setActionResult] = useState("");
  const { mode, entityId, open, close, isOpen } = useOpsModal();

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/treasury/interbank", { cache: "no-store" });
      if (!res.ok) {
        setError(`Request failed (${res.status})`);
        return;
      }
      setRows((await res.json()) as InterbankRow[]);
    } catch {
      setError("Request failed");
    }
  }, []);

  useEffect(() => {
    fetch("/api/treasury/nostro-vostro")
      .then((r) => r.json())
      .then((list) => {
        if (Array.isArray(list) && list[0]) {
          setNostroId(list[0].id);
          setCpId(list[0].counterpartyId ?? "");
        }
      })
      .catch(() => undefined);
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
      const res = await fetch("/api/treasury/interbank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          counterpartyId: form.get("counterpartyId"),
          nostroAccountId: form.get("nostroAccountId"),
          principalMinor: form.get("principalMinor"),
          currency: "AZN",
          rateAnnual: Number(form.get("rateAnnual")),
          startDate: new Date().toISOString(),
          maturityDate: new Date(Date.now() + 7 * 86400000).toISOString(),
          idempotencyKey: `ib-ui-${Date.now()}`,
        }),
      });
      setCreateResult(await res.text());
      if (res.ok) await load();
    } finally {
      setBusy(false);
    }
  }

  async function maturePlacement() {
    if (!entityId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/treasury/interbank/${entityId}/mature`, { method: "POST" });
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
      <PageHeader title="Interbank placements" subtitle="Overnight placement stub" />
      <form onSubmit={submit} className={CARD_CONTAINER_CLASS}>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            name="counterpartyId"
            defaultValue={cpId}
            placeholder="counterpartyId"
            className="rounded border px-3 py-2 text-sm"
          />
          <input
            name="nostroAccountId"
            defaultValue={nostroId}
            placeholder="nostroAccountId"
            className="rounded border px-3 py-2 text-sm"
          />
          <input
            name="principalMinor"
            type="number"
            defaultValue={5000000}
            placeholder="principal minor"
            className="rounded border px-3 py-2 text-sm"
          />
          <input
            name="rateAnnual"
            type="number"
            step="0.001"
            defaultValue={0.08}
            placeholder="rate annual"
            className="rounded border px-3 py-2 text-sm"
          />
        </div>
        <button type="submit" className={`${PRIMARY_BUTTON_CLASS} mt-4`} disabled={busy}>
          Create placement
        </button>
        <OpsResult text={createResult} />
      </form>

      <OpsError message={error} />
      <div className={CARD_CONTAINER_CLASS}>
        <OpsDataTable
          rows={rows}
          emptyLabel="No placements"
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
            { key: "counterpartyId", label: "Counterparty" },
            {
              key: "principalMinor",
              label: "Principal",
              render: (row) => formatAznMinor(row.principalMinor),
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
        title="Interbank placement"
        subtitle={entityId ?? undefined}
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
                <dt className="text-muted-foreground">Counterparty</dt>
                <dd>{detail.counterpartyId ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Principal</dt>
                <dd>{formatAznMinor(detail.principalMinor)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Rate (annual)</dt>
                <dd>{String(detail.rateAnnual ?? "—")}</dd>
              </div>
            </dl>
            <button type="button" className={PRIMARY_BUTTON_CLASS} disabled={busy} onClick={() => void maturePlacement()}>
              Mature placement
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

export default function InterbankPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <InterbankPageInner />
    </Suspense>
  );
}
