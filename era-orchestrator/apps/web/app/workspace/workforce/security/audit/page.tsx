"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CatalogField,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  EraListFilterBar,
  ListPaginationFooter,
  PageHeader,
} from "@era/satellite-kit/ui";
import { getOrchAccessToken, orchFetch } from "../../../../../lib/orch-api";
import { useRequireAuth } from "../../../../../lib/use-require-auth";
import { useListPagination } from "../../../../../lib/use-list-pagination";

type AuditRow = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorUserId?: string | null;
  globalPersonId?: string | null;
  cpEmploymentId?: string | null;
  createdAt: string;
};

type PersonProfile = { displayName: string | null };
type ActorProfile = { email: string };

const AUDIT_FILTER_ACTIONS = [
  "HIRE",
  "TERMINATE",
  "EMPLOYMENT_TRANSFERRED",
  "ABSENCE_APPROVED",
  "PERSONNEL_ORDER_ISSUED",
  "ROLE_GRANT",
  "TIMESHEET_APPROVE",
  "PERSONNEL_ORDER_CREATED",
  "ABSENCE_CREATED",
  "ROLE_REVOKE",
  "WORKFORCE_IMPORT_APPLIED",
  "ATTENDANCE_REBUILD",
] as const;

async function wfFetch(path: string) {
  const token = getOrchAccessToken();
  const res = await fetch(`/api/platform/workforce/${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

export default function WorkforceSecurityAuditPage() {
  const { ready, token } = useRequireAuth();
  const t = useTranslations("workforceAudit");
  const tCommon = useTranslations("common");
  const [action, setAction] = useState("");
  const [globalPersonId, setGlobalPersonId] = useState("");
  const [holdingId, setHoldingId] = useState("");
  const [holdings, setHoldings] = useState<Array<{ id: string; name: string }>>(
    [],
  );
  const [items, setItems] = useState<AuditRow[]>([]);
  const [persons, setPersons] = useState<Record<string, PersonProfile>>({});
  const [actors, setActors] = useState<Record<string, ActorProfile>>({});
  const [personOptions, setPersonOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const [loading, setLoading] = useState(false);

  const { page, pageSize, setPage, setPageSize, paged, total } =
    useListPagination(items);

  const holdingOptions = useMemo(
    () => [
      { value: "", label: t("holdingAny") },
      ...holdings.map((h) => ({ value: h.id, label: h.name })),
    ],
    [holdings, t],
  );

  const actionOptions = useMemo(
    () => [
      { value: "", label: t("actionAny") },
      ...AUDIT_FILTER_ACTIONS.map((v) => ({
        value: v,
        label: t(`action.${v}` as "action.HIRE"),
      })),
    ],
    [t],
  );

  useEffect(() => {
    if (!ready || !token) return;
    void (async () => {
      const res = await orchFetch("/v1/holdings", { token });
      if (!res.ok) return;
      const list = (await res.json()) as Array<{ id: string; name: string }>;
      setHoldings(list);
    })();
  }, [ready, token]);

  useEffect(() => {
    if (!ready) return;
    void (async () => {
      try {
        const data = await wfFetch("employments?pageSize=200");
        const itemsList = Array.isArray(data)
          ? data
          : (data.items ?? data.employments ?? []);
        const personsMap = (data.persons ?? {}) as Record<string, PersonProfile>;
        const byPerson = new Map<string, { value: string; label: string }>();
        for (const e of itemsList as Array<{
          id: string;
          globalPersonId: string;
          staffCode?: string;
        }>) {
          if (!e.globalPersonId || byPerson.has(e.globalPersonId)) continue;
          const name =
            personsMap[e.globalPersonId]?.displayName ??
            e.globalPersonId.slice(0, 8);
          const code =
            e.staffCode ?? e.id.replace(/-/g, "").slice(0, 8).toUpperCase();
          byPerson.set(e.globalPersonId, {
            value: e.globalPersonId,
            label: `${name} (${code})`,
          });
        }
        setPersonOptions([...byPerson.values()]);
      } catch {
        /* employments optional for filter */
      }
    })();
  }, [ready]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ pageSize: "50" });
      if (action.trim()) qs.set("action", action.trim());
      if (globalPersonId.trim()) qs.set("globalPersonId", globalPersonId.trim());
      if (holdingId.trim()) qs.set("holdingId", holdingId.trim());
      const data = await wfFetch(`security/audit?${qs.toString()}`);
      setItems(data.items ?? []);
      setPersons(data.persons ?? {});
      setActors(data.actors ?? {});
    } finally {
      setLoading(false);
    }
  }, [action, globalPersonId, holdingId]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  if (!ready) return null;

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <p className="mb-4 text-sm">
        <Link href="/workspace/workforce/security" className="text-[#2980B9] hover:underline">
          ← {t("back")}
        </Link>
      </p>
      <EraListFilterBar
        className="mb-4"
        resetLabel={tCommon("filterReset")}
        onReset={() => {
          setAction("");
          setGlobalPersonId("");
          setHoldingId("");
        }}
      >
        <CatalogField
          kind="CLOSED_MEDIUM"
          label={t("filterAction")}
          value={action}
          onChange={(next) => setAction(String(next))}
          options={actionOptions}
          emptyLabel={t("actionAny")}
        />
        <CatalogField
          kind="ENTITY_REF"
          label={t("filterPerson")}
          value={globalPersonId}
          onChange={(next) => setGlobalPersonId(String(next))}
          options={personOptions}
          emptyLabel={t("personAny")}
        />
        <CatalogField
          kind="ENTITY_REF"
          label={t("filterHolding")}
          value={holdingId}
          onChange={(next) => setHoldingId(String(next))}
          options={holdingOptions}
          emptyLabel={t("holdingAny")}
        />
      </EraListFilterBar>
      <div className={DATA_TABLE_VIEWPORT_CLASS}>
        <table className={DATA_TABLE_CLASS}>
          <thead>
            <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colTime")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colAction")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colActor")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colEntity")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colPerson")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colEmployment")}</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((row) => {
              const actorEmail = row.actorUserId
                ? actors[row.actorUserId]?.email
                : null;
              const personName = row.globalPersonId
                ? persons[row.globalPersonId]?.displayName
                : null;
              return (
                <tr key={row.id} className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {new Date(row.createdAt).toLocaleString()}
                  </td>
                  <td className={`${DATA_TABLE_TD_CLASS} font-medium`}>
                    {t(`action.${row.action}` as "action.HIRE", {
                      defaultValue: row.action,
                    })}
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {actorEmail ??
                      (row.actorUserId ? row.actorUserId.slice(0, 8) : "—")}
                  </td>
                  <td
                    className={DATA_TABLE_TD_CLASS}
                    title={`${row.entityType} / ${row.entityId}`}
                  >
                    {row.entityType} / {row.entityId.slice(0, 8)}…
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {personName ??
                      (row.globalPersonId ? row.globalPersonId.slice(0, 8) : "—")}
                  </td>
                  <td
                    className={DATA_TABLE_TD_CLASS}
                    title={row.cpEmploymentId ?? undefined}
                  >
                    {row.cpEmploymentId?.slice(0, 8) ?? "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {total === 0 && !loading ? (
          <p className="px-4 py-4 text-sm text-[#7F8C8D]">{t("empty")}</p>
        ) : null}
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
    </>
  );
}
