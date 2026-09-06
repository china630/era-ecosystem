"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  MODAL_INPUT_CLASS,
  ModalFooter,
  ModalShell,
  PRIMARY_BUTTON_CLASS,
  PageHeader,
} from "@era/satellite-kit/ui";
import { DiagnosisPanel } from "@/components/DiagnosisPanel";
import { VisitCpoePanel } from "@/components/VisitCpoePanel";

type VisitDetail = {
  id: string;
  status: string;
  patientOrigin: string;
  amountNet: string;
  patientRef: { fullName: string; refCode: string; globalPersonId?: string | null };
  practitioner: { fullName: string };
  serviceLines: Array<{ serviceCode: string; description: string; amount: string }>;
};

export default function VisitDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const t = useTranslations("visits");
  const tc = useTranslations("common");
  const [visit, setVisit] = useState<VisitDetail | null>(null);
  const [message, setMessage] = useState("");
  const [completing, setCompleting] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [prescriptionOpen, setPrescriptionOpen] = useState(false);
  const [rxSku, setRxSku] = useState("");
  const [rxQty, setRxQty] = useState("1");
  const [rxDescription, setRxDescription] = useState("");
  const [discountOpen, setDiscountOpen] = useState(false);
  const [discountPercent, setDiscountPercent] = useState("10");
  const [discountReason, setDiscountReason] = useState("");
  const [insuranceResult, setInsuranceResult] = useState<string | null>(null);

  useEffect(() => {
    if (!params.id) return;
    void fetch(`/api/visits/${params.id}`)
      .then((r) => r.json())
      .then((d) => setVisit(d.data ?? d));
  }, [params.id]);

  async function completeVisit() {
    if (!visit || visit.status === "COMPLETED") return;
    setCompleting(true);
    setMessage("");
    try {
      const res = await fetch(`/api/visits/${visit.id}/complete`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? t("completeFailed"));
        return;
      }
      setVisit(data.data ?? data);
      setMessage(t("completeSuccess"));
      setCompleteOpen(false);
    } finally {
      setCompleting(false);
    }
  }

  async function issuePrescription() {
    if (!visit || !rxSku.trim()) return;
    const res = await fetch(`/api/visits/${visit.id}/prescription`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lines: [
          {
            sku: rxSku.trim(),
            qty: Number(rxQty) || 1,
            description: rxDescription.trim() || undefined,
          },
        ],
      }),
    });
    const data = await res.json();
    setPrescriptionOpen(false);
    setMessage(res.ok ? t("prescriptionSuccess", { count: data.reserved ?? 1 }) : t("prescriptionFailed"));
  }

  async function applyDiscount() {
    if (!visit) return;
    const res = await fetch(`/api/visits/${visit.id}/discount`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        percent: Number(discountPercent),
        reason: discountReason || "Admin discount",
      }),
    });
    setDiscountOpen(false);
    setMessage(res.ok ? "Discount applied" : "Discount failed");
  }

  async function checkInsurance() {
    if (!visit) return;
    const fin = window.prompt(t("insuranceFinPrompt"));
    if (!fin?.trim()) return;
    const res = await fetch("/api/insurance/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patientFin: fin.trim().toUpperCase() }),
    });
    const data = await res.json();
    setInsuranceResult(JSON.stringify(data.data ?? data, null, 2));
  }

  if (!visit) {
    return <p className="p-6 text-sm text-slate-500">Loading visit…</p>;
  }

  const canComplete =
    visit.status !== "COMPLETED" &&
    (visit.patientOrigin === "IN_HOUSE" || visit.patientOrigin === "HOTEL");

  return (
    <>
      <PageHeader
        title={visit.patientRef.fullName}
        subtitle={`Visit ${visit.id.slice(0, 8)} · ${visit.status}`}
      />
      <div className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
        <p className="text-sm">
          Practitioner: {visit.practitioner.fullName} · Origin: {visit.patientOrigin}
        </p>
        <ul className="space-y-1 text-sm">
          {visit.serviceLines.map((line) => (
            <li key={line.serviceCode} className="flex justify-between border-b py-1">
              <span>{line.description}</span>
              <span>{line.amount} AZN</span>
            </li>
          ))}
        </ul>
        <p className="font-medium">Total: {visit.amountNet} AZN</p>
        <DiagnosisPanel
          apiBase={`/api/visits/${visit.id}/diagnoses`}
          title={t("diagnoses")}
        />
        <VisitCpoePanel visitId={visit.id} />
        {insuranceResult && (
          <pre className="rounded border bg-slate-50 p-2 text-xs">{insuranceResult}</pre>
        )}
        {message && <p className="text-sm text-slate-600">{message}</p>}
        <div className="flex flex-wrap gap-2">
          {canComplete && (
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={completing}
              onClick={() => setCompleteOpen(true)}
            >
              {completing ? t("completing") : t("completeVisit")}
            </button>
          )}
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setPrescriptionOpen(true)}>
            {t("issuePrescription")}
          </button>
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setDiscountOpen(true)}>
            Discount
          </button>
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void checkInsurance()}>
            Insurance check
          </button>
          <Link href={`/cashier?visitId=${visit.id}`} className={PRIMARY_BUTTON_CLASS}>
            Cashier
          </Link>
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => router.push("/appointments")}>
            Back
          </button>
        </div>
      </div>
      <ModalShell open={completeOpen} title={t("completeConfirmTitle")} onClose={() => setCompleteOpen(false)}>
        <p className="text-[13px]">{t("completeConfirmBody")}</p>
        <ModalFooter
          onCancel={() => setCompleteOpen(false)}
          onSubmit={() => void completeVisit()}
          submitLabel={t("completeVisit")}
        />
      </ModalShell>
      <ModalShell open={prescriptionOpen} title={t("prescriptionTitle")} onClose={() => setPrescriptionOpen(false)}>
        <div className="space-y-2">
          <input className={MODAL_INPUT_CLASS} placeholder={t("rxSku")} value={rxSku} onChange={(e) => setRxSku(e.target.value)} />
          <input className={MODAL_INPUT_CLASS} placeholder={t("rxQty")} value={rxQty} onChange={(e) => setRxQty(e.target.value)} />
          <input className={MODAL_INPUT_CLASS} placeholder={t("rxDescription")} value={rxDescription} onChange={(e) => setRxDescription(e.target.value)} />
        </div>
        <ModalFooter onCancel={() => setPrescriptionOpen(false)} onSubmit={() => void issuePrescription()} submitLabel={t("issuePrescription")} />
      </ModalShell>
      <ModalShell open={discountOpen} title="Visit discount" onClose={() => setDiscountOpen(false)}>
        <div className="space-y-2">
          <input className={MODAL_INPUT_CLASS} placeholder="Percent" value={discountPercent} onChange={(e) => setDiscountPercent(e.target.value)} />
          <input className={MODAL_INPUT_CLASS} placeholder="Reason" value={discountReason} onChange={(e) => setDiscountReason(e.target.value)} />
        </div>
        <ModalFooter onCancel={() => setDiscountOpen(false)} onSubmit={() => void applyDiscount()} submitLabel="Apply" />
      </ModalShell>
    </>
  );
}
