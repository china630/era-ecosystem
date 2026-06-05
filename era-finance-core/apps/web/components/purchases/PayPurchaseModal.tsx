"use client";

import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { apiFetch } from "../../lib/api-client";
import { notifyListRefresh } from "../../lib/list-refresh-bus";
import { MODAL_FIELD_LABEL_CLASS, MODAL_INPUT_CLASS } from "../../lib/design-system";
import { SalesModalFooter, SalesModalShell } from "../sales/modals/modal-shell";
import { Select, SelectContent, SelectItem, SelectTrigger } from "../ui/select";

type MoneyOption = {
  code: string;
  label: string;
  kind: "CASH" | "BANK";
  currency: string;
  requiresBankAccountId?: boolean;
};

type BankAccount = {
  id: string;
  bankName: string;
  ledgerAccountCode: string | null;
  currency: string;
};

const lbl = MODAL_FIELD_LABEL_CLASS;

export function PayPurchaseModal({
  open,
  onClose,
  onPaid,
  purchaseInvoiceId,
  counterpartyId,
  defaultAmount,
  payUrl,
}: {
  open: boolean;
  onClose: () => void;
  onPaid?: () => void;
  purchaseInvoiceId?: string;
  counterpartyId?: string;
  defaultAmount?: string;
  payUrl: string;
}) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState(defaultAmount ?? "");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [moneyOptions, setMoneyOptions] = useState<MoneyOption[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [debitCode, setDebitCode] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAmount(defaultAmount ?? "");
    void (async () => {
      const res = await apiFetch("/api/system/money-accounts?purpose=incoming");
      if (res.ok) {
        const data = (await res.json()) as { options?: MoneyOption[] };
        setMoneyOptions(data.options ?? []);
        if (data.options?.[0]) setDebitCode(data.options[0].code);
      }
      const banks = await apiFetch("/api/banking/bank-accounts");
      if (banks.ok) {
        setBankAccounts((await banks.json()) as BankAccount[]);
      }
    })();
  }, [open, defaultAmount]);

  const selected = moneyOptions.find((o) => o.code === debitCode);
  const showBankPick = selected?.kind === "BANK";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const body: Record<string, unknown> = {
      amount: Number(amount),
      paymentDate,
      creditAccountCode: debitCode,
    };
    if (showBankPick && bankAccountId) {
      body.bankAccountId = bankAccountId;
    }
    const res = await apiFetch(payUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(await res.text());
      return;
    }
    toast.success(t("inventory.purchasePayDone", { defaultValue: "Ödəniş keçirildi" }));
    notifyListRefresh("inventory-hub");
    notifyListRefresh("payables");
    onPaid?.();
    onClose();
  }

  return (
    <SalesModalShell
      open={open}
      title={t("inventory.purchasePayTitle", { defaultValue: "Ödəniş et" })}
      onClose={onClose}
      footer={<SalesModalFooter onCancel={onClose} busy={busy} formId="pay-purchase-form" />}
    >
      <form id="pay-purchase-form" className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
        <div>
          <span className={lbl}>{t("inventory.purchasePayAmount", { defaultValue: "Məbləğ" })}</span>
          <input
            className={MODAL_INPUT_CLASS}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div>
          <span className={lbl}>{t("inventory.purchasePayDate", { defaultValue: "Tarix" })}</span>
          <input
            type="date"
            className={MODAL_INPUT_CLASS}
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
          />
        </div>
        <div>
          <span className={lbl}>{t("invoiceNew.paymentAccount", { defaultValue: "Ödəniş hesabı" })}</span>
          <Select value={debitCode} onValueChange={setDebitCode}>
            <SelectTrigger className={MODAL_INPUT_CLASS} />
            <SelectContent>
              {moneyOptions.map((o) => (
                <SelectItem key={o.code} value={o.code}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {showBankPick ? (
          <div>
            <span className={lbl}>{t("invoiceNew.bankAccount", { defaultValue: "Bank hesabı" })}</span>
            <Select value={bankAccountId} onValueChange={setBankAccountId}>
              <SelectTrigger className={MODAL_INPUT_CLASS} />
              <SelectContent>
                {bankAccounts.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.bankName} · {b.ledgerAccountCode ?? "—"} ({b.currency})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        {purchaseInvoiceId ? (
          <p className="text-[12px] text-muted-foreground m-0">ID: {purchaseInvoiceId}</p>
        ) : null}
        {counterpartyId ? (
          <p className="text-[12px] text-muted-foreground m-0">CP: {counterpartyId}</p>
        ) : null}
      </form>
    </SalesModalShell>
  );
}
