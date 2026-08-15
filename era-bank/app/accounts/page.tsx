"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  EraListFilterBar,
  Field,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  showApiError,
  useDebouncedValue,
} from "@era/satellite-kit/ui";
import { BankDataGrid } from "@/components/BankDataGrid";
import { useOpsModal } from "@/components/ops";
import { AccountDetailModal, AccountOpenModal } from "@/components/ops/modals/AccountModals";
import { StatusBadge, formatAznMinor, maskIban } from "@/components/ops-ui";

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
  const debouncedCustomer = useDebouncedValue(customerId, 300);
  const debouncedIban = useDebouncedValue(iban, 300);
  const [rows, setRows] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (debouncedCustomer.trim()) params.set("customerId", debouncedCustomer.trim());
    if (debouncedIban.trim()) params.set("iban", debouncedIban.trim());
    try {
      const res = await fetch(`/api/accounts?${params}`, { cache: "no-store" });
      if (!res.ok) {
        showApiError(tCommon("error"));
        setRows([]);
        return;
      }
      setRows((await res.json()) as Account[]);
    } catch {
      showApiError(tCommon("error"));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedCustomer, debouncedIban, tCommon]);

  useEffect(() => {
    void load();
  }, [load]);

  const gridRows = useMemo(
    () => rows as Array<Account & Record<string, unknown>>,
    [rows],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            onClick={() => modal.open("create")}
          >
            {t("openAccount")}
          </button>
        }
      />
      <EraListFilterBar
        resetLabel={tCommon("filterReset")}
        onReset={() => {
          setCustomerId("");
          setIban("");
        }}
      >
        <Field
          label={t("filterCustomer")}
          preset="longText"
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
        />
        <Field
          label={t("filterIban")}
          preset="longText"
          value={iban}
          onChange={(e) => setIban(e.target.value)}
        />
      </EraListFilterBar>
      {loading ? (
        <p className="text-sm text-muted-foreground">{tCommon("loading")}</p>
      ) : (
        <BankDataGrid
          columns={[
            {
              key: "iban",
              header: t("colIban"),
              render: (row) => (
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() => modal.open("detail", String(row.id))}
                >
                  {row.iban ? maskIban(String(row.iban)) : String(row.id).slice(0, 10)}
                </button>
              ),
            },
            {
              key: "status",
              header: t("colStatus"),
              render: (row) =>
                row.status ? <StatusBadge status={String(row.status)} /> : "—",
            },
            {
              key: "ledgerBalanceMinor",
              header: t("colBalance"),
              render: (row) =>
                formatAznMinor(row.ledgerBalanceMinor ?? row.balanceMinor),
            },
            {
              key: "availableBalanceMinor",
              header: t("colAvailable"),
              render: (row) =>
                formatAznMinor(row.availableBalanceMinor ?? row.availableMinor),
            },
          ]}
          rows={gridRows}
          emptyLabel={tCommon("empty")}
        />
      )}
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
    <Suspense
      fallback={
        <p className="text-sm text-muted-foreground">{tCommon("loading")}</p>
      }
    >
      <AccountsPageContent />
    </Suspense>
  );
}
