"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Users } from "lucide-react";
import {
  CARD_CONTAINER_CLASS,
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
  isWorkforceGate403,
  workforceFetch as wfFetch,
} from "../../../../lib/workforce-fetch";
import { WorkforceGate } from "../../../../components/workspace/workforce-gate";

const SATELLITES = [
  { key: "industry_clinic", i18n: "clinic" },
  { key: "industry_hotel_pms", i18n: "hotel" },
  { key: "industry_fnb_pos", i18n: "fnb" },
] as const;

const ROLES_BY_SATELLITE: Record<string, string[]> = {
  industry_clinic: ["DOCTOR", "NURSE", "RECEPTION", "CLINIC_ADMIN"],
  industry_hotel_pms: ["RECEPTION", "HOUSEKEEPING", "MANAGER", "STAFF"],
  industry_fnb_pos: ["WAITER", "MANAGER", "CHEF", "CASHIER", "STAFF"],
};

function humanizeRole(code: string): string {
  return code
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());
}

type Overview = {
  seats: { used: number; limit: number };
};

type PositionRow = {
  id: string;
  name: string;
  orgUnit?: { name: string };
};

type TemplateRow = {
  id: string;
  positionId: string;
  satelliteKey: string;
  satelliteRole: string;
};

export default function WorkforceSecurityMatrixPage() {
  const { ready, user } = useRequireAuth();
  const t = useTranslations("workforceSecurity");
  const tCommon = useTranslations("common");
  const tSys = useTranslations("workspace.systems");
  const [data, setData] = useState<Overview | null>(null);
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notEntitled, setNotEntitled] = useState(false);
  const [busy, setBusy] = useState(false);

  const { page, pageSize, setPage, setPageSize, paged, total } =
    useListPagination(positions);

  const satelliteLabel = useCallback(
    (key: string): string => {
      const found = SATELLITES.find((s) => s.key === key);
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

  const load = useCallback(async () => {
    setLoading(true);
    const [ovRes, posRes, tmplRes] = await Promise.all([
      wfFetch("security/overview"),
      wfFetch("positions"),
      wfFetch("role-templates"),
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
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!ready || !user?.organizationId) return;
    void load();
  }, [ready, user?.organizationId, load]);

  async function onMatrixChange(positionId: string, satelliteKey: string, role: string) {
    if (busy) return;
    setBusy(true);
    const existing = templateByCell.get(`${positionId}:${satelliteKey}`);
    try {
      if (!role) {
        if (existing) {
          await wfFetch(`role-templates/${existing.id}`, { method: "DELETE" });
        }
      } else {
        if (existing && existing.satelliteRole !== role) {
          await wfFetch(`role-templates/${existing.id}`, { method: "DELETE" });
        }
        await wfFetch("role-templates", {
          method: "PUT",
          body: JSON.stringify({ positionId, satelliteKey, satelliteRole: role }),
        });
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return null;
  if (notEntitled) {
    return <WorkforceGate onEnabled={load} />;
  }

  const seatUsed = data?.seats.used ?? 0;
  const seatLimit = data?.seats.limit;

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
            <div className={DATA_TABLE_VIEWPORT_CLASS}>
              <table className={DATA_TABLE_CLASS}>
                <thead>
                  <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colPosition")}</th>
                    {SATELLITES.map((s) => (
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
                        colSpan={SATELLITES.length + 1}
                        className={`${DATA_TABLE_TD_CLASS} text-[#7F8C8D]`}
                      >
                        {t("noPositions")}
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
                        {SATELLITES.map((s) => {
                          const tmpl = templateByCell.get(`${p.id}:${s.key}`);
                          const current = tmpl?.satelliteRole ?? "";
                          return (
                            <td key={s.key} className={DATA_TABLE_TD_CLASS}>
                              <select
                                className="rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px] focus:border-[#2980B9] focus:outline-none disabled:opacity-50"
                                value={current}
                                disabled={busy}
                                onChange={(e) =>
                                  void onMatrixChange(p.id, s.key, e.target.value)
                                }
                              >
                                <option value="">{t("noAccess")}</option>
                                {(ROLES_BY_SATELLITE[s.key] ?? []).map((r) => (
                                  <option key={r} value={r}>
                                    {humanizeRole(r)}
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
