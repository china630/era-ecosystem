"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Field, FieldSelect } from "@era/satellite-kit/ui";
import { OpsModalShell } from "@/components/ops/OpsModalShell";
import { OpsError, StatusBadge, maskIban } from "@/components/ops-ui";

function maskPersonId(id: string | null | undefined): string {
  if (!id) return "—";
  if (id.length <= 12) return id;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

type BeneficialOwnerRow = {
  id: string;
  globalPersonId?: string | null;
  sharePercent?: number | null;
};

type CustomerDetail = {
  id: string;
  customerType?: string;
  kycStatus?: string;
  status?: string;
  voen?: string | null;
  globalPersonId?: string | null;
  homeBranchId?: string;
  beneficialOwners?: BeneficialOwnerRow[];
};

type AccountRow = { id: string; iban?: string; status?: string; currency?: string };

function MdmBadge({ globalPersonId, label }: { globalPersonId?: string | null; label: string }) {
  const linked = Boolean(globalPersonId);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] ${
        linked ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"
      }`}
    >
      {label}: {linked ? maskPersonId(globalPersonId) : "—"}
    </span>
  );
}

type CifCreateModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
};

export function CifCreateModal({ open, onClose, onCreated }: CifCreateModalProps) {
  const t = useTranslations("pages.cif");
  const [customerType, setCustomerType] = useState<"NATURAL" | "LEGAL">("NATURAL");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fin, setFin] = useState("");
  const [previewPersonId, setPreviewPersonId] = useState<string | null>(null);
  const formId = "cif-create-form";

  async function previewMdm() {
    if (customerType !== "NATURAL" || !fin.trim()) return;
    setPreviewPersonId(null);
    try {
      const res = await fetch("/api/mdm/person-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fin: fin.trim(), fullName: "CIF Preview" }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { globalPersonId?: string };
      setPreviewPersonId(data.globalPersonId ?? null);
    } catch {
      setPreviewPersonId(null);
    }
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/cif/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerType,
          homeBranchId: form.get("homeBranchId"),
          fin: customerType === "NATURAL" ? form.get("fin") : undefined,
          voen: customerType === "LEGAL" ? form.get("voen") : undefined,
        }),
      });
      if (!res.ok) {
        setError(await res.text());
        return;
      }
      const created = (await res.json()) as { id: string };
      onCreated(created.id);
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
      submitLabel={t("create")}
      busy={busy}
    >
      <form id={formId} onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <FieldSelect
          label={t("customerType")}
          preset="selectWide"
          className="sm:col-span-2"
          value={customerType}
          onChange={(e) => setCustomerType(e.target.value as "NATURAL" | "LEGAL")}
        >
          <option value="NATURAL">{t("natural")}</option>
          <option value="LEGAL">{t("legal")}</option>
        </FieldSelect>
        {customerType === "NATURAL" ? (
          <>
            <Field name="fin" label="FIN (7 chars)" preset="fin" defaultValue="1234567" />
            <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                onClick={() => {
                  setFin("1234567");
                  void previewMdm();
                }}
              >
                {t("mdmPreview")}
              </button>
              {previewPersonId ? (
                <MdmBadge globalPersonId={previewPersonId} label={t("mdmLinked")} />
              ) : null}
            </div>
          </>
        ) : (
          <Field name="voen" label="VÖEN (10 digits)" preset="voen" defaultValue="1234567890" />
        )}
        <Field name="homeBranchId" label={t("homeBranch")} preset="code" defaultValue="demo-branch-hq" />
        <div className="sm:col-span-2">
          <OpsError message={error} />
        </div>
      </form>
    </OpsModalShell>
  );
}

type UboAddModalProps = {
  open: boolean;
  customerId: string;
  onClose: () => void;
  onAdded: () => void;
};

function UboAddModal({ open, customerId, onClose, onAdded }: UboAddModalProps) {
  const t = useTranslations("pages.cif");
  const tCommon = useTranslations("common");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const formId = "ubo-add-form";

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch(`/api/cif/customers/${customerId}/beneficial-owners`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fin: String(form.get("fin") ?? "").trim() || undefined,
          passport: String(form.get("passport") ?? "").trim() || undefined,
          sharePercent: Number(form.get("sharePercent")) || 0,
        }),
      });
      if (!res.ok) {
        setError(await res.text());
        return;
      }
      onAdded();
      onClose();
    } catch {
      setError("Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <OpsModalShell
      open={open}
      title={t("addUbo")}
      onClose={onClose}
      formId={formId}
      submitLabel={tCommon("save")}
      busy={busy}
    >
      <form id={formId} onSubmit={submit} className="grid gap-3">
        <Field name="fin" label="FIN" preset="fin" />
        <Field name="passport" label={t("passport")} preset="shortText" />
        <Field name="sharePercent" label={t("sharePercent")} preset="amount" type="number" defaultValue="25" />
        <OpsError message={error} />
      </form>
    </OpsModalShell>
  );
}

type CifDetailModalProps = {
  open: boolean;
  customerId: string | null;
  onClose: () => void;
};

export function CifDetailModal({ open, customerId, onClose }: CifDetailModalProps) {
  const t = useTranslations("pages.cif");
  const tCommon = useTranslations("common");
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uboOpen, setUboOpen] = useState(false);

  const load = useCallback(async () => {
    if (!customerId) return;
    setLoading(true);
    setError(null);
    try {
      const [cRes, aRes] = await Promise.all([
        fetch(`/api/cif/customers/${customerId}`, { cache: "no-store" }),
        fetch(`/api/accounts?customerId=${customerId}`, { cache: "no-store" }),
      ]);
      if (!cRes.ok) {
        setError(`${tCommon("error")} (${cRes.status})`);
        return;
      }
      setCustomer((await cRes.json()) as CustomerDetail);
      if (aRes.ok) setAccounts((await aRes.json()) as AccountRow[]);
    } catch {
      setError(tCommon("error"));
    } finally {
      setLoading(false);
    }
  }, [customerId, tCommon]);

  useEffect(() => {
    if (open && customerId) void load();
    if (!open) {
      setCustomer(null);
      setAccounts([]);
    }
  }, [open, customerId, load]);

  return (
    <>
      <OpsModalShell
        open={open}
        title={t("detailTitle")}
        subtitle={customerId ?? undefined}
        onClose={onClose}
        hideFooter
        maxWidthClass="max-w-2xl"
      >
        {loading ? <p className="text-sm text-muted-foreground">{tCommon("loading")}</p> : null}
        <OpsError message={error} />
        {customer ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <MdmBadge
                globalPersonId={customer.globalPersonId}
                label={customer.customerType === "LEGAL" ? t("mdmUboPerson") : t("mdmLinked")}
              />
              {customer.voen ? (
                <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px]">VÖEN {customer.voen}</span>
              ) : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 text-sm">
              <div>
                <span className="text-muted-foreground">{t("customerType")}: </span>
                {customer.customerType}
              </div>
              <div>
                <span className="text-muted-foreground">KYC: </span>
                {customer.kycStatus ? <StatusBadge status={customer.kycStatus} /> : "—"}
              </div>
              <div>
                <span className="text-muted-foreground">{t("homeBranch")}: </span>
                {customer.homeBranchId ?? "—"}
              </div>
            </div>
            <div>
              <h3 className="mb-2 font-medium">{t("linkedAccounts")}</h3>
              {accounts.length === 0 ? (
                <p className="text-sm text-muted-foreground">{tCommon("empty")}</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {accounts.map((acc) => (
                    <li key={acc.id}>
                      <Link href={`/accounts?id=${acc.id}`} className="text-primary underline">
                        {acc.iban ? maskIban(acc.iban) : acc.id}
                      </Link>
                      {acc.status ? <> — <StatusBadge status={acc.status} /></> : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {customer.customerType === "LEGAL" ? (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-medium">{t("beneficialOwners")}</h3>
                  <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => setUboOpen(true)}>
                    {t("addUbo")}
                  </button>
                </div>
                {customer.beneficialOwners?.length ? (
                  <ul className="space-y-1 text-sm">
                    {customer.beneficialOwners.map((bo) => (
                      <li key={bo.id}>
                        {maskPersonId(bo.globalPersonId)} — {bo.sharePercent ?? 0}%
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">{tCommon("empty")}</p>
                )}
              </div>
            ) : null}
            <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void load()}>
              {tCommon("refresh")}
            </button>
          </div>
        ) : null}
      </OpsModalShell>
      {customerId && customer?.customerType === "LEGAL" ? (
        <UboAddModal
          open={uboOpen}
          customerId={customerId}
          onClose={() => setUboOpen(false)}
          onAdded={() => void load()}
        />
      ) : null}
    </>
  );
}
