"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Users } from "lucide-react";
import {
  CARD_CONTAINER_CLASS,
  CatalogField,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  ListPaginationFooter,
  PageHeader,
} from "@era/satellite-kit/ui";
import { useRequireAuth } from "../../../../lib/use-require-auth";
import { useListPagination } from "../../../../lib/use-list-pagination";
import {
  WORKFORCE_UI_SATELLITES,
  humanizeSatelliteRole,
  rolesForSatellite,
} from "../../../../lib/workforce-satellites";
import {
  isWorkforceGate403,
  workforceFetch as wfFetch,
} from "../../../../lib/workforce-fetch";
import { WorkforceGate } from "../../../../components/workspace/workforce-gate";

type AccessStateFilter = "" | "all" | "configured" | "notConfigured";

function positionHasConfiguredAccess(
  positionId: string,
  templateByCell: Map<string, TemplateRow>,
  satelliteKey: string,
): boolean {
  if (satelliteKey) {
    return templateByCell.has(`${positionId}:${satelliteKey}`);
  }
  return WORKFORCE_UI_SATELLITES.some((s) =>
    templateByCell.has(`${positionId}:${s.key}`),
  );
}

type Overview = {
  seats: { used: number; limit: number };
};

type OrgUnitOpt = { id: string; name: string };

type PositionRow = {
  id: string;
  name: string;
  status?: string;
  orgUnit?: { id: string; name: string };
};

type TemplateRow = {
  id: string;
  positionId: string;
  satelliteKey: string;
  satelliteRole: string;
};

export default function WorkforceSecurityMatrixPage() {
  const searchParams = useSearchParams();
  const { ready, user } = useRequireAuth();
  const t = useTranslations("workforceSecurity");
  const tCommon = useTranslations("common");
  const tSys = useTranslations("workspace.systems");
  const [data, setData] = useState<Overview | null>(null);
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [orgUnits, setOrgUnits] = useState<OrgUnitOpt[]>([]);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notEntitled, setNotEntitled] = useState(false);
  const [busyCell, setBusyCell] = useState<string | null>(null);
  const [matrixError, setMatrixError] = useState<string | null>(null);

  const [filterText, setFilterText] = useState("");
  const [filterOrgUnitId, setFilterOrgUnitId] = useState(
    () => searchParams.get("orgUnitId") ?? "",
  );
  const [filterPositionId, setFilterPositionId] = useState(
    () => searchParams.get("positionId") ?? "",
  );
  const [filterSatellite, setFilterSatellite] = useState("");
  const [filterAccessState, setFilterAccessState] = useState<AccessStateFilter>("");

  useEffect(() => {
    const ou = searchParams.get("orgUnitId");
    const pos = searchParams.get("positionId");
    if (ou != null) setFilterOrgUnitId(ou);
    if (pos != null) setFilterPositionId(pos);
  }, [searchParams]);

  const satelliteLabel = useCallback(
    (key: string): string => {
      const found = WORKFORCE_UI_SATELLITES.find((s) => s.key === key);
      return found ? tSys(`${found.i18n}.title` as "clinic.title") : key;
    },
    [tSys],
  );

  const templateByCell = useMemo(() => {
    const m = new Map<string, TemplateRow>();
    for (const row of templates) {
      m.set(`${row.positionId}:${row.satelliteKey}`, row);
    }
    return m;
  }, [templates]);

  const orgUnitOptions = useMemo(
    () => orgUnits.map((u) => ({ value: u.id, label: u.name })),
    [orgUnits],
  );

  const filterPositionOptions = useMemo(
    () =>
      positions.filter(
        (p) => !filterOrgUnitId || p.orgUnit?.id === filterOrgUnitId,
      ),
    [positions, filterOrgUnitId],
  );

  const satelliteOptions = useMemo(
    () =>
      WORKFORCE_UI_SATELLITES.map((s) => ({
        value: s.key,
        label: satelliteLabel(s.key),
      })),
    [satelliteLabel],
  );

  const accessStateOptions = useMemo(
    () => [
      { value: "all", label: t("filterAccessAll") },
      { value: "configured", label: t("filterAccessConfigured") },
      { value: "notConfigured", label: t("filterAccessNotConfigured") },
    ],
    [t],
  );

  const hasActiveFilters =
    filterText.trim() !== "" ||
    filterOrgUnitId !== "" ||
    filterPositionId !== "" ||
    filterAccessState === "configured" ||
    filterAccessState === "notConfigured";

  const filteredPositions = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    return positions.filter((p) => {
      if (filterOrgUnitId && p.orgUnit?.id !== filterOrgUnitId) return false;
      if (filterPositionId && p.id !== filterPositionId) return false;
      if (filterAccessState && filterAccessState !== "all") {
        const configured = positionHasConfiguredAccess(
          p.id,
          templateByCell,
          filterSatellite,
        );
        if (filterAccessState === "configured" && !configured) return false;
        if (filterAccessState === "notConfigured" && configured) return false;
      }
      if (q) {
        const posName = p.name.toLowerCase();
        const unitName = (p.orgUnit?.name ?? "").toLowerCase();
        if (!posName.includes(q) && !unitName.includes(q)) return false;
      }
      return true;
    });
  }, [
    positions,
    filterText,
    filterOrgUnitId,
    filterPositionId,
    filterSatellite,
    filterAccessState,
    templateByCell,
  ]);

  const filterResetKey = [
    filterText,
    filterOrgUnitId,
    filterPositionId,
    filterSatellite,
    filterAccessState,
  ].join("|");

  const { page, pageSize, setPage, setPageSize, paged, total } =
    useListPagination(filteredPositions, filterResetKey);

  const reloadTemplates = useCallback(async () => {
    const tmplRes = await wfFetch("role-templates");
    if (tmplRes.ok) {
      const rows = (await tmplRes.json()) as TemplateRow[];
      setTemplates(Array.isArray(rows) ? rows : []);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setMatrixError(null);
    const [ovRes, posRes, tmplRes, ouRes] = await Promise.all([
      wfFetch("security/overview"),
      wfFetch("positions?status=ACTIVE"),
      wfFetch("role-templates"),
      wfFetch("org-units"),
    ]);
    if (await isWorkforceGate403(ovRes)) {
      setNotEntitled(true);
      setLoading(false);
      return;
    }
    setNotEntitled(false);
    if (ovRes.ok) setData((await ovRes.json()) as Overview);
    if (posRes.ok) {
      const p = (await posRes.json()) as PositionRow[];
      setPositions(Array.isArray(p) ? p : []);
    }
    if (tmplRes.ok) {
      const rows = (await tmplRes.json()) as TemplateRow[];
      setTemplates(Array.isArray(rows) ? rows : []);
    }
    if (ouRes.ok) {
      const units = (await ouRes.json()) as OrgUnitOpt[];
      setOrgUnits(Array.isArray(units) ? units : []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!ready || !user?.organizationId) return;
    void load();
  }, [ready, user?.organizationId, load]);

  async function onMatrixChange(positionId: string, satelliteKey: string, role: string) {
    const cellKey = `${positionId}:${satelliteKey}`;
    if (busyCell) return;
    setBusyCell(cellKey);
    setMatrixError(null);
    const existing = templateByCell.get(cellKey);
    try {
      if (!role) {
        if (existing) {
          const res = await wfFetch(`role-templates/${existing.id}`, { method: "DELETE" });
          if (!res.ok) throw new Error(await res.text());
        }
        setTemplates((prev) =>
          prev.filter(
            (row) => !(row.positionId === positionId && row.satelliteKey === satelliteKey),
          ),
        );
      } else {
        if (existing && existing.satelliteRole !== role) {
          const delRes = await wfFetch(`role-templates/${existing.id}`, { method: "DELETE" });
          if (!delRes.ok) throw new Error(await delRes.text());
        }
        const putRes = await wfFetch("role-templates", {
          method: "PUT",
          body: JSON.stringify({ positionId, satelliteKey, satelliteRole: role }),
        });
        if (!putRes.ok) throw new Error(await putRes.text());
        const row = (await putRes.json()) as TemplateRow;
        setTemplates((prev) => {
          const rest = prev.filter(
            (r) => !(r.positionId === positionId && r.satelliteKey === satelliteKey),
          );
          return [...rest, row];
        });
      }
    } catch (err) {
      setMatrixError(err instanceof Error ? err.message : tCommon("saveFailed"));
      await reloadTemplates();
    } finally {
      setBusyCell(null);
    }
  }

  if (!ready) return null;
  if (notEntitled) {
    return <WorkforceGate onEnabled={load} />;
  }

  const seatUsed = data?.seats.used ?? 0;
  const seatLimit = data?.seats.limit;
  const emptyMessage =
    positions.length === 0 ? t("noPositions") : t("noFilterMatch");

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      {loading ? (
        <p className="text-sm text-[#7F8C8D]">{t("loading")}</p>
      ) : (
        <div className="space-y-4">
          <div className={`${CARD_CONTAINER_CLASS} flex items-center gap-4 p-4`}>
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#EBF5FB]">
              <Users className="h-5 w-5 text-[#2980B9]" aria-hidden />
            </span>
            <div>
              <p className="text-xs uppercase tracking-wide text-[#95A5A6]">{t("seatsTitle")}</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-[#34495E]">
                {seatUsed}
                <span className="text-sm font-normal text-[#7F8C8D]">
                  {" "}
                  / {seatLimit ?? "∞"}
                </span>
              </p>
            </div>
          </div>

          <section className={`${CARD_CONTAINER_CLASS} overflow-hidden`}>
            <div className="border-b border-[#EBEDF0] px-4 py-3">
              <h2 className="text-sm font-semibold text-[#34495E]">{t("matrixTitle")}</h2>
              <p className="text-xs text-[#7F8C8D]">{t("matrixHint")}</p>
            </div>
            <div className="flex flex-wrap items-end gap-3 border-b border-[#EBEDF0] px-4 py-3">
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
                options={orgUnitOptions}
                emptyLabel={t("filterAll")}
              />
              <CatalogField
                kind="ENTITY_REF"
                label={t("filterPosition")}
                value={filterPositionId}
                onChange={(next) => setFilterPositionId(String(next))}
                options={filterPositionOptions.map((p) => ({
                  value: p.id,
                  label: p.name,
                }))}
                emptyLabel={t("filterAll")}
              />
              <CatalogField
                kind="CLOSED_SMALL"
                label={t("filterSatellite")}
                value={filterSatellite}
                onChange={(next) => setFilterSatellite(String(next))}
                options={satelliteOptions}
                emptyLabel={t("filterAll")}
              />
              <CatalogField
                kind="CLOSED_SMALL"
                label={t("filterAccessState")}
                value={filterAccessState}
                onChange={(next) => setFilterAccessState(String(next) as AccessStateFilter)}
                options={accessStateOptions}
                emptyLabel={t("filterAll")}
              />
              {hasActiveFilters ? (
                <p className="pb-1 text-xs text-[#7F8C8D]">
                  {t("filterResultCount", { count: filteredPositions.length })}
                </p>
              ) : null}
            </div>
            {matrixError ? (
              <p className="border-b border-[#EBEDF0] px-4 py-2 text-[13px] text-[#C0392B]">
                {matrixError}
              </p>
            ) : null}
            <div className={DATA_TABLE_VIEWPORT_CLASS}>
              <table className={DATA_TABLE_CLASS}>
                <thead>
                  <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colPosition")}</th>
                    {WORKFORCE_UI_SATELLITES.map((s) => (
                      <th key={s.key} className={DATA_TABLE_TH_LEFT_CLASS}>
                        {satelliteLabel(s.key)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {total === 0 ? (
                    <tr className={DATA_TABLE_TR_CLASS}>
                      <td
                        colSpan={WORKFORCE_UI_SATELLITES.length + 1}
                        className={`${DATA_TABLE_TD_CLASS} text-[#7F8C8D]`}
                      >
                        {emptyMessage}
                      </td>
                    </tr>
                  ) : (
                    paged.map((p) => (
                      <tr key={p.id} className={DATA_TABLE_TR_CLASS}>
                        <td className={DATA_TABLE_TD_CLASS}>
                          <span className="font-medium text-[#34495E]">{p.name}</span>
                          {p.orgUnit?.name ? (
                            <span className="ml-1 text-[#7F8C8D]">({p.orgUnit.name})</span>
                          ) : null}
                        </td>
                        {WORKFORCE_UI_SATELLITES.map((s) => {
                          const cellKey = `${p.id}:${s.key}`;
                          const tmpl = templateByCell.get(cellKey);
                          const current = tmpl?.satelliteRole ?? "";
                          const cellBusy = busyCell === cellKey;
                          return (
                            <td key={s.key} className={DATA_TABLE_TD_CLASS}>
                              <select
                                className="rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px] focus:border-[#2980B9] focus:outline-none disabled:opacity-50"
                                value={current}
                                disabled={cellBusy || busyCell !== null}
                                onChange={(e) =>
                                  void onMatrixChange(p.id, s.key, e.target.value)
                                }
                              >
                                <option value="">{t("noAccess")}</option>
                                {rolesForSatellite(s.key).map((r) => (
                                  <option key={r} value={r}>
                                    {humanizeSatelliteRole(r)}
                                  </option>
                                ))}
                              </select>
                            </td>
                          );
                        })}
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
          </section>
        </div>
      )}
    </>
  );
}
