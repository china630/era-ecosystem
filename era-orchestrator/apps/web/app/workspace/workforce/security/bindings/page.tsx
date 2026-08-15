"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  ListPaginationFooter,
  PageHeader,
} from "@era/satellite-kit/ui";
import { useRequireAuth } from "../../../../../lib/use-require-auth";
import { useListPagination } from "../../../../../lib/use-list-pagination";
import {
  isWorkforceGate403,
  workforceFetch as wfFetch,
} from "../../../../../lib/workforce-fetch";
import { WorkforceGate } from "../../../../../components/workspace/workforce-gate";

const SATELLITES = [
  { key: "industry_clinic", i18n: "clinic" },
  { key: "industry_hotel_pms", i18n: "hotel" },
  { key: "industry_fnb_pos", i18n: "fnb" },
] as const;

function humanizeRole(code: string): string {
  return code
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());
}

type BindingRow = {
  id: string;
  satelliteKey: string;
  satelliteRole: string;
  employment: { orgUnit?: { name: string }; position?: { name: string } };
};

type Overview = {
  bindings: BindingRow[];
};

export default function WorkforceSecurityBindingsPage() {
  const { ready, user } = useRequireAuth();
  const t = useTranslations("workforceSecurity");
  const tCommon = useTranslations("common");
  const tSys = useTranslations("workspace.systems");
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [notEntitled, setNotEntitled] = useState(false);

  const bindings = useMemo(() => data?.bindings ?? [], [data?.bindings]);
  const { page, pageSize, setPage, setPageSize, paged, total } =
    useListPagination(bindings);

  const satelliteLabel = useCallback(
    (key: string): string => {
      const found = SATELLITES.find((s) => s.key === key);
      return found ? tSys(`${found.i18n}.title` as "clinic.title") : key;
    },
    [tSys],
  );

  const load = useCallback(async () => {
    setLoading(true);
    const ovRes = await wfFetch("security/overview");
    if (await isWorkforceGate403(ovRes)) {
      setNotEntitled(true);
      setLoading(false);
      return;
    }
    setNotEntitled(false);
    if (ovRes.ok) setData((await ovRes.json()) as Overview);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!ready || !user?.organizationId) return;
    void load();
  }, [ready, user?.organizationId, load]);

  if (!ready) return null;
  if (notEntitled) {
    return <WorkforceGate onEnabled={load} />;
  }

  return (
    <>
      <PageHeader title={t("bindingsPageTitle")} subtitle={t("bindingsPageSubtitle")} />
      {loading ? (
        <p className="text-sm text-[#7F8C8D]">{t("loading")}</p>
      ) : (
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colSatellite")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colRole")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colOrgUnit")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colPosition")}</th>
              </tr>
            </thead>
            <tbody>
              {total === 0 ? (
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td colSpan={4} className={`${DATA_TABLE_TD_CLASS} text-[#7F8C8D]`}>
                    {t("noBindings")}
                  </td>
                </tr>
              ) : (
                paged.map((b) => (
                  <tr key={b.id} className={DATA_TABLE_TR_CLASS}>
                    <td className={DATA_TABLE_TD_CLASS}>{satelliteLabel(b.satelliteKey)}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{humanizeRole(b.satelliteRole)}</td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      {b.employment?.orgUnit?.name ?? "—"}
                    </td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      {b.employment?.position?.name ?? "—"}
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
    </>
  );
}
