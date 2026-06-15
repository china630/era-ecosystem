"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  ColorLegend,
  MODAL_INPUT_CLASS,
  ModalFooter,
  ModalShell,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { PageHeader } from "@era/satellite-kit/ui";

type LabOrder = {
  id: string;
  testCode: string;
  status: string;
  amountNet: string;
  patientRef: { refCode: string; fullName: string };
};

type PatientOption = { id: string; refCode: string; fullName: string };

export default function LabOrdersPage() {
  const t = useTranslations("labOrders");
  const tc = useTranslations("common");
  const tNav = useTranslations("nav");
  const router = useRouter();
  const [orders, setOrders] = useState<LabOrder[]>([]);
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ patientRefCode: "", testCode: "", visitId: "" });

  const loadOrders = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (criticalOnly) params.set("criticalOnly", "true");
    const query = params.toString() ? `?${params}` : "";
    const res = await fetch(`/api/lab-orders${query}`);
    const data = await res.json();
    setOrders(Array.isArray(data) ? data : (data.data ?? []));
    setLoading(false);
  }, [statusFilter, criticalOnly]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    void fetch("/api/patients")
      .then((r) => r.json())
      .then((d) => setPatients((d.data ?? d) as PatientOption[]));
  }, []);

  async function createOrder() {
    const patient = patients.find((p) => p.refCode === form.patientRefCode);
    if (!patient || !form.testCode.trim()) return;
    const res = await fetch("/api/lab-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientRefCode: patient.refCode,
        patientFullName: patient.fullName,
        testCode: form.testCode.trim(),
        visitId: form.visitId.trim() || undefined,
      }),
    });
    const data = await res.json();
    const order = data.data ?? data;
    setCreateOpen(false);
    setForm({ patientRefCode: "", testCode: "", visitId: "" });
    if (order?.id) router.push(`/lab-orders/${order.id}`);
    else await loadOrders();
  }

  async function completeOrder(id: string) {
    await fetch(`/api/lab-orders/${id}/complete`, { method: "POST" });
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status: "COMPLETED" } : o)),
    );
  }

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <div className="flex gap-2">
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setCreateOpen(true)}>
              {t("createTitle")}
            </button>
            <Link href="/admin/lis-profiles" className={SECONDARY_BUTTON_CLASS}>
              {t("importCsv")}
            </Link>
            <Link href="/" className={SECONDARY_BUTTON_CLASS}>
              {tNav("home")}
            </Link>
          </div>
        }
      />
      <div className={`${CARD_CONTAINER_CLASS} p-6 space-y-4`}>
        <label className="flex items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={criticalOnly}
            onChange={(e) => {
              setLoading(true);
              setCriticalOnly(e.target.checked);
            }}
          />
          {t("criticalOnly")}
        </label>
        <ColorLegend
          className="mb-2"
          items={[
            { id: "ordered", label: "ORDERED", swatchClassName: "bg-slate-100" },
            { id: "ready", label: "RESULT_READY", swatchClassName: "bg-blue-50" },
            { id: "done", label: "COMPLETED", swatchClassName: "bg-green-50" },
          ]}
        />
        <label className="flex items-center gap-2 text-[13px]">
          {t("statusFilter")}
          <select
            className="rounded border px-2 py-1"
            value={statusFilter}
            onChange={(e) => {
              setLoading(true);
              setStatusFilter(e.target.value);
            }}
          >
            <option value="">{tc("all")}</option>
            <option value="ORDERED">ORDERED</option>
            <option value="COLLECTED">COLLECTED</option>
            <option value="RESULT_READY">RESULT_READY</option>
            <option value="PUBLISHED">PUBLISHED</option>
            <option value="COMPLETED">COMPLETED</option>
          </select>
        </label>
        {loading ? (
          <p className="text-[13px] text-[#7F8C8D]">{tc("loading")}</p>
        ) : orders.length === 0 ? (
          <p className="text-[13px] text-[#7F8C8D]">{t("empty")}</p>
        ) : (
          <ul className="space-y-2">
            {orders.map((order) => (
              <li
                key={order.id}
                className="flex items-center justify-between rounded border p-3 text-[13px]"
              >
                <div>
                  <Link
                    href={`/lab-orders/${order.id}`}
                    className="font-medium text-[#2980B9] hover:underline"
                  >
                    <strong>{order.testCode}</strong>
                  </Link>{" "}
                  — {order.patientRef.fullName} ({order.patientRef.refCode})
                  <div className="text-[#7F8C8D]">
                    {order.status} · {order.amountNet} AZN
                  </div>
                </div>
                {order.status === "PUBLISHED" && (
                  <button
                    type="button"
                    className={PRIMARY_BUTTON_CLASS}
                    onClick={() => completeOrder(order.id)}
                  >
                    {tc("complete")}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <ModalShell open={createOpen} title={t("createTitle")} onClose={() => setCreateOpen(false)}>
        <div className="space-y-2">
          <select
            className={MODAL_INPUT_CLASS}
            value={form.patientRefCode}
            onChange={(e) => setForm({ ...form, patientRefCode: e.target.value })}
          >
            <option value="">{t("selectPatient")}</option>
            {patients.map((p) => (
              <option key={p.id} value={p.refCode}>
                {p.fullName} ({p.refCode})
              </option>
            ))}
          </select>
          <input
            className={MODAL_INPUT_CLASS}
            placeholder={t("testCode")}
            value={form.testCode}
            onChange={(e) => setForm({ ...form, testCode: e.target.value })}
          />
          <input
            className={MODAL_INPUT_CLASS}
            placeholder={t("visitIdOptional")}
            value={form.visitId}
            onChange={(e) => setForm({ ...form, visitId: e.target.value })}
          />
        </div>
        <ModalFooter onCancel={() => setCreateOpen(false)} onSubmit={() => void createOrder()} submitLabel={tc("save")} />
      </ModalShell>
    </>
  );
}
