"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  CHIP_ACTIVE_CLASS,
  CHIP_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  ModalFooter,
  ModalShell,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TEXT_DANGER_CLASS,
  TEXT_MUTED_CLASS,
  TEXT_SUCCESS_CLASS,
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
import { pickL10n } from "@/domain/catalog/diagnostic-catalog-shared";
import { PrintLanguageDialog } from "@/components/print/PrintLanguageDialog";

const resultsFormId = "lab-results-form";

type LabResultRow = {
  code: string;
  label: string | null;
  value: string;
  unit: string | null;
  refMin: string | null;
  refMax: string | null;
  flag: string | null;
};

type LabOrderItem = {
  id: string;
  serviceCode: string;
  diagnosticService?: {
    code: string;
    modality?: { code: string } | null;
  } | null;
  results?: LabResultRow[];
};

type LabOrder = {
  id: string;
  testCode: string;
  status: string;
  amountNet: string;
  createdAt?: string;
  collectedAt: string | null;
  publishedAt: string | null;
  resultJson: string | null;
  visitId: string | null;
  patientRef: { refCode: string; fullName: string };
  items?: LabOrderItem[];
};

const EDITABLE_STATUSES = ["COLLECTED", "IN_PROGRESS", "RESULT_READY"];
const STEP_KEYS = ["collect", "results", "publish", "complete"] as const;

function stepIndex(status: string): number {
  if (status === "ORDERED") return 0;
  if (status === "COLLECTED" || status === "IN_PROGRESS") return 1;
  if (status === "RESULT_READY") return 2;
  if (status === "PUBLISHED") return 3;
  return 4;
}

function flagClass(flag: string | null | undefined): string {
  if (flag === "CRITICAL") return `${TEXT_DANGER_CLASS} font-semibold`;
  if (flag === "HIGH" || flag === "LOW") return TEXT_DANGER_CLASS;
  return "";
}

export function resolveResultLabel(
  code: string,
  stored: string | null | undefined,
  catalogItem: DiagnosticCatalogItem | null,
  metaFields: CatalogFieldDef[],
  locale: string,
): string | null {
  if (stored?.trim()) return stored;
  const analyte = catalogItem?.analytes?.find((a) => a.code === code);
  if (analyte) return pickL10n(analyte.label, locale);
  if (code.startsWith("meta.")) {
    const key = code.slice(5);
    const meta = metaFields.find((f) => f.key === key);
    if (meta) return pickL10n(meta.label, locale);
  }
  const field = catalogItem?.fields?.find((f) => f.key === code);
  if (field) return pickL10n(field.label, locale);
  return null;
}

type Props = {
  open: boolean;
  orderId: string | null;
  onClose: () => void;
  onChanged?: () => void;
};

export function LabOrderWorkflowModal({ open, orderId, onClose, onChanged }: Props) {
  const t = useTranslations("labOrdersDetail");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [order, setOrder] = useState<LabOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [catalogItem, setCatalogItem] = useState<DiagnosticCatalogItem | null>(null);
  const [metaFields, setMetaFields] = useState<CatalogFieldDef[]>([]);
  const [metaValues, setMetaValues] = useState<Record<string, string>>({});
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [resultLines, setResultLines] = useState<ResultLineState[]>([]);
  const [resultsModalOpen, setResultsModalOpen] = useState(false);
  const [printNotice, setPrintNotice] = useState("");
  const [printOpen, setPrintOpen] = useState(false);

  const loadOrder = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!orderId) return;
      if (!opts?.silent) setLoading(true);
      setError("");
      const res = await fetch(`/api/lab-orders/${orderId}`);
      let found: LabOrder | null = null;
      if (res.ok) {
        const data = await res.json();
        found = (data.data ?? data) as LabOrder;
      }
      setOrder(found);

      if (found) {
        const primaryCode =
          found.items?.[0]?.serviceCode ??
          found.testCode.split(",")[0]?.trim() ??
          found.testCode;
        const catRes = await fetch(
          `/api/diagnostic-catalog?applyFavorites=false&search=${encodeURIComponent(primaryCode)}`,
        );
        const catData = await catRes.json();
        const row = catData.data ?? catData;
        const metas = (row.metaFields ?? []) as CatalogFieldDef[];
        setMetaFields(metas);
        const item =
          ((row.items ?? []) as DiagnosticCatalogItem[]).find(
            (i) => i.code === primaryCode || i.serviceCode === primaryCode,
          ) ?? null;
        setCatalogItem(item);

        if (found.resultJson) {
          try {
            const raw: unknown =
              typeof found.resultJson === "string"
                ? JSON.parse(found.resultJson)
                : found.resultJson;
            const parsed = Array.isArray(raw) ? (raw as ResultLineState[]) : [];
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
            /* keep */
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
    },
    [orderId],
  );

  useEffect(() => {
    if (open && orderId) void loadOrder();
    if (!open) {
      setResultsModalOpen(false);
      setPrintNotice("");
      setPrintOpen(false);
      setError("");
    }
  }, [open, orderId, loadOrder]);

  const resultRows = useMemo<LabResultRow[]>(() => {
    if (!order) return [];
    const mapRow = (r: {
      code: string;
      label?: string | null;
      value: string;
      unit?: string | null;
      refMin?: string | null;
      refMax?: string | null;
      flag?: string | null;
    }): LabResultRow => ({
      code: r.code,
      label: resolveResultLabel(r.code, r.label, catalogItem, metaFields, locale),
      value: r.value,
      unit: r.unit ?? null,
      refMin: r.refMin ?? null,
      refMax: r.refMax ?? null,
      flag: r.flag ?? null,
    });

    const fromItems = (order.items ?? []).flatMap((it) => it.results ?? []);
    if (fromItems.length > 0) return fromItems.map(mapRow);
    if (!order.resultJson) return [];
    try {
      const raw: unknown =
        typeof order.resultJson === "string" ? JSON.parse(order.resultJson) : order.resultJson;
      if (!Array.isArray(raw)) return [];
      return raw.map(mapRow);
    } catch {
      return [];
    }
  }, [order, catalogItem, metaFields, locale]);

  const showLabColumns = useMemo(
    () =>
      resultRows.some((r) => r.unit || r.refMin || r.refMax) || catalogItem?.kind === "lab_panel",
    [resultRows, catalogItem],
  );

  async function runAction(path: string, body?: unknown) {
    if (!orderId) return;
    setBusy(true);
    setError("");
    const res = await fetch(`/api/lab-orders/${orderId}/${path}`, {
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
    setBusy(false);
    if (path === "results") setResultsModalOpen(false);
    await loadOrder({ silent: true });
    onChanged?.();
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

  function openResultsEntry() {
    if (catalogItem?.analytes?.length && resultLines.length === 0) {
      setResultLines(linesFromAnalytes(catalogItem.analytes));
    }
    setResultsModalOpen(true);
  }

  const currentStep = order ? stepIndex(order.status) : 0;
  const canEditResults = Boolean(order && EDITABLE_STATUSES.includes(order.status));
  const title =
    order != null
      ? `${order.items?.length ? order.items.map((i) => i.serviceCode).join(", ") : order.testCode} — ${order.patientRef.fullName}`
      : t("title");

  const modalityCode =
    order?.items?.[0]?.diagnosticService?.modality?.code ??
    catalogItem?.modality ??
    "";
  const isImaging =
    /usg|usm|ultrasound|imaging/i.test(modalityCode) ||
    catalogItem?.kind === "imaging";
  const printHref = orderId
    ? isImaging
      ? `/print/usm/${orderId}`
      : `/print/lab-order/${orderId}`
    : null;

  return (
    <>
      <ModalShell
        open={open && Boolean(orderId)}
        title={title}
        subtitle={orderId ? t("subtitle", { id: orderId.slice(0, 8) }) : undefined}
        onClose={onClose}
        closeLabel={tc("close")}
        maxWidthClass="max-w-3xl"
        headerActions={
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            onClick={() => setPrintOpen(true)}
            disabled={!orderId}
          >
            {t("printButton")}
          </button>
        }
      >
        <div className="space-y-5">
          {loading ? (
            <p className={`text-[13px] ${TEXT_MUTED_CLASS}`}>{tc("loading")}</p>
          ) : !order ? (
            <p className={`text-[13px] ${TEXT_DANGER_CLASS}`}>{t("notFound")}</p>
          ) : (
            <>
              <div className={`space-y-1 text-[13px] ${TEXT_MUTED_CLASS}`}>
                <div>
                  {t("status")}: {order.status} · {order.amountNet} AZN
                  {order.visitId ? ` · ${t("visit")} ${order.visitId.slice(0, 8)}…` : ""}
                </div>
                {catalogItem ? (
                  <div>
                    {t("template")}: {catalogItem.code} ({catalogItem.kind})
                  </div>
                ) : null}
              </div>

              {printNotice ? <p className={`text-[13px] ${TEXT_MUTED_CLASS}`}>{printNotice}</p> : null}

              <ol className="flex flex-wrap gap-2">
                {STEP_KEYS.map((stepKey, idx) => (
                  <li
                    key={stepKey}
                    className={`rounded border px-3 py-2 text-[12px] ${
                      idx < currentStep
                        ? "border-green-500 bg-green-50 text-green-800"
                        : idx === currentStep
                          ? CHIP_ACTIVE_CLASS
                          : `${CHIP_CLASS} border-slate-200 ${TEXT_MUTED_CLASS}`
                    }`}
                  >
                    <div>
                      {idx + 1}. {t(`steps.${stepKey}`)}
                    </div>
                    <div className="text-[10px] opacity-75">{t(`steps.${stepKey}Hint`)}</div>
                  </li>
                ))}
              </ol>

              {error ? <p className={`text-[13px] ${TEXT_DANGER_CLASS}`}>{error}</p> : null}

              {order.status === "ORDERED" ? (
                <button
                  type="button"
                  className={PRIMARY_BUTTON_CLASS}
                  disabled={busy}
                  onClick={() => void runAction("collect")}
                >
                  {t("markCollected")}
                </button>
              ) : null}

              {order.status === "COLLECTED" || order.status === "IN_PROGRESS" ? (
                <button
                  type="button"
                  className={PRIMARY_BUTTON_CLASS}
                  disabled={busy}
                  onClick={openResultsEntry}
                >
                  {t("saveResults")}
                </button>
              ) : null}

              <div className="space-y-2">
                <h3 className="m-0 text-[13px] font-semibold">{t("resultsTable.title")}</h3>
                {resultRows.length === 0 ? (
                  <p className={`text-[13px] ${TEXT_MUTED_CLASS}`}>{t("noResults")}</p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-[#D5DADF]">
                    <table className={DATA_TABLE_CLASS}>
                      <thead>
                        <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                          <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("resultsTable.label")}</th>
                          <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("resultsTable.value")}</th>
                          {showLabColumns ? (
                            <>
                              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("resultsTable.unit")}</th>
                              <th className={DATA_TABLE_TH_LEFT_CLASS}>
                                {t("resultsTable.refRange")}
                              </th>
                            </>
                          ) : null}
                          <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("resultsTable.flag")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resultRows.map((row, idx) => (
                          <tr key={`${row.code}-${idx}`} className={DATA_TABLE_TR_CLASS}>
                            <td className={DATA_TABLE_TD_CLASS}>
                              <div className="font-medium">{row.label ?? row.code}</div>
                              {row.label ? (
                                <div className={`text-[11px] ${TEXT_MUTED_CLASS}`}>{row.code}</div>
                              ) : null}
                            </td>
                            <td className={`${DATA_TABLE_TD_CLASS} ${flagClass(row.flag)}`}>
                              {row.value}
                            </td>
                            {showLabColumns ? (
                              <>
                                <td className={DATA_TABLE_TD_CLASS}>{row.unit ?? "—"}</td>
                                <td className={DATA_TABLE_TD_CLASS}>
                                  {row.refMin || row.refMax
                                    ? `${row.refMin ?? "?"}–${row.refMax ?? "?"}`
                                    : "—"}
                                </td>
                              </>
                            ) : null}
                            <td className={`${DATA_TABLE_TD_CLASS} ${flagClass(row.flag)}`}>
                              {row.flag ?? "NORMAL"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {order.status === "RESULT_READY" ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={SECONDARY_BUTTON_CLASS}
                    disabled={busy}
                    onClick={openResultsEntry}
                  >
                    {t("editResults")}
                  </button>
                  <button
                    type="button"
                    className={PRIMARY_BUTTON_CLASS}
                    disabled={busy}
                    onClick={() => void runAction("publish")}
                  >
                    {t("publishToDoctor")}
                  </button>
                </div>
              ) : null}

              {order.status === "PUBLISHED" ? (
                <div className="space-y-2">
                  <p className={`text-[13px] ${TEXT_MUTED_CLASS}`}>{t("resultsReadOnly")}</p>
                  <button
                    type="button"
                    className={PRIMARY_BUTTON_CLASS}
                    disabled={busy}
                    onClick={() => void runAction("complete")}
                  >
                    {t("completeBilling")}
                  </button>
                </div>
              ) : null}

              {order.status === "COMPLETED" ? (
                <div className="space-y-1">
                  <p className={`text-[13px] ${TEXT_MUTED_CLASS}`}>{t("resultsReadOnly")}</p>
                  <p className={`text-[13px] ${TEXT_SUCCESS_CLASS}`}>
                    {t("completed")}
                    {order.publishedAt
                      ? ` · ${t("published")} ${new Date(order.publishedAt).toLocaleString()}`
                      : ""}
                  </p>
                </div>
              ) : null}
            </>
          )}
        </div>
      </ModalShell>

      <ModalShell
        open={resultsModalOpen && canEditResults}
        title={t("resultLines")}
        onClose={() => setResultsModalOpen(false)}
        closeLabel={tc("close")}
        maxWidthClass="max-w-2xl"
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
      <PrintLanguageDialog
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        href={printHref}
        title={t("printButton")}
      />
    </>
  );
}
