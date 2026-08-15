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
import { OpsError, OpsField, OpsResult, StatusBadge, formatAznMinor } from "@/components/ops-ui";

type CardTxn = {
  id: string;
  status?: string;
  type?: string;
  amountMinor?: unknown;
  currency?: string;
  merchantName?: string | null;
  processorRef?: string;
  cardId?: string;
};

function CardTxnsPageInner() {
  const t = useTranslations("pages.cardTxns");
  const tCommon = useTranslations("common");
  const { mode, entityId, open, close, isOpen } = useOpsModal();
  const [rows, setRows] = useState<CardTxn[]>([]);
  const [detail, setDetail] = useState<CardTxn | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionResult, setActionResult] = useState("");
  const [acquiringOpen, setAcquiringOpen] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/card-txns", { cache: "no-store" });
      if (!res.ok) {
        setError(`${tCommon("error")} (${res.status})`);
        return;
      }
      setRows((await res.json()) as CardTxn[]);
    } catch {
      setError(tCommon("error"));
    }
  }, [tCommon]);

  const loadDetail = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/card-txns/${id}`, { cache: "no-store" });
      if (res.ok) setDetail((await res.json()) as CardTxn);
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

  async function authorizeDemo(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/card-txns/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId: form.get("cardId") || undefined,
          cardToken: form.get("cardToken") || undefined,
          amountMinor: String(form.get("amountMinor") ?? 10000),
          currency: form.get("currency") ?? "AZN",
          processorRef: form.get("processorRef") ?? `auth-${Date.now()}`,
          merchantName: form.get("merchantName") || undefined,
          mcc: form.get("mcc") || undefined,
        }),
      });
      setActionResult(await res.text());
      if (res.ok) {
        close();
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  async function captureTxn() {
    if (!entityId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/card-txns/${entityId}/capture`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      setActionResult(await res.text());
      if (res.ok) {
        await loadDetail(entityId);
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  async function reverseTxn() {
    if (!entityId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/card-txns/${entityId}/reverse`, { method: "POST" });
      setActionResult(await res.text());
      if (res.ok) {
        await loadDetail(entityId);
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  async function acquiringAuthorize(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/cards/acquiring/inbound/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardToken: form.get("cardToken"),
          amountMinor: String(form.get("amountMinor") ?? 10000),
          currency: form.get("currency") ?? "AZN",
          processorRef: form.get("processorRef") ?? `acq-${Date.now()}`,
          merchantName: form.get("merchantName") || undefined,
          mcc: form.get("mcc") || undefined,
        }),
      });
      setActionResult(await res.text());
      if (res.ok) {
        setAcquiringOpen(false);
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className={`${CARD_CONTAINER_CLASS} flex flex-wrap gap-3`}>
        <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void load()}>
          {tCommon("refresh")}
        </button>
        <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => open("create")}>
          Demo authorize
        </button>
        <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => setAcquiringOpen(true)}>
          Acquiring inbound
        </button>
        <Link href="/cards" className="text-sm text-primary underline">
          Back to cards
        </Link>
      </div>
      <OpsError message={error} />
      <div className={CARD_CONTAINER_CLASS}>
        <OpsDataTable
          rows={rows}
          emptyLabel={tCommon("empty")}
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
            { key: "type", label: "Type" },
            {
              key: "amountMinor",
              label: "Amount",
              render: (row) => formatAznMinor(row.amountMinor),
            },
            { key: "merchantName", label: "Merchant" },
          ]}
        />
      </div>

      <OpsModalShell
        open={isOpen && mode === "create"}
        title="Demo authorize"
        subtitle="Staff ops authorization path"
        onClose={close}
        formId="card-auth-form"
        submitLabel="Authorize"
        busy={busy}
      >
        <form id="card-auth-form" onSubmit={(e) => void authorizeDemo(e)} className="grid gap-3 sm:grid-cols-2">
          <OpsField name="cardId" label="Card ID (optional if token set)" />
          <OpsField name="cardToken" label="Card token" />
          <OpsField name="amountMinor" label="Amount (minor)" type="number" defaultValue={10000} />
          <OpsField name="currency" label="Currency" defaultValue="AZN" />
          <OpsField name="processorRef" label="Processor ref" defaultValue={`auth-${Date.now()}`} />
          <OpsField name="merchantName" label="Merchant" defaultValue="Demo Merchant" />
          <OpsField name="mcc" label="MCC" defaultValue="5411" />
        </form>
      </OpsModalShell>

      <OpsModalShell
        open={isOpen && mode === "detail"}
        title="Card transaction"
        subtitle={detail?.processorRef ?? entityId ?? undefined}
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
                <dt className="text-muted-foreground">Type</dt>
                <dd>{detail.type ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Amount</dt>
                <dd>{formatAznMinor(detail.amountMinor)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Card</dt>
                <dd className="font-mono text-xs">{detail.cardId ?? "—"}</dd>
              </div>
            </dl>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={PRIMARY_BUTTON_CLASS} disabled={busy} onClick={() => void captureTxn()}>
                Capture
              </button>
              <button type="button" className={SECONDARY_BUTTON_CLASS} disabled={busy} onClick={() => void reverseTxn()}>
                Reverse
              </button>
            </div>
            <OpsResult text={actionResult} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{tCommon("loading")}</p>
        )}
      </OpsModalShell>

      <OpsModalShell
        open={acquiringOpen}
        title="Acquiring inbound authorize"
        subtitle="Stub AzeriCard inbound path"
        onClose={() => setAcquiringOpen(false)}
        formId="acquiring-form"
        submitLabel="Authorize inbound"
        busy={busy}
      >
        <form id="acquiring-form" onSubmit={(e) => void acquiringAuthorize(e)} className="grid gap-3 sm:grid-cols-2">
          <OpsField name="cardToken" label="Card token" />
          <OpsField name="amountMinor" label="Amount (minor)" type="number" defaultValue={10000} />
          <OpsField name="currency" label="Currency" defaultValue="AZN" />
          <OpsField name="processorRef" label="Processor ref" defaultValue={`acq-${Date.now()}`} />
          <OpsField name="merchantName" label="Merchant" defaultValue="POS Terminal" />
          <OpsField name="mcc" label="MCC" defaultValue="5812" />
        </form>
        <OpsResult text={actionResult} />
      </OpsModalShell>
    </div>
  );
}

export default function CardTxnsPage() {
  const tCommon = useTranslations("common");
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">{tCommon("loading")}</p>}>
      <CardTxnsPageInner />
    </Suspense>
  );
}
