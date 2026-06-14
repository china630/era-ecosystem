"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  CARD_CONTAINER_CLASS,
  PRIMARY_BUTTON_CLASS,
  PageHeader,
} from "@era/satellite-kit/ui";

type VisitDetail = {
  id: string;
  status: string;
  patientOrigin: string;
  amountNet: string;
  patientRef: { fullName: string; refCode: string };
  practitioner: { fullName: string };
  serviceLines: Array<{ serviceCode: string; description: string; amount: string }>;
};

type CompleteResult = {
  billing?: {
    channel?: string;
    folioChargeId?: string;
    eventPublished?: boolean;
  };
};

export default function VisitDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [visit, setVisit] = useState<VisitDetail | null>(null);
  const [message, setMessage] = useState("");
  const [completing, setCompleting] = useState(false);
  const [completeResult, setCompleteResult] = useState<CompleteResult | null>(null);

  useEffect(() => {
    if (!params.id) return;
    void fetch(`/api/visits/${params.id}`)
      .then((r) => r.json())
      .then((d) => setVisit(d.data ?? d));
  }, [params.id]);

  async function completeVisit() {
    if (!visit || visit.status === "COMPLETED") return;
    if (!window.confirm("Complete visit and post billing?")) return;
    setCompleting(true);
    setMessage("");
    try {
      const res = await fetch(`/api/visits/${visit.id}/complete`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "Complete failed");
        return;
      }
      const payload = data.data ?? data;
      setVisit(payload);
      setCompleteResult({ billing: payload.billing });
      setMessage("Visit completed");
    } finally {
      setCompleting(false);
    }
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
        {completeResult?.billing && (
          <div className="rounded border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-900">
            Billing: {completeResult.billing.channel ?? "—"}
            {completeResult.billing.folioChargeId
              ? ` · folio charge ${completeResult.billing.folioChargeId}`
              : ""}
            {completeResult.billing.eventPublished ? " · event published" : ""}
          </div>
        )}
        {message && <p className="text-sm text-slate-600">{message}</p>}
        <div className="flex flex-wrap gap-2">
          {canComplete && (
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={completing}
              onClick={() => void completeVisit()}
            >
              {completing ? "Completing…" : "Complete visit"}
            </button>
          )}
          <Link href={`/cashier?visitId=${visit.id}`} className={PRIMARY_BUTTON_CLASS}>
            Cashier
          </Link>
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            onClick={() => router.push("/appointments")}
          >
            Back
          </button>
        </div>
      </div>
    </>
  );
}
