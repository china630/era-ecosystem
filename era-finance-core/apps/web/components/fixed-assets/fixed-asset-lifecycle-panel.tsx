"use client";

import Link from "next/link";
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
  eventType: "ACQUISITION" | "MODERNIZATION" | "REVALUATION" | "DISPOSAL";
  amount: unknown;
  portion?: unknown;
  note?: string | null;
  createdAt: string;
  transaction?: { id: string; reference: string | null; date?: string } | null;
};

type CreditSource = "SUPPLIER" | "BANK" | "DONATION";

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
            <Button type="button" variant="outline" className={MODAL_FOOTER_BUTTON_CLASS} onClick={onClose} disabled={busy}>
              {t("common.close")}
            </Button>
            <Button type="submit" variant="primary" className={MODAL_FOOTER_BUTTON_CLASS} disabled={busy}>
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
  const [modal, setModal] = useState<"acquire" | "modernize" | "revalue" | "dispose" | null>(null);
  const [amount, setAmount] = useState("");
  const [creditSource, setCreditSource] = useState<CreditSource>("BANK");
  const [counterpartyId, setCounterpartyId] = useState("");
  const [direction, setDirection] = useState<"UP" | "DOWN">("UP");
  const [portion, setPortion] = useState("1");
  const [proceeds, setProceeds] = useState("");
  const [note, setNote] = useState("");

  const loadEvents = async () => {
    setLoading(true);
    const res = await apiFetch(`/api/fixed-assets/${encodeURIComponent(assetId)}/lifecycle-events`);
    if (res.ok) {
      setEvents(await res.json());
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadEvents();
  }, [assetId]);

  const hasAcquisition = events.some((e) => e.eventType === "ACQUISITION");

  async function postAction(path: string, body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await apiFetch(`/api/fixed-assets/${encodeURIComponent(assetId)}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        toast.error(t("common.saveErr"), { description: await res.text() });
        return;
      }
      toast.success(t("common.save"));
      setModal(null);
      setAmount("");
      setNote("");
      await loadEvents();
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-[#D5DADF] bg-[#F8F9FA] p-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-semibold text-[#34495E]">
          {t("fixedAssets.lifecycleTitle")} — {assetName}
        </div>
        <div className="flex flex-wrap gap-1">
          {!hasAcquisition ? (
            <Button type="button" variant="outline" onClick={() => setModal("acquire")}>
              {t("fixedAssets.lifecycleAcquire")}
            </Button>
          ) : null}
          <Button type="button" variant="outline" onClick={() => setModal("modernize")}>
            {t("fixedAssets.lifecycleModernize")}
          </Button>
          <Button type="button" variant="outline" onClick={() => setModal("revalue")}>
            {t("fixedAssets.lifecycleRevalue")}
          </Button>
          <Button type="button" variant="outline" onClick={() => setModal("dispose")}>
            {t("fixedAssets.lifecycleDispose")}
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-[#7F8C8D] m-0">{t("common.loading")}</p>
      ) : events.length === 0 ? (
        <p className="text-xs text-[#7F8C8D] m-0">{t("fixedAssets.lifecycleEmpty")}</p>
      ) : (
        <ul className="m-0 list-none space-y-1 p-0 text-xs text-[#34495E]">
          {events.map((e) => (
            <li key={e.id} className="rounded border border-[#E8EAED] bg-white px-2 py-1">
              <span className="font-medium">{t(`fixedAssets.lifecycleEvent.${e.eventType}`)}</span>
              {" · "}
              {String(e.amount)}
              {e.portion != null ? ` · ${String(e.portion)}` : ""}
              {" · "}
              {String(e.createdAt).slice(0, 10)}
              {e.transaction?.reference ? (
                <>
                  {" · "}
                  <Link
                    href="/accounting/adjustments"
                    className="text-[#2980B9] hover:underline"
                    title={e.transaction.id}
                  >
                    {e.transaction.reference}
                  </Link>
                </>
              ) : null}
              {e.note ? ` — ${e.note}` : ""}
            </li>
          ))}
        </ul>
      )}

      <LifecycleFormModal
        title={t("fixedAssets.lifecycleAcquire")}
        open={modal === "acquire"}
        onClose={() => setModal(null)}
        busy={busy}
        onSubmit={(e) => {
          e.preventDefault();
          if (creditSource === "DONATION" && note.trim().length < 10) {
            toast.error(t("fixedAssets.lifecycleDonationNoteRequired"));
            return;
          }
          void postAction("acquire", {
            creditSource,
            counterpartyId: creditSource === "SUPPLIER" ? counterpartyId.trim() || undefined : undefined,
            amount: amount ? Number(amount) : undefined,
            note: note.trim() || undefined,
          });
        }}
      >
        <CreditFields
          creditSource={creditSource}
          setCreditSource={setCreditSource}
          counterpartyId={counterpartyId}
          setCounterpartyId={setCounterpartyId}
          amount={amount}
          setAmount={setAmount}
          amountLabel={t("fixedAssets.lifecycleAmountOptional")}
        />
        <NoteField note={note} setNote={setNote} required={creditSource === "DONATION"} multiline={creditSource === "DONATION"} />
      </LifecycleFormModal>

      <LifecycleFormModal
        title={t("fixedAssets.lifecycleModernize")}
        open={modal === "modernize"}
        onClose={() => setModal(null)}
        busy={busy}
        onSubmit={(e) => {
          e.preventDefault();
          const a = Number(amount);
          if (!Number.isFinite(a) || a <= 0) {
            toast.error(t("common.fillRequired"));
            return;
          }
          void postAction("modernize", {
            amount: a,
            creditSource,
            counterpartyId: creditSource === "SUPPLIER" ? counterpartyId.trim() || undefined : undefined,
            note: note.trim() || undefined,
          });
        }}
      >
        <CreditFields
          creditSource={creditSource}
          setCreditSource={setCreditSource}
          counterpartyId={counterpartyId}
          setCounterpartyId={setCounterpartyId}
          amount={amount}
          setAmount={setAmount}
          amountLabel={t("fixedAssets.lifecycleAmount")}
        />
        <NoteField note={note} setNote={setNote} />
      </LifecycleFormModal>

      <LifecycleFormModal
        title={t("fixedAssets.lifecycleRevalue")}
        open={modal === "revalue"}
        onClose={() => setModal(null)}
        busy={busy}
        onSubmit={(e) => {
          e.preventDefault();
          const a = Number(amount);
          if (!Number.isFinite(a) || a <= 0) {
            toast.error(t("common.fillRequired"));
            return;
          }
          void postAction("revalue", { direction, amount: a, note: note.trim() || undefined });
        }}
      >
        <label className={MODAL_FIELD_LABEL_CLASS}>
          {t("fixedAssets.lifecycleDirection")}
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value as "UP" | "DOWN")}
            className={`mt-1 block w-full ${MODAL_INPUT_CLASS}`}
          >
            <option value="UP">{t("fixedAssets.lifecycleUp")}</option>
            <option value="DOWN">{t("fixedAssets.lifecycleDown")}</option>
          </select>
        </label>
        <label className={MODAL_FIELD_LABEL_CLASS}>
          {t("fixedAssets.lifecycleAmount")}
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={`mt-1 block w-full ${MODAL_INPUT_NUMERIC_CLASS}`}
          />
        </label>
        <NoteField note={note} setNote={setNote} />
      </LifecycleFormModal>

      <LifecycleFormModal
        title={t("fixedAssets.lifecycleDispose")}
        open={modal === "dispose"}
        onClose={() => setModal(null)}
        busy={busy}
        onSubmit={(e) => {
          e.preventDefault();
          const p = Number(portion);
          if (!Number.isFinite(p) || p <= 0 || p > 1) {
            toast.error(t("common.fillRequired"));
            return;
          }
          void postAction("dispose", {
            portion: p,
            proceeds: proceeds ? Number(proceeds) : undefined,
            note: note.trim() || undefined,
          });
        }}
      >
        <label className={MODAL_FIELD_LABEL_CLASS}>
          {t("fixedAssets.lifecyclePortion")}
          <input
            type="number"
            step="0.01"
            min={0.01}
            max={1}
            value={portion}
            onChange={(e) => setPortion(e.target.value)}
            className={`mt-1 block w-full ${MODAL_INPUT_NUMERIC_CLASS}`}
          />
        </label>
        <label className={MODAL_FIELD_LABEL_CLASS}>
          {t("fixedAssets.lifecycleProceeds")}
          <input
            type="number"
            step="0.01"
            min={0}
            value={proceeds}
            onChange={(e) => setProceeds(e.target.value)}
            className={`mt-1 block w-full ${MODAL_INPUT_NUMERIC_CLASS}`}
          />
        </label>
        <NoteField note={note} setNote={setNote} />
      </LifecycleFormModal>
    </div>
  );
}

function CreditFields({
  creditSource,
  setCreditSource,
  counterpartyId,
  setCounterpartyId,
  amount,
  setAmount,
  amountLabel,
}: {
  creditSource: CreditSource;
  setCreditSource: (v: CreditSource) => void;
  counterpartyId: string;
  setCounterpartyId: (v: string) => void;
  amount: string;
  setAmount: (v: string) => void;
  amountLabel: string;
}) {
  const { t } = useTranslation();
  return (
    <>
      <label className={MODAL_FIELD_LABEL_CLASS}>
        {t("fixedAssets.lifecycleCreditSource")}
        <select
          value={creditSource}
          onChange={(e) => setCreditSource(e.target.value as CreditSource)}
          className={`mt-1 block w-full ${MODAL_INPUT_CLASS}`}
        >
          <option value="BANK">{t("fixedAssets.lifecycleBank")}</option>
          <option value="SUPPLIER">{t("fixedAssets.lifecycleSupplier")}</option>
          <option value="DONATION">{t("fixedAssets.lifecycleDonation")}</option>
        </select>
      </label>
      {creditSource === "SUPPLIER" ? (
        <label className={MODAL_FIELD_LABEL_CLASS}>
          {t("fixedAssets.lifecycleCounterpartyId")}
          <input
            value={counterpartyId}
            onChange={(e) => setCounterpartyId(e.target.value)}
            className={`mt-1 block w-full ${MODAL_INPUT_CLASS}`}
          />
        </label>
      ) : null}
      <label className={MODAL_FIELD_LABEL_CLASS}>
        {amountLabel}
        <input
          type="number"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className={`mt-1 block w-full ${MODAL_INPUT_NUMERIC_CLASS}`}
        />
      </label>
    </>
  );
}

function NoteField({
  note,
  setNote,
  required,
  multiline,
}: {
  note: string;
  setNote: (v: string) => void;
  required?: boolean;
  multiline?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <label className={MODAL_FIELD_LABEL_CLASS}>
      {t("fixedAssets.lifecycleNote")}
      {required ? " *" : ""}
      {multiline ? (
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          className={`mt-1 block w-full ${MODAL_INPUT_CLASS}`}
          placeholder={t("fixedAssets.lifecycleDonationNotePh")}
        />
      ) : (
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className={`mt-1 block w-full ${MODAL_INPUT_CLASS}`}
        />
      )}
    </label>
  );
}
