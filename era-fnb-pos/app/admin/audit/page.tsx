"use client";

import { useCallback, useEffect, useState } from "react";
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
  PageHeader,
  showApiError,
  useDebouncedValue,
} from "@era/satellite-kit/ui";
import { bakuDateTimeDisplay } from "@era/satellite-kit/time";

const ENTITY_TYPES = [
  "HTTP_MUTATION",
  "TicketLine",
  "Ticket",
  "PosShift",
  "Role",
] as const;

type AuditRow = {
  id: string;
  userId: string | null;
  entityType: string;
  entityId: string;
  action: string;
  changes: Record<string, unknown>;
  createdAt: string;
};

export default function FnbAuditPage() {
  const t = useTranslations("auditViewer");
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
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const search = useCallback(async () => {
    try {
      const params = new URLSearchParams({ entityType });
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
      setRows(Array.isArray(data) ? data : (data.data ?? []));
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : t("loadFailed") });
    }
  }, [entityType, debouncedEntityId, debouncedAction, debouncedUserId, dateFrom, dateTo, t]);

  useEffect(() => {
    void search();
  }, [search]);

  return (
    <>
      <PageHeader title={t("title")} />
      <p className="mb-4 text-[13px] text-[#7F8C8D]">{t("subtitle")}</p>
      <EraListFilterBar
        resetLabel={tc("cancel")}
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
          id="fnb-audit-entity"
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
          id="fnb-audit-entity-id"
          value={entityId}
          onChange={(e) => setEntityId(e.target.value)}
        />
        <Field
          label={t("action")}
          preset="shortText"
          id="fnb-audit-action"
          value={action}
          onChange={(e) => setAction(e.target.value)}
        />
        <Field
          label={t("userId")}
          preset="code"
          id="fnb-audit-user"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
        />
        <DatePicker
          label={t("dateFrom")}
          value={dateFrom}
          onChange={setDateFrom}
          placeholder={tc("date")}
          preset="date"
          id="fnb-audit-from"
        />
        <DatePicker
          label={t("dateTo")}
          value={dateTo}
          onChange={setDateTo}
          placeholder={tc("date")}
          preset="date"
          id="fnb-audit-to"
        />
      </EraListFilterBar>
      <section className={`${CARD_CONTAINER_CLASS} p-4`}>
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc("date")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("action")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("entityType")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("entityId")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("userId")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("changes")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS}>{bakuDateTimeDisplay(row.createdAt)}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{row.action}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{row.entityType}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{row.entityId}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{row.userId ?? tc("emDash")}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    <button
                      type="button"
                      className="text-[12px] text-[#2980B9] hover:underline"
                      onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
                    >
                      {expandedId === row.id ? t("hideChanges") : t("showChanges")}
                    </button>
                    {expandedId === row.id && (
                      <pre className="mt-1 max-h-32 overflow-auto rounded bg-[#F8F9FA] p-2 text-[11px]">
                        {JSON.stringify(row.changes, null, 2)}
                      </pre>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td colSpan={6} className={`${DATA_TABLE_TD_CLASS} text-[#7F8C8D]`}>
                    {t("empty")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
