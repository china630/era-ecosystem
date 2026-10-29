"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CatalogField,
  DatePicker,
  EraListFilterBar,
  Field,
  useDebouncedValue,
} from "@era/satellite-kit/ui";
import { bakuDateTimeDisplay } from "@era/satellite-kit/time";
import { apiFetch } from "../../../../lib/api-client";
import { useOrgPermissions } from "../../../../lib/use-org-permissions";
import {
  CARD_CONTAINER_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "../../../../lib/design-system";
import { useRequireAuth } from "../../../../lib/use-require-auth";
import { PageHeader } from "../../../../components/layout/page-header";
import { AuditActionChip } from "../../../../components/admin/audit-action-chip";
import { AuditDiffModal } from "../../../../components/admin/audit-diff-modal";

/** Same catalog as `/admin/audit` (Wave D sibling filter parity). */
const AUDIT_ENTITY_TYPES = [
  "HTTP_MUTATION",
  "Invoice",
  "Employee",
  "Product",
  "JournalEntry",
  "IntegrationSyncRun",
  "CustomsDeclaration",
  "Counterparty",
] as const;

type Semantic = "CREATE" | "UPDATE" | "DELETE" | "OTHER";

type AdminAuditRow = {
  id: string;
  userId: string | null;
  actorDisplayName: string | null;
  entityType: string;
  entityId: string;
  action: string;
  semanticAction: Semantic;
  createdAt: string;
  oldValues: unknown;
  newValues: unknown;
  objectLabel: string;
  invoiceNumber: string | null;
  employeeDisplayName: string | null;
};

export default function AdminSecurityAuditLogPage() {
  const { t } = useTranslation();
  const { ready, token } = useRequireAuth();
  const perms = useOrgPermissions();
  const isOwner = perms.isOwner;

  const [rows, setRows] = useState<AdminAuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [busy, setBusy] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const [userId, setUserId] = useState("");
  const [entityName, setEntityName] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selected, setSelected] = useState<AdminAuditRow | null>(null);

  const debouncedUserId = useDebouncedValue(userId, 300);

  const maxPage = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total, pageSize],
  );

  const objectLabel = useCallback(
    (r: AdminAuditRow) => {
      if (r.entityType === "Invoice" && r.invoiceNumber) {
        return t("securityAuditPage.objectInvoice", {
          number: r.invoiceNumber,
        });
      }
      if (r.entityType === "Employee" && r.employeeDisplayName) {
        return t("securityAuditPage.objectEmployee", {
          name: r.employeeDisplayName,
        });
      }
      const typeLabel = t(`auditEntity.${r.entityType}`, {
        defaultValue: r.entityType,
      });
      return `${typeLabel} · ${r.entityId}`;
    },
    [t],
  );

  const fetchPage = useCallback(
    async (pageNum: number) => {
      if (!token || !isOwner) {
        return;
      }
      setLoadErr(null);
      setBusy(true);
      try {
        const q = new URLSearchParams();
        q.set("page", String(pageNum));
        q.set("pageSize", String(pageSize));
        if (debouncedUserId.trim()) {
          q.set("userId", debouncedUserId.trim());
        }
        if (entityName.trim()) {
          q.set("entityName", entityName.trim());
        }
        if (dateFrom.trim()) {
          q.set("dateFrom", dateFrom.trim());
        }
        if (dateTo.trim()) {
          q.set("dateTo", dateTo.trim());
        }
        const res = await apiFetch(`/api/admin/security-audit?${q.toString()}`);
        if (!res.ok) {
          setLoadErr(`${res.status}`);
          setRows([]);
          setTotal(0);
          return;
        }
        const body = (await res.json()) as {
          items: AdminAuditRow[];
          total: number;
        };
        setRows(body.items ?? []);
        setTotal(body.total ?? 0);
        setPage(pageNum);
      } finally {
        setBusy(false);
      }
    },
    [token, isOwner, pageSize, debouncedUserId, entityName, dateFrom, dateTo],
  );

  useEffect(() => {
    if (!ready || !token || !isOwner) {
      return;
    }
    void fetchPage(1);
  }, [ready, token, isOwner, fetchPage]);

  function resetFilters() {
    setEntityName("");
    setUserId("");
    setDateFrom("");
    setDateTo("");
  }

  if (!ready || !token) {
    return <div className="text-sm text-[#7F8C8D]">{t("common.loading")}</div>;
  }

  if (!isOwner) {
    return (
      <div className="max-w-3xl space-y-4">
        <PageHeader
          title={t("securityAuditPage.title")}
          subtitle={t("securityAuditPage.ownerOnly")}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <PageHeader
        title={t("securityAuditPage.title")}
        subtitle={t("securityAuditPage.subtitle")}
      />

      <EraListFilterBar
        resetLabel={t("common.filterReset", { defaultValue: "Reset filters" })}
        onReset={resetFilters}
      >
        <CatalogField
          kind="CLOSED_MEDIUM"
          label={t("securityAuditPage.filterEntity")}
          id="finance-security-audit-entity"
          value={entityName}
          onChange={(v) => setEntityName(String(v ?? ""))}
          options={[
            {
              value: "",
              label: t("common.all", { defaultValue: "All" }),
            },
            ...AUDIT_ENTITY_TYPES.map((code) => ({
              value: code,
              label: t(`auditEntity.${code}`, { defaultValue: code }),
            })),
          ]}
          emptyLabel={null}
          widthPreset="selectWide"
        />
        <Field
          label={t("securityAuditPage.filterUser")}
          preset="code"
          id="finance-security-audit-user"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder={t("auditPage.placeholderUserId", {
            defaultValue: "UUID",
          })}
        />
        <DatePicker
          label={t("auditPage.filterFrom")}
          value={dateFrom}
          onChange={setDateFrom}
          placeholder={t("common.datePlaceholder", {
            defaultValue: "dd.mm.yyyy",
          })}
          preset="date"
          id="finance-security-audit-from"
        />
        <DatePicker
          label={t("auditPage.filterTo")}
          value={dateTo}
          onChange={setDateTo}
          placeholder={t("common.datePlaceholder", {
            defaultValue: "dd.mm.yyyy",
          })}
          preset="date"
          id="finance-security-audit-to"
        />
      </EraListFilterBar>

      {loadErr && <p className="text-red-600 text-sm">{loadErr}</p>}

      <div className={`overflow-x-auto ${CARD_CONTAINER_CLASS}`}>
        <table className="min-w-full text-[13px]">
          <thead className="bg-gray-50 text-left text-[#7F8C8D]">
            <tr>
              <th className="px-3 py-2 font-medium">
                {t("securityAuditPage.colWhen")}
              </th>
              <th className="px-3 py-2 font-medium">
                {t("securityAuditPage.colWho")}
              </th>
              <th className="px-3 py-2 font-medium">
                {t("securityAuditPage.colAction")}
              </th>
              <th className="px-3 py-2 font-medium">
                {t("securityAuditPage.colObject")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                className={`border-t border-[#D5DADF] ${
                  r.semanticAction === "UPDATE"
                    ? "cursor-pointer hover:bg-slate-50/80"
                    : ""
                }`}
                onClick={() => {
                  if (r.semanticAction === "UPDATE") {
                    setSelected(r);
                  }
                }}
              >
                <td className="px-3 py-2 whitespace-nowrap text-[#34495E]">
                  {bakuDateTimeDisplay(r.createdAt)}
                </td>
                <td className="px-3 py-2 text-[#34495E]">
                  {r.actorDisplayName ?? r.userId ?? "—"}
                </td>
                <td className="px-3 py-2">
                  <AuditActionChip
                    semanticAction={r.semanticAction}
                    httpAction={r.action}
                  />
                </td>
                <td className="px-3 py-2 text-[#34495E]">{objectLabel(r)}</td>
              </tr>
            ))}
            {rows.length === 0 && !busy && (
              <tr>
                <td
                  colSpan={4}
                  className="px-3 py-6 text-center text-[#7F8C8D]"
                >
                  {t("securityAuditPage.empty", {
                    defaultValue: t("auditPage.empty", {
                      defaultValue: "No rows",
                    }),
                  })}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[#7F8C8D]">
          <span>
            {t("securityAuditPage.paginationShort", {
              page,
              maxPage,
              total,
            })}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1 || busy}
              onClick={() => void fetchPage(Math.max(1, page - 1))}
              className={`${SECONDARY_BUTTON_CLASS} px-3 py-1 text-xs disabled:opacity-40`}
            >
              {t("employees.prevPage")}
            </button>
            <button
              type="button"
              disabled={page >= maxPage || busy}
              onClick={() => void fetchPage(page + 1)}
              className={`${SECONDARY_BUTTON_CLASS} px-3 py-1 text-xs disabled:opacity-40`}
            >
              {t("employees.nextPage")}
            </button>
          </div>
        </div>
      )}

      <AuditDiffModal
        open={Boolean(selected)}
        title={t("securityAuditPage.diffTitle")}
        oldValues={selected?.oldValues}
        newValues={selected?.newValues}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
