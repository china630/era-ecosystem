"use client";

import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { apiFetch } from "../../lib/api-client";
import {
  MODAL_DIALOG_CONTENT_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  MODAL_FOOTER_ACTIONS_CLASS,
  MODAL_FOOTER_BUTTON_CLASS,
  MODAL_INPUT_CLASS,
  MODAL_INPUT_NUMERIC_CLASS,
} from "../../lib/design-system";
import { Button } from "../ui/button";

type LifecycleEvent = {
  id: string;
  eventType: string;
  amount: unknown;
  eventDate: string;
  note?: string | null;
  createdAt: string;
};

type CreditSource = "SUPPLIER" | "BANK";
type ModalKind =
  | "acquire"
  | "commission"
  | "capitalize"
  | "revalue"
  | "dispose"
  | "transfer"
  | "gratuitous-in"
  | "gratuitous-out"
  | "inventory"
  | null;

function LifecycleFormModal({
  title,
  open,
  onClose,
  busy,
  children,
  onSubmit,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  busy: boolean;
  children: React.ReactNode;
  onSubmit: (e: FormEvent) => void;
}) {
  const { t } = useTranslation();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className={`${MODAL_DIALOG_CONTENT_CLASS} max-w-md`} role="dialog" aria-modal="true">
        <h3 className="m-0 text-lg font-semibold text-[#34495E]">{title}</h3>
        <form className="mt-4 grid gap-3" onSubmit={onSubmit}>
          {children}
          <div className={MODAL_FOOTER_ACTIONS_CLASS}>
            <Button
              type="button"
              variant="outline"
              className={MODAL_FOOTER_BUTTON_CLASS}
              onClick={onClose}
              disabled={busy}
            >
              {t("common.close")}
            </Button>
            <Button
              type="submit"
              variant="primary"
              className={MODAL_FOOTER_BUTTON_CLASS}
              disabled={busy}
            >
              {busy ? "…" : t("common.save")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function FixedAssetLifecyclePanel({
  assetId,
  assetName,
  onChanged,
}: {
  assetId: string;
  assetName: string;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [events, setEvents] = useState<LifecycleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<ModalKind>(null);
  const [amount, setAmount] = useState("");
  const [creditSource, setCreditSource] = useState<CreditSource>("BANK");
  const [counterpartyId, setCounterpartyId] = useState("");
  const [direction, setDirection] = useState<"UP" | "DOWN">("UP");
  const [inventoryDirection, setInventoryDirection] = useState<"SURPLUS" | "SHORTAGE">(
    "SURPLUS",
  );
  const [toDepartmentId, setToDepartmentId] = useState("");
  const [proceeds, setProceeds] = useState("");
  const [note, setNote] = useState("");

  const loadEvents = async () => {
    setLoading(true);
    const res = await apiFetch(`/api/fixed-assets/${encodeURIComponent(assetId)}/events`);
    if (res.ok) {
      setEvents(await res.json());
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadEvents();
  }, [assetId]);

  const hasAcquire = events.some((e) => e.eventType === "ACQUIRE");

  async function postAction(path: string, body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await apiFetch(
        `/api/fixed-assets/${encodeURIComponent(assetId)}/${path}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        toast.error(await res.text());
        return;
      }
      toast.success(t("common.save"));
      setModal(null);
      setAmount("");
      setCounterpartyId("");
      setProceeds("");
      setNote("");
      setToDepartmentId("");
      await loadEvents();
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!modal) return;
    if (modal === "acquire") {
      await postAction("acquire", {
        creditSource,
        counterpartyId: counterpartyId || undefined,
        amount: amount ? Number(amount) : undefined,
        note: note || undefined,
      });
      return;
    }
    if (modal === "commission") {
      await postAction("commission", { note: note || undefined });
      return;
    }
    if (modal === "capitalize") {
      await postAction("capitalize", {
        amount: Number(amount),
        creditSource,
        counterpartyId: counterpartyId || undefined,
        note: note || undefined,
      });
      return;
    }
    if (modal === "revalue") {
      await postAction("revalue", {
        direction,
        amount: Number(amount),
        note: note || undefined,
      });
      return;
    }
    if (modal === "dispose") {
      await postAction("dispose", {
        proceeds: proceeds ? Number(proceeds) : 0,
        note: note || undefined,
      });
      return;
    }
    if (modal === "transfer") {
      await postAction("transfer", {
        toDepartmentId,
        note: note || undefined,
      });
      return;
    }
    if (modal === "gratuitous-in") {
      await postAction("gratuitous-in", {
        amount: amount ? Number(amount) : undefined,
        note: note || undefined,
      });
      return;
    }
    if (modal === "gratuitous-out") {
      await postAction("gratuitous-out", { note: note || undefined });
      return;
    }
    if (modal === "inventory") {
      await postAction("inventory", {
        direction: inventoryDirection,
        amount: Number(amount),
        note: note || undefined,
      });
    }
  }

  const actions: { key: Exclude<ModalKind, null>; label: string; disabled?: boolean }[] = [
    { key: "acquire", label: t("fixedAssets.lifecycleAcquire"), disabled: hasAcquire },
    { key: "commission", label: t("fixedAssets.lifecycleCommission") },
    { key: "capitalize", label: t("fixedAssets.lifecycleCapitalize") },
    { key: "revalue", label: t("fixedAssets.lifecycleRevalue") },
    { key: "dispose", label: t("fixedAssets.lifecycleDispose") },
    { key: "transfer", label: t("fixedAssets.lifecycleTransfer") },
    { key: "gratuitous-in", label: t("fixedAssets.lifecycleGratuitousIn") },
    { key: "gratuitous-out", label: t("fixedAssets.lifecycleGratuitousOut") },
    { key: "inventory", label: t("fixedAssets.lifecycleInventory") },
  ];

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-[#D5DADF] bg-[#F8FAFB] p-3">
      <div className="text-sm font-semibold text-[#34495E]">
        {t("fixedAssets.lifecycleTitle")}: {assetName}
      </div>
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
            <Button
              key={a.key}
              type="button"
              variant="outline"
              className="!px-2 !py-1 text-xs"
              disabled={a.disabled || busy}
              onClick={() => setModal(a.key)}
            >
            {a.label}
          </Button>
        ))}
      </div>
      {loading ? (
        <p className="m-0 text-sm text-[#7F8C8D]">{t("common.loading")}</p>
      ) : events.length === 0 ? (
        <p className="m-0 text-sm text-[#7F8C8D]">{t("fixedAssets.lifecycleEmpty")}</p>
      ) : (
        <ul className="m-0 list-none space-y-1 p-0 text-sm text-[#34495E]">
          {events.map((ev) => (
            <li key={ev.id} className="flex flex-wrap gap-2 border-b border-[#E8ECF0] py-1">
              <span className="font-medium">{ev.eventType}</span>
              <span>{String(ev.eventDate).slice(0, 10)}</span>
              <span>{String(ev.amount)}</span>
              {ev.note ? <span className="text-[#7F8C8D]">{ev.note}</span> : null}
            </li>
          ))}
        </ul>
      )}

      <LifecycleFormModal
        title={modal ? t(`fixedAssets.lifecycleModal.${modal}`) : ""}
        open={modal != null}
        onClose={() => setModal(null)}
        busy={busy}
        onSubmit={(e) => void onSubmit(e)}
      >
        {(modal === "acquire" || modal === "capitalize") && (
          <>
            <label className={MODAL_FIELD_LABEL_CLASS}>
              {t("fixedAssets.lifecycleCreditSource")}
              <select
                className={MODAL_INPUT_CLASS}
                value={creditSource}
                onChange={(e) => setCreditSource(e.target.value as CreditSource)}
              >
                <option value="BANK">BANK</option>
                <option value="SUPPLIER">SUPPLIER</option>
              </select>
            </label>
            {creditSource === "SUPPLIER" && (
              <label className={MODAL_FIELD_LABEL_CLASS}>
                counterpartyId
                <input
                  className={MODAL_INPUT_CLASS}
                  value={counterpartyId}
                  onChange={(e) => setCounterpartyId(e.target.value)}
                  required
                />
              </label>
            )}
            <label className={MODAL_FIELD_LABEL_CLASS}>
              {t("fixedAssets.lifecycleAmount")}
              <input
                className={MODAL_INPUT_NUMERIC_CLASS}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required={modal === "capitalize"}
              />
            </label>
          </>
        )}
        {modal === "revalue" && (
          <>
            <label className={MODAL_FIELD_LABEL_CLASS}>
              {t("fixedAssets.lifecycleDirection")}
              <select
                className={MODAL_INPUT_CLASS}
                value={direction}
                onChange={(e) => setDirection(e.target.value as "UP" | "DOWN")}
              >
                <option value="UP">UP</option>
                <option value="DOWN">DOWN</option>
              </select>
            </label>
            <label className={MODAL_FIELD_LABEL_CLASS}>
              {t("fixedAssets.lifecycleAmount")}
              <input
                className={MODAL_INPUT_NUMERIC_CLASS}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </label>
          </>
        )}
        {modal === "dispose" && (
          <label className={MODAL_FIELD_LABEL_CLASS}>
            {t("fixedAssets.lifecycleProceeds")}
            <input
              className={MODAL_INPUT_NUMERIC_CLASS}
              value={proceeds}
              onChange={(e) => setProceeds(e.target.value)}
            />
          </label>
        )}
        {modal === "transfer" && (
          <label className={MODAL_FIELD_LABEL_CLASS}>
            {t("fixedAssets.lifecycleToDepartment")}
            <input
              className={MODAL_INPUT_CLASS}
              value={toDepartmentId}
              onChange={(e) => setToDepartmentId(e.target.value)}
              required
            />
          </label>
        )}
        {(modal === "gratuitous-in" || modal === "inventory") && (
          <label className={MODAL_FIELD_LABEL_CLASS}>
            {t("fixedAssets.lifecycleAmount")}
            <input
              className={MODAL_INPUT_NUMERIC_CLASS}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required={modal === "inventory"}
            />
          </label>
        )}
        {modal === "inventory" && (
          <label className={MODAL_FIELD_LABEL_CLASS}>
            {t("fixedAssets.lifecycleDirection")}
            <select
              className={MODAL_INPUT_CLASS}
              value={inventoryDirection}
              onChange={(e) =>
                setInventoryDirection(e.target.value as "SURPLUS" | "SHORTAGE")
              }
            >
              <option value="SURPLUS">SURPLUS</option>
              <option value="SHORTAGE">SHORTAGE</option>
            </select>
          </label>
        )}
        <label className={MODAL_FIELD_LABEL_CLASS}>
          {t("fixedAssets.lifecycleNote")}
          <input
            className={MODAL_INPUT_CLASS}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
      </LifecycleFormModal>
    </div>
  );
}
