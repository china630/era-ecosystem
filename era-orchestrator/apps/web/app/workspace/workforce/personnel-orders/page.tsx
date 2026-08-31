"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  personDisplayName?: string | null;
  employment?: { globalPersonId: string };
};

type EmploymentOpt = { id: string; globalPersonId: string };

const ORDER_TYPES = ["HIRE", "TRANSFER", "TERMINATE"] as const;

export default function PersonnelOrdersPage() {
  const { ready } = useRequireAuth();
  const t = useTranslations("workforceOrders");
  const tCommon = useTranslations("common");
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [persons, setPersons] = useState<
    Record<string, { displayName: string | null }>
  >({});
  const [loading, setLoading] = useState(true);
  const [gated, setGated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [employments, setEmployments] = useState<EmploymentOpt[]>([]);
  const [employmentId, setEmploymentId] = useState("");
  const [type, setType] = useState("HIRE");
  const [effectiveDate, setEffectiveDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [busy, setBusy] = useState(false);
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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await workforceFetch("personnel-orders");
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
  }, [t]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

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
          issue: false,
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

  if (!ready) return null;
  if (gated) return <WorkforceGate onEnabled={() => void load()} />;

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void openCreate()}>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden />
            {t("create")}
          </button>
        }
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
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
                        disabled={r.status === "DRAFT"}
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
          <label className="block text-[13px] font-medium text-[#34495E]">
            {t("colDate")}
            <input
              type="date"
              className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
            />
          </label>
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
    </div>
  );
}
