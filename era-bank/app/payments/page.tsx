"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  CatalogField,
  EraListFilterBar,
  Field,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  showApiError,
} from "@era/satellite-kit/ui";
import { BankDataGrid } from "@/components/BankDataGrid";
import { OpsModalShell, useOpsModal } from "@/components/ops";
import { useOpsMe } from "@/components/ops/useOpsMe";
import {
  PaymentCreateModal,
  PaymentDetailModal,
} from "@/components/ops/modals/PaymentModals";
import { StatusBadge, formatAznMinor } from "@/components/ops-ui";
import {
  CURRENCY_OPTIONS,
  PAYMENT_STATUS_OPTIONS,
  majorToMinor,
} from "@/lib/bank-lookups";

type Payment = {
  id: string;
  status?: string;
  creditorIban?: string;
  amountMinor?: unknown;
  currency?: string;
  rail?: string;
  createdByUserId?: string;
};

function PaymentsPageInner() {
  const t = useTranslations("pages.payments");
  const tCommon = useTranslations("common");
  const searchParams = useSearchParams();
  const me = useOpsMe();
  const { mode, open, close, entityId } = useOpsModal();
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [inboundCurrency, setInboundCurrency] = useState("AZN");
  const canApprove = me?.canApprove === true;

  useEffect(() => {
    const id = searchParams.get("id");
    if (id) open("detail", id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open once from query
  }, [searchParams]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = status ? `?status=${encodeURIComponent(status)}` : "";
      const res = await fetch(`/api/payments/orders${qs}`, { cache: "no-store" });
      if (!res.ok) {
        showApiError(tCommon("error"));
        setRows([]);
        return;
      }
      setRows((await res.json()) as Payment[]);
    } catch {
      showApiError(tCommon("error"));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [status, tCommon]);

  useEffect(() => {
    void load();
  }, [load]);

  async function registerInbound(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/payments/inbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey:
            form.get("idempotencyKey") ?? `inbound-ui-${Date.now()}`,
          creditorIban: form.get("creditorIban"),
          amountMinor: String(
            majorToMinor(String(form.get("amountMajor") ?? "0")),
          ),
          currency: inboundCurrency,
        }),
      });
      if (!res.ok) {
        showApiError(tCommon("error"));
        return;
      }
      close();
      await load();
    } catch {
      showApiError(tCommon("error"));
    } finally {
      setBusy(false);
    }
  }

  async function approveOrReject(id: string, action: "approve" | "reject") {
    const row = rows.find((r) => r.id === id);
    if (
      row?.createdByUserId &&
      me?.id &&
      row.createdByUserId === me.id
    ) {
      showApiError(t("makerCannotApprove"));
      return;
    }
    let reason: string | undefined;
    if (action === "reject") {
      const entered = window.prompt(t("rejectReason"));
      reason = (entered ?? "").trim();
      if (!reason) {
        showApiError(t("rejectReasonRequired"));
        return;
      }
    }
    const res = await fetch(`/api/payments/orders/${id}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body:
        action === "reject" ? JSON.stringify({ reason }) : undefined,
    });
    if (!res.ok) {
      showApiError(await res.text());
      return;
    }
    await load();
  }

  const gridRows = useMemo(
    () => rows as Array<Payment & Record<string, unknown>>,
    [rows],
  );

  const statusOptions = useMemo(
    () => [{ value: "", label: t("allStatuses") }, ...PAYMENT_STATUS_OPTIONS],
    [t],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              onClick={() => open("inbound")}
            >
              {t("registerInbound")}
            </button>
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              onClick={() => open("create")}
            >
              {t("newPayment")}
            </button>
          </div>
        }
      />
      <EraListFilterBar
        resetLabel={tCommon("filterReset")}
        onReset={() => setStatus("")}
      >
        <CatalogField
          kind="CLOSED_SMALL"
          label={t("statusFilter")}
          options={statusOptions}
          value={status}
          onChange={(next) =>
            setStatus(Array.isArray(next) ? next[0] ?? "" : next)
          }
          emptyLabel={null}
        />
      </EraListFilterBar>
      {loading ? (
        <p className="text-sm text-muted-foreground">{tCommon("loading")}</p>
      ) : (
        <BankDataGrid
          columns={[
            {
              key: "id",
              header: t("colId"),
              render: (row) => (
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() => open("detail", String(row.id))}
                >
                  {String(row.id).slice(0, 10)}…
                </button>
              ),
            },
            {
              key: "status",
              header: t("colStatus"),
              render: (row) =>
                row.status ? <StatusBadge status={String(row.status)} /> : "—",
            },
            { key: "creditorIban", header: t("colBeneficiary") },
            {
              key: "amountMinor",
              header: t("colAmount"),
              render: (row) => formatAznMinor(row.amountMinor),
            },
            { key: "rail", header: t("colRail") },
            {
              key: "actions",
              header: t("colActions"),
              render: (row) => {
                const isMaker =
                  Boolean(row.createdByUserId) &&
                  me?.id === String(row.createdByUserId);
                if (
                  row.status !== "PENDING_APPROVAL" ||
                  !canApprove ||
                  isMaker
                ) {
                  return isMaker && row.status === "PENDING_APPROVAL" ? (
                    <span className="text-xs text-muted-foreground">
                      {t("makerCannotApprove")}
                    </span>
                  ) : (
                    "—"
                  );
                }
                const id = String(row.id);
                return (
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className={PRIMARY_BUTTON_CLASS}
                      onClick={() => void approveOrReject(id, "approve")}
                    >
                      {t("approve")}
                    </button>
                    <button
                      type="button"
                      className={SECONDARY_BUTTON_CLASS}
                      onClick={() => void approveOrReject(id, "reject")}
                    >
                      {t("reject")}
                    </button>
                  </div>
                );
              },
            },
          ]}
          rows={gridRows}
          emptyLabel={tCommon("empty")}
        />
      )}

      <PaymentCreateModal
        open={mode === "create"}
        onClose={close}
        onCreated={(id) => {
          void load();
          open("detail", id);
        }}
      />
      <PaymentDetailModal
        open={mode === "detail"}
        paymentId={entityId}
        onClose={close}
        onUpdated={() => void load()}
      />

      <OpsModalShell
        open={mode === "inbound"}
        title={t("inboundTitle")}
        subtitle={t("inboundSubtitle")}
        onClose={close}
        formId="inbound-payment-form"
        submitLabel={t("registerInbound")}
        busy={busy}
      >
        <form
          id="inbound-payment-form"
          onSubmit={(e) => void registerInbound(e)}
          className="grid gap-3"
        >
          <Field
            name="idempotencyKey"
            label={t("idempotencyKey")}
            preset="code"
            defaultValue={`inbound-ui-${Date.now()}`}
          />
          <Field
            name="creditorIban"
            label={t("creditorIban")}
            preset="longText"
            required
            defaultValue=""
          />
          <Field
            name="amountMajor"
            label={t("amountMajor")}
            preset="amount"
            type="number"
            step="0.01"
            min={0}
            defaultValue={1000}
          />
          <CatalogField
            kind="CLOSED_SMALL"
            label={t("currency")}
            options={CURRENCY_OPTIONS}
            value={inboundCurrency}
            onChange={(next) =>
              setInboundCurrency(Array.isArray(next) ? next[0] ?? "AZN" : next)
            }
          />
        </form>
      </OpsModalShell>
    </div>
  );
}

export default function PaymentsPage() {
  const tCommon = useTranslations("common");
  return (
    <Suspense
      fallback={
        <p className="text-sm text-muted-foreground">{tCommon("loading")}</p>
      }
    >
      <PaymentsPageInner />
    </Suspense>
  );
}
