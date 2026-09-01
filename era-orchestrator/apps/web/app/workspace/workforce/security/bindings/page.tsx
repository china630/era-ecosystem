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
  DEFAULT_LIST_PAGE_SIZE,
  ListPaginationFooter,
  PageHeader,
} from "@era/satellite-kit/ui";
import { useRequireAuth } from "../../../../../lib/use-require-auth";
import {
  WORKFORCE_UI_SATELLITES,
  humanizeSatelliteRole,
  rolesForSatellite,
} from "../../../../../lib/workforce-satellites";
import {
  isWorkforceGate403,
  workforceFetch as wfFetch,
} from "../../../../../lib/workforce-fetch";
import { WorkforceGate } from "../../../../../components/workspace/workforce-gate";

type BindingRow = {
  id: string;
  satelliteKey: string;
  satelliteRole: string;
  provisionState?: string;
  lastProvisionError?: string | null;
  employment: {
    orgUnit?: { id: string; name: string };
    position?: { id: string; name: string };
  };
};

type OrgUnitOpt = { id: string; name: string };
type PositionOpt = { id: string; name: string; orgUnitId?: string };

export default function WorkforceSecurityBindingsPage() {
  const { ready, user } = useRequireAuth();
  const t = useTranslations("workforceSecurity");
  const tCommon = useTranslations("common");
  const tSys = useTranslations("workspace.systems");
  const [items, setItems] = useState<BindingRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_LIST_PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [notEntitled, setNotEntitled] = useState(false);
  const [orgUnits, setOrgUnits] = useState<OrgUnitOpt[]>([]);
  const [positions, setPositions] = useState<PositionOpt[]>([]);

  const [filterText, setFilterText] = useState("");
  const [filterOrgUnitId, setFilterOrgUnitId] = useState("");
  const [filterPositionId, setFilterPositionId] = useState("");
  const [filterSatellite, setFilterSatellite] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterProvisionState, setFilterProvisionState] = useState("");

  const satelliteLabel = useCallback(
    (key: string): string => {
      const found = WORKFORCE_UI_SATELLITES.find((s) => s.key === key);
      return found ? tSys(`${found.i18n}.title` as "clinic.title") : key;
    },
    [tSys],
  );

  const satelliteOptions = useMemo(
    () =>
      WORKFORCE_UI_SATELLITES.map((s) => ({
        value: s.key,
        label: satelliteLabel(s.key),
      })),
    [satelliteLabel],
  );

  const filterPositionOptions = useMemo(() => {
    return positions
      .filter((p) => !filterOrgUnitId || p.orgUnitId === filterOrgUnitId)
      .map((p) => ({ value: p.id, label: p.name }))
      .sort((a, b) => a.label.localeCompare(b.label, "az"));
  }, [positions, filterOrgUnitId]);

  const filterRoleOptions = useMemo(() => {
    if (!filterSatellite) return [];
    return rolesForSatellite(filterSatellite).map((r) => ({
      value: r,
      label: humanizeSatelliteRole(r),
    }));
  }, [filterSatellite]);

  const provisionStateOptions = useMemo(
    () => [
      { value: "PENDING", label: t("provisionPending") },
      { value: "APPLIED", label: t("provisionApplied") },
      { value: "FAILED", label: t("provisionFailed") },
    ],
    [t],
  );

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (filterText.trim()) qs.set("search", filterText.trim());
    if (filterOrgUnitId) qs.set("orgUnitId", filterOrgUnitId);
    if (filterPositionId) qs.set("positionId", filterPositionId);
    if (filterSatellite) qs.set("satelliteKey", filterSatellite);
    if (filterRole) qs.set("role", filterRole);
    if (filterProvisionState) qs.set("provisionState", filterProvisionState);

    const [bindRes, ouRes, posRes] = await Promise.all([
      wfFetch(`security/bindings?${qs}`),
      wfFetch("org-units"),
      wfFetch("positions?status=ACTIVE"),
    ]);
    if (await isWorkforceGate403(bindRes)) {
      setNotEntitled(true);
      setLoading(false);
      return;
    }
    setNotEntitled(false);
    if (bindRes.ok) {
      const data = (await bindRes.json()) as {
        items: BindingRow[];
        total: number;
      };
      setItems(Array.isArray(data.items) ? data.items : []);
      setTotal(typeof data.total === "number" ? data.total : 0);
    }
    if (ouRes.ok) {
      const units = (await ouRes.json()) as OrgUnitOpt[];
      setOrgUnits(Array.isArray(units) ? units : []);
    }
    if (posRes.ok) {
      const rows = (await posRes.json()) as PositionOpt[];
      setPositions(Array.isArray(rows) ? rows : []);
    }
    setLoading(false);
  }, [
    page,
    pageSize,
    filterText,
    filterOrgUnitId,
    filterPositionId,
    filterSatellite,
    filterRole,
    filterProvisionState,
  ]);

  useEffect(() => {
    if (!ready || !user?.organizationId) return;
    void load();
  }, [ready, user?.organizationId, load]);

  useEffect(() => {
    setPage(1);
  }, [
    filterText,
    filterOrgUnitId,
    filterPositionId,
    filterSatellite,
    filterRole,
    filterProvisionState,
    pageSize,
  ]);

  if (!ready) return null;
  if (notEntitled) {
    return <WorkforceGate onEnabled={load} />;
  }

  const emptyMessage =
    total === 0 && !filterText && !filterSatellite
      ? t("noBindings")
      : t("noFilterMatch");

  return (
    <>
      <PageHeader title={t("bindingsPageTitle")} subtitle={t("bindingsPageSubtitle")} />
      {loading ? (
        <p className="text-sm text-[#7F8C8D]">{t("loading")}</p>
      ) : (
        <>
          <div className={`${CARD_CONTAINER_CLASS} mb-4 flex flex-wrap items-end gap-3 p-4`}>
            <label className="text-[13px] font-medium text-[#34495E]">
              {t("filterSearch")}
              <input
                className="mt-1 block w-48 rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder={t("filterSearchPlaceholder")}
              />
            </label>
            <CatalogField
              kind="ENTITY_REF"
              label={t("filterOrgUnit")}
              value={filterOrgUnitId}
              onChange={(next) => {
                setFilterOrgUnitId(String(next));
                setFilterPositionId("");
              }}
              options={orgUnits.map((u) => ({ value: u.id, label: u.name }))}
              emptyLabel={t("filterAll")}
            />
            <CatalogField
              kind="ENTITY_REF"
              label={t("filterPosition")}
              value={filterPositionId}
              onChange={(next) => setFilterPositionId(String(next))}
              options={filterPositionOptions}
              emptyLabel={t("filterAll")}
            />
            <CatalogField
              kind="CLOSED_SMALL"
              label={t("filterSatellite")}
              value={filterSatellite}
              onChange={(next) => {
                setFilterSatellite(String(next));
                setFilterRole("");
              }}
              options={satelliteOptions}
              emptyLabel={t("filterAll")}
            />
            <CatalogField
              kind="CLOSED_SMALL"
              label={t("filterRole")}
              value={filterRole}
              disabled={!filterSatellite}
              onChange={(next) => setFilterRole(String(next))}
              options={filterRoleOptions}
              emptyLabel={t("filterAll")}
            />
            <CatalogField
              kind="CLOSED_SMALL"
              label={t("filterProvisionState")}
              value={filterProvisionState}
              onChange={(next) => setFilterProvisionState(String(next))}
              options={provisionStateOptions}
              emptyLabel={t("filterAll")}
            />
          </div>
          <div className={DATA_TABLE_VIEWPORT_CLASS}>
            <table className={DATA_TABLE_CLASS}>
              <thead>
                <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colOrgUnit")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colPosition")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colSatellite")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colRole")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colSync")}</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr className={DATA_TABLE_TR_CLASS}>
                    <td className={DATA_TABLE_TD_CLASS} colSpan={5}>
                      {emptyMessage}
                    </td>
                  </tr>
                ) : (
                  items.map((b) => (
                    <tr key={b.id} className={DATA_TABLE_TR_CLASS}>
                      <td className={DATA_TABLE_TD_CLASS}>
                        {b.employment?.orgUnit?.name ?? "—"}
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        {b.employment?.position?.name ?? "—"}
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        {satelliteLabel(b.satelliteKey)}
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        {humanizeSatelliteRole(b.satelliteRole)}
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        {b.provisionState === "FAILED" ? (
                          <span
                            className="text-[#C0392B]"
                            title={b.lastProvisionError ?? undefined}
                          >
                            {t("provisionFailed")}
                          </span>
                        ) : b.provisionState === "PENDING" ? (
                          <span className="text-[#7F8C8D]">{t("provisionPending")}</span>
                        ) : (
                          <span className="text-[#27AE60]">{t("provisionApplied")}</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
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
        </>
      )}
    </>
  );
}
