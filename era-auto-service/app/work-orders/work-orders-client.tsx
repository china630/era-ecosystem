"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  FORM_FIELD_GROUP_CLASS,
  FORM_STACK_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  ModalFooter,
  ModalShell,
  MODAL_INPUT_CLASS,
  VoenLookupField,
  PRIMARY_BUTTON_CLASS,
  PageHeader,
} from "@era/satellite-kit/ui";

const newWoFormId = "new-work-order-form";

type WorkOrder = {
  id: string;
  code: string;
  status: string;
  vehiclePlate?: string | null;
  laborAmount: string | number;
  partsAmount: string | number;
  vehicle?: {
    id: string;
    plate: string;
    customerName?: string | null;
    financeCounterpartyId?: string | null;
  } | null;
};

type Vehicle = {
  id: string;
  plate: string;
  customerName?: string | null;
  financeCounterpartyId?: string | null;
};

export function WorkOrdersClient() {
  const t = useTranslations("workOrders");
  const tc = useTranslations("common");
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [woModalOpen, setWoModalOpen] = useState(false);

  const [code, setCode] = useState("");
  const [plate, setPlate] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [voen, setVoen] = useState("");
  const [counterpartyId, setCounterpartyId] = useState("");

  const [laborDesc, setLaborDesc] = useState("Oil change");
  const [laborHours, setLaborHours] = useState("1");
  const [laborRate, setLaborRate] = useState("50");

  const [partDesc, setPartDesc] = useState("Filter");
  const [partSku, setPartSku] = useState("");
  const [partQty, setPartQty] = useState("1");
  const [partPrice, setPartPrice] = useState("25");

  const selected = orders.find((o) => o.id === selectedId) ?? null;

  const refresh = useCallback(async () => {
    const res = await fetch("/api/work-orders");
    if (!res.ok) return;
    const data = (await res.json()) as WorkOrder[];
    setOrders(Array.isArray(data) ? data : (data as { data?: WorkOrder[] }).data ?? []);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function lookupVoenResolved(voenDigits: string, name?: string | null) {
    setMessage(name ? t("voenFound", { name }) : t("voenNotFound"));
    if (!voenDigits) return;
    const mdm = await fetch("/api/mdm/voen-lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taxId: voenDigits }),
    }).then((r) => r.json()).catch(() => null);
    const id = mdm?.financeCounterpartyId ?? mdm?.organizationId;
    if (id) {
      setCounterpartyId(id);
      setMessage(t("counterpartyLinked", { id: id.slice(0, 8) }));
    }
  }

  async function saveVehicle() {
    if (!plate.trim()) return;
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plate: plate.trim(),
          customerName: customerName.trim() || undefined,
          financeCounterpartyId: counterpartyId.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setMessage(t("vehicleSaved"));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Vehicle save failed");
    } finally {
      setLoading(false);
    }
  }

  async function createWorkOrder() {
    if (!code.trim()) return;
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/work-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim(),
          vehiclePlate: plate.trim() || undefined,
        }),
      });
      const data = (await res.json()) as WorkOrder;
      if (!res.ok) throw new Error(JSON.stringify(data));
      setSelectedId(data.id);
      setCode("");
      setWoModalOpen(false);
      await refresh();
      setMessage(t("workOrderCreated", { code: data.code }));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Create failed");
    } finally {
      setLoading(false);
    }
  }

  async function addLabor() {
    if (!selectedId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/work-orders/${selectedId}/labor-lines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: laborDesc,
          hours: Number(laborHours),
          rateAzn: Number(laborRate),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      await refresh();
      setMessage(t("laborAdded"));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Labor line failed");
    } finally {
      setLoading(false);
    }
  }

  async function addPart() {
    if (!selectedId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/work-orders/${selectedId}/part-lines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: partDesc,
          sku: partSku.trim() || undefined,
          qty: Number(partQty),
          unitPrice: Number(partPrice),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      await refresh();
      setMessage(t("partAdded"));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Part line failed");
    } finally {
      setLoading(false);
    }
  }

  async function completeOrder() {
    if (!selectedId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/work-orders/${selectedId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error(await res.text());
      await refresh();
      setMessage(t("completed"));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Complete failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
      />
      {message ? (
        <p className="mb-3 text-[13px] text-[#2980B9]">{message}</p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
          <h2 className="text-[14px] font-semibold">{t("vehicleCard")}</h2>
          <input
            className="w-full rounded border px-2 py-1 text-[13px]"
            placeholder={t("plate")}
            value={plate}
            onChange={(e) => setPlate(e.target.value)}
          />
          <input
            className="w-full rounded border px-2 py-1 text-[13px]"
            placeholder={t("customerName")}
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
          />
          <VoenLookupField
            value={voen}
            onChange={setVoen}
            onResolved={(r) => void lookupVoenResolved(r.voen, r.name)}
            labels={{
              voen: t("voen"),
              check: tc("lookup"),
              found: t("voenFound", { name: "" }),
              notFound: t("voenNotFound"),
              invalid: t("voenInvalid"),
            }}
          />
          {counterpartyId ? (
            <p className="text-[12px] text-[#7F8C8D]">{t("counterparty")}: {counterpartyId}</p>
          ) : null}
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={loading}
            onClick={() => void saveVehicle()}
          >
            {t("saveVehicle")}
          </button>

          <button
            type="button"
            className={`${PRIMARY_BUTTON_CLASS} mt-2`}
            disabled={loading}
            onClick={() => setWoModalOpen(true)}
          >
            {t("createWorkOrder")}
          </button>
        </div>

        <div className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
          <h2 className="text-[14px] font-semibold">{t("orders")}</h2>
          <ul className="max-h-48 space-y-1 overflow-auto text-[13px]">
            {orders.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  className={`w-full rounded px-2 py-1 text-left hover:bg-[#EBF5FB] ${
                    selectedId === o.id ? "bg-[#EBF5FB] font-medium" : ""
                  }`}
                  onClick={() => setSelectedId(o.id)}
                >
                  {o.code} · {o.vehiclePlate ?? "—"} · {o.status} ·{" "}
                  {Number(o.laborAmount) + Number(o.partsAmount)} AZN
                </button>
              </li>
            ))}
          </ul>

          {selected ? (
            <>
              <p className="text-[13px]">
                {t("selected")}: <strong>{selected.code}</strong> ({selected.status})
              </p>
              <h3 className="text-[13px] font-semibold">{t("laborLine")}</h3>
              <input
                className="w-full rounded border px-2 py-1 text-[13px]"
                value={laborDesc}
                onChange={(e) => setLaborDesc(e.target.value)}
              />
              <div className="flex gap-2">
                <input
                  className="w-20 rounded border px-2 py-1 text-[13px]"
                  value={laborHours}
                  onChange={(e) => setLaborHours(e.target.value)}
                  placeholder="h"
                />
                <input
                  className="flex-1 rounded border px-2 py-1 text-[13px]"
                  value={laborRate}
                  onChange={(e) => setLaborRate(e.target.value)}
                  placeholder="rate AZN"
                />
                <button
                  type="button"
                  className={PRIMARY_BUTTON_CLASS}
                  disabled={loading || selected.status === "COMPLETED"}
                  onClick={() => void addLabor()}
                >
                  {t("addLabor")}
                </button>
              </div>
              <h3 className="text-[13px] font-semibold">{t("partLine")}</h3>
              <input
                className="w-full rounded border px-2 py-1 text-[13px]"
                placeholder="SKU"
                value={partSku}
                onChange={(e) => setPartSku(e.target.value)}
              />
              <input
                className="w-full rounded border px-2 py-1 text-[13px]"
                value={partDesc}
                onChange={(e) => setPartDesc(e.target.value)}
              />
              <div className="flex gap-2">
                <input
                  className="w-20 rounded border px-2 py-1 text-[13px]"
                  value={partQty}
                  onChange={(e) => setPartQty(e.target.value)}
                />
                <input
                  className="flex-1 rounded border px-2 py-1 text-[13px]"
                  value={partPrice}
                  onChange={(e) => setPartPrice(e.target.value)}
                />
                <button
                  type="button"
                  className={PRIMARY_BUTTON_CLASS}
                  disabled={loading || selected.status === "COMPLETED"}
                  onClick={() => void addPart()}
                >
                  {t("addPart")}
                </button>
              </div>
              {selected.status !== "COMPLETED" ? (
                <button
                  type="button"
                  className={PRIMARY_BUTTON_CLASS}
                  disabled={loading}
                  onClick={() => void completeOrder()}
                >
                  {t("completeWorkOrder")}
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      <ModalShell
        open={woModalOpen}
        title={t("newWorkOrder")}
        onClose={() => setWoModalOpen(false)}
        closeLabel={tc("close")}
        footer={
          <ModalFooter
            onCancel={() => setWoModalOpen(false)}
            onSubmit={() => void createWorkOrder()}
            busy={loading}
            submitLabel={t("createWorkOrder")}
            cancelLabel={tc("cancel")}
          />
        }
      >
        <div className={FORM_STACK_CLASS}>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS}>{t("woCode")}</label>
            <input
              id={newWoFormId}
              className={MODAL_INPUT_CLASS}
              placeholder={t("woCode")}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
        </div>
      </ModalShell>
    </>
  );
}
