"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  CARD_CONTAINER_CLASS,
  PRIMARY_BUTTON_CLASS,
  PageHeader,
} from "@era/satellite-kit/ui";

type LabOrder = {
  id: string;
  testCode: string;
  status: string;
  amountNet: string;
  collectedAt: string | null;
  publishedAt: string | null;
  resultJson: string | null;
  visitId: string | null;
  patientRef: { refCode: string; fullName: string };
};

type ResultLine = { code: string; value: string; unit?: string };

const STEPS = [
  { key: "COLLECTED", label: "Collect sample" },
  { key: "RESULT_READY", label: "Enter results" },
  { key: "PUBLISHED", label: "Publish" },
  { key: "COMPLETED", label: "Complete & bill" },
] as const;

function stepIndex(status: string): number {
  if (status === "ORDERED") return 0;
  if (status === "COLLECTED" || status === "IN_PROGRESS") return 1;
  if (status === "RESULT_READY") return 2;
  if (status === "PUBLISHED") return 3;
  return 4;
}

export default function LabOrderDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [order, setOrder] = useState<LabOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resultLines, setResultLines] = useState<ResultLine[]>([
    { code: "WBC", value: "", unit: "10^9/L" },
  ]);

  const loadOrder = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await fetch("/api/lab-orders");
    const data = await res.json();
    const found = Array.isArray(data)
      ? (data as LabOrder[]).find((o) => o.id === id)
      : null;
    setOrder(found ?? null);
    if (found?.resultJson) {
      try {
        setResultLines(JSON.parse(found.resultJson) as ResultLine[]);
      } catch {
        /* keep defaults */
      }
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  async function runAction(path: string, body?: unknown) {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/lab-orders/${id}/${path}`, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Action failed");
      setBusy(false);
      return;
    }
    setOrder(data);
    setBusy(false);
  }

  const currentStep = order ? stepIndex(order.status) : 0;

  return (
    <>
      <PageHeader
        title="Lab order workflow"
        subtitle={`K2 — order ${id.slice(0, 8)}…`}
        actions={
          <Link href="/lab-orders" className={PRIMARY_BUTTON_CLASS}>
            Back to list
          </Link>
        }
      />
      <div className={`${CARD_CONTAINER_CLASS} p-6 space-y-6`}>
        {loading ? (
          <p className="text-[13px] text-[#7F8C8D]">Loading…</p>
        ) : !order ? (
          <p className="text-[13px] text-red-600">Order not found.</p>
        ) : (
          <>
            <div className="text-[13px] space-y-1">
              <div>
                <strong>{order.testCode}</strong> — {order.patientRef.fullName}
              </div>
              <div className="text-[#7F8C8D]">
                Status: {order.status} · {order.amountNet} AZN
                {order.visitId ? ` · visit ${order.visitId.slice(0, 8)}…` : ""}
              </div>
            </div>

            <ol className="flex flex-wrap gap-2">
              {STEPS.map((step, idx) => (
                <li
                  key={step.key}
                  className={`rounded border px-3 py-2 text-[12px] ${
                    idx < currentStep
                      ? "border-green-500 bg-green-50 text-green-800"
                      : idx === currentStep
                        ? "border-[#2980B9] bg-blue-50 text-[#2980B9]"
                        : "border-slate-200 text-[#7F8C8D]"
                  }`}
                >
                  {idx + 1}. {step.label}
                </li>
              ))}
            </ol>

            {error && <p className="text-[13px] text-red-600">{error}</p>}

            {order.status === "ORDERED" && (
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                disabled={busy}
                onClick={() => runAction("collect")}
              >
                Mark collected (K-08)
              </button>
            )}

            {(order.status === "COLLECTED" ||
              order.status === "IN_PROGRESS") && (
              <div className="space-y-3">
                <p className="text-[13px] font-medium">Result lines (K-09)</p>
                {resultLines.map((line, idx) => (
                  <div key={idx} className="flex flex-wrap gap-2 text-[13px]">
                    <input
                      className="rounded border px-2 py-1"
                      placeholder="Code"
                      value={line.code}
                      onChange={(e) => {
                        const next = [...resultLines];
                        next[idx] = { ...next[idx], code: e.target.value };
                        setResultLines(next);
                      }}
                    />
                    <input
                      className="rounded border px-2 py-1"
                      placeholder="Value"
                      value={line.value}
                      onChange={(e) => {
                        const next = [...resultLines];
                        next[idx] = { ...next[idx], value: e.target.value };
                        setResultLines(next);
                      }}
                    />
                  </div>
                ))}
                <button
                  type="button"
                  className="text-[13px] text-[#2980B9]"
                  onClick={() =>
                    setResultLines([...resultLines, { code: "", value: "" }])
                  }
                >
                  + Add line
                </button>
                <div>
                  <button
                    type="button"
                    className={PRIMARY_BUTTON_CLASS}
                    disabled={busy}
                    onClick={() =>
                      runAction("results", {
                        lines: resultLines.filter((l) => l.code && l.value),
                      })
                    }
                  >
                    Save results
                  </button>
                </div>
              </div>
            )}

            {order.status === "RESULT_READY" && (
              <div className="space-y-2">
                {order.resultJson && (
                  <pre className="rounded border bg-slate-50 p-3 text-[12px] overflow-auto">
                    {order.resultJson}
                  </pre>
                )}
                <button
                  type="button"
                  className={PRIMARY_BUTTON_CLASS}
                  disabled={busy}
                  onClick={() => runAction("publish")}
                >
                  Publish to doctor (K-10)
                </button>
              </div>
            )}

            {order.status === "PUBLISHED" && (
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                disabled={busy}
                onClick={() => runAction("complete")}
              >
                Complete & dispatch billing event (K-11)
              </button>
            )}

            {order.status === "COMPLETED" && (
              <p className="text-[13px] text-green-700">
                Completed
                {order.publishedAt
                  ? ` · published ${new Date(order.publishedAt).toLocaleString()}`
                  : ""}
              </p>
            )}
          </>
        )}
      </div>
    </>
  );
}
