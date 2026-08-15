"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Ban } from "lucide-react";
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TH_RIGHT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  ListPaginationFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TABLE_ROW_ICON_BTN_CLASS,
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

type WorkforceSatelliteKey = (typeof SATELLITES)[number]["key"];

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
  employments: Array<{
    id: string;
    globalPersonId: string;
    orgUnit?: { name: string };
    position?: { name: string };
  }>;
};

type GrantRow = {
  id: string;
  employmentId: string;
  satelliteKey: string;
  satelliteRole: string;
  reason: string;
  revokedAt?: string | null;
};

export default function WorkforceSecurityGrantsPage() {
  const { ready, user } = useRequireAuth();
  const t = useTranslations("workforceSecurity");
  const tCommon = useTranslations("common");
  const tSys = useTranslations("workspace.systems");
  const [data, setData] = useState<Overview | null>(null);
  const [grants, setGrants] = useState<GrantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notEntitled, setNotEntitled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [grantOpen, setGrantOpen] = useState(false);
  const [grantForm, setGrantForm] = useState<{
    employmentId: string;
    satelliteKey: WorkforceSatelliteKey;
    satelliteRole: string;
    reason: string;
  }>({
    employmentId: "",
    satelliteKey: SATELLITES[0].key,
    satelliteRole: "DOCTOR",
    reason: "",
  });

  const { page, pageSize, setPage, setPageSize, paged, total } =
    useListPagination(grants);

  const satelliteLabel = useCallback(
    (key: string): string => {
      const found = SATELLITES.find((s) => s.key === key);
      return found ? tSys(`${found.i18n}.title` as "clinic.title") : key;
    },
    [tSys],
  );

  const employmentLabel = useCallback(
    (employmentId: string): string => {
      const e = data?.employments.find((x) => x.id === employmentId);
      if (!e) return `${employmentId.slice(0, 8)}…`;
      const parts = [e.position?.name, e.orgUnit?.name].filter(Boolean);
      return parts.length > 0 ? parts.join(" · ") : `${employmentId.slice(0, 8)}…`;
    },
    [data?.employments],
  );

  const load = useCallback(async () => {
    setLoading(true);
    const [ovRes, grantRes] = await Promise.all([
      wfFetch("security/overview"),
      wfFetch("manual-grants"),
    ]);
    if (await isWorkforceGate403(ovRes)) {
      setNotEntitled(true);
      setLoading(false);
      return;
    }
    setNotEntitled(false);
    if (ovRes.ok) setData((await ovRes.json()) as Overview);
    if (grantRes.ok) {
      const rows = (await grantRes.json()) as GrantRow[];
      setGrants(Array.isArray(rows) ? rows : []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!ready || !user?.organizationId) return;
    void load();
  }, [ready, user?.organizationId, load]);

  async function onGrantSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !grantForm.employmentId || !grantForm.reason.trim()) return;
    setBusy(true);
    const res = await wfFetch("manual-grants", {
      method: "POST",
      body: JSON.stringify(grantForm),
    });
    setBusy(false);
    if (res.ok) {
      setGrantOpen(false);
      setGrantForm((f) => ({ ...f, reason: "" }));
      await load();
    }
  }

  async function onRevokeGrant(id: string) {
    if (busy) return;
    setBusy(true);
    const res = await wfFetch(`manual-grants/${id}/revoke`, { method: "POST", body: "{}" });
    setBusy(false);
    if (res.ok) await load();
  }

  if (!ready) return null;
  if (notEntitled) {
    return <WorkforceGate onEnabled={load} />;
  }

  const roleOptions =
    ROLES_BY_SATELLITE[grantForm.satelliteKey] ?? ROLES_BY_SATELLITE.industry_clinic;

  return (
    <>
      <PageHeader
        title={t("grantsPageTitle")}
        subtitle={t("grantsPageSubtitle")}
        actions={
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setGrantOpen(true)}>
            {t("grantCreate")}
          </button>
        }
      />
      {loading ? (
        <p className="text-sm text-[#7F8C8D]">{t("loading")}</p>
      ) : (
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
                    {t("noGrants")}
                  </td>
                </tr>
              ) : (
                paged.map((g) => (
                  <tr key={g.id} className={DATA_TABLE_TR_CLASS}>
                    <td className={DATA_TABLE_TD_CLASS}>{employmentLabel(g.employmentId)}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{satelliteLabel(g.satelliteKey)}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{humanizeRole(g.satelliteRole)}</td>
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
                        <span className="text-[#95A5A6]">{t("grantRevoked")}</span>
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

      <ModalShell
        open={grantOpen}
        title={t("grantModalTitle")}
        onClose={() => setGrantOpen(false)}
        closeLabel={tCommon("close")}
      >
        <form onSubmit={onGrantSubmit} className="grid gap-3">
          <label className="block text-[13px] font-medium text-[#34495E]">
            {t("fieldEmployment")}
            <select
              className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]"
              value={grantForm.employmentId}
              onChange={(e) => setGrantForm((f) => ({ ...f, employmentId: e.target.value }))}
              required
            >
              <option value="">{t("selectEmployment")}</option>
              {(data?.employments ?? []).map((e) => (
                <option key={e.id} value={e.id}>
                  {employmentLabel(e.id)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[13px] font-medium text-[#34495E]">
            {t("colSatellite")}
            <select
              className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]"
              value={grantForm.satelliteKey}
              onChange={(e) =>
                setGrantForm((f) => ({
                  ...f,
                  satelliteKey: e.target.value as WorkforceSatelliteKey,
                  satelliteRole: ROLES_BY_SATELLITE[e.target.value]?.[0] ?? "STAFF",
                }))
              }
            >
              {SATELLITES.map((s) => (
                <option key={s.key} value={s.key}>
                  {satelliteLabel(s.key)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[13px] font-medium text-[#34495E]">
            {t("colRole")}
            <select
              className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]"
              value={grantForm.satelliteRole}
              onChange={(e) => setGrantForm((f) => ({ ...f, satelliteRole: e.target.value }))}
            >
              {roleOptions.map((r) => (
                <option key={r} value={r}>
                  {humanizeRole(r)}
                </option>
              ))}
            </select>
          </label>
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
