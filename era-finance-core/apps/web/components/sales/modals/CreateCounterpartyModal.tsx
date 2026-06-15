"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { apiFetch } from "../../../lib/api-client";
import { safeJson } from "../../../lib/api-fetch";
import {
  COUNTERPARTY_LEGAL_FORMS,
  counterpartyLegalFormI18nKey,
  type CounterpartyLegalForm,
} from "../../../lib/counterparty-legal-form";
import { notifyListRefresh } from "../../../lib/list-refresh-bus";
import {
  MODAL_CHECKBOX_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  MODAL_INPUT_CLASS,
} from "../../../lib/design-system";
import { Button } from "../../ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger } from "../../ui/select";
import { SalesModalFooter, SalesModalShell } from "./modal-shell";

const lbl = MODAL_FIELD_LABEL_CLASS;

function isPoisonLookupName(name: string): boolean {
  const n = name.trim();
  if (!n) return true;
  if (/[<>]/.test(n)) return true;
  return /javascript|noscript|cloudflare|cf-ray|you need to enable|checking your browser/i.test(n);
}

export function CreateCounterpartyModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [name, setName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [role, setRole] = useState<"" | "CUSTOMER" | "SUPPLIER" | "BOTH" | "OTHER">("");
  const [legalForm, setLegalForm] = useState<CounterpartyLegalForm | "">("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [isVatPayer, setIsVatPayer] = useState(false);
  const [isRiskyTaxpayer, setIsRiskyTaxpayer] = useState<boolean | null>(null);
  const [voenCheckBusy, setVoenCheckBusy] = useState(false);
  const [voenVerified, setVoenVerified] = useState(false);
  const [directorName, setDirectorName] = useState("");
  const [phones, setPhones] = useState<string[]>([""]);
  const [finCode, setFinCode] = useState("");
  const [finCheckBusy, setFinCheckBusy] = useState(false);
  const [finVerified, setFinVerified] = useState(false);
  const [mdmPersonId, setMdmPersonId] = useState<string | null>(null);
  const [manualCheckTax, setManualCheckTax] = useState(false);
  const [manualCheckInternal, setManualCheckInternal] = useState(false);
  const [busy, setBusy] = useState(false);
  const fieldsLocked = !voenVerified;

  const digits = useMemo(() => taxId.replace(/\D/g, ""), [taxId]);
  const taxValid = digits.length === 10;

  /** После `addResourceBundle` (оверрайды из БД) пересчитать подписи ОПФ. */
  const [i18nResourceTick, setI18nResourceTick] = useState(0);
  useEffect(() => {
    const bump = () => setI18nResourceTick((n) => n + 1);
    const store = i18n.store;
    store.on("added", bump);
    store.on("removed", bump);
    i18n.on("languageChanged", bump);
    return () => {
      store.off("added", bump);
      store.off("removed", bump);
      i18n.off("languageChanged", bump);
    };
  }, [i18n]);

  const legalFormOptions = useMemo(
    () =>
      COUNTERPARTY_LEGAL_FORMS.map((v) => ({
        value: v,
        label: t(counterpartyLegalFormI18nKey(v)),
      })),
    [t, i18n.language, i18nResourceTick],
  );

  async function checkVoen({ allowFallback }: { allowFallback: boolean }) {
    const d = digits;
    if (d.length !== 10) {
      toast.error(t("counterparties.taxInvalid"));
      return;
    }
    setVoenCheckBusy(true);
    try {
      const dirRes = await apiFetch(
        `/api/organization/directory/by-voen/${encodeURIComponent(d)}`,
      );
      if (dirRes.ok) {
        const dir = await safeJson<{
          name: string;
          legalAddress?: string | null;
          phone?: string | null;
          directorName?: string | null;
        }>(dirRes);
        if (dir?.name?.trim() && !isPoisonLookupName(dir.name)) {
          setName(dir.name.trim());
        }
        if (dir?.legalAddress?.trim()) {
          const incoming = dir.legalAddress.trim();
          setAddress((prev) => {
            const cur = prev.trim();
            if (!cur) return incoming;
            if (cur !== incoming) return incoming;
            return prev;
          });
        }
      }

      const mdm = await apiFetch(`/api/counterparties/global/by-voen/${encodeURIComponent(d)}`);
      if (mdm.ok) {
        const g = await safeJson<{
          taxId: string;
          name: string;
          legalAddress?: string | null;
          vatStatus?: boolean | null;
        }>(mdm);
        if (g) {
          let mdmProvidedName = false;
          if (g.name?.trim() && !isPoisonLookupName(g.name)) {
            mdmProvidedName = true;
            setName(g.name.trim());
          }
          if (g.vatStatus !== undefined && g.vatStatus !== null) {
            setIsVatPayer(g.vatStatus);
          }
          if (g.legalAddress?.trim()) {
            const incoming = g.legalAddress.trim();
            setAddress((prev) => {
              const cur = prev.trim();
              if (!cur) return incoming;
              if (cur !== incoming) return incoming;
              return prev;
            });
          }
          setVoenVerified(true);
          setManualCheckInternal(true);
          if (!allowFallback) {
            return;
          }
          if (mdmProvidedName) {
            return;
          }
        }
      }

      if (!allowFallback) {
        return;
      }

      const res = await apiFetch(`/api/tax/taxpayer-info?voen=${encodeURIComponent(d)}`);
      if (!res.ok) {
        toast.error(t("counterparties.voenLookupNotFound"));
        return;
      }
      const j = await safeJson<{
        name: string;
        isVatPayer: boolean;
        address: string | null;
        isRiskyTaxpayer?: boolean | null;
      }>(res);
      if (!j?.name?.trim() || isPoisonLookupName(j.name)) {
        toast.error(t("counterparties.voenLookupNotFound"));
        return;
      }
      setName(j.name.trim());
      setIsVatPayer(j.isVatPayer);
      if (j.isRiskyTaxpayer !== undefined) {
        setIsRiskyTaxpayer(j.isRiskyTaxpayer ?? null);
      }
      if (j.address?.trim()) {
        const incoming = j.address.trim();
        setAddress((prev) => {
          const cur = prev.trim();
          if (!cur) return incoming;
          if (cur !== incoming) return incoming;
          return prev;
        });
      }
      const vatRes = await apiFetch(`/api/tax/vat-payer-info?voen=${encodeURIComponent(d)}`);
      if (vatRes.ok) {
        const vat = await safeJson<{ name?: string; isVatPayer?: boolean }>(vatRes);
        if (vat?.name?.trim() && !isPoisonLookupName(vat.name)) {
          setName(vat.name.trim());
        }
        if (vat?.isVatPayer !== undefined) {
          setIsVatPayer(vat.isVatPayer);
        }
      }
      setVoenVerified(true);
      setManualCheckTax(true);
    } catch (err) {
      console.error("[checkVoen]", err);
      toast.error(t("counterparties.voenLookupNotFound"));
    } finally {
      setVoenCheckBusy(false);
    }
  }

  async function handleCheckVoen() {
    await checkVoen({ allowFallback: true });
  }

  async function handleCheckFin() {
    const fin = finCode.trim().toUpperCase();
    if (fin.length !== 7) {
      toast.error(t("counterparties.finInvalid", { defaultValue: "FIN 7 simvol olmalıdır" }));
      return;
    }
    setFinCheckBusy(true);
    try {
      const res = await apiFetch("/api/counterparties/lookup-fin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fin, fullName: name.trim() || undefined }),
      });
      if (!res.ok) {
        toast.error(await res.text());
        return;
      }
      const j = await safeJson<{
        found?: boolean;
        fullName?: string | null;
        globalPersonId?: string | null;
        message?: string;
      }>(res);
      if (!j?.found) {
        toast.error(
          t("counterparties.finNotFound", { defaultValue: "FIN tapılmadı" }),
        );
        setFinVerified(false);
        setMdmPersonId(null);
        return;
      }
      if (j.fullName?.trim() && !isPoisonLookupName(j.fullName)) {
        setName(j.fullName.trim());
      }
      setFinVerified(true);
      setMdmPersonId(j.globalPersonId ?? null);
      toast.success(t("counterparties.finFound", { defaultValue: "FIN təsdiqləndi" }));
    } catch (err) {
      console.error("[handleCheckFin]", err);
      toast.error(t("counterparties.finLookupErr", { defaultValue: "FIN yoxlanması uğursuz" }));
    } finally {
      setFinCheckBusy(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    setName("");
    setTaxId("");
    setRole("");
    setLegalForm("");
    setAddress("");
    setEmail("");
    setIsVatPayer(false);
    setIsRiskyTaxpayer(null);
    setVoenCheckBusy(false);
    setVoenVerified(false);
    setDirectorName("");
    setPhones([""]);
    setFinCode("");
    setFinCheckBusy(false);
    setFinVerified(false);
    setMdmPersonId(null);
    setManualCheckTax(false);
    setManualCheckInternal(false);
    setBusy(false);
  }, [open]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error(t("counterparties.nameRequired"));
      return;
    }
    if (!taxValid) {
      toast.error(t("counterparties.taxInvalid"));
      return;
    }
    if (!legalForm) {
      toast.error(t("counterparties.legalFormRequired"));
      return;
    }
    if (!voenVerified) {
      toast.error(t("counterparties.yoxlaFirst", { defaultValue: "Əvvəl Yoxla düyməsinə basın" }));
      return;
    }
    setBusy(true);
    const body: Record<string, unknown> = {
      name: name.trim(),
      taxId: digits,
      legalForm,
      address: address.trim() || undefined,
      email: email.trim() || undefined,
      isVatPayer,
    };
    if (role) {
      body.role = role;
    }
    if (directorName.trim()) body.directorName = directorName.trim();
    const phoneList = phones.map((p) => p.trim()).filter(Boolean);
    if (phoneList.length) body.phones = phoneList;
    if (finCode.trim()) body.finCode = finCode.trim();
    const res = await apiFetch("/api/counterparties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(t("counterparties.createErr"), { description: await res.text() });
      return;
    }
    toast.success(t("common.save"));
    notifyListRefresh("counterparties");
    onClose();
  }

  return (
    <SalesModalShell
      open={open}
      title={t("counterparties.newTitle")}
      onClose={onClose}
      maxWidthClass="max-w-[calc(42rem*0.7)]"
      footer={
        <SalesModalFooter onCancel={onClose} busy={busy} formId="create-counterparty-form" />
      }
    >
      <form
        id="create-counterparty-form"
        noValidate
        onSubmit={(e) => void onSubmit(e)}
        className="space-y-4"
      >
        <div>
          <span className={lbl}>{t("counterparties.taxId")}</span>
          <div className="flex w-full min-w-0 items-stretch gap-2 sm:gap-3">
            <input
              name="taxId"
              inputMode="numeric"
              maxLength={10}
              value={digits}
              onChange={(e) => {
                setVoenVerified(false);
                setTaxId(e.target.value.replace(/\D/g, "").slice(0, 10));
              }}
              className={`${MODAL_INPUT_CLASS} h-9 min-h-9 min-w-0 flex-1 tabular-nums max-w-none`}
              aria-invalid={!taxValid && digits.length > 0}
            />
            <Button
              type="button"
              variant="secondary"
              disabled={voenCheckBusy || !taxValid}
              aria-busy={voenCheckBusy}
              aria-label={t("counterparties.yoxla")}
              className="shrink-0 self-center"
              onClick={(e) => {
                e.preventDefault();
                void handleCheckVoen();
              }}
            >
              {voenCheckBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                t("counterparties.yoxla")
              )}
            </Button>
          </div>
        </div>
        {(manualCheckTax || manualCheckInternal) && (
          <div className="flex flex-wrap gap-2 text-[12px]">
            {manualCheckTax ? (
              <span className="rounded bg-emerald-100 px-2 py-0.5 text-emerald-900">Tax ✓</span>
            ) : null}
            {manualCheckInternal ? (
              <span className="rounded bg-sky-100 px-2 py-0.5 text-sky-900">MDM ✓</span>
            ) : null}
          </div>
        )}
        <div>
          <span className={lbl}>{t("counterparties.name")}</span>
          <input
            name="name"
            autoComplete="organization"
            value={name}
            disabled={fieldsLocked}
            onChange={(e) => setName(e.target.value)}
            className={MODAL_INPUT_CLASS}
          />
        </div>
        <div>
          <span className={lbl}>{t("counterparties.legalFormField")}</span>
          <Select
            key={i18n.language}
            value={legalForm}
            disabled={fieldsLocked}
            onValueChange={(v) => setLegalForm(v as CounterpartyLegalForm | "")}
          >
            <SelectTrigger className="" />
            <SelectContent>
              <SelectItem value="" disabled>
                {t("counterparties.selectLegalForm")}
              </SelectItem>
              {legalFormOptions.map(({ value, label }) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3 items-center">
          <label className="flex cursor-pointer items-center gap-2 text-[13px] text-[#34495E]">
            <input
              type="checkbox"
              className={MODAL_CHECKBOX_CLASS}
              disabled={fieldsLocked}
              checked={isVatPayer}
              onChange={(e) => setIsVatPayer(e.target.checked)}
            />
            <span>{t("counterparties.vatPayerCheckbox")}</span>
          </label>
          {isRiskyTaxpayer === true ? (
            <div className="inline-flex items-center rounded-lg border border-amber-300 bg-amber-100 px-2.5 py-1 text-[13px] font-semibold text-amber-900">
              {t("counterparties.riskyTaxpayerBadge")}
            </div>
          ) : (
            <span />
          )}
        </div>
        <div>
          <span className={lbl}>{t("counterparties.director", { defaultValue: "Direktor" })}</span>
          <input
            value={directorName}
            disabled={fieldsLocked}
            onChange={(e) => setDirectorName(e.target.value)}
            className={MODAL_INPUT_CLASS}
          />
        </div>
        <div className="space-y-2">
          <span className={lbl}>{t("counterparties.phones", { defaultValue: "Telefonlar" })}</span>
          {phones.map((ph, idx) => (
            <div key={idx} className="flex gap-2">
              <input
                value={ph}
                disabled={fieldsLocked}
                onChange={(e) => {
                  const next = [...phones];
                  next[idx] = e.target.value;
                  setPhones(next);
                }}
                className={MODAL_INPUT_CLASS}
              />
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            disabled={fieldsLocked}
            onClick={() => setPhones((p) => [...p, ""])}
          >
            +
          </Button>
        </div>
        {(role === "SUPPLIER" || legalForm === "INDIVIDUAL") && (
          <div>
            <span className={lbl}>FIN</span>
            <div className="flex w-full min-w-0 items-stretch gap-2">
              <input
                value={finCode}
                disabled={fieldsLocked}
                maxLength={7}
                onChange={(e) => {
                  setFinVerified(false);
                  setMdmPersonId(null);
                  setFinCode(e.target.value.toUpperCase().slice(0, 7));
                }}
                className={`${MODAL_INPUT_CLASS} min-w-0 flex-1`}
              />
              <Button
                type="button"
                variant="secondary"
                disabled={fieldsLocked || finCheckBusy || finCode.trim().length !== 7}
                aria-busy={finCheckBusy}
                className="shrink-0"
                onClick={(e) => {
                  e.preventDefault();
                  void handleCheckFin();
                }}
              >
                {finCheckBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  t("counterparties.yoxlaFin", { defaultValue: "Yoxla FIN" })
                )}
              </Button>
            </div>
            {finVerified ? (
              <span className="mt-1 inline-block rounded bg-violet-100 px-2 py-0.5 text-[12px] text-violet-900">
                FIN ✓
                {mdmPersonId ? ` · MDM ${mdmPersonId.slice(0, 4)}…${mdmPersonId.slice(-4)}` : ""}
              </span>
            ) : null}
          </div>
        )}
        <div>
          <span className={lbl}>{t("counterparties.role")}</span>
          <Select
            value={role}
            disabled={fieldsLocked}
            onValueChange={(v) => setRole(v as typeof role)}
          >
            <SelectTrigger className="" />
            <SelectContent>
              <SelectItem value="">{t("counterparties.selectRoleOptional")}</SelectItem>
              <SelectItem value="CUSTOMER">{t("counterparties.roleCustomer")}</SelectItem>
              <SelectItem value="SUPPLIER">{t("counterparties.roleSupplier")}</SelectItem>
              <SelectItem value="BOTH">{t("counterparties.roleBoth")}</SelectItem>
              <SelectItem value="OTHER">{t("counterparties.roleOther")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <span className={lbl}>{t("counterparties.address")}</span>
          <input
            name="address"
            value={address}
            disabled={fieldsLocked}
            onChange={(e) => setAddress(e.target.value)}
            className={MODAL_INPUT_CLASS}
          />
        </div>
        <div>
          <span className={lbl}>{t("counterparties.email")}</span>
          <input
            name="email"
            type="email"
            value={email}
            disabled={fieldsLocked}
            onChange={(e) => setEmail(e.target.value)}
            className={MODAL_INPUT_CLASS}
          />
        </div>
      </form>
    </SalesModalShell>
  );
}
