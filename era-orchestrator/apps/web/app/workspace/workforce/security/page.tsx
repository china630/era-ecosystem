"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { getOrchAccessToken } from "../../../lib/orch-api";
import { useRequireAuth } from "../../../lib/use-require-auth";

const SATELLITES = [
  { key: "industry_clinic", label: "Clinic" },
  { key: "industry_hotel_pms", label: "Hotel PMS" },
  { key: "industry_fnb_pos", label: "F&B POS" },
] as const;

const ROLES_BY_SATELLITE: Record<string, string[]> = {
  industry_clinic: ["DOCTOR", "NURSE", "RECEPTION", "CLINIC_ADMIN"],
  industry_hotel_pms: ["RECEPTION", "HOUSEKEEPING", "MANAGER", "STAFF"],
  industry_fnb_pos: ["WAITER", "MANAGER", "CHEF", "CASHIER", "STAFF"],
};

type Overview = {
  seats: { used: number; limit: number };
  bindings: Array<{
    id: string;
    satelliteKey: string;
    satelliteRole: string;
    employment: { orgUnit?: { name: string }; position?: { name: string } };
  }>;
  employments: Array<{
    id: string;
    globalPersonId: string;
    orgUnit?: { name: string };
    position?: { name: string };
  }>;
  auditTail: Array<{ action: string; entityType: string; createdAt: string }>;
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

type GrantRow = {
  id: string;
  employmentId: string;
  satelliteKey: string;
  satelliteRole: string;
  reason: string;
  revokedAt?: string | null;
};

async function wfFetch(path: string, init: RequestInit = {}) {
  const token = getOrchAccessToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(`/api/platform/workforce/${path.replace(/^\//, "")}`, {
    ...init,
    headers,
  });
}

export default function WorkforceSecurityPage() {
  const { ready, user } = useRequireAuth();
  const t = useTranslations("workforceSecurity");
  const [data, setData] = useState<Overview | null>(null);
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [grants, setGrants] = useState<GrantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [grantOpen, setGrantOpen] = useState(false);
  const [grantForm, setGrantForm] = useState({
    employmentId: "",
    satelliteKey: SATELLITES[0].key,
    satelliteRole: "DOCTOR",
    reason: "",
  });

  const templateMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const row of templates) {
      m.set(`${row.positionId}:${row.satelliteKey}`, row.satelliteRole);
    }
    return m;
  }, [templates]);

  const load = useCallback(async () => {
    setLoading(true);
    const [ovRes, posRes, tmplRes, grantRes] = await Promise.all([
      wfFetch("security/overview"),
      wfFetch("positions"),
      wfFetch("role-templates"),
      wfFetch("manual-grants"),
    ]);
    if (ovRes.ok) setData((await ovRes.json()) as Overview);
    if (posRes.ok) {
      const p = (await posRes.json()) as PositionRow[];
      setPositions(Array.isArray(p) ? p : []);
    }
    if (tmplRes.ok) {
      const rows = (await tmplRes.json()) as TemplateRow[];
      setTemplates(Array.isArray(rows) ? rows : []);
    }
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

  async function onMatrixChange(positionId: string, satelliteKey: string, role: string) {
    if (busy || !role) return;
    setBusy(true);
    const res = await wfFetch("role-templates", {
      method: "PUT",
      body: JSON.stringify({ positionId, satelliteKey, satelliteRole: role }),
    });
    setBusy(false);
    if (res.ok) await load();
  }

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

  const roleOptions =
    ROLES_BY_SATELLITE[grantForm.satelliteKey] ?? ROLES_BY_SATELLITE.industry_clinic;

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <>
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              onClick={() => setGrantOpen(true)}
            >
              {t("grantCreate")}
            </button>
            <Link href="/workspace/workforce/employments" className={SECONDARY_BUTTON_CLASS}>
              {t("goEmployments")}
            </Link>
            <Link href="/workspace/workforce/export" className={SECONDARY_BUTTON_CLASS}>
              {t("linkExport")}
            </Link>
            <Link href="/workspace/workforce/security/audit" className={SECONDARY_BUTTON_CLASS}>
              {t("linkAudit")}
            </Link>
          </>
        }
      />
      {loading ? (
        <p className="text-sm text-[#7F8C8D]">{t("loading")}</p>
      ) : (
        <>
          <div className={`${CARD_CONTAINER_CLASS} mb-4 p-4`}>
            <p className="text-[13px] font-semibold text-[#34495E]">{t("seatsTitle")}</p>
            <p className="mt-1 text-sm tabular-nums">
              {data?.seats.used ?? 0} / {data?.seats.limit ?? "—"}
            </p>
          </div>

          <div className={`${CARD_CONTAINER_CLASS} mb-4 overflow-x-auto`}>
            <h2 className="mb-2 text-sm font-semibold text-[#34495E]">{t("matrixTitle")}</h2>
            <table className="min-w-full text-[13px]">
              <thead>
                <tr className="border-b border-[#D5DADF]">
                  <th className="p-2 text-left">{t("colPosition")}</th>
                  {SATELLITES.map((s) => (
                    <th key={s.key} className="p-2 text-left">
                      {s.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {positions.map((p) => (
                  <tr key={p.id} className="border-t border-[#EBEDF0]">
                    <td className="p-2">
                      {p.name}
                      {p.orgUnit?.name ? (
                        <span className="ml-1 text-[#7F8C8D]">({p.orgUnit.name})</span>
                      ) : null}
                    </td>
                    {SATELLITES.map((s) => {
                      const current =
                        templateMap.get(`${p.id}:${s.key}`) ??
                        ROLES_BY_SATELLITE[s.key]?.[0] ??
                        "STAFF";
                      return (
                        <td key={s.key} className="p-2">
                          <select
                            className="rounded border border-[#D5DBDB] px-2 py-1 text-[13px]"
                            value={current}
                            disabled={busy}
                            onChange={(e) =>
                              void onMatrixChange(p.id, s.key, e.target.value)
                            }
                          >
                            {(ROLES_BY_SATELLITE[s.key] ?? []).map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={`${CARD_CONTAINER_CLASS} mb-4 overflow-x-auto`}>
            <h2 className="mb-2 text-sm font-semibold text-[#34495E]">{t("grantsTitle")}</h2>
            <table className="min-w-full text-[13px]">
              <thead>
                <tr className="border-b border-[#D5DADF]">
                  <th className="p-2 text-left">{t("colEmployment")}</th>
                  <th className="p-2 text-left">{t("colSatellite")}</th>
                  <th className="p-2 text-left">{t("colRole")}</th>
                  <th className="p-2 text-left">{t("colReason")}</th>
                  <th className="p-2 text-left">{t("colActions")}</th>
                </tr>
              </thead>
              <tbody>
                {grants.map((g) => (
                  <tr key={g.id} className="border-t border-[#EBEDF0]">
                    <td className="p-2 font-mono text-xs">{g.employmentId.slice(0, 8)}…</td>
                    <td className="p-2">{g.satelliteKey}</td>
                    <td className="p-2">{g.satelliteRole}</td>
                    <td className="p-2">{g.reason}</td>
                    <td className="p-2">
                      {!g.revokedAt ? (
                        <button
                          type="button"
                          className="text-[#C0392B] underline"
                          disabled={busy}
                          onClick={() => void onRevokeGrant(g.id)}
                        >
                          {t("grantRevoke")}
                        </button>
                      ) : (
                        <span className="text-[#7F8C8D]">{t("grantRevoked")}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={`${CARD_CONTAINER_CLASS} mb-4 overflow-x-auto`}>
            <h2 className="mb-2 text-sm font-semibold text-[#34495E]">{t("bindingsTitle")}</h2>
            <table className="min-w-full text-[13px]">
              <thead>
                <tr className="border-b border-[#D5DADF]">
                  <th className="p-2 text-left">{t("colSatellite")}</th>
                  <th className="p-2 text-left">{t("colRole")}</th>
                  <th className="p-2 text-left">{t("colOrgUnit")}</th>
                  <th className="p-2 text-left">{t("colPosition")}</th>
                </tr>
              </thead>
              <tbody>
                {(data?.bindings ?? []).map((b) => (
                  <tr key={b.id} className="border-t border-[#EBEDF0]">
                    <td className="p-2">{b.satelliteKey}</td>
                    <td className="p-2">{b.satelliteRole}</td>
                    <td className="p-2">{b.employment?.orgUnit?.name ?? "—"}</td>
                    <td className="p-2">{b.employment?.position?.name ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={`${CARD_CONTAINER_CLASS} p-4`}>
            <h2 className="mb-2 text-sm font-semibold text-[#34495E]">{t("auditTitle")}</h2>
            <ul className="space-y-1 text-xs text-[#34495E]">
              {(data?.auditTail ?? []).map((a, i) => (
                <li key={`${a.action}-${i}`}>
                  {a.action} · {a.entityType} · {String(a.createdAt).slice(0, 19)}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {grantOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={onGrantSubmit}
            className={`${CARD_CONTAINER_CLASS} w-full max-w-md p-4`}
          >
            <h3 className="mb-3 text-sm font-semibold">{t("grantModalTitle")}</h3>
            <label className="mb-2 block text-[13px]">
              {t("fieldEmployment")}
              <select
                className="mt-1 w-full rounded border border-[#D5DBDB] px-2 py-1"
                value={grantForm.employmentId}
                onChange={(e) =>
                  setGrantForm((f) => ({ ...f, employmentId: e.target.value }))
                }
                required
              >
                <option value="">{t("selectEmployment")}</option>
                {(data?.employments ?? []).map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.position?.name ?? e.id.slice(0, 8)} — {e.orgUnit?.name ?? ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="mb-2 block text-[13px]">
              {t("colSatellite")}
              <select
                className="mt-1 w-full rounded border border-[#D5DBDB] px-2 py-1"
                value={grantForm.satelliteKey}
                onChange={(e) =>
                  setGrantForm((f) => ({
                    ...f,
                    satelliteKey: e.target.value,
                    satelliteRole: ROLES_BY_SATELLITE[e.target.value]?.[0] ?? "STAFF",
                  }))
                }
              >
                {SATELLITES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="mb-2 block text-[13px]">
              {t("colRole")}
              <select
                className="mt-1 w-full rounded border border-[#D5DBDB] px-2 py-1"
                value={grantForm.satelliteRole}
                onChange={(e) =>
                  setGrantForm((f) => ({ ...f, satelliteRole: e.target.value }))
                }
              >
                {roleOptions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <label className="mb-3 block text-[13px]">
              {t("fieldReason")}
              <textarea
                className="mt-1 w-full rounded border border-[#D5DBDB] px-2 py-1"
                rows={2}
                value={grantForm.reason}
                onChange={(e) => setGrantForm((f) => ({ ...f, reason: e.target.value }))}
                required
              />
            </label>
            <div className="flex gap-2">
              <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={busy}>
                {t("grantSubmit")}
              </button>
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                onClick={() => setGrantOpen(false)}
              >
                {t("grantCancel")}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
