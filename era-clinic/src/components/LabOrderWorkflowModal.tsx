"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
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
  showApiError,
  useCan,
} from "@era/satellite-kit/ui";
import { labStatusTone } from "@/components/lab-status-tone";
import {
  TemplateResultForm,
  linesFromAnalytes,
  structuredResultPayload,
  type ResultLineState,
} from "@/components/TemplateResultForm";
import { bakuDateTimeDisplay } from "@/lib/baku-day";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import type {
  CatalogFieldDef,
  DiagnosticCatalogItem,
} from "@/domain/catalog/diagnostic-catalog-shared";
import { pickL10n } from "@/domain/catalog/diagnostic-catalog-shared";
import { formatNameAndCode } from "@/lib/display-code";
import { PrintLanguageDialog } from "@/components/print/PrintLanguageDialog";
import { formatNormDisplay, isCatalogNormEcho } from "@/lib/lab-analyte-norms";
import { isUnsetLabValue } from "@/lib/lab-result-flags";

const resultsFormId = "lab-results-form";

type LabResultRow = {
  code: string;
  label: string | null;
  value: string;
  unit: string | null;
  refMin: string | null;
  refMax: string | null;
  normTextEn?: string | null;
  normTextRu?: string | null;
  normTextAz?: string | null;
  flag: string | null;
  /** Numeric pair shown under the blank sentence for this guest. */
  chosenRange?: string | null;
};

type LabOrderItem = {
  id: string;
  serviceCode: string;
  inPackage?: boolean;
  amountNet?: string | number | null;
  diagnosticService?: {
    code: string;
    titleEn?: string;
    titleRu?: string;
    titleAz?: string | null;
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
const CORRECTABLE_STATUSES = ["COMPLETED", "PUBLISHED"];
const STEP_KEYS = ["collect", "results", "publish", "complete"] as const;

function labOrderStatusLabel(
  tList: (
    key:
      | "orderStatus.ORDERED"
      | "orderStatus.COLLECTED"
      | "orderStatus.IN_PROGRESS"
      | "orderStatus.RESULT_READY"
      | "orderStatus.PUBLISHED"
      | "orderStatus.COMPLETED"
      | "orderStatus.CANCELLED"
      | "inPackage",
  ) => string,
  status: string,
): string {
  switch (status) {
    case "ORDERED":
      return tList("orderStatus.ORDERED");
    case "COLLECTED":
      return tList("orderStatus.COLLECTED");
    case "IN_PROGRESS":
      return tList("orderStatus.IN_PROGRESS");
    case "RESULT_READY":
      return tList("orderStatus.RESULT_READY");
    case "PUBLISHED":
      return tList("orderStatus.PUBLISHED");
    case "COMPLETED":
      return tList("orderStatus.COMPLETED");
    case "CANCELLED":
      return tList("orderStatus.CANCELLED");
    default:
      return status;
  }
}

function labOrderAmountLabel(order: LabOrder, inPackageLabel: string): string {
  const header = Number(order.amountNet);
  const items = order.items ?? [];
  const net =
    header > 0 ? header : items.reduce((sum, item) => sum + (Number(item.amountNet) || 0), 0);
  if (items.length > 0 && items.every((item) => item.inPackage) && !(net > 0)) {
    return inPackageLabel;
  }
  return `${Number.isFinite(net) ? net.toFixed(2) : "0.00"} AZN`;
}

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
  onChanged?: (patch?: { id: string; status: string }) => void;
};

export function LabOrderWorkflowModal({ open, orderId, onClose, onChanged }: Props) {
  const t = useTranslations("labOrdersDetail");
  const tList = useTranslations("labOrders");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [order, setOrder] = useState<LabOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [catalogItem, setCatalogItem] = useState<DiagnosticCatalogItem | null>(null);
  const [metaFields, setMetaFields] = useState<CatalogFieldDef[]>([]);
  const [metaValues, setMetaValues] = useState<Record<string, string>>({});
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [resultLines, setResultLines] = useState<ResultLineState[]>([]);
  const blankFileRef = useRef<HTMLInputElement>(null);
  const [resultsModalOpen, setResultsModalOpen] = useState(false);
  const [printNotice, setPrintNotice] = useState("");
  const [printOpen, setPrintOpen] = useState(false);

  const loadOrder = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!orderId) return;
      if (!opts?.silent) setLoading(true);
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

        const savedLines = (found.items ?? []).flatMap((row) => row.results ?? []);
        if (item?.kind === "lab_panel" && savedLines.length > 0) {
          setResultLines(
            savedLines.map((row) => ({
              code: row.code,
              value: row.value,
              unit: row.unit ?? undefined,
              refMin: row.refMin ?? undefined,
              refMax: row.refMax ?? undefined,
              normTextEn: row.normTextEn ?? undefined,
              normTextRu: row.normTextRu ?? undefined,
              normTextAz: row.normTextAz ?? undefined,
            })),
          );
        } else if (found.resultJson) {
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
      return found;
    },
    [orderId],
  );

  useEffect(() => {
    if (open && orderId) void loadOrder();
    if (!open) {
      setResultsModalOpen(false);
      setPrintNotice("");
      setPrintOpen(false);
    }
  }, [open, orderId, loadOrder]);

  const resultRows = useMemo<LabResultRow[]>(() => {
    if (!order) return [];
    const analyteByCode = new Map((catalogItem?.analytes ?? []).map((a) => [a.code, a]));
    const mapRow = (r: {
      code: string;
      label?: string | null;
      value: string;
      unit?: string | null;
      refMin?: string | null;
      refMax?: string | null;
      normTextEn?: string | null;
      normTextRu?: string | null;
      normTextAz?: string | null;
      flag?: string | null;
    }): LabResultRow => {
      const analyte = analyteByCode.get(r.code);
      const dash =
        isUnsetLabValue(r.value) ||
        isCatalogNormEcho(r.value, {
          normTextEn: r.normTextEn ?? analyte?.normText?.en,
          normTextRu: r.normTextRu ?? analyte?.normText?.ru,
          normTextAz: r.normTextAz ?? analyte?.normText?.az,
          refMin: r.refMin ?? analyte?.refMin,
          refMax: r.refMax ?? analyte?.refMax,
          unit: r.unit ?? analyte?.unit,
        });
      const hasSentence = Boolean(
        (r.normTextAz ?? analyte?.normText?.az)?.trim() ||
          (r.normTextEn ?? analyte?.normText?.en)?.trim() ||
          (r.normTextRu ?? analyte?.normText?.ru)?.trim(),
      );
      const sexPaired = Boolean(
        analyte?.refMinFemale ||
          analyte?.refMaxFemale ||
          analyte?.refMinMale ||
          analyte?.refMaxMale,
      );
      const chosen =
        r.refMin || r.refMax ? `${r.refMin ?? "?"}–${r.refMax ?? "?"}` : null;
      return {
        code: r.code,
        label: resolveResultLabel(r.code, r.label, catalogItem, metaFields, locale),
        value: dash ? "—" : r.value,
        unit: r.unit ?? null,
        refMin: dash ? null : r.refMin ?? null,
        refMax: dash ? null : r.refMax ?? null,
        normTextEn: dash ? null : r.normTextEn ?? analyte?.normText?.en ?? null,
        normTextRu: dash ? null : r.normTextRu ?? analyte?.normText?.ru ?? null,
        normTextAz: dash ? null : r.normTextAz ?? analyte?.normText?.az ?? null,
        flag: dash ? null : r.flag ?? null,
        chosenRange: dash
          ? null
          : hasSentence
          ? chosen ?? (sexPaired ? "__SEX_UNKNOWN__" : null)
          : null,
      };
    };

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
      resultRows.some(
        (r) => r.unit || r.refMin || r.refMax || r.normTextAz || r.normTextEn || r.normTextRu,
      ) || catalogItem?.kind === "lab_panel",
    [resultRows, catalogItem],
  );

  async function cancelOrder() {
    if (!orderId || !window.confirm(tList("cancelConfirm"))) return;
    setBusy(true);
    const res = await fetch(`/api/lab-orders/${orderId}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      showApiError(data, t("actionFailed"));
      setBusy(false);
      return;
    }
    setBusy(false);
    if (orderId) onChanged?.({ id: orderId, status: "CANCELLED" });
    onClose();
  }

  async function runAction(path: string, body?: unknown) {
    if (!orderId) return;
    setBusy(true);
    const res = await fetch(`/api/lab-orders/${orderId}/${path}`, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!res.ok) {
      showApiError(data, t("actionFailed"));
      setBusy(false);
      return;
    }
    setBusy(false);
    if (path === "results") setResultsModalOpen(false);
    const fresh = await loadOrder({ silent: true });
    if (fresh) onChanged?.({ id: fresh.id, status: fresh.status });
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

  function labItemLabel(item: LabOrderItem): string {
    const svc = item.diagnosticService;
    const name = svc
      ? pickL10n(
          {
            en: svc.titleEn ?? svc.code,
            ru: svc.titleRu ?? svc.titleEn ?? svc.code,
            az: svc.titleAz ?? svc.titleEn ?? svc.code,
          },
          locale,
        )
      : catalogItem && (catalogItem.code === item.serviceCode || catalogItem.serviceCode === item.serviceCode)
        ? pickL10n(catalogItem.title, locale)
        : "";
    return formatNameAndCode(name, item.serviceCode);
  }

  const canCollect = useCan(CLINIC_PERMISSION.API_LAB_ORDERS_COLLECT);
  const canWriteResults = useCan(CLINIC_PERMISSION.API_LAB_ORDERS_WRITE);
  const canPublish = useCan(CLINIC_PERMISSION.API_LAB_ORDERS_PUBLISH);
  const canComplete = useCan(CLINIC_PERMISSION.API_LAB_ORDERS_COMPLETE);
  const canBlank = useCan(CLINIC_PERMISSION.API_LAB_ORDERS_BLANK);
  const currentStep = order ? stepIndex(order.status) : 0;
  const canEditResults = Boolean(
    order && (EDITABLE_STATUSES.includes(order.status) || CORRECTABLE_STATUSES.includes(order.status)),
  );
  const correcting = Boolean(order && CORRECTABLE_STATUSES.includes(order.status));
  const serviceTitle =
    order != null
      ? order.items?.length
        ? order.items.map((i) => labItemLabel(i)).join(", ")
        : formatNameAndCode(catalogItem ? pickL10n(catalogItem.title, locale) : "", order.testCode)
      : "";
  const title =
    order != null
      ? `${formatNameAndCode(order.patientRef.fullName, order.patientRef.refCode)}${serviceTitle ? ` — ${serviceTitle}` : ""}`
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
        maxWidthClass="max-w-3xl w-full"
        headerActions={
          <>
            {order?.status === "ORDERED" ? (
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                disabled={busy}
                onClick={() => void cancelOrder()}
                aria-label={tList("cancelOrder")}
              >
                <Trash2 className="mr-1 inline h-4 w-4" aria-hidden />
                {tList("cancelOrder")}
              </button>
            ) : null}
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              onClick={() => setPrintOpen(true)}
              disabled={!orderId}
            >
              {t("printButton")}
            </button>
          </>
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
                  {t("status")}:{" "}
                  <span className={`font-medium ${labStatusTone(order.status).text}`}>
                    {labOrderStatusLabel(tList, order.status)}
                  </span>{" "}
                  ·{" "}
                  {labOrderAmountLabel(order, tList("inPackage"))}
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

              {order.status === "ORDERED" && canCollect ? (
                <button
                  type="button"
                  className={PRIMARY_BUTTON_CLASS}
                  disabled={busy}
                  onClick={() => void runAction("collect")}
                >
                  {t("markCollected")}
                </button>
              ) : null}

              {(order.status === "COLLECTED" || order.status === "IN_PROGRESS") && canWriteResults ? (
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
                                <td className={`${DATA_TABLE_TD_CLASS} max-w-[14rem] whitespace-pre-wrap`}>
                                  {(() => {
                                    const lang = locale.startsWith("ru")
                                      ? "ru"
                                      : locale.startsWith("az")
                                        ? "az"
                                        : "en";
                                    const sentence =
                                      formatNormDisplay(
                                        {
                                          normTextEn: row.normTextEn,
                                          normTextRu: row.normTextRu,
                                          normTextAz: row.normTextAz,
                                          refMin: row.refMin,
                                          refMax: row.refMax,
                                          unit: row.unit,
                                        },
                                        { lang },
                                      ) || "—";
                                    return (
                                      <div>
                                        <div>{sentence}</div>
                                        {row.chosenRange ? (
                                          <div className={`text-[11px] ${TEXT_MUTED_CLASS}`}>
                                            {row.chosenRange === "__SEX_UNKNOWN__"
                                              ? t("resultsTable.sexUnknownNorm")
                                              : row.chosenRange}
                                          </div>
                                        ) : null}
                                      </div>
                                    );
                                  })()}
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

              {correcting && canWriteResults ? (
                <button
                  type="button"
                  className={SECONDARY_BUTTON_CLASS}
                  disabled={busy}
                  onClick={openResultsEntry}
                >
                  {t("correctResults")}
                </button>
              ) : null}

              {order.status === "RESULT_READY" ? (
                <div className="flex flex-wrap gap-2">
                  {canWriteResults ? (
                  <button
                    type="button"
                    className={SECONDARY_BUTTON_CLASS}
                    disabled={busy}
                    onClick={openResultsEntry}
                  >
                    {t("editResults")}
                  </button>
                  ) : null}
                  {canPublish ? (
                  <button
                    type="button"
                    className={PRIMARY_BUTTON_CLASS}
                    disabled={busy}
                    onClick={() => void runAction("publish")}
                  >
                    {t("publishToDoctor")}
                  </button>
                  ) : null}
                </div>
              ) : null}

              {order.status === "PUBLISHED" && canComplete ? (
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
                      ? ` · ${t("published")} ${bakuDateTimeDisplay(order.publishedAt)}`
                      : ""}
                  </p>
                </div>
              ) : null}
            </>
          )}
        </div>
      </ModalShell>

      <ModalShell
        open={resultsModalOpen && canEditResults && canWriteResults}
        title={t("resultLines")}
        onClose={() => setResultsModalOpen(false)}
        closeLabel={tc("close")}
        maxWidthClass="max-w-3xl w-full"
        headerActions={
          canBlank ? (
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            disabled={!orderId || busy}
            onClick={() => blankFileRef.current?.click()}
          >
            {t("loadWord")}
          </button>
          ) : null
        }
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
        <input
          ref={blankFileRef}
          type="file"
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          aria-label={t("loadWord")}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file || !orderId) return;
            const reader = new FileReader();
            reader.onload = () => {
              const raw = String(reader.result ?? "");
              const docxBase64 = raw.includes(",") ? raw.split(",")[1] ?? "" : raw;
              void fetch(`/api/lab-orders/${orderId}/blank`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ docxBase64 }),
              })
                .then(async (res) => ({ ok: res.ok, json: await res.json() }))
                .then(({ ok, json }) => {
                  if (!ok) {
                    const code = typeof json.code === "string" ? json.code : "";
                    showApiError(
                      {
                        error:
                          code === "NO_BLANK"
                            ? t("loadWordNoBlank")
                            : code === "NO_USM_FIELDS"
                              ? t("loadWordNoFields")
                              : code === "LAB_AWAITING_PAYMENT"
                                ? t("loadWordAwaitingPayment")
                          : typeof json.error === "string"
                            ? json.error
                            : typeof json.message === "string"
                              ? json.message
                              : t("loadWord"),
                      },
                      t("loadWord"),
                    );
                    return;
                  }
                  const payload = json.data ?? json;
                  const fields = payload.fields as Record<string, string> | undefined;
                  if (fields && typeof fields === "object") {
                    const omit = new Set(
                      Array.isArray(payload.omit) ? (payload.omit as string[]) : [],
                    );
                    setFieldValues((prev) => {
                      const next = { ...prev, ...fields };
                      for (const key of omit) delete next[key];
                      return next;
                    });
                    return;
                  }
                  const rows = (payload.rows ?? []) as Array<{
                    analyteCode: string | null;
                    value: string;
                    applied: boolean;
                  }>;
                  const applied = rows.filter((row) => row.applied && row.analyteCode);
                  if (applied.length === 0) {
                    showApiError({ error: t("loadWordNoValues") }, t("loadWord"));
                    return;
                  }
                  setResultLines((lines) =>
                    lines.map((line) => {
                      const hit = applied.find((row) => row.analyteCode === line.code);
                      return hit ? { ...line, value: hit.value } : line;
                    }),
                  );
                });
            };
            reader.readAsDataURL(file);
          }}
        />
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
