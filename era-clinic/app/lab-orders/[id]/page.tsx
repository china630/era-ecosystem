"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  ColorLegend,
  FORM_FIELD_GROUP_CLASS,
  FORM_STACK_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  ModalFooter,
  ModalShell,
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  PageHeader,
} from "@era/satellite-kit/ui";

const resultsFormId = "lab-results-form";

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

const STEP_KEYS = ["collect", "results", "publish", "complete"] as const;

function stepIndex(status: string): number {
  if (status === "ORDERED") return 0;
  if (status === "COLLECTED" || status === "IN_PROGRESS") return 1;
  if (status === "RESULT_READY") return 2;
  if (status === "PUBLISHED") return 3;
  return 4;
}

export default function LabOrderDetailPage() {
  const t = useTranslations("labOrdersDetail");
  const tc = useTranslations("common");
  const params = useParams();
  const id = params.id as string;
  const [order, setOrder] = useState<LabOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resultLines, setResultLines] = useState<ResultLine[]>([
    { code: "WBC", value: "", unit: "10^9/L" },
  ]);
  const [resultsModalOpen, setResultsModalOpen] = useState(false);

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
      setError(data.error ?? t("actionFailed"));
      setBusy(false);
      return;
    }
    setOrder(data);
    setBusy(false);
    if (path === "results") setResultsModalOpen(false);
  }

  async function saveResults(e: React.FormEvent) {
    e.preventDefault();
    await runAction("results", {
      lines: resultLines.filter((l) => l.code && l.value),
    });
  }

  const currentStep = order ? stepIndex(order.status) : 0;

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle", { id: id.slice(0, 8) })}
        actions={
          <Link href="/lab-orders" className={PRIMARY_BUTTON_CLASS}>
            {t("backToList")}
          </Link>
        }
      />
      <div className={`${CARD_CONTAINER_CLASS} p-6 space-y-6`}>
        {loading ? (
          <p className="text-[13px] text-[#7F8C8D]">{tc("loading")}</p>
        ) : !order ? (
          <p className="text-[13px] text-red-600">{t("notFound")}</p>
        ) : (
          <>
            <div className="text-[13px] space-y-1">
              <div>
                <strong>{order.testCode}</strong> — {order.patientRef.fullName}
              </div>
              <div className="text-[#7F8C8D]">
                {t("status")}: {order.status} · {order.amountNet} AZN
                {order.visitId ? ` · ${t("visit")} ${order.visitId.slice(0, 8)}…` : ""}
              </div>
            </div>

            <ColorLegend
              items={[
                { id: "done", label: t("steps.complete"), swatchClassName: "bg-green-50" },
                { id: "current", label: t("steps.collect"), swatchClassName: "bg-blue-50" },
                { id: "pending", label: t("steps.publish"), swatchClassName: "bg-slate-100" },
              ]}
            />
            <ol className="flex flex-wrap gap-2">
              {STEP_KEYS.map((stepKey, idx) => (
                <li
                  key={stepKey}
                  className={`rounded border px-3 py-2 text-[12px] ${
                    idx < currentStep
                      ? "border-green-500 bg-green-50 text-green-800"
                      : idx === currentStep
                        ? "border-[#2980B9] bg-blue-50 text-[#2980B9]"
                        : "border-slate-200 text-[#7F8C8D]"
                  }`}
                >
                  {idx + 1}. {t(`steps.${stepKey}`)}
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
                {t("markCollected")}
              </button>
            )}

            {(order.status === "COLLECTED" ||
              order.status === "IN_PROGRESS") && (
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                disabled={busy}
                onClick={() => setResultsModalOpen(true)}
              >
                {t("saveResults")}
              </button>
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
                  {t("publishToDoctor")}
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
                {t("completeBilling")}
              </button>
            )}

            {order.status === "COMPLETED" && (
              <p className="text-[13px] text-green-700">
                {t("completed")}
                {order.publishedAt
                  ? ` · ${t("published")} ${new Date(order.publishedAt).toLocaleString()}`
                  : ""}
              </p>
            )}
          </>
        )}
      </div>

      <ModalShell
        open={resultsModalOpen}
        title={t("resultLines")}
        onClose={() => setResultsModalOpen(false)}
        closeLabel={tc("close")}
        footer={
          <ModalFooter
            formId={resultsFormId}
            onCancel={() => setResultsModalOpen(false)}
            busy={busy}
            submitLabel={t("saveResults")}
            cancelLabel={tc("cancel")}
          />
        }
      >
        <form id={resultsFormId} onSubmit={saveResults} className={FORM_STACK_CLASS}>
          {resultLines.map((line, idx) => (
            <div key={idx} className="grid grid-cols-2 gap-2">
              <div className={FORM_FIELD_GROUP_CLASS}>
                <label className={MODAL_FIELD_LABEL_CLASS}>{t("code")}</label>
                <input
                  className={MODAL_INPUT_CLASS}
                  value={line.code}
                  onChange={(e) => {
                    const next = [...resultLines];
                    next[idx] = { ...next[idx], code: e.target.value };
                    setResultLines(next);
                  }}
                />
              </div>
              <div className={FORM_FIELD_GROUP_CLASS}>
                <label className={MODAL_FIELD_LABEL_CLASS}>{t("value")}</label>
                <input
                  className={MODAL_INPUT_CLASS}
                  value={line.value}
                  onChange={(e) => {
                    const next = [...resultLines];
                    next[idx] = { ...next[idx], value: e.target.value };
                    setResultLines(next);
                  }}
                />
              </div>
            </div>
          ))}
          <button
            type="button"
            className="text-[13px] text-[#2980B9]"
            onClick={() => setResultLines([...resultLines, { code: "", value: "" }])}
          >
            {t("addLine")}
          </button>
        </form>
      </ModalShell>
    </>
  );
}
