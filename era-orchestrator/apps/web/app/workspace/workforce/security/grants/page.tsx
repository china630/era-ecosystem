"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Ban, RotateCcw } from "lucide-react";
import {
  CARD_CONTAINER_CLASS,
  CatalogField,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TH_RIGHT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  DEFAULT_LIST_PAGE_SIZE,
  ListPaginationFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TABLE_ROW_ICON_BTN_CLASS,
} from "@era/satellite-kit/ui";
import { useRequireAuth } from "../../../../../lib/use-require-auth";
import {
  WORKFORCE_UI_SATELLITES,
  humanizeSatelliteRole,
  rolesForSatellite,
  type WorkforceUiSatelliteKey,
} from "../../../../../lib/workforce-satellites";
import {
  isWorkforceGate403,
  workforceFetch as wfFetch,
} from "../../../../../lib/workforce-fetch";
import { WorkforceGate } from "../../../../../components/workspace/workforce-gate";

type GrantStatusFilter = "ACTIVE" | "REVOKED" | "ALL";

type EmploymentRow = {
  id: string;
  globalPersonId: string;
  status?: string;
  orgUnitId?: string;
  positionId?: string;
  orgUnit?: { id: string; name: string };
  position?: { id: string; name: string };
};

type PersonProfile = {
  globalPersonId: string;
  displayName: string | null;
  finMasked?: string | null;
  accessDenied: boolean;
};

type EmploymentsList = {
  items: EmploymentRow[];
  persons: Record<string, PersonProfile>;
};

type GrantRow = {
  id: string;
  employmentId: string;
  satelliteKey: string;
  satelliteRole: string;
  reason: string;
  revokedAt?: string | null;
};

const EMPTY_GRANT_FORM = {
  employmentId: "",
  satelliteKey: "" as "" | WorkforceUiSatelliteKey,
  satelliteRole: "",
  reason: "",
};

export default function WorkforceSecurityGrantsPage() {
  const { ready, user } = useRequireAuth();
  const t = useTranslations("workforceSecurity");
  const tCommon = useTranslations("common");
  const tSys = useTranslations("workspace.systems");
  const [employments, setEmployments] = useState<EmploymentRow[]>([]);
  const [persons, setPersons] = useState<Record<string, PersonProfile>>({});
  const [grants, setGrants] = useState<GrantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notEntitled, setNotEntitled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [grantOpen, setGrantOpen] = useState(false);
  const [grantForm, setGrantForm] = useState(EMPTY_GRANT_FORM);
  const [modalError, setModalError] = useState<string | null>(null);

  const [filterText, setFilterText] = useState("");
  const [filterOrgUnitId, setFilterOrgUnitId] = useState("");
  const [filterPositionId, setFilterPositionId] = useState("");
  const [filterSatellite, setFilterSatellite] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterStatus, setFilterStatus] = useState<GrantStatusFilter>("ACTIVE");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_LIST_PAGE_SIZE);
  const [grantsTotal, setGrantsTotal] = useState(0);

  const satelliteLabel = useCallback(
    (key: string): string => {
      const found = WORKFORCE_UI_SATELLITES.find((s) => s.key === key);
      return found ? tSys(`${found.i18n}.title` as "clinic.title") : key;
    },
    [tSys],
  );

  const employmentById = useMemo(() => {
    const m = new Map<string, EmploymentRow>();
    for (const e of employments) m.set(e.id, e);
    return m;
  }, [employments]);

  const personName = useCallback(
    (globalPersonId: string): string => {
      const p = persons[globalPersonId];
      if (p?.displayName?.trim()) return p.displayName.trim();
      return t("maskedPerson");
    },
    [persons, t],
  );

  const employmentLabel = useCallback(
    (employmentId: string): string => {
      const e = employmentById.get(employmentId);
      if (!e) return `${employmentId.slice(0, 8)}…`;
      const name = personName(e.globalPersonId);
      const job = [e.position?.name, e.orgUnit?.name].filter(Boolean).join(" · ");
      return job ? `${name} — ${job}` : name;
    },
    [employmentById, personName],
  );

  const employmentOptions = useMemo(
    () =>
      [...employments]
        .filter((e) => (e.status ?? "ACTIVE") === "ACTIVE")
        .map((e) => ({
          value: e.id,
          label: employmentLabel(e.id),
        }))
        .sort((a, b) => a.label.localeCompare(b.label, "az")),
    [employments, employmentLabel],
  );

  const satelliteOptions = useMemo(
    () =>
      WORKFORCE_UI_SATELLITES.map((s) => ({
        value: s.key,
        label: satelliteLabel(s.key),
      })),
    [satelliteLabel],
  );

  const orgUnitOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const e of employments) {
      const id = e.orgUnitId ?? e.orgUnit?.id;
      const name = e.orgUnit?.name;
      if (id && name && !seen.has(id)) seen.set(id, name);
    }
    return [...seen.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "az"));
  }, [employments]);

  const filterPositionOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const e of employments) {
      const unitId = e.orgUnitId ?? e.orgUnit?.id;
      if (filterOrgUnitId && unitId !== filterOrgUnitId) continue;
      const id = e.positionId ?? e.position?.id;
      const name = e.position?.name;
      if (id && name && !seen.has(id)) seen.set(id, name);
    }
    return [...seen.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "az"));
  }, [employments, filterOrgUnitId]);

  const filterRoleOptions = useMemo(() => {
    if (!filterSatellite) return [];
    return rolesForSatellite(filterSatellite).map((r) => ({
      value: r,
      label: humanizeSatelliteRole(r),
    }));
  }, [filterSatellite]);

  const statusOptions = useMemo(
    () => [
      { value: "ACTIVE", label: t("filterStatusActive") },
      { value: "REVOKED", label: t("filterStatusRevoked") },
      { value: "ALL", label: t("filterAll") },
    ],
    [t],
  );

  const roleOptions = useMemo(() => {
    if (!grantForm.satelliteKey) return [];
    return rolesForSatellite(grantForm.satelliteKey).map((r) => ({
      value: r,
      label: humanizeSatelliteRole(r),
    }));
  }, [grantForm.satelliteKey]);

  const hasActiveFilters =
    filterText.trim() !== "" ||
    filterOrgUnitId !== "" ||
    filterPositionId !== "" ||
    filterSatellite !== "" ||
    filterRole !== "" ||
    filterStatus !== "ACTIVE";

  const filteredGrants = useMemo(() => {
    return grants.filter((g) => {
      const emp = employmentById.get(g.employmentId);
      if (filterOrgUnitId) {
        const unitId = emp?.orgUnitId ?? emp?.orgUnit?.id;
        if (unitId !== filterOrgUnitId) return false;
      }
      if (filterPositionId) {
        const posId = emp?.positionId ?? emp?.position?.id;
        if (posId !== filterPositionId) return false;
      }
      if (filterRole && g.satelliteRole !== filterRole) return false;
      if (filterText.trim().length >= 2) {
        const q = filterText.trim().toLowerCase();
        const name = (emp ? personName(emp.globalPersonId) : "").toLowerCase();
        const reason = (g.reason ?? "").toLowerCase();
        const unit = (emp?.orgUnit?.name ?? "").toLowerCase();
        const pos = (emp?.position?.name ?? "").toLowerCase();
        const role = g.satelliteRole.toLowerCase();
        const hay = `${name} ${reason} ${unit} ${pos} ${role}`;
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    grants,
    filterText,
    filterOrgUnitId,
    filterPositionId,
    filterRole,
    employmentById,
    personName,
  ]);

  const filterResetKey = [
    filterText,
    filterOrgUnitId,
    filterPositionId,
    filterSatellite,
    filterRole,
    filterStatus,
  ].join("|");

  useEffect(() => {
    setPage(1);
  }, [filterResetKey, pageSize]);

  const loadGrants = useCallback(async () => {
    const qs = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (filterStatus === "ACTIVE") qs.set("revoked", "false");
    else if (filterStatus === "REVOKED") qs.set("revoked", "true");
    if (filterSatellite) qs.set("satelliteKey", filterSatellite);
    if (filterText.trim().length >= 2) qs.set("search", filterText.trim());
    const grantRes = await wfFetch(`manual-grants?${qs}`);
    if (grantRes.ok) {
      const payload = (await grantRes.json()) as {
        items: GrantRow[];
        total: number;
      };
      setGrants(Array.isArray(payload.items) ? payload.items : []);
      setGrantsTotal(typeof payload.total === "number" ? payload.total : 0);
    }
  }, [filterStatus, filterSatellite, filterText, page, pageSize]);

  const loadEmployments = useCallback(async (): Promise<boolean> => {
    const empRes = await wfFetch("employments?page=1&pageSize=100");
    if (await isWorkforceGate403(empRes)) {
      setNotEntitled(true);
      return false;
    }
    setNotEntitled(false);
    if (empRes.ok) {
      const payload = (await empRes.json()) as EmploymentsList;
      setEmployments(Array.isArray(payload.items) ? payload.items : []);
      setPersons(payload.persons ?? {});
    }
    return true;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const ok = await loadEmployments();
    if (ok) await loadGrants();
    setLoading(false);
  }, [loadEmployments, loadGrants]);

  useEffect(() => {
    if (!ready || !user?.organizationId) return;
    void load();
  }, [ready, user?.organizationId, loadEmployments]);

  const skipFilterGrantReload = useRef(true);
  useEffect(() => {
    if (!ready || !user?.organizationId || loading) return;
    if (skipFilterGrantReload.current) {
      skipFilterGrantReload.current = false;
      return;
    }
    void loadGrants();
  }, [ready, user?.organizationId, loading, loadGrants]);

  function openGrantModal() {
    setGrantForm(EMPTY_GRANT_FORM);
    setModalError(null);
    setGrantOpen(true);
  }

  async function onGrantSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (
      busy ||
      !grantForm.employmentId ||
      !grantForm.satelliteKey ||
      !grantForm.satelliteRole ||
      !grantForm.reason.trim()
    ) {
      return;
    }
    setBusy(true);
    setModalError(null);
    const res = await wfFetch("manual-grants", {
      method: "POST",
      body: JSON.stringify({
        employmentId: grantForm.employmentId,
        satelliteKey: grantForm.satelliteKey,
        satelliteRole: grantForm.satelliteRole,
        reason: grantForm.reason.trim(),
      }),
    });
    setBusy(false);
    if (res.ok) {
      setGrantOpen(false);
      setGrantForm(EMPTY_GRANT_FORM);
      await load();
      return;
    }
    setModalError((await res.text()) || tCommon("saveFailed"));
  }

  async function onRevokeGrant(id: string) {
    if (busy) return;
    setBusy(true);
    const res = await wfFetch(`manual-grants/${id}/revoke`, { method: "POST", body: "{}" });
    setBusy(false);
    if (res.ok) await load();
  }

  async function onRestoreGrant(id: string) {
    if (busy) return;
    setBusy(true);
    const res = await wfFetch(`manual-grants/${id}/restore`, { method: "POST", body: "{}" });
    setBusy(false);
    if (res.ok) await load();
  }

  if (!ready) return null;
  if (notEntitled) {
    return <WorkforceGate onEnabled={load} />;
  }

  const emptyMessage = grants.length === 0 ? t("noGrants") : t("noFilterMatch");

  return (
    <>
      <PageHeader
        title={t("grantsPageTitle")}
        subtitle={t("grantsPageSubtitle")}
        actions={
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={openGrantModal}>
            {t("grantCreate")}
          </button>
        }
      />
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
              options={orgUnitOptions}
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
              label={t("filterStatus")}
              value={filterStatus}
              onChange={(next) => setFilterStatus(String(next) as GrantStatusFilter)}
              options={statusOptions}
            />
            {hasActiveFilters ? (
              <p className="pb-1 text-xs text-[#7F8C8D]">
                {t("filterResultCount", { count: filteredGrants.length })}
              </p>
            ) : null}
          </div>
          <div className={DATA_TABLE_VIEWPORT_CLASS}>
            <table className={DATA_TABLE_CLASS}>
              <thead>
                <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colEmployment")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colSatellite")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colRole")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colReason")}</th>
                  <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("colActions")}</th>
                </tr>
              </thead>
              <tbody>
                {total === 0 ? (
                  <tr className={DATA_TABLE_TR_CLASS}>
                    <td colSpan={5} className={`${DATA_TABLE_TD_CLASS} text-[#7F8C8D]`}>
                      {emptyMessage}
                    </td>
                  </tr>
                ) : (
                  filteredGrants.map((g) => (
                    <tr key={g.id} className={DATA_TABLE_TR_CLASS}>
                      <td className={DATA_TABLE_TD_CLASS}>{employmentLabel(g.employmentId)}</td>
                      <td className={DATA_TABLE_TD_CLASS}>{satelliteLabel(g.satelliteKey)}</td>
                      <td className={DATA_TABLE_TD_CLASS}>{humanizeSatelliteRole(g.satelliteRole)}</td>
                      <td className={`${DATA_TABLE_TD_CLASS} text-[#7F8C8D]`}>{g.reason}</td>
                      <td className={`${DATA_TABLE_TD_CLASS} text-right`}>
                        {!g.revokedAt ? (
                          <button
                            type="button"
                            className={TABLE_ROW_ICON_BTN_CLASS}
                            title={t("grantRevoke")}
                            aria-label={t("grantRevoke")}
                            disabled={busy}
                            onClick={() => void onRevokeGrant(g.id)}
                          >
                            <Ban className="h-4 w-4 text-[#C0392B]" aria-hidden />
                          </button>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-[#95A5A6]">{t("grantRevoked")}</span>
                            <button
                              type="button"
                              className={TABLE_ROW_ICON_BTN_CLASS}
                              title={t("grantRestore")}
                              aria-label={t("grantRestore")}
                              disabled={busy}
                              onClick={() => void onRestoreGrant(g.id)}
                            >
                              <RotateCcw className="h-4 w-4 text-[#27AE60]" aria-hidden />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <ListPaginationFooter
              page={page}
              pageSize={pageSize}
              total={
                filterOrgUnitId || filterPositionId || filterRole
                  ? filteredGrants.length
                  : grantsTotal
              }
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
      )}

      <ModalShell
        open={grantOpen}
        title={t("grantModalTitle")}
        onClose={() => setGrantOpen(false)}
        closeLabel={tCommon("close")}
      >
        <form onSubmit={onGrantSubmit} className="grid gap-3">
          <CatalogField
            kind="ENTITY_REF"
            label={t("fieldEmployment")}
            required
            hint={t("fieldEmploymentHint")}
            value={grantForm.employmentId}
            onChange={(next) =>
              setGrantForm((f) => ({ ...f, employmentId: String(next) }))
            }
            options={employmentOptions}
            emptyLabel={t("selectEmployment")}
          />
          <CatalogField
            kind="CLOSED_SMALL"
            label={t("colSatellite")}
            required
            value={grantForm.satelliteKey}
            onChange={(next) =>
              setGrantForm((f) => ({
                ...f,
                satelliteKey: String(next) as WorkforceUiSatelliteKey | "",
                satelliteRole: "",
              }))
            }
            options={satelliteOptions}
            emptyLabel={t("selectSatellite")}
          />
          <CatalogField
            kind="CLOSED_SMALL"
            label={t("colRole")}
            required
            disabled={!grantForm.satelliteKey}
            value={grantForm.satelliteRole}
            onChange={(next) =>
              setGrantForm((f) => ({ ...f, satelliteRole: String(next) }))
            }
            options={roleOptions}
            emptyLabel={t("selectRole")}
          />
          <label className="block text-[13px] font-medium text-[#34495E]">
            {t("fieldReason")}
            <textarea
              className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]"
              rows={2}
              value={grantForm.reason}
              onChange={(e) => setGrantForm((f) => ({ ...f, reason: e.target.value }))}
              required
            />
          </label>
          {modalError ? (
            <p className="text-[13px] text-[#C0392B]">{modalError}</p>
          ) : null}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              onClick={() => setGrantOpen(false)}
            >
              {t("grantCancel")}
            </button>
            <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={busy}>
              {t("grantSubmit")}
            </button>
          </div>
        </form>
      </ModalShell>
    </>
  );
}
