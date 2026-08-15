"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CatalogField,
  Field,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { OpsModalShell } from "@/components/ops/OpsModalShell";
import { useEodLock } from "@/components/ops/EodLockProvider";
import { useOpsMe } from "@/components/ops/useOpsMe";
import { OpsError, OpsResult, StatusBadge } from "@/components/ops-ui";
import { PostingLegsTable } from "@/components/PostingLegsTable";
import {
  loadAccountOptions,
  loadBranchOptions,
  majorToMinor,
  type LookupOption,
  withOrphanOption,
} from "@/lib/bank-lookups";

type OpKind = "cash-deposit" | "cash-withdrawal" | "internal-transfer" | "cross-branch";

type PostingDetail = {
  id: string;
  reference?: string;
  type?: string;
  status?: string;
  makerUserId?: string;
  checkerUserId?: string | null;
  entries?: Array<{
    accountId?: string | null;
    glAccountId?: string;
    branchId?: string;
    debitMinor?: unknown;
    creditMinor?: unknown;
    currency?: string;
  }>;
};

type PostingCreateModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
};

export function PostingCreateModal({ open, onClose, onCreated }: PostingCreateModalProps) {
  const t = useTranslations("pages.postings");
  const [kind, setKind] = useState<OpKind>("cash-deposit");
  const [accounts, setAccounts] = useState<LookupOption[]>([]);
  const [branches, setBranches] = useState<LookupOption[]>([]);
  const [accountId, setAccountId] = useState("");
  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [serviceBranchId, setServiceBranchId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  const formId = "posting-create-form";

  const opKindOptions = useMemo(
    () => [
      { value: "cash-deposit", label: t("cashDeposit") },
      { value: "cash-withdrawal", label: t("cashWithdrawal") },
      { value: "internal-transfer", label: t("internalTransfer") },
      { value: "cross-branch", label: t("crossBranch") },
    ],
    [t],
  );

  useEffect(() => {
    if (!open) return;
    void Promise.all([loadAccountOptions(), loadBranchOptions()]).then(
      ([a, b]) => {
        setAccounts(a);
        setBranches(b);
      },
    );
    setAccountId("");
    setFromAccountId("");
    setToAccountId("");
    setServiceBranchId("");
    setError(null);
    setResult("");
  }, [open]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult("");
    const form = new FormData(e.currentTarget);
    const amountMinor = String(
      majorToMinor(String(form.get("amountMajor") ?? "0")),
    );
    const idempotencyKey = crypto.randomUUID();
    let path = `/api/postings/${kind}`;
    let body: Record<string, unknown> = {
      idempotencyKey,
      currency: "AZN",
    };

    if (kind === "internal-transfer") {
      if (!fromAccountId || !toAccountId) {
        setError("Accounts required");
        setBusy(false);
        return;
      }
      body = {
        fromAccountId,
        toAccountId,
        amountMinor,
        idempotencyKey,
      };
    } else if (kind === "cross-branch") {
      if (!accountId || !serviceBranchId) {
        setError("Account and service branch required");
        setBusy(false);
        return;
      }
      path = "/api/branches/cross-branch-withdrawal";
      body = {
        customerAccountId: accountId,
        serviceBranchId,
        amountMinor,
        currency: "AZN",
        idempotencyKey,
      };
    } else {
      if (!accountId) {
        setError("Account required");
        setBusy(false);
        return;
      }
      body = {
        accountId,
        amountMinor,
        currency: "AZN",
        idempotencyKey,
      };
    }

    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      if (!res.ok) {
        setError(text);
        return;
      }
      setResult(text);
      try {
        const parsed = JSON.parse(text) as { id?: string };
        if (parsed.id) onCreated(parsed.id);
      } catch {
        /* non-json ok */
      }
    } catch {
      setError("Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <OpsModalShell
      open={open}
      title={t("newTitle")}
      subtitle={t("newSubtitle")}
      onClose={onClose}
      formId={formId}
      submitLabel={t("submitMaker")}
      busy={busy}
      maxWidthClass="max-w-2xl"
    >
      <form id={formId} onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <CatalogField
          kind="CLOSED_SMALL"
          label={t("operation")}
          className="sm:col-span-2"
          options={opKindOptions}
          value={kind}
          onChange={(next) =>
            setKind((Array.isArray(next) ? next[0] : next) as OpKind)
          }
          required
        />
        {kind === "internal-transfer" ? (
          <>
            <CatalogField
              kind="ENTITY_REF"
              label={t("fromAccount")}
              options={withOrphanOption(accounts, fromAccountId)}
              value={fromAccountId}
              onChange={(next) =>
                setFromAccountId(Array.isArray(next) ? next[0] ?? "" : next)
              }
              required
            />
            <CatalogField
              kind="ENTITY_REF"
              label={t("toAccount")}
              options={withOrphanOption(accounts, toAccountId)}
              value={toAccountId}
              onChange={(next) =>
                setToAccountId(Array.isArray(next) ? next[0] ?? "" : next)
              }
              required
            />
          </>
        ) : kind === "cross-branch" ? (
          <>
            <CatalogField
              kind="ENTITY_REF"
              label={t("accountId")}
              options={withOrphanOption(accounts, accountId)}
              value={accountId}
              onChange={(next) =>
                setAccountId(Array.isArray(next) ? next[0] ?? "" : next)
              }
              required
            />
            <CatalogField
              kind="ENTITY_REF"
              label={t("serviceBranch")}
              options={withOrphanOption(branches, serviceBranchId)}
              value={serviceBranchId}
              onChange={(next) =>
                setServiceBranchId(Array.isArray(next) ? next[0] ?? "" : next)
              }
              required
            />
          </>
        ) : (
          <CatalogField
            kind="ENTITY_REF"
            label={t("accountId")}
            className="sm:col-span-2"
            options={withOrphanOption(accounts, accountId)}
            value={accountId}
            onChange={(next) =>
              setAccountId(Array.isArray(next) ? next[0] ?? "" : next)
            }
            required
          />
        )}
        <Field
          name="amountMajor"
          label={t("amount")}
          preset="amount"
          type="number"
          step="0.01"
          required
        />
        <div className="sm:col-span-2">
          <OpsError message={error} />
          <OpsResult text={result} />
        </div>
      </form>
    </OpsModalShell>
  );
}

type PostingDetailModalProps = {
  open: boolean;
  postingId: string | null;
  onClose: () => void;
  onUpdated?: () => void;
};

export function PostingDetailModal({
  open,
  postingId,
  onClose,
  onUpdated,
}: PostingDetailModalProps) {
  const t = useTranslations("pages.postings");
  const tCommon = useTranslations("common");
  const me = useOpsMe();
  const { mutationsDisabled } = useEodLock();
  const [data, setData] = useState<PostingDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!postingId) return;
    setError(null);
    try {
      const res = await fetch(`/api/postings/${postingId}`, { cache: "no-store" });
      if (!res.ok) {
        setError(`${tCommon("error")} (${res.status})`);
        return;
      }
      setData((await res.json()) as PostingDetail);
    } catch {
      setError(tCommon("error"));
    }
  }, [postingId, tCommon]);

  useEffect(() => {
    if (open && postingId) void load();
    if (!open) setData(null);
  }, [open, postingId, load]);

  async function approve() {
    if (!postingId) return;
    setActionError(null);
    const res = await fetch(`/api/postings/${postingId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!res.ok) setActionError(await res.text());
    await load();
    onUpdated?.();
  }

  async function reject() {
    if (!postingId) return;
    setActionError(null);
    const res = await fetch(`/api/postings/${postingId}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Checker rejected" }),
    });
    if (!res.ok) setActionError(await res.text());
    await load();
    onUpdated?.();
  }

  async function reverse() {
    if (!postingId) return;
    setActionError(null);
    const res = await fetch(`/api/postings/${postingId}/reverse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reason: "Manual reversal",
        idempotencyKey: `rev-${postingId}-${Date.now()}`,
      }),
    });
    if (!res.ok) setActionError(await res.text());
    await load();
    onUpdated?.();
  }

  const canApprove = me?.canApprove === true;

  return (
    <OpsModalShell
      open={open}
      title={t("detailTitle")}
      subtitle={postingId ?? undefined}
      onClose={onClose}
      hideFooter
      maxWidthClass="max-w-3xl"
    >
      <OpsError message={error} />
      {data ? (
        <div className="space-y-4">
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              Reference: <strong>{data.reference ?? "—"}</strong>
            </div>
            <div>
              Status: {data.status ? <StatusBadge status={data.status} /> : "—"}
            </div>
            <div>Type: {data.type ?? "—"}</div>
            <div>Maker: {data.makerUserId ?? "—"}</div>
          </div>
          <div>
            <h3 className="mb-3 font-medium">{t("legs")}</h3>
            <PostingLegsTable legs={data.entries ?? []} />
          </div>
          <div className="flex flex-wrap gap-2">
            {data.status === "PENDING" && canApprove ? (
              <>
                <button
                  type="button"
                  className={PRIMARY_BUTTON_CLASS}
                  disabled={mutationsDisabled}
                  onClick={() => void approve()}
                >
                  {t("approve")}
                </button>
                <button
                  type="button"
                  className={SECONDARY_BUTTON_CLASS}
                  disabled={mutationsDisabled}
                  onClick={() => void reject()}
                >
                  {t("reject")}
                </button>
              </>
            ) : null}
            {data.status === "POSTED" ? (
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                disabled={mutationsDisabled}
                onClick={() => void reverse()}
              >
                {t("reverse")}
              </button>
            ) : null}
          </div>
          <OpsError message={actionError} />
        </div>
      ) : null}
    </OpsModalShell>
  );
}
