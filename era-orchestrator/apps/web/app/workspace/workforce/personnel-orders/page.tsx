"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import {
  CatalogField,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  ListPaginationFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  CARD_CONTAINER_CLASS,
} from "@era/satellite-kit/ui";
import { useRequireAuth } from "../../../../lib/use-require-auth";
import { useListPagination } from "../../../../lib/use-list-pagination";
import {
  isWorkforceGate403,
  workforceFetch,
} from "../../../../lib/workforce-fetch";
import { WorkforceGate } from "../../../../components/workspace/workforce-gate";

type OrderRow = {
  id: string;
  type: string;
  status: string;
  employmentId: string;
  effectiveDate: string;
  orderNumber?: string | null;
  locale?: string | null;
  personDisplayName?: string | null;
  employment?: { globalPersonId: string };
};

type EmploymentOpt = { id: string; globalPersonId: string };

const ORDER_TYPES = ["HIRE", "TRANSFER", "TERMINATE", "LEAVE_ANNUAL"] as const;
const LOCALES = ["az", "ru"] as const;

export default function PersonnelOrdersPage() {
  const { ready } = useRequireAuth();
  const t = useTranslations("workforceOrders");
  const tCommon = useTranslations("common");
  const searchParams = useSearchParams();
  const filterEmploymentId = searchParams.get("employmentId") ?? "";
  const autoPdf = searchParams.get("autoPdf") === "1";
  const orderTypeFilter = searchParams.get("orderType")?.trim() ?? "";
  const autoPdfDoneRef = useRef(false);
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [persons, setPersons] = useState<
    Record<string, { displayName: string | null }>
  >({});
  const [loading, setLoading] = useState(true);
  const [gated, setGated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [tplOpen, setTplOpen] = useState(false);
  const [employments, setEmployments] = useState<EmploymentOpt[]>([]);
  const [employmentId, setEmploymentId] = useState("");
  const [type, setType] = useState("HIRE");
  const [locale, setLocale] = useState("az");
  const [effectiveDate, setEffectiveDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [leaveStart, setLeaveStart] = useState("");
  const [leaveEnd, setLeaveEnd] = useState("");
  const [busy, setBusy] = useState(false);

  const [tplType, setTplType] = useState("HIRE");
  const [tplLocale, setTplLocale] = useState("az");
  const [tplName, setTplName] = useState("");
  const [tplBody, setTplBody] = useState("");
  const [tplScope, setTplScope] = useState<"org" | "holding">("org");
  const [requireOrderIssuedBeforeTerminate, setRequireOrderIssuedBeforeTerminate] =
    useState(false);
  const [settingsBusy, setSettingsBusy] = useState(false);

  const { page, pageSize, setPage, setPageSize, paged, total } =
    useListPagination(rows);

  const empOptions = useMemo(
    () =>
      employments.map((e) => ({
        value: e.id,
        label: persons[e.globalPersonId]?.displayName ?? e.globalPersonId.slice(0, 8),
      })),
    [employments, persons],
  );

  const typeOptions = useMemo(
    () => ORDER_TYPES.map((v) => ({ value: v, label: t(`type.${v}` as "type.HIRE") })),
    [t],
  );

  const localeOptions = useMemo(
    () => LOCALES.map((v) => ({ value: v, label: t(`locale.${v}` as "locale.az") })),
    [t],
  );

  const scopeOptions = useMemo(
    () => [
      { value: "org", label: t("tplScopeOrg") },
      { value: "holding", label: t("tplScopeHolding") },
    ],
    [t],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const qs = filterEmploymentId
      ? `?employmentId=${encodeURIComponent(filterEmploymentId)}`
      : "";
    const res = await workforceFetch(`personnel-orders${qs}`);
    if (await isWorkforceGate403(res)) {
      setGated(true);
      setLoading(false);
      return;
    }
    setGated(false);
    if (!res.ok) {
      setError(t("loadFailed"));
      setRows([]);
      setLoading(false);
      return;
    }
    const data = (await res.json()) as
      | OrderRow[]
      | {
          items?: OrderRow[];
          persons?: Record<string, { displayName: string | null }>;
        };
    if (Array.isArray(data)) {
      setRows(data);
    } else {
      setRows(data.items ?? []);
      if (data.persons) setPersons(data.persons);
    }
    setLoading(false);
  }, [t, filterEmploymentId]);

  const loadSettings = useCallback(async () => {
    const res = await workforceFetch("personnel-orders/settings");
    if (!res.ok) return;
    const data = (await res.json()) as {
      requireOrderIssuedBeforeTerminate?: boolean;
    };
    setRequireOrderIssuedBeforeTerminate(
      data.requireOrderIssuedBeforeTerminate === true,
    );
  }, []);

  useEffect(() => {
    if (ready) {
      void load();
      void loadSettings();
    }
  }, [ready, load, loadSettings]);

  async function patchSettings(checked: boolean) {
    setSettingsBusy(true);
    setError(null);
    try {
      const res = await workforceFetch("personnel-orders/settings", {
        method: "PATCH",
        body: JSON.stringify({
          requireOrderIssuedBeforeTerminate: checked,
        }),
      });
      if (!res.ok) {
        setError(t("settingsFailed"));
        await loadSettings();
        return;
      }
      const data = (await res.json()) as {
        requireOrderIssuedBeforeTerminate?: boolean;
      };
      setRequireOrderIssuedBeforeTerminate(
        data.requireOrderIssuedBeforeTerminate === true,
      );
    } finally {
      setSettingsBusy(false);
    }
  }

  useEffect(() => {
    autoPdfDoneRef.current = false;
  }, [filterEmploymentId, autoPdf, orderTypeFilter]);

  async function openCreate() {
    setOpen(true);
    const empRes = await workforceFetch("employments?status=ACTIVE");
    if (empRes.ok) {
      const e = (await empRes.json()) as {
        items?: EmploymentOpt[];
        persons?: Record<string, { displayName: string | null }>;
      };
      setEmployments(e.items ?? []);
      if (e.persons) setPersons(e.persons);
      if (e.items?.[0]) setEmploymentId(e.items[0].id);
    }
  }

  async function createOrder() {
    setBusy(true);
    setError(null);
    try {
      const res = await workforceFetch("personnel-orders", {
        method: "POST",
        body: JSON.stringify({
          employmentId,
          type,
          effectiveDate,
          locale,
          issue: false,
          ...(type === "LEAVE_ANNUAL"
            ? {
                leaveStartDate: leaveStart || effectiveDate,
                leaveEndDate: leaveEnd || effectiveDate,
              }
            : {}),
        }),
      });
      if (!res.ok) {
        setError(t("createFailed"));
        return;
      }
      setOpen(false);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function issue(id: string) {
    setBusy(true);
    try {
      const res = await workforceFetch(`personnel-orders/${id}/issue`, {
        method: "POST",
        body: "{}",
      });
      if (!res.ok) {
        setError(t("issueFailed"));
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function cancel(id: string) {
    if (!window.confirm(t("cancelConfirm"))) return;
    setBusy(true);
    try {
      const res = await workforceFetch(`personnel-orders/${id}/cancel`, {
        method: "POST",
        body: "{}",
      });
      if (!res.ok) {
        setError(t("cancelFailed"));
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function downloadPdf(id: string) {
    const res = await workforceFetch(`personnel-orders/${id}/pdf`);
    if (!res.ok) {
      setError(t("pdfFailed"));
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `personnel-order-${id.slice(0, 8)}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    if (!autoPdf || loading || autoPdfDoneRef.current || rows.length === 0) {
      return;
    }
    const typed = orderTypeFilter
      ? rows.filter((r) => r.type === orderTypeFilter)
      : rows;
    const issued = typed.find((r) => r.status === "ISSUED");
    if (issued) {
      autoPdfDoneRef.current = true;
      void downloadPdf(issued.id);
      return;
    }
    if (typed.some((r) => r.status === "DRAFT")) {
      autoPdfDoneRef.current = true;
      setError(t("autoPdfNeedIssue"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot after load
  }, [autoPdf, loading, rows, orderTypeFilter, t]);

  async function saveTemplate() {
    setBusy(true);
    setError(null);
    try {
      const res = await workforceFetch("personnel-orders/templates", {
        method: "PUT",
        body: JSON.stringify({
          type: tplType,
          locale: tplLocale,
          name: tplName.trim() || `${tplType} ${tplLocale}`,
          bodyHtml: tplBody,
          scope: tplScope,
        }),
      });
      if (!res.ok) {
        setError(t("tplFailed"));
        return;
      }
      setTplOpen(false);
    } finally {
      setBusy(false);
    }
  }

  async function previewTemplate() {
    if (!tplBody.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await workforceFetch("personnel-orders/templates/preview-pdf", {
        method: "POST",
        body: JSON.stringify({
          type: tplType,
          locale: tplLocale,
          bodyHtml: tplBody,
          name: tplName.trim() || undefined,
        }),
      });
      if (!res.ok) {
        setError(t("tplPreviewFailed"));
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `template-preview-${tplType}-${tplLocale}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return null;
  if (gated) return <WorkforceGate onEnabled={() => void load()} />;

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              onClick={() => setTplOpen(true)}
            >
              {t("templates")}
            </button>
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void openCreate()}>
              <Plus className="mr-1.5 h-4 w-4" aria-hidden />
              {t("create")}
            </button>
          </div>
        }
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className={`space-y-2 ${CARD_CONTAINER_CLASS} p-3`}>
        <p className="text-sm text-[var(--era-muted)]">{t("draftHint")}</p>
        <label className="flex items-start gap-2 text-sm text-[#34495E]">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={requireOrderIssuedBeforeTerminate}
            disabled={settingsBusy}
            onChange={(e) => void patchSettings(e.target.checked)}
          />
          <span>
            {t("requireOrderBeforeTerminate")}
            <span className="mt-0.5 block text-xs text-[var(--era-muted)]">
              {t("requireOrderBeforeTerminateHint")}
            </span>
          </span>
        </label>
      </div>
      {loading ? (
        <p className="text-sm text-[#7F8C8D]">{t("loading")}</p>
      ) : (
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colNumber")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colType")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colPerson")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colDate")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colStatus")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS} colSpan={6}>
                    {t("empty")}
                  </td>
                </tr>
              ) : (
                paged.map((r) => (
                  <tr key={r.id} className={DATA_TABLE_TR_CLASS}>
                    <td className={DATA_TABLE_TD_CLASS}>{r.orderNumber ?? r.id.slice(0, 8)}</td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      {t(`type.${r.type}` as "type.HIRE")}
                    </td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      {r.personDisplayName ??
                        (r.employment?.globalPersonId
                          ? persons[r.employment.globalPersonId]?.displayName
                          : null) ??
                        r.employmentId.slice(0, 8)}
                    </td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      {String(r.effectiveDate).slice(0, 10)}
                    </td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      {t(`status.${r.status}` as "status.DRAFT")}
                    </td>
                    <td className={`${DATA_TABLE_TD_CLASS} flex flex-wrap gap-2`}>
                      <button
                        type="button"
                        className={SECONDARY_BUTTON_CLASS}
                        disabled={busy || r.status !== "DRAFT"}
                        onClick={() => void issue(r.id)}
                      >
                        {t("issue")}
                      </button>
                      <button
                        type="button"
                        className={SECONDARY_BUTTON_CLASS}
                        disabled={busy || r.status !== "DRAFT"}
                        onClick={() => void cancel(r.id)}
                      >
                        {t("cancel")}
                      </button>
                      <button
                        type="button"
                        className={SECONDARY_BUTTON_CLASS}
                        onClick={() => void downloadPdf(r.id)}
                      >
                        PDF
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <ListPaginationFooter
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            labels={{
              rowsPerPage: tCommon("paginationRowsPerPage"),
              pageOf: tCommon("paginationPageOf"),
              prev: tCommon("paginationPrev"),
              next: tCommon("paginationNext"),
            }}
          />
        </div>
      )}
      <ModalShell
        open={open}
        title={t("create")}
        onClose={() => setOpen(false)}
        closeLabel={tCommon("close")}
      >
        <form className="grid gap-3" onSubmit={(e) => e.preventDefault()}>
          <CatalogField
            kind="ENTITY_REF"
            label={t("colPerson")}
            value={employmentId}
            onChange={(next) => setEmploymentId(String(next))}
            options={empOptions}
          />
          <CatalogField
            kind="CLOSED_SMALL"
            label={t("colType")}
            value={type}
            onChange={(next) => setType(String(next))}
            options={typeOptions}
          />
          <CatalogField
            kind="CLOSED_SMALL"
            label={t("colLocale")}
            value={locale}
            onChange={(next) => setLocale(String(next))}
            options={localeOptions}
          />
          <label className="block text-[13px] font-medium text-[#34495E]">
            {t("colDate")}
            <input
              type="date"
              className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
            />
          </label>
          {type === "LEAVE_ANNUAL" ? (
            <>
              <label className="block text-[13px] font-medium text-[#34495E]">
                {t("leaveStart")}
                <input
                  type="date"
                  className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5"
                  value={leaveStart}
                  onChange={(e) => setLeaveStart(e.target.value)}
                />
              </label>
              <label className="block text-[13px] font-medium text-[#34495E]">
                {t("leaveEnd")}
                <input
                  type="date"
                  className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5"
                  value={leaveEnd}
                  onChange={(e) => setLeaveEnd(e.target.value)}
                />
              </label>
            </>
          ) : null}
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={busy || !employmentId}
            onClick={() => void createOrder()}
          >
            {t("create")}
          </button>
        </form>
      </ModalShell>
      <ModalShell
        open={tplOpen}
        title={t("templates")}
        onClose={() => setTplOpen(false)}
        closeLabel={tCommon("close")}
      >
        <form className="grid gap-3" onSubmit={(e) => e.preventDefault()}>
          <CatalogField
            kind="CLOSED_SMALL"
            label={t("colType")}
            value={tplType}
            onChange={(next) => setTplType(String(next))}
            options={typeOptions}
          />
          <CatalogField
            kind="CLOSED_SMALL"
            label={t("colLocale")}
            value={tplLocale}
            onChange={(next) => setTplLocale(String(next))}
            options={localeOptions}
          />
          <CatalogField
            kind="CLOSED_SMALL"
            label={t("tplScope")}
            value={tplScope}
            onChange={(next) => setTplScope(String(next) as "org" | "holding")}
            options={scopeOptions}
          />
          <label className="block text-[13px] font-medium text-[#34495E]">
            {t("tplName")}
            <input
              className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5"
              value={tplName}
              onChange={(e) => setTplName(e.target.value)}
            />
          </label>
          <label className="block text-[13px] font-medium text-[#34495E]">
            {t("tplBody")}
            <textarea
              className="mt-1 block h-40 w-full rounded-lg border border-[#D5DADF] px-2 py-1.5 font-mono text-[12px]"
              value={tplBody}
              onChange={(e) => setTplBody(e.target.value)}
              placeholder="{{person.fullName}} {{order.number}}"
            />
          </label>
          <p className="text-xs text-[#7F8C8D]">{t("tplHint")}</p>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              disabled={busy || !tplBody.trim()}
              onClick={() => void previewTemplate()}
            >
              {t("tplPreview")}
            </button>
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={busy || !tplBody.trim()}
              onClick={() => void saveTemplate()}
            >
              {t("tplSave")}
            </button>
          </div>
        </form>
      </ModalShell>
    </div>
  );
}
