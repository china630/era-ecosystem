"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CARD_CONTAINER_CLASS, PageHeader, SECONDARY_BUTTON_CLASS } from "@era/satellite-kit/ui";
import { OpsDataTable, useOpsModal } from "@/components/ops";
import { AccountDetailModal, AccountOpenModal } from "@/components/ops/modals/AccountModals";
import { OpsError, StatusBadge, formatAznMinor, maskIban } from "@/components/ops-ui";

type Account = {
  id: string;
  iban?: string;
  customerId?: string;
  branchId?: string;
  currency?: string;
  status?: string;
  balanceMinor?: unknown;
  availableMinor?: unknown;
  ledgerBalanceMinor?: unknown;
  availableBalanceMinor?: unknown;
};

function AccountsPageContent() {
  const t = useTranslations("pages.accounts");
  const tCommon = useTranslations("common");
  const modal = useOpsModal();
  const [customerId, setCustomerId] = useState("");
  const [iban, setIban] = useState("");
  const [rows, setRows] = useState<Account[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (customerId.trim()) params.set("customerId", customerId.trim());
    if (iban.trim()) params.set("iban", iban.trim());
    try {
      const res = await fetch(`/api/accounts?${params}`, { cache: "no-store" });
      if (!res.ok) {
        setError(`${tCommon("error")} (${res.status})`);
        return;
      }
      setRows((await res.json()) as Account[]);
    } catch {
      setError(tCommon("error"));
    } finally {
      setLoading(false);
    }
  }, [customerId, iban, tCommon]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className={`${CARD_CONTAINER_CLASS} flex flex-wrap gap-3`}>
        <input
          className="rounded border px-3 py-2 text-sm"
          placeholder={t("filterCustomer")}
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
        />
        <input
          className="rounded border px-3 py-2 text-sm"
          placeholder={t("filterIban")}
          value={iban}
          onChange={(e) => setIban(e.target.value)}
        />
        <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void load()}>
          {tCommon("refresh")}
        </button>
      </div>
      <OpsError message={error} />
      <div className={CARD_CONTAINER_CLASS}>
        {loading ? <p className="text-sm text-muted-foreground">{tCommon("loading")}</p> : null}
        {!loading ? (
          <OpsDataTable
            rows={rows}
            addLabel={t("openAccount")}
            onAdd={() => modal.open("create")}
            emptyLabel={tCommon("empty")}
            onRowClick={(row) => modal.open("detail", row.id)}
            columns={[
              {
                key: "iban",
                label: "IBAN",
                render: (row) => (
                  <span className="text-primary">
                    {row.iban ? maskIban(row.iban) : row.id.slice(0, 10)}
                  </span>
                ),
              },
              {
                key: "status",
                label: "Status",
                render: (row) => (row.status ? <StatusBadge status={row.status} /> : "—"),
              },
              {
                key: "ledgerBalanceMinor",
                label: "Balance",
                render: (row) => formatAznMinor(row.ledgerBalanceMinor ?? row.balanceMinor),
              },
              {
                key: "availableBalanceMinor",
                label: "Available",
                render: (row) => formatAznMinor(row.availableBalanceMinor ?? row.availableMinor),
              },
            ]}
          />
        ) : null}
      </div>
      <AccountOpenModal
        open={modal.mode === "create"}
        onClose={modal.close}
        onCreated={(id) => {
          void load();
          modal.open("detail", id);
        }}
      />
      <AccountDetailModal
        open={modal.mode === "detail"}
        accountId={modal.entityId}
        onClose={modal.close}
        onClosed={() => void load()}
      />
    </div>
  );
}

export default function AccountsPage() {
  const tCommon = useTranslations("common");
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">{tCommon("loading")}</p>}>
      <AccountsPageContent />
    </Suspense>
  );
}
