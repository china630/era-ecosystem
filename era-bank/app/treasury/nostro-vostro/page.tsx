"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { OpsDataTable, OpsModalShell, useOpsModal } from "@/components/ops";
import { OpsError, OpsResult, StatusBadge, formatAznMinor } from "@/components/ops-ui";

type NostroRow = {
  id: string;
  direction?: string;
  iban?: string;
  currency?: string;
  ledgerBalanceMinor?: unknown;
  status?: string;
  counterpartyId?: string | null;
};

type StatementLine = {
  id?: string;
  narrative?: string;
  amountMinor?: unknown;
  valueDate?: string;
};

function NostroVostroPageInner() {
  const tCommon = useTranslations("common");
  const { mode, entityId, open, close, isOpen } = useOpsModal();
  const [rows, setRows] = useState<NostroRow[]>([]);
  const [detail, setDetail] = useState<NostroRow | null>(null);
  const [statement, setStatement] = useState<StatementLine[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionResult, setActionResult] = useState("");
  const [statementBalance, setStatementBalance] = useState("0");

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/treasury/nostro-vostro", { cache: "no-store" });
      if (!res.ok) {
        setError(`${tCommon("error")} (${res.status})`);
        return;
      }
      setRows((await res.json()) as NostroRow[]);
    } catch {
      setError(tCommon("error"));
    }
  }, [tCommon]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (mode === "detail" && entityId) {
      const row = rows.find((r) => r.id === entityId) ?? null;
      setDetail(row);
      setStatement(null);
      setActionResult("");
      if (row?.ledgerBalanceMinor != null) {
        setStatementBalance(String(row.ledgerBalanceMinor));
      }
    } else {
      setDetail(null);
      setStatement(null);
    }
  }, [mode, entityId, rows]);

  async function loadStatement() {
    if (!entityId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/treasury/nostro-vostro/${entityId}/statement`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setStatement(Array.isArray(data?.lines) ? (data.lines as StatementLine[]) : (data as StatementLine[]));
      } else {
        setActionResult(await res.text());
      }
    } finally {
      setBusy(false);
    }
  }

  async function reconcile(e: React.FormEvent) {
    e.preventDefault();
    if (!entityId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/treasury/nostro-vostro/${entityId}/reconcile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statementBalanceMinor: statementBalance }),
      });
      setActionResult(await res.text());
      if (res.ok) {
        await load();
        setDetail(rows.find((r) => r.id === entityId) ?? null);
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
      <PageHeader title="Nostro / Vostro" subtitle="Correspondent account registry" />
      <div className={`${CARD_CONTAINER_CLASS} flex gap-3`}>
        <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void load()}>
          {tCommon("refresh")}
        </button>
      </div>
      <OpsError message={error} />
      <div className={CARD_CONTAINER_CLASS}>
        <OpsDataTable
          rows={rows}
          emptyLabel={tCommon("empty")}
          onRowClick={(row) => open("detail", row.id)}
          columns={[
            { key: "iban", label: "IBAN" },
            { key: "direction", label: "Direction" },
            { key: "currency", label: "CCY" },
            {
              key: "ledgerBalanceMinor",
              label: "Balance",
              render: (row) => formatAznMinor(row.ledgerBalanceMinor),
            },
            {
              key: "status",
              label: "Status",
              render: (row) => (row.status ? <StatusBadge status={row.status} /> : "—"),
            },
          ]}
        />
      </div>

      <OpsModalShell
        open={isOpen && mode === "detail"}
        title="Correspondent account"
        subtitle={detail?.iban ?? entityId ?? undefined}
        onClose={close}
        hideFooter
        maxWidthClass="max-w-2xl"
      >
        {detail ? (
          <div className="space-y-4 text-sm">
            <dl className="grid gap-2 sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Direction</dt>
                <dd>{detail.direction ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Ledger balance</dt>
                <dd>{formatAznMinor(detail.ledgerBalanceMinor)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Counterparty</dt>
                <dd>{detail.counterpartyId ?? "—"}</dd>
              </div>
            </dl>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={SECONDARY_BUTTON_CLASS} disabled={busy} onClick={() => void loadStatement()}>
                Load statement
              </button>
            </div>
            {statement ? (
              <div className="max-h-48 overflow-auto rounded border">
                <table className="min-w-full text-xs">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="px-2 py-1 text-left">Date</th>
                      <th className="px-2 py-1 text-left">Narrative</th>
                      <th className="px-2 py-1 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statement.map((line, idx) => (
                      <tr key={line.id ?? idx} className="border-t">
                        <td className="px-2 py-1">{line.valueDate?.slice(0, 10) ?? "—"}</td>
                        <td className="px-2 py-1">{line.narrative ?? "—"}</td>
                        <td className="px-2 py-1 text-right">{formatAznMinor(line.amountMinor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            <form onSubmit={(e) => void reconcile(e)} className="space-y-3 rounded border p-3">
              <h4 className="font-medium">Reconcile</h4>
              <label className="block">
                <span className="mb-1 block text-[12px] text-muted-foreground">Statement balance (minor)</span>
                <input
                  className="w-full rounded border px-3 py-2 text-sm"
                  type="number"
                  value={statementBalance}
                  onChange={(e) => setStatementBalance(e.target.value)}
                />
              </label>
              <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={busy}>
                Reconcile
              </button>
            </form>
            <OpsResult text={actionResult} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{tCommon("loading")}</p>
        )}
      </OpsModalShell>
    </div>
  );
}

export default function NostroVostroPage() {
  const tCommon = useTranslations("common");
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">{tCommon("loading")}</p>}>
      <NostroVostroPageInner />
    </Suspense>
  );
}
