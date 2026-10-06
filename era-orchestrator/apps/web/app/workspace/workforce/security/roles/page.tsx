"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CatalogField,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  EraListFilterBar,
  EraListWorkspace,
  LIST_PAGE_SHELL_CLASS,
  PageHeader,
} from "@era/satellite-kit/ui";
import { useRequireAuth } from "../../../../../lib/use-require-auth";
import {
  isWorkforceGate403,
  workforceFetch as wfFetch,
} from "../../../../../lib/workforce-fetch";
import { WorkforceGate } from "../../../../../components/workspace/workforce-gate";

const SATELLITE_I18N: Record<string, string> = {
  industry_clinic: "clinic",
  industry_hotel_pms: "hotel",
  industry_fnb_pos: "fnb",
  industry_retail: "retail",
  industry_crm: "crm",
  industry_wholesale: "wholesale",
  industry_construction: "construction",
  industry_logistics: "logistics",
  industry_auto_service: "auto",
  industry_banking: "banking",
};

type Holder = {
  employmentId: string;
  globalPersonId: string;
  positionName: string | null;
  orgUnitName: string | null;
  manual: boolean;
  provisionState: string;
};

type RoleRow = {
  satelliteKey: string;
  code: string;
  name: string;
  active: boolean;
  inCatalog: boolean;
  holders: Holder[];
};

type PersonProfile = {
  displayName: string | null;
  accessDenied?: boolean;
};

export default function WorkforceRoleDirectoryPage() {
  const { ready, user } = useRequireAuth();
  const t = useTranslations("workforceSecurity");
  const tCommon = useTranslations("common");
  const tSys = useTranslations("workspace.systems");
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [persons, setPersons] = useState<Record<string, PersonProfile>>({});
  const [loading, setLoading] = useState(true);
  const [notEntitled, setNotEntitled] = useState(false);
  const [filterSatellite, setFilterSatellite] = useState("");
  const [filterText, setFilterText] = useState("");
  const [openKey, setOpenKey] = useState<string | null>(null);

  const satelliteLabel = useCallback(
    (key: string) => {
      const slug = SATELLITE_I18N[key];
      return slug ? tSys(`${slug}.title` as "clinic.title") : key;
    },
    [tSys],
  );

  const load = useCallback(async () => {
    setLoading(true);
    const res = await wfFetch("security/role-directory");
    if (await isWorkforceGate403(res)) {
      setNotEntitled(true);
      setLoading(false);
      return;
    }
    setNotEntitled(false);
    if (res.ok) {
      const body = (await res.json()) as {
        roles?: RoleRow[];
        persons?: Record<string, PersonProfile>;
      };
      setRoles(Array.isArray(body.roles) ? body.roles : []);
      setPersons(body.persons ?? {});
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!ready || !user?.organizationId) return;
    void load();
  }, [ready, user?.organizationId, load]);

  const satelliteOptions = useMemo(() => {
    const keys = [...new Set(roles.map((role) => role.satelliteKey))].sort();
    return keys.map((key) => ({ value: key, label: satelliteLabel(key) }));
  }, [roles, satelliteLabel]);

  const visible = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    return roles.filter((role) => {
      if (filterSatellite && role.satelliteKey !== filterSatellite) return false;
      if (!q) return true;
      if (role.name.toLowerCase().includes(q) || role.code.toLowerCase().includes(q)) {
        return true;
      }
      return role.holders.some((holder) => {
        const person = persons[holder.globalPersonId];
        const name = person?.displayName ?? "";
        return (
          name.toLowerCase().includes(q) ||
          (holder.positionName ?? "").toLowerCase().includes(q)
        );
      });
    });
  }, [filterSatellite, filterText, persons, roles]);

  function personLabel(holder: Holder) {
    const person = persons[holder.globalPersonId];
    if (person?.accessDenied) return t("maskedPerson");
    return person?.displayName || tCommon("unnamedPerson");
  }

  if (!ready) return null;
  if (notEntitled) return <WorkforceGate onEnabled={load} />;

  return (
    <div className={LIST_PAGE_SHELL_CLASS}>
      <div className="shrink-0">
        <PageHeader
          className="!mb-0"
          title={t("rolesPageTitle")}
          subtitle={t("rolesPageSubtitle")}
        />
      </div>
      <EraListWorkspace
        filter={
          <EraListFilterBar
            className="!mb-0"
            resetLabel={tCommon("filterReset")}
            onReset={() => {
              setFilterSatellite("");
              setFilterText("");
            }}
          >
            <CatalogField
              kind="CLOSED_SMALL"
              label={t("filterSatellite")}
              value={filterSatellite}
              onChange={(next) => setFilterSatellite(String(next))}
              options={satelliteOptions}
              emptyLabel={t("filterAll")}
            />
            <label className="text-[13px] font-medium text-[#34495E]">
              {t("filterSearch")}
              <input
                className="mt-1 block w-56 rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder={t("rolesSearchPlaceholder")}
              />
            </label>
          </EraListFilterBar>
        }
        table={
        <table className={DATA_TABLE_CLASS}>
          <thead>
            <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colSatellite")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colRole")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colStatus")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colPeople")}</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr className={DATA_TABLE_TR_CLASS}>
                <td
                  colSpan={4}
                  className={`${DATA_TABLE_TD_CLASS} py-8 text-center text-[#7F8C8D]`}
                >
                  {loading ? t("loading") : t("noRoles")}
                </td>
              </tr>
            ) : (
              visible.map((role) => {
                const key = `${role.satelliteKey}:${role.code}`;
                const open = openKey === key;
                const roleName = role.inCatalog
                  ? role.name
                  : `${t("roleNeedsRepick")} (${role.code})`;
                return (
                  <Fragment key={key}>
                    <tr
                      className={`${DATA_TABLE_TR_CLASS} cursor-pointer`}
                      onClick={() => setOpenKey(open ? null : key)}
                    >
                      <td className={DATA_TABLE_TD_CLASS}>
                        {satelliteLabel(role.satelliteKey)}
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        <span className="font-medium text-[#34495E]">{roleName}</span>
                        {role.inCatalog ? (
                          <span className="ml-2 font-mono text-[12px] text-[#7F8C8D]">
                            {role.code}
                          </span>
                        ) : null}
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        {!role.inCatalog
                          ? t("roleUnknown")
                          : role.active
                            ? t("filterStatusActive")
                            : t("roleInactive")}
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>{role.holders.length}</td>
                    </tr>
                    {open ? (
                      <tr className={DATA_TABLE_TR_CLASS}>
                        <td colSpan={4} className={DATA_TABLE_TD_CLASS}>
                          {role.holders.length === 0 ? (
                            <span className="text-[#7F8C8D]">{t("noPeopleOnRole")}</span>
                          ) : (
                            <ul className="space-y-1">
                              {role.holders.map((holder) => (
                                <li
                                  key={holder.employmentId}
                                  className="flex flex-wrap items-center gap-2 text-[13px]"
                                >
                                  <span className="font-medium text-[#2C3E50]">
                                    {personLabel(holder)}
                                  </span>
                                  <span className="text-[#7F8C8D]">
                                    {[holder.positionName, holder.orgUnitName]
                                      .filter(Boolean)
                                      .join(" · ")}
                                  </span>
                                  {holder.manual ? (
                                    <span className="rounded bg-[#F4F6F7] px-1.5 py-0.5 text-[11px] text-[#34495E]">
                                      {t("manualGrantMark")}
                                    </span>
                                  ) : null}
                                  {holder.provisionState === "FAILED" ? (
                                    <span className="text-[12px] text-[#C0392B]">
                                      {t("provisionFailed")}
                                    </span>
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
        }
      >
      </EraListWorkspace>
    </div>
  );
}
