"use client";

import { FormEvent, useEffect, useState } from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { apiFetch } from "../../lib/api-client";
import {
  MODAL_CLOSE_BUTTON_CLASS,
  MODAL_DIALOG_CONTENT_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  MODAL_FOOTER_ACTIONS_CLASS,
  MODAL_FOOTER_BUTTON_CLASS,
  MODAL_INPUT_CLASS,
  MODAL_INPUT_NUMERIC_CLASS,
} from "../../lib/design-system";
import { Button } from "../ui/button";

export function IntangibleAssetModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [invNo, setInvNo] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [life, setLife] = useState("36");
  const [salvage, setSalvage] = useState("0");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName("");
    setInvNo("");
    setPurchaseDate("");
    setPurchasePrice("");
    setLife("36");
    setSalvage("0");
    setBusy(false);
  }, [open]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!name.trim() || !invNo.trim() || !purchaseDate) {
      toast.error(t("common.fillRequired"));
      return;
    }
    const pp = Number(purchasePrice);
    const lifeN = Number(life);
    if (!Number.isFinite(pp) || !Number.isFinite(lifeN) || lifeN < 1) {
      toast.error(t("common.fillRequired"));
      return;
    }
    setBusy(true);
    try {
      const res = await apiFetch("/api/intangible-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          inventoryNumber: invNo.trim(),
          purchaseDate,
          purchasePrice: pp,
          usefulLifeMonths: lifeN,
          salvageValue: Number(salvage || 0),
        }),
      });
      if (!res.ok) {
        toast.error(t("common.saveErr"), { description: await res.text() });
        return;
      }
      toast.success(t("common.save"));
      onSaved();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className={`${MODAL_DIALOG_CONTENT_CLASS} max-w-lg`} role="dialog" aria-modal="true">
        <header className="flex shrink-0 items-start justify-between gap-3">
          <h3 className="m-0 min-w-0 flex-1 pr-2 text-lg font-semibold leading-snug text-[#34495E]">
            {t("intangibleAssets.newTitle")}
          </h3>
          <Button type="button" variant="ghost" className={MODAL_CLOSE_BUTTON_CLASS} onClick={onClose} aria-label={t("common.close")}>
            <X className="h-4 w-4 shrink-0" aria-hidden />
          </Button>
        </header>
        <form id="intangible-asset-modal-form" className="mt-4 grid gap-4" onSubmit={(e) => void onSubmit(e)}>
          <label className={MODAL_FIELD_LABEL_CLASS}>
            {t("intangibleAssets.name")}
            <input value={name} onChange={(e) => setName(e.target.value)} className={`mt-1 block w-full ${MODAL_INPUT_CLASS}`} />
          </label>
          <label className={MODAL_FIELD_LABEL_CLASS}>
            {t("intangibleAssets.invNo")}
            <input value={invNo} onChange={(e) => setInvNo(e.target.value)} className={`mt-1 block w-full ${MODAL_INPUT_CLASS}`} />
          </label>
          <label className={MODAL_FIELD_LABEL_CLASS}>
            {t("intangibleAssets.purchaseDate")}
            <input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} className={`mt-1 block w-full ${MODAL_INPUT_CLASS}`} />
          </label>
          <label className={MODAL_FIELD_LABEL_CLASS}>
            {t("intangibleAssets.purchasePrice")}
            <input type="number" step="0.01" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} className={`mt-1 block w-full ${MODAL_INPUT_NUMERIC_CLASS}`} />
          </label>
          <label className={MODAL_FIELD_LABEL_CLASS}>
            {t("intangibleAssets.life")}
            <input type="number" min={1} value={life} onChange={(e) => setLife(e.target.value)} className={`mt-1 block w-full ${MODAL_INPUT_NUMERIC_CLASS}`} />
          </label>
          <label className={MODAL_FIELD_LABEL_CLASS}>
            {t("intangibleAssets.salvage")}
            <input type="number" step="0.01" value={salvage} onChange={(e) => setSalvage(e.target.value)} className={`mt-1 block w-full ${MODAL_INPUT_NUMERIC_CLASS}`} />
          </label>
        </form>
        <div className={MODAL_FOOTER_ACTIONS_CLASS}>
          <Button type="button" variant="outline" className={MODAL_FOOTER_BUTTON_CLASS} onClick={onClose} disabled={busy}>
            {t("common.close")}
          </Button>
          <Button type="submit" variant="primary" className={MODAL_FOOTER_BUTTON_CLASS} form="intangible-asset-modal-form" disabled={busy}>
            {busy ? "тАж" : t("intangibleAssets.save")}
          </Button>
        </div>
      </div>
    </div>
  );
}
