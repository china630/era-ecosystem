"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  ColorLegend,
  ModalFooter,
  ModalShell,
  PRIMARY_BUTTON_CLASS,
  PageHeader,
} from "@era/satellite-kit/ui";
import {
  TemplateResultForm,
  linesFromAnalytes,
  structuredResultPayload,
  type ResultLineState,
} from "@/components/TemplateResultForm";
import type {
  CatalogFieldDef,
  DiagnosticCatalogItem,
} from "@/domain/catalog/diagnostic-catalog-shared";

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
  const [catalogItem, setCatalogItem] = useState<DiagnosticCatalogItem | null>(null);
  const [metaFields, setMetaFields] = useState<CatalogFieldDef[]>([]);
  const [metaValues, setMetaValues] = useState<Record<string, string>>({});
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [resultLines, setResultLines] = useState<ResultLineState[]>([]);
  const [resultsModalOpen, setResultsModalOpen] = useState(false);

  const loadOrder = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await fetch("/api/lab-orders");
    const data = await res.json();
    const list = Array.isArray(data) ? data : (data.data ?? []);
    const found = (list as LabOrder[]).find((o) => o.id === id) ?? null;
    setOrder(found);

    if (found) {
      const primaryCode = found.testCode.split(",")[0]?.trim() ?? found.testCode;
      const catRes = await fetch(
        `/api/diagnostic-catalog?applyFavorites=false&search=${encodeURIComponent(primaryCode)}`,
      );
      const catData = await catRes.json();
      const row = catData.data ?? catData;
      setMetaFields(row.metaFields ?? []);
      const item =
        ((row.items ?? []) as DiagnosticCatalogItem[]).find(
          (i) => i.code === primaryCode || i.serviceCode === primaryCode,
        ) ?? null;
      setCatalogItem(item);

      if (found.resultJson) {
        try {
          const parsed = JSON.parse(found.resultJson) as ResultLineState[];
          if (item?.kind === "lab_panel") {
            setResultLines(parsed);
          } else {
            const fields: Record<string, string> = {};
            const meta: Record<string, string> = {};
            for (const line of parsed) {
              if (line.code.startsWith("meta.")) meta[line.code.slice(5)] = line.value;
              else fields[line.code] = line.value;
            }
            setFieldValues(fields);
            setMetaValues(meta);
            setResultLines(parsed);
          }
        } catch {
          /* keep defaults */
        }
      } else if (item?.analytes?.length) {
        setResultLines(linesFromAnalytes(item.analytes));
      } else {
        setResultLines([]);
        setFieldValues({});
        setMetaValues({});
      }
    }

    setLoading(false);
  }, [id]);

  useEffect(() => {
    void loadOrder();
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
    setOrder(data.data ?? data);
    setBusy(false);
    if (path === "results") setResultsModalOpen(false);
  }

  async function saveResults(e: React.FormEvent) {
    e.preventDefault();
    if (!catalogItem) {
      await runAction("results", {
        lines: resultLines.filter((l) => l.code && l.value),
      });
      return;
    }
    const payload = structuredResultPayload({
      item: catalogItem,
      metaValues,
      fieldValues,
      lines: resultLines,
    });
    await runAction("results", payload);
  }

  function openResultsModal() {
    if (catalogItem?.analytes?.length && resultLines.length === 0) {
      setResultLines(linesFromAnalytes(catalogItem.analytes));
    }
    setResultsModalOpen(true);
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
      <div className={`${CARD_CONTAINER_CLASS} space-y-6 p-6`}>
        {loading ? (
          <p className="text-[13px] text-[#7F8C8D]">{tc("loading")}</p>
        ) : !order ? (
          <p className="text-[13px] text-red-600">{t("notFound")}</p>
        ) : (
          <>
            <div className="space-y-1 text-[13px]">
              <div>
                <strong>{order.testCode}</strong> — {order.patientRef.fullName}
              </div>
              <div className="text-[#7F8C8D]">
                {t("status")}: {order.status} · {order.amountNet} AZN
                {order.visitId ? ` · ${t("visit")} ${order.visitId.slice(0, 8)}…` : ""}
              </div>
              {catalogItem && (
                <div className="text-[#7F8C8D]">
                  {t("template")}: {catalogItem.code} ({catalogItem.kind})
                </div>
              )}
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
                onClick={() => void runAction("collect")}
              >
                {t("markCollected")}
              </button>
            )}

            {(order.status === "COLLECTED" || order.status === "IN_PROGRESS") && (
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                disabled={busy}
                onClick={openResultsModal}
              >
                {t("saveResults")}
              </button>
            )}

            {order.status === "RESULT_READY" && (
              <div className="space-y-2">
                {order.resultJson && (
                  <pre className="overflow-auto rounded border bg-slate-50 p-3 text-[12px]">
                    {order.resultJson}
                  </pre>
                )}
                <button
                  type="button"
                  className={PRIMARY_BUTTON_CLASS}
                  disabled={busy}
                  onClick={() => void runAction("publish")}
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
                onClick={() => void runAction("complete")}
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
        <form id={resultsFormId} onSubmit={(e) => void saveResults(e)}>
          <TemplateResultForm
            item={catalogItem}
            metaFields={metaFields}
            metaValues={metaValues}
            onMetaChange={(k, v) => setMetaValues((prev) => ({ ...prev, [k]: v }))}
            lines={resultLines}
            onLinesChange={setResultLines}
            fieldValues={fieldValues}
            onFieldChange={(k, v) => setFieldValues((prev) => ({ ...prev, [k]: v }))}
            labels={{
              meta: t("metaFields"),
              fields: t("templateFields"),
              analytes: t("analytes"),
              value: t("value"),
              noTemplate: t("noTemplate"),
            }}
          />
        </form>
      </ModalShell>
    </>
  );
}
