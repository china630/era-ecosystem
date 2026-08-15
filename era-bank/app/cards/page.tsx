"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  CatalogField,
  Field,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { OpsDataTable, OpsModalShell, useOpsModal } from "@/components/ops";
import { OpsError, OpsResult, StatusBadge } from "@/components/ops-ui";
import {
  loadAccountOptions,
  loadBranchOptions,
  loadCustomerOptions,
  loadProductTemplateOptions,
  majorToMinor,
  type LookupOption,
  withOrphanOption,
} from "@/lib/bank-lookups";

type CardRow = {
  id: string;
  status?: string;
  panLast4?: string;
  bin6?: string;
  customerId?: string;
  accountId?: string;
  cardToken?: string;
  limitsJson?: Record<string, unknown>;
  blockReason?: string | null;
};

function CardsPageInner() {
  const t = useTranslations("pages.cards");
  const tCommon = useTranslations("common");
  const { mode, entityId, open, close, isOpen } = useOpsModal();
  const [rows, setRows] = useState<CardRow[]>([]);
  const [detail, setDetail] = useState<CardRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionResult, setActionResult] = useState("");
  const [limitsOpen, setLimitsOpen] = useState(false);
  const [dailyLimitMajor, setDailyLimitMajor] = useState("5000");
  const [perTxnMaxMajor, setPerTxnMaxMajor] = useState("2000");
  const [customers, setCustomers] = useState<LookupOption[]>([]);
  const [accounts, setAccounts] = useState<LookupOption[]>([]);
  const [branches, setBranches] = useState<LookupOption[]>([]);
  const [products, setProducts] = useState<LookupOption[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [productTemplateId, setProductTemplateId] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/cards", { cache: "no-store" });
      if (!res.ok) {
        setError(`${tCommon("error")} (${res.status})`);
        return;
      }
      setRows((await res.json()) as CardRow[]);
    } catch {
      setError(tCommon("error"));
    }
  }, [tCommon]);

  const loadDetail = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/cards/${id}`, { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as CardRow;
        setDetail(data);
        const limits = data.limitsJson as Record<string, number> | undefined;
        if (limits?.dailySpendLimitMinor != null) {
          setDailyLimitMajor(String(limits.dailySpendLimitMinor / 100));
        }
        if (limits?.perTxnMaxMinor != null) {
          setPerTxnMaxMajor(String(limits.perTxnMaxMinor / 100));
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (mode !== "create") return;
    void Promise.all([
      loadCustomerOptions(),
      loadBranchOptions(),
      loadProductTemplateOptions("CARD"),
    ]).then(([c, b, p]) => {
      setCustomers(c);
      setBranches(b);
      setProducts(p);
    });
  }, [mode]);

  useEffect(() => {
    if (!customerId) {
      setAccounts([]);
      return;
    }
    void loadAccountOptions(customerId).then(setAccounts);
  }, [customerId]);

  useEffect(() => {
    if (mode === "detail" && entityId) {
      void loadDetail(entityId);
    } else {
      setDetail(null);
      setActionResult("");
      setLimitsOpen(false);
    }
  }, [mode, entityId, loadDetail]);

  async function issueCard(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          accountId,
          branchId,
          productTemplateId,
        }),
      });
      if (!res.ok) {
        setError(`${tCommon("error")} (${res.status})`);
        return;
      }
      close();
      await load();
    } catch {
      setError(tCommon("error"));
    } finally {
      setBusy(false);
    }
  }

  async function blockCard() {
    if (!entityId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/cards/${entityId}/block`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Ops block" }),
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

  async function unblockCard() {
    if (!entityId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/cards/${entityId}/unblock`, { method: "POST" });
      setActionResult(await res.text());
      if (res.ok) {
        await loadDetail(entityId);
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  async function saveLimits(e: React.FormEvent) {
    e.preventDefault();
    if (!entityId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/cards/${entityId}/limits`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          limitsJson: {
            dailySpendLimitMinor: majorToMinor(dailyLimitMajor),
            perTxnMaxMinor: majorToMinor(perTxnMaxMajor),
          },
        }),
      });
      setActionResult(await res.text());
      if (res.ok) {
        setLimitsOpen(false);
        await loadDetail(entityId);
      }
    } finally {
      setBusy(false);
    }
  }

  async function closeCard() {
    if (!entityId || !window.confirm("Close this card permanently?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/cards/${entityId}/close`, { method: "POST" });
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
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className={`${CARD_CONTAINER_CLASS} flex flex-wrap gap-3`}>
        <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void load()}>
          {tCommon("refresh")}
        </button>
        <Link href="/card-txns" className="text-sm text-primary underline">
          Card transactions
        </Link>
      </div>
      <OpsError message={error} />
      <div className={CARD_CONTAINER_CLASS}>
        <OpsDataTable
          rows={rows}
          emptyLabel={tCommon("empty")}
          addLabel="Issue card"
          onAdd={() => open("create")}
          onRowClick={(row) => open("detail", row.id)}
          columns={[
            {
              key: "panLast4",
              label: "PAN",
              render: (row) => (row.bin6 && row.panLast4 ? `${row.bin6}…${row.panLast4}` : "—"),
            },
            {
              key: "status",
              label: "Status",
              render: (row) => (row.status ? <StatusBadge status={row.status} /> : "—"),
            },
            { key: "customerId", label: "Customer" },
            { key: "accountId", label: "Account" },
          ]}
        />
      </div>

      <OpsModalShell
        open={isOpen && mode === "create"}
        title="Issue card"
        subtitle="Debit card on customer current account"
        onClose={close}
        formId="issue-card-form"
        submitLabel="Issue card"
        busy={busy}
      >
        <form id="issue-card-form" onSubmit={(e) => void issueCard(e)} className="grid gap-3 sm:grid-cols-2">
          <CatalogField
            kind="ENTITY_REF"
            label="Customer"
            options={withOrphanOption(customers, customerId)}
            value={customerId}
            onChange={(next) => {
              setCustomerId(Array.isArray(next) ? next[0] ?? "" : next);
              setAccountId("");
            }}
            required
          />
          <CatalogField
            kind="ENTITY_REF"
            label="Account"
            options={withOrphanOption(accounts, accountId)}
            value={accountId}
            onChange={(next) =>
              setAccountId(Array.isArray(next) ? next[0] ?? "" : next)
            }
            required
          />
          <CatalogField
            kind="ENTITY_REF"
            label="Branch"
            options={withOrphanOption(branches, branchId)}
            value={branchId}
            onChange={(next) =>
              setBranchId(Array.isArray(next) ? next[0] ?? "" : next)
            }
            required
          />
          <CatalogField
            kind="ENTITY_REF"
            label="Card product"
            options={withOrphanOption(products, productTemplateId)}
            value={productTemplateId}
            onChange={(next) =>
              setProductTemplateId(Array.isArray(next) ? next[0] ?? "" : next)
            }
            required
          />
        </form>
      </OpsModalShell>

      <OpsModalShell
        open={isOpen && mode === "detail"}
        title="Card detail"
        subtitle={detail?.panLast4 ? `•••• ${detail.panLast4}` : entityId ?? undefined}
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
                <dt className="text-muted-foreground">Token</dt>
                <dd className="font-mono text-xs">{detail.cardToken ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Customer</dt>
                <dd>{detail.customerId ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Account</dt>
                <dd>{detail.accountId ?? "—"}</dd>
              </div>
            </dl>
            {detail.blockReason ? (
              <p className="text-destructive">Block reason: {detail.blockReason}</p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <button type="button" className={SECONDARY_BUTTON_CLASS} disabled={busy} onClick={() => void blockCard()}>
                Block
              </button>
              <button type="button" className={SECONDARY_BUTTON_CLASS} disabled={busy} onClick={() => void unblockCard()}>
                Unblock
              </button>
              <button type="button" className={SECONDARY_BUTTON_CLASS} disabled={busy} onClick={() => setLimitsOpen(true)}>
                Edit limits
              </button>
              <button type="button" className={PRIMARY_BUTTON_CLASS} disabled={busy} onClick={() => void closeCard()}>
                Close card
              </button>
            </div>
            <OpsResult text={actionResult} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{tCommon("loading")}</p>
        )}
      </OpsModalShell>

      <OpsModalShell
        open={limitsOpen}
        title="Card limits"
        onClose={() => setLimitsOpen(false)}
        formId="card-limits-form"
        submitLabel="Save limits"
        busy={busy}
      >
        <form id="card-limits-form" onSubmit={(e) => void saveLimits(e)} className="space-y-4">
          <Field
            label={t("dailySpendLimitMajor")}
            preset="amount"
            type="number"
            step="0.01"
            value={dailyLimitMajor}
            onChange={(e) => setDailyLimitMajor(e.target.value)}
          />
          <Field
            label={t("perTxnMaxMajor")}
            preset="amount"
            type="number"
            step="0.01"
            value={perTxnMaxMajor}
            onChange={(e) => setPerTxnMaxMajor(e.target.value)}
          />
        </form>
      </OpsModalShell>
    </div>
  );
}

export default function CardsPage() {
  const tCommon = useTranslations("common");
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">{tCommon("loading")}</p>}>
      <CardsPageInner />
    </Suspense>
  );
}
