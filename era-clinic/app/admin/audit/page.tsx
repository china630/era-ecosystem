"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  CatalogField,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  DatePicker,
  EraListFilterBar,
  Field,
  ListPaginationFooter,
  PageHeader,
  showApiError,
  useDebouncedValue,
} from "@era/satellite-kit/ui";
import { bakuDateTimeDisplay } from "@/lib/baku-day";

const ENTITY_TYPES = [
  "HTTP_MUTATION",
  "ProcedureOrder",
  "Visit",
  "WalkInParty",
  "Role",
  "ImportRun",
] as const;

type AuditRow = {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  createdAt: string;
  userId?: string | null;
  changes?: Record<string, unknown>;
};

export default function ClinicAuditPage() {
  const t = useTranslations("audit");
  const tc = useTranslations("common");
  const [entityType, setEntityType] = useState<string>("HTTP_MUTATION");
  const [entityId, setEntityId] = useState("");
  const [action, setAction] = useState("");
  const [userId, setUserId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const debouncedEntityId = useDebouncedValue(entityId, 300);
  const debouncedAction = useDebouncedValue(action, 300);
  const debouncedUserId = useDebouncedValue(userId, 300);
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, page, pageSize]);

  const search = useCallback(async () => {
    try {
      const params = new URLSearchParams({ entityType, limit: "100" });
      if (debouncedEntityId.trim()) params.set("entityId", debouncedEntityId.trim());
      if (debouncedAction.trim()) params.set("action", debouncedAction.trim());
      if (debouncedUserId.trim()) params.set("userId", debouncedUserId.trim());
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      const res = await fetch(`/api/admin/audit?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, t("loadFailed"));
        setRows([]);
        return;
      }
      setRows((Array.isArray(data) ? data : (data.data ?? [])) as AuditRow[]);
      setPage(1);
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : t("loadFailed") });
    }
  }, [
    entityType,
    debouncedEntityId,
    debouncedAction,
    debouncedUserId,
    dateFrom,
    dateTo,
    t,
  ]);

  useEffect(() => {
    void search();
  }, [search]);

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <EraListFilterBar
        resetLabel={tc("filterReset")}
        onReset={() => {
          setEntityType("HTTP_MUTATION");
          setEntityId("");
          setAction("");
          setUserId("");
          setDateFrom("");
          setDateTo("");
        }}
      >
        <CatalogField
          kind="CLOSED_SMALL"
          label={t("entityType")}
          id="clinic-audit-entity"
          value={entityType}
          onChange={(v) => setEntityType(String(v ?? "HTTP_MUTATION"))}
          options={ENTITY_TYPES.map((code) => ({
            value: code,
            label: t(`entity_${code}` as "entity_HTTP_MUTATION"),
          }))}
          emptyLabel={null}
          widthPreset="selectWide"
        />
        <Field
          label={t("entityId")}
          preset="code"
          id="clinic-audit-entity-id"
          value={entityId}
          onChange={(e) => setEntityId(e.target.value)}
        />
        <Field
          label={t("action")}
          preset="shortText"
          id="clinic-audit-action"
          value={action}
          onChange={(e) => setAction(e.target.value)}
        />
        <Field
          label={t("user")}
          preset="code"
          id="clinic-audit-user"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
        />
        <DatePicker
          label={t("dateFrom")}
          value={dateFrom}
          onChange={setDateFrom}
          placeholder={tc("datePlaceholder")}
          preset="date"
          id="clinic-audit-from"
        />
        <DatePicker
          label={t("dateTo")}
          value={dateTo}
          onChange={setDateTo}
          placeholder={tc("datePlaceholder")}
          preset="date"
          id="clinic-audit-to"
        />
      </EraListFilterBar>
      <div className={`${CARD_CONTAINER_CLASS} p-4`}>
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("when")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("entity")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("action")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("user")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("changes")}</th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((r) => (
                <tr key={r.id} className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS}>{bakuDateTimeDisplay(r.createdAt)}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {r.entityType} / {r.entityId.slice(0, 8)}
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>{r.action}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{r.userId ?? "—"}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    <button
                      type="button"
                      className="text-[12px] text-[#2980B9] hover:underline"
                      onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                    >
                      {expandedId === r.id ? t("hideChanges") : t("showChanges")}
                    </button>
                    {expandedId === r.id && (
                      <pre className="mt-1 max-h-32 overflow-auto rounded bg-[#F8F9FA] p-2 text-[11px]">
                        {JSON.stringify(r.changes ?? {}, null, 2)}
                      </pre>
                    )}
                  </td>
                </tr>
              ))}
              {pagedRows.length === 0 && (
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td colSpan={5} className={`${DATA_TABLE_TD_CLASS} text-[#7F8C8D]`}>
                    {t("empty")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <ListPaginationFooter
          page={page}
          pageSize={pageSize}
          total={rows.length}
          onPageChange={setPage}
          onPageSizeChange={(n) => {
            setPageSize(n);
            setPage(1);
          }}
          labels={{
            rowsPerPage: tc("rowsPerPage"),
            pageOf: tc("pageOf"),
            prev: tc("prev"),
            next: tc("next"),
          }}
        />
      </div>
    </>
  );
}
