"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  CatalogField,
  GHOST_BUTTON_CLASS,
  MODAL_INPUT_CLASS,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { useAuth } from "@/lib/auth-context";
import { orchFetch } from "@/lib/orch-api";
import type { FiscalDeviceRow, OperatingMode, PaymentMethodRow } from "@/lib/org-hub-shared";
import { useOrgShell } from "../org-shell";

const PAY_SAT_OPTIONS = [
  { value: "hotel", label: "hotel" },
  { value: "clinic", label: "clinic" },
  { value: "fnb", label: "fnb" },
  { value: "retail", label: "retail" },
];

type PayDraft = {
  id: string | null;
  code: string;
  nameAz: string;
  nameRu: string;
  nameEn: string;
  fiscalHint: "CASH" | "CARD" | "NONE";
  satellites: string[];
  active: boolean;
};

const EMPTY_PAY: PayDraft = {
  id: null,
  code: "",
  nameAz: "",
  nameRu: "",
  nameEn: "",
  fiscalHint: "CASH",
  satellites: ["hotel", "clinic", "fnb", "retail"],
  active: true,
};

const EMPTY_FISCAL = {
  kind: "FISCAL_KKM",
  providerId: "mock",
  label: "",
  outletCode: "",
  registerCode: "",
  endpoint: "",
  secrets: "",
  isOrgDefault: false,
};

export default function OrgPaymentsPage() {
  const { orgId, mode: shellMode } = useOrgShell();
  const { token } = useAuth();
  const t = useTranslations("superAdmin.orgHub");
  const [pane, setPane] = useState<"methods" | "fiscal">("methods");
  const [mode, setMode] = useState<OperatingMode | null>(shellMode);
  const [fiscalDevices, setFiscalDevices] = useState<FiscalDeviceRow[]>([]);
  const [fiscalDraft, setFiscalDraft] = useState(EMPTY_FISCAL);
  const [fiscalOpen, setFiscalOpen] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodRow[]>([]);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payDraft, setPayDraft] = useState<PayDraft>(EMPTY_PAY);
  const [savingPay, setSavingPay] = useState(false);
  const [savingFiscal, setSavingFiscal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const parentCash = mode?.mode === "DEPARTMENT" && mode.fiscalRouting === "PARENT";

  const reload = useCallback(async () => {
    if (!token || !orgId) return;
    setLoading(true);
    try {
      const [modeRes, fiscalRes, payRes] = await Promise.all([
        orchFetch(`/v1/admin/orgs/${orgId}/operating-mode`, { token }),
        orchFetch(`/v1/admin/orgs/${orgId}/fiscal-devices`, { token }),
        orchFetch(`/v1/admin/orgs/${orgId}/payment-methods`, { token }),
      ]);
      if (modeRes.ok) setMode((await modeRes.json()) as OperatingMode);
      if (fiscalRes.ok) setFiscalDevices((await fiscalRes.json()) as FiscalDeviceRow[]);
      if (payRes.ok) setPaymentMethods((await payRes.json()) as PaymentMethodRow[]);
    } finally {
      setLoading(false);
    }
  }, [token, orgId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function addFiscalDevice() {
    if (!token || !fiscalDraft.label.trim()) return;
    setSavingFiscal(true);
    setMessage("");
    let secrets: Record<string, string> | undefined;
    if (fiscalDraft.secrets.trim()) {
      try {
        secrets = JSON.parse(fiscalDraft.secrets) as Record<string, string>;
      } catch {
        setMessage(t("fiscalSaveFailed", { status: "JSON" }));
        setSavingFiscal(false);
        return;
      }
    }
    try {
      const res = await orchFetch(`/v1/admin/orgs/${orgId}/fiscal-devices`, {
        token,
        method: "POST",
        body: JSON.stringify({
          kind: fiscalDraft.kind,
          providerId: fiscalDraft.providerId,
          label: fiscalDraft.label.trim(),
          outletCode: fiscalDraft.outletCode.trim() || null,
          registerCode: fiscalDraft.registerCode.trim() || null,
          endpoint: fiscalDraft.endpoint.trim() || null,
          secrets: secrets ?? undefined,
          isOrgDefault: fiscalDraft.isOrgDefault,
        }),
      });
      if (!res.ok) {
        setMessage(t("fiscalSaveFailed", { status: res.status }));
        return;
      }
      setFiscalDraft(EMPTY_FISCAL);
      setFiscalOpen(false);
      setMessage(t("fiscalSaved"));
      await reload();
    } finally {
      setSavingFiscal(false);
    }
  }

  async function retireFiscalDevice(deviceId: string) {
    if (!token) return;
    const res = await orchFetch(`/v1/admin/orgs/${orgId}/fiscal-devices/${deviceId}`, {
      token,
      method: "DELETE",
    });
    if (!res.ok) {
      setMessage(t("fiscalSaveFailed", { status: res.status }));
      return;
    }
    setMessage(t("fiscalRetired"));
    await reload();
  }

  async function savePay() {
    if (!token) return;
    if (
      !payDraft.nameAz.trim() ||
      !payDraft.nameRu.trim() ||
      !payDraft.nameEn.trim() ||
      payDraft.satellites.length === 0 ||
      (!payDraft.id && !payDraft.code.trim())
    ) {
      setMessage(t("payValidation"));
      return;
    }
    setSavingPay(true);
    setMessage("");
    try {
      const body = {
        code: payDraft.code.trim() || undefined,
        nameAz: payDraft.nameAz.trim(),
        nameRu: payDraft.nameRu.trim(),
        nameEn: payDraft.nameEn.trim(),
        fiscalHint: payDraft.fiscalHint,
        satellites: payDraft.satellites,
        active: payDraft.active,
      };
      const res = payDraft.id
        ? await orchFetch(`/v1/admin/orgs/${orgId}/payment-methods/${payDraft.id}`, {
            token,
            method: "PUT",
            body: JSON.stringify(body),
          })
        : await orchFetch(`/v1/admin/orgs/${orgId}/payment-methods`, {
            token,
            method: "POST",
            body: JSON.stringify(body),
          });
      if (!res.ok) {
        setMessage(t("paySaveFailed", { status: res.status }));
        return;
      }
      setPayModalOpen(false);
      setMessage(t("paySaved"));
      await reload();
    } finally {
      setSavingPay(false);
    }
  }

  async function deactivatePay(id: string) {
    if (!token) return;
    if (!window.confirm(t("payDisableConfirm"))) return;
    const res = await orchFetch(`/v1/admin/orgs/${orgId}/payment-methods/${id}`, {
      token,
      method: "DELETE",
    });
    if (!res.ok) {
      setMessage(t("paySaveFailed", { status: res.status }));
      return;
    }
    setMessage(t("paySaved"));
    await reload();
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("payPageTitle")}
        subtitle={pane === "fiscal" ? t("fiscalHint") : t("payHint")}
        actions={
          pane === "methods" && !parentCash ? (
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              onClick={() => {
                setPayDraft(EMPTY_PAY);
                setPayModalOpen(true);
              }}
            >
              {t("payAdd")}
            </button>
          ) : pane === "fiscal" ? (
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setFiscalOpen(true)}>
              {t("fiscalAdd")}
            </button>
          ) : null
        }
      />
      <div className="flex gap-2 text-sm">
        <button
          type="button"
          className={pane === "methods" ? PRIMARY_BUTTON_CLASS : GHOST_BUTTON_CLASS}
          onClick={() => setPane("methods")}
        >
          {t("payTitle")}
        </button>
        <button
          type="button"
          className={pane === "fiscal" ? PRIMARY_BUTTON_CLASS : GHOST_BUTTON_CLASS}
          onClick={() => setPane("fiscal")}
        >
          {t("fiscalTitle")}
        </button>
      </div>
      {loading ? <p className="text-sm text-[#7F8C8D]">{t("loading")}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {parentCash ? <p className="text-xs text-[#2980B9]">{t("payParentCash")}</p> : null}

      {pane === "methods" ? (
        <section className={`${CARD_CONTAINER_CLASS} p-4`}>
          <ul className="space-y-1 text-sm">
            {paymentMethods.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-2">
                <code className="font-mono text-[#2980B9]">{row.code}</code>
                <span>
                  {row.nameRu || row.nameEn}
                  {!row.active ? ` · ${t("payOff")}` : ""}
                </span>
                {!parentCash ? (
                  <>
                    <button
                      type="button"
                      className="text-xs text-[#2980B9]"
                      onClick={() => {
                        setPayDraft({
                          id: row.id,
                          code: row.code,
                          nameAz: row.nameAz,
                          nameRu: row.nameRu,
                          nameEn: row.nameEn,
                          fiscalHint: (row.fiscalHint as PayDraft["fiscalHint"]) || "NONE",
                          satellites: row.satellites ?? [],
                          active: row.active,
                        });
                        setPayModalOpen(true);
                      }}
                    >
                      {t("payEdit")}
                    </button>
                    {row.active ? (
                      <button type="button" className="text-xs text-[#E74C3C]" onClick={() => void deactivatePay(row.id)}>
                        {t("payDisable")}
                      </button>
                    ) : null}
                  </>
                ) : null}
              </li>
            ))}
            {paymentMethods.length === 0 ? <li className="text-[#7F8C8D]">{t("payEmpty")}</li> : null}
          </ul>
        </section>
      ) : (
        <section className={`${CARD_CONTAINER_CLASS} p-4`}>
          <ul className="space-y-1 text-sm">
            {fiscalDevices.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-2">
                <span>
                  {d.label} · {d.kind} · {d.providerId}
                  {d.isOrgDefault ? ` · ${t("fiscalDefaultMark")}` : ""}
                  {d.hasSecrets ? ` · ${t("fiscalSecretsMark")}` : ""}
                </span>
                <button type="button" className="text-xs text-[#E74C3C]" onClick={() => void retireFiscalDevice(d.id)}>
                  {t("fiscalRetire")}
                </button>
              </li>
            ))}
            {fiscalDevices.length === 0 ? <li className="text-[#7F8C8D]">{t("fiscalEmpty")}</li> : null}
          </ul>
        </section>
      )}

      <ModalShell open={fiscalOpen} onClose={() => setFiscalOpen(false)} title={t("fiscalAdd")}>
        <div className="grid gap-2 p-1 sm:grid-cols-2">
          <CatalogField
            kind="CLOSED_SMALL"
            label={t("fiscalKind")}
            value={fiscalDraft.kind}
            onChange={(next) => setFiscalDraft((d) => ({ ...d, kind: String(next) }))}
            options={[
              { value: "FISCAL_KKM", label: t("fiscalKindKkm") },
              { value: "BANK_POS", label: t("fiscalKindPos") },
            ]}
          />
          <CatalogField
            kind="CLOSED_SMALL"
            label={t("fiscalProvider")}
            value={fiscalDraft.providerId}
            onChange={(next) => setFiscalDraft((d) => ({ ...d, providerId: String(next) }))}
            options={[
              { value: "mock", label: "mock" },
              { value: "omnitech", label: "omnitech" },
              { value: "nbc", label: "nbc" },
              { value: "cybernet", label: "cybernet" },
            ]}
          />
          <label className="text-xs font-medium text-[#7F8C8D]">
            {t("fiscalLabel")}
            <input className={`${MODAL_INPUT_CLASS} mt-1 w-full`} value={fiscalDraft.label} onChange={(e) => setFiscalDraft((d) => ({ ...d, label: e.target.value }))} />
          </label>
          <label className="text-xs font-medium text-[#7F8C8D]">
            {t("fiscalOutlet")}
            <input className={`${MODAL_INPUT_CLASS} mt-1 w-full`} value={fiscalDraft.outletCode} onChange={(e) => setFiscalDraft((d) => ({ ...d, outletCode: e.target.value }))} />
          </label>
          <label className="text-xs font-medium text-[#7F8C8D]">
            {t("fiscalRegister")}
            <input className={`${MODAL_INPUT_CLASS} mt-1 w-full`} value={fiscalDraft.registerCode} onChange={(e) => setFiscalDraft((d) => ({ ...d, registerCode: e.target.value }))} />
          </label>
          <label className="text-xs font-medium text-[#7F8C8D]">
            {t("fiscalEndpoint")}
            <input className={`${MODAL_INPUT_CLASS} mt-1 w-full`} value={fiscalDraft.endpoint} onChange={(e) => setFiscalDraft((d) => ({ ...d, endpoint: e.target.value }))} />
          </label>
          <label className="text-xs font-medium text-[#7F8C8D] sm:col-span-2">
            {t("fiscalSecrets")}
            <input className={`${MODAL_INPUT_CLASS} mt-1 w-full`} value={fiscalDraft.secrets} onChange={(e) => setFiscalDraft((d) => ({ ...d, secrets: e.target.value }))} />
          </label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={fiscalDraft.isOrgDefault} onChange={(e) => setFiscalDraft((d) => ({ ...d, isOrgDefault: e.target.checked }))} />
            {t("fiscalOrgDefault")}
          </label>
          <button type="button" className={PRIMARY_BUTTON_CLASS} disabled={savingFiscal} onClick={() => void addFiscalDevice()}>
            {savingFiscal ? t("saving") : t("save")}
          </button>
        </div>
      </ModalShell>

      <ModalShell open={payModalOpen} onClose={() => setPayModalOpen(false)} title={payDraft.id ? t("payEditTitle") : t("payAdd")}>
        <div className="space-y-3 p-1">
          <label className="block text-xs font-medium text-[#7F8C8D]">
            {t("payCode")}
            <input className={`${MODAL_INPUT_CLASS} mt-1 w-full`} value={payDraft.code} disabled={Boolean(payDraft.id)} onChange={(e) => setPayDraft((d) => ({ ...d, code: e.target.value }))} />
          </label>
          <label className="block text-xs font-medium text-[#7F8C8D]">
            {t("payNameRu")}
            <input className={`${MODAL_INPUT_CLASS} mt-1 w-full`} value={payDraft.nameRu} onChange={(e) => setPayDraft((d) => ({ ...d, nameRu: e.target.value }))} />
          </label>
          <label className="block text-xs font-medium text-[#7F8C8D]">
            {t("payNameAz")}
            <input className={`${MODAL_INPUT_CLASS} mt-1 w-full`} value={payDraft.nameAz} onChange={(e) => setPayDraft((d) => ({ ...d, nameAz: e.target.value }))} />
          </label>
          <label className="block text-xs font-medium text-[#7F8C8D]">
            {t("payNameEn")}
            <input className={`${MODAL_INPUT_CLASS} mt-1 w-full`} value={payDraft.nameEn} onChange={(e) => setPayDraft((d) => ({ ...d, nameEn: e.target.value }))} />
          </label>
          <CatalogField
            kind="CLOSED_SMALL"
            label={t("payFiscalHint")}
            value={payDraft.fiscalHint}
            onChange={(next) => setPayDraft((d) => ({ ...d, fiscalHint: next as PayDraft["fiscalHint"] }))}
            options={[
              { value: "CASH", label: t("fiscalHintCash") },
              { value: "CARD", label: t("fiscalHintCard") },
              { value: "NONE", label: t("fiscalHintNone") },
            ]}
          />
          <CatalogField
            kind="MULTI"
            label={t("paySatellites")}
            value={payDraft.satellites}
            onChange={(next) => setPayDraft((d) => ({ ...d, satellites: Array.isArray(next) ? next.map(String) : [] }))}
            options={PAY_SAT_OPTIONS}
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={payDraft.active} onChange={(e) => setPayDraft((d) => ({ ...d, active: e.target.checked }))} />
            {t("payActive")}
          </label>
          <button type="button" className={PRIMARY_BUTTON_CLASS} disabled={savingPay} onClick={() => void savePay()}>
            {savingPay ? t("saving") : t("save")}
          </button>
        </div>
      </ModalShell>
    </div>
  );
}
