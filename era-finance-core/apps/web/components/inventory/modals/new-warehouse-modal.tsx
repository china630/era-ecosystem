"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { CatalogField, Field } from "@era/satellite-kit/ui";
import { apiFetch } from "../../../lib/api-client";
import { notifyInventoryListsRefresh } from "../../../lib/list-refresh-bus";
import { InventoryModalFooter, InventoryModalShell } from "./modal-shell";

const COST_CLASS_OPTIONS = [
  "FOOD",
  "CHEMICAL",
  "CONSUMABLE",
  "TABLEWARE",
  "INVENTORY_GT",
] as const;

export function NewWarehouseModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const formId = "inventory-modal-new-warehouse";
  const [whName, setWhName] = useState("");
  const [whCode, setWhCode] = useState("");
  const [whLoc, setWhLoc] = useState("");
  const [costClass, setCostClass] = useState("");
  const [outletCode, setOutletCode] = useState("");
  const [busy, setBusy] = useState(false);

  const costClassOptions = useMemo(
    () => [
      { value: "", label: t("common.none", "—") },
      ...COST_CLASS_OPTIONS.map((c) => ({
        value: c,
        label: t(`inventory.costClass.${c}`, c),
      })),
    ],
    [t],
  );

  useEffect(() => {
    if (!open) return;
    setWhName("");
    setWhCode("");
    setWhLoc("");
    setCostClass("");
    setOutletCode("");
    setBusy(false);
  }, [open]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !whName.trim()) {
      toast.error(t("common.fillRequired"));
      return;
    }
    setBusy(true);
    const res = await apiFetch("/api/inventory/warehouses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: whName.trim(),
        ...(whCode.trim() ? { code: whCode.trim() } : {}),
        location: whLoc,
        ...(costClass ? { costClass } : {}),
        ...(outletCode.trim() ? { satelliteOutletCode: outletCode.trim() } : {}),
      }),
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(t("common.saveErr"), { description: await res.text() });
      return;
    }
    toast.success(t("common.save"));
    notifyInventoryListsRefresh();
    onClose();
  }

  return (
    <InventoryModalShell
      open={open}
      title={t("inventory.warehouseNewTitle")}
      onClose={onClose}
      maxWidthClass="max-w-lg"
      footer={
        <InventoryModalFooter onCancel={onClose} busy={busy} formId={formId} />
      }
    >
      <form id={formId} className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
        <Field
          label={t("inventory.whNamePh")}
          preset="shortText"
          placeholder={t("inventory.whNamePlaceholder")}
          value={whName}
          onChange={(e) => setWhName(e.target.value)}
        />
        <Field
          label={t("inventory.whCodePh")}
          preset="code"
          placeholder={t("inventory.whCodePlaceholder")}
          value={whCode}
          onChange={(e) => setWhCode(e.target.value)}
        />
        <Field
          label={t("inventory.whLocPh")}
          preset="shortText"
          placeholder={t("inventory.whLocPlaceholder")}
          value={whLoc}
          onChange={(e) => setWhLoc(e.target.value)}
        />
        <CatalogField
          kind="CLOSED_SMALL"
          label={t("inventory.whCostClass", "Cost class (buffet)")}
          options={costClassOptions}
          value={costClass}
          onChange={(next) => setCostClass(String(next ?? ""))}
        />
        <Field
          label={t("inventory.whOutletCode", "Satellite outlet code")}
          preset="code"
          placeholder="NAFTANI"
          value={outletCode}
          onChange={(e) => setOutletCode(e.target.value)}
        />
      </form>
    </InventoryModalShell>
  );
}
