"use client";

import { Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Field, FieldSelect, FieldTextarea } from "@era/satellite-kit/ui";
import { apiFetch } from "../../lib/api-client";
import { parsePaginatedList } from "../../lib/paginated-list";
import {
  MODAL_FOOTER_ACTIONS_CLASS,
  MODAL_FOOTER_BUTTON_CLASS,
  MODAL_INPUT_NUMERIC_CLASS,
  TABLE_ROW_ICON_BTN_CLASS,
} from "../../lib/design-system";
import { Button } from "../ui/button";
import { SalesModalShell } from "../sales/modals/modal-shell";

const TEMPLATES = [
  "FREEFORM",
  "AR_OVERCOLLECTION_REFUND",
  "AR_WRITEOFF",
  "AP_WRITEOFF",
  "DONATION_IN_KIND",
] as const;

const CP_REQUIRED = new Set(["AR_OVERCOLLECTION_REFUND", "AR_WRITEOFF", "AP_WRITEOFF"]);

type TemplateCode = (typeof TEMPLATES)[number];

type AccountOpt = { id: string; code: string; nameRu?: string; nameEn?: string; nameAz?: string };
type CounterpartyOpt = { id: string; name: string };
type DepartmentOpt = { id: string; name: string };
type LineDraft = { key: string; accountCode: string; debit: string; credit: string };

export type ManualAdjustmentPrefill = {
  template?: TemplateCode;
  counterpartyId?: string;
  basisInvoiceId?: string;
  basisFixedAssetId?: string;
  departmentId?: string;
  lines?: Array<{ accountCode: string; debit: string; credit: string }>;
};

function emptyLine(): LineDraft {
  return { key: crypto.randomUUID(), accountCode: "", debit: "", credit: "0" };
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ManualAdjustmentModal({
  open,
  onClose,
  onPosted,
  prefill,
}: {
  open: boolean;
  onClose: () => void;
  onPosted: () => void;
  prefill?: ManualAdjustmentPrefill | null;
}) {
  const { t } = useTranslation();
  const [date, setDate] = useState(todayIso);
  const [template, setTemplate] = useState<TemplateCode>("FREEFORM");
  const [reason, setReason] = useState("");
  const [counterpartyId, setCounterpartyId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [basisInvoiceId, setBasisInvoiceId] = useState("");
  const [basisFixedAssetId, setBasisFixedAssetId] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([emptyLine(), emptyLine()]);
  const [accounts, setAccounts] = useState<AccountOpt[]>([]);
  const [counterparties, setCounterparties] = useState<CounterpartyOpt[]>([]);
  const [departments, setDepartments] = useState<DepartmentOpt[]>([]);
  const [busy, setBusy] = useState(false);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewOk, setPreviewOk] = useState(false);
  const [periodWarning, setPeriodWarning] = useState<string | null>(null);

  const cpRequired = CP_REQUIRED.has(template);

  const loadLookups = useCallback(async () => {
    const [accRes, cpRes, deptRes] = await Promise.all([
      apiFetch("/api/accounts?ledgerType=NAS"),
      apiFetch("/api/counterparties?pageSize=200"),
      apiFetch("/api/hr/departments"),
    ]);
    if (accRes.ok) setAccounts((await accRes.json()) as AccountOpt[]);
    if (cpRes.ok) {
      const parsed = parsePaginatedList<CounterpartyOpt>(await cpRes.json());
      setCounterparties(parsed.items);
    }
    if (deptRes.ok) {
      setDepartments((await deptRes.json()) as DepartmentOpt[]);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setDate(todayIso());
    setTemplate(prefill?.template ?? "FREEFORM");
    setReason("");
    setCounterpartyId(prefill?.counterpartyId ?? "");
    setDepartmentId(prefill?.departmentId ?? "");
    setBasisInvoiceId(prefill?.basisInvoiceId ?? "");
    setBasisFixedAssetId(prefill?.basisFixedAssetId ?? "");
    if (prefill?.lines?.length) {
      setLines(
        prefill.lines.map((l) => ({
          key: crypto.randomUUID(),
          accountCode: l.accountCode,
          debit: l.debit,
          credit: l.credit,
        })),
      );
    } else {
      setLines([emptyLine(), emptyLine()]);
    }
    setBusy(false);
    setPreviewBusy(false);
    setPreviewOk(false);
    setPeriodWarning(null);
    void loadLookups();
  }, [open, loadLookups, prefill]);

  useEffect(() => {
    if (!open || template === "FREEFORM" || prefill?.lines?.length) return;
    void (async () => {
      const res = await apiFetch(
        `/api/accounting/manual-adjustments/templates?template=${encodeURIComponent(template)}`,
      );
      if (!res.ok) return;
      const data = (await res.json()) as {
        lines: Array<{ accountCode: string; debitHint: "debit" | "credit" }>;
      };
      if (!data.lines.length) return;
      setLines(
        data.lines.map((l) => ({
          key: crypto.randomUUID(),
          accountCode: l.accountCode,
          debit: l.debitHint === "debit" ? "" : "0",
          credit: l.debitHint === "credit" ? "" : "0",
        })),
      );
      setPreviewOk(false);
    })();
  }, [open, template, prefill?.lines?.length]);

  const totals = useMemo(() => {
    let dr = 0;
    let cr = 0;
    for (const l of lines) {
      dr += Number(l.debit) || 0;
      cr += Number(l.credit) || 0;
    }
    return { dr, cr, balanced: Math.abs(dr - cr) < 0.00005 && dr > 0 };
  }, [lines]);

  function buildBody() {
    return {
      date,
      reason: reason.trim(),
      template,
      ...(counterpartyId ? { counterpartyId } : {}),
      ...(departmentId ? { departmentId } : {}),
      ...(basisInvoiceId ? { basisInvoiceId } : {}),
      ...(basisFixedAssetId ? { basisFixedAssetId } : {}),
      lines: lines.map((l) => ({
        accountCode: l.accountCode.trim(),
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0,
      })),
    };
  }

  async function onPreview() {
    if (previewBusy || busy) return;
    if (cpRequired && !counterpartyId) {
      toast.error(t("manualAdjustments.counterpartyRequired"));
      return;
    }
    setPreviewBusy(true);
    setPreviewOk(false);
    setPeriodWarning(null);
    const res = await apiFetch("/api/accounting/manual-adjustments/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildBody()),
    });
    setPreviewBusy(false);
    if (!res.ok) {
      toast.error(t("manualAdjustments.previewErr"), { description: await res.text() });
      return;
    }
    const data = (await res.json()) as { periodClosed: boolean; periodKey: string | null };
    if (data.periodClosed) {
      setPeriodWarning(
        t("manualAdjustments.periodClosedWarning", { period: data.periodKey ?? "" }),
      );
    }
    setPreviewOk(true);
    toast.success(t("manualAdjustments.previewOk"));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !previewOk) return;
    if (cpRequired && !counterpartyId) {
      toast.error(t("manualAdjustments.counterpartyRequired"));
      return;
    }
    setBusy(true);
    const res = await apiFetch("/api/accounting/manual-adjustments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildBody()),
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(t("manualAdjustments.postErr"), { description: await res.text() });
      return;
    }
    toast.success(t("manualAdjustments.postOk"));
    onPosted();
    onClose();
  }

  return (
    <SalesModalShell
      open={open}
      title={t("manualAdjustments.modalTitle")}
      subtitle={t("manualAdjustments.modalHint")}
      onClose={onClose}
      maxWidthClass="max-w-3xl"
      footer={
        <div className={MODAL_FOOTER_ACTIONS_CLASS}>
          <Button
            type="button"
            variant="outline"
            className={MODAL_FOOTER_BUTTON_CLASS}
            onClick={onClose}
            disabled={busy}
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            className={MODAL_FOOTER_BUTTON_CLASS}
            disabled={busy || previewBusy || !totals.balanced || reason.trim().length < 10}
            onClick={() => void onPreview()}
          >
            {previewBusy ? "…" : t("manualAdjustments.checkBtn")}
          </Button>
          <Button
            type="submit"
            variant="primary"
            className={MODAL_FOOTER_BUTTON_CLASS}
            form="manual-adjustment-form"
            disabled={busy || !previewOk || !totals.balanced}
          >
            {busy ? "…" : t("manualAdjustments.submit")}
          </Button>
        </div>
      }
    >
      <form id="manual-adjustment-form" onSubmit={(e) => void onSubmit(e)} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label={t("manualAdjustments.date")}
            preset="date"
            type="date"
            required
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setPreviewOk(false);
            }}
          />
          <FieldSelect
            label={t("manualAdjustments.template")}
            preset="selectWide"
            value={template}
            onChange={(e) => {
              setTemplate(e.target.value as TemplateCode);
              setPreviewOk(false);
            }}
          >
            {TEMPLATES.map((code) => (
              <option key={code} value={code}>
                {t(`manualAdjustments.template_${code}`)}
              </option>
            ))}
          </FieldSelect>
        </div>
        {template === "DONATION_IN_KIND" ? (
          <p className="m-0 text-[13px] text-[#7F8C8D]">{t("manualAdjustments.donationGlHint")}</p>
        ) : null}
        <FieldSelect
          label={
            cpRequired
              ? t("manualAdjustments.counterpartyRequiredLabel")
              : t("manualAdjustments.counterparty")
          }
          preset="selectWide"
          required={cpRequired}
          value={counterpartyId}
          onChange={(e) => {
            setCounterpartyId(e.target.value);
            setPreviewOk(false);
          }}
        >
          <option value="">{t("manualAdjustments.counterpartyNone")}</option>
          {counterparties.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </FieldSelect>
        <FieldSelect
          label={t("manualAdjustments.department")}
          preset="selectWide"
          value={departmentId}
          onChange={(e) => {
            setDepartmentId(e.target.value);
            setPreviewOk(false);
          }}
        >
          <option value="">{t("manualAdjustments.departmentNone")}</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </FieldSelect>
        <FieldTextarea
          label={t("manualAdjustments.reason")}
          required
          minLength={10}
          maxLength={2000}
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            setPreviewOk(false);
          }}
          placeholder={t("manualAdjustments.reasonPh")}
        />
        {periodWarning ? (
          <p className="m-0 text-[13px] text-amber-700">{periodWarning}</p>
        ) : null}
        {previewOk ? (
          <p className="m-0 text-[13px] text-[#2980B9]">{t("manualAdjustments.previewReady")}</p>
        ) : null}
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[13px] font-semibold text-[#34495E]">
              {t("manualAdjustments.lines")}
            </span>
            <Button
              type="button"
              variant="outline"
              className={MODAL_FOOTER_BUTTON_CLASS}
              onClick={() => {
                setLines((prev) => [...prev, emptyLine()]);
                setPreviewOk(false);
              }}
            >
              <Plus className="h-4 w-4" aria-hidden />
              {t("manualAdjustments.addLine")}
            </Button>
          </div>
          <div className="space-y-2">
            {lines.map((line, idx) => (
              <div key={line.key} className="grid grid-cols-[1fr_7rem_7rem_2rem] items-end gap-2">
                <FieldSelect
                  label={idx === 0 ? t("manualAdjustments.account") : ""}
                  preset="selectWide"
                  required
                  value={line.accountCode}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((x) =>
                        x.key === line.key ? { ...x, accountCode: e.target.value } : x,
                      ),
                    )
                  }
                >
                  <option value="">{t("manualAdjustments.chooseAccount")}</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.code}>
                      {a.code} {a.nameAz || a.nameRu || a.nameEn || ""}
                    </option>
                  ))}
                </FieldSelect>
                <Field
                  label={idx === 0 ? t("manualAdjustments.debit") : ""}
                  preset="amount"
                  inputClassName={MODAL_INPUT_NUMERIC_CLASS}
                  value={line.debit}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((x) => (x.key === line.key ? { ...x, debit: e.target.value } : x)),
                    )
                  }
                />
                <Field
                  label={idx === 0 ? t("manualAdjustments.credit") : ""}
                  preset="amount"
                  inputClassName={MODAL_INPUT_NUMERIC_CLASS}
                  value={line.credit}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((x) => (x.key === line.key ? { ...x, credit: e.target.value } : x)),
                    )
                  }
                />
                <button
                  type="button"
                  className={`${TABLE_ROW_ICON_BTN_CLASS} mb-1`}
                  disabled={lines.length <= 2}
                  onClick={() => setLines((prev) => prev.filter((x) => x.key !== line.key))}
                  aria-label={t("common.delete")}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <p
            className={`mt-2 m-0 text-[13px] tabular-nums ${
              totals.balanced ? "text-[#2980B9]" : "text-[#E74C3C]"
            }`}
          >
            {t("manualAdjustments.preview", {
              debit: totals.dr.toFixed(2),
              credit: totals.cr.toFixed(2),
            })}
          </p>
        </div>
      </form>
    </SalesModalShell>
  );
}
