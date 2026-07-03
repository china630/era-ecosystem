"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { getOrchAccessToken } from "../../../../lib/orch-api";
import { useRequireAuth } from "../../../../lib/use-require-auth";

type PositionRow = {
  id: string;
  name: string;
  code: string | null;
  totalSlots: number;
  orgUnit: { id: string; name: string };
  _count?: { employments: number };
};

type OrgUnit = { id: string; name: string };

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

export default function PositionsPage() {
  const { ready, user } = useRequireAuth();
  const t = useTranslations("workforcePositions");
  const [rows, setRows] = useState<PositionRow[]>([]);
  const [units, setUnits] = useState<OrgUnit[]>([]);
  const [orgUnitId, setOrgUnitId] = useState("");
  const [name, setName] = useState("");
  const [totalSlots, setTotalSlots] = useState(1);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [posRes, unitRes] = await Promise.all([
      wfFetch("positions"),
      wfFetch("org-units"),
    ]);
    if (unitRes.ok) {
      const u = (await unitRes.json()) as { items: OrgUnit[] };
      setUnits(u.items ?? []);
      if (!orgUnitId && u.items?.[0]) setOrgUnitId(u.items[0].id);
    }
    if (posRes.ok) {
      setRows(await posRes.json());
    }
    setLoading(false);
  }, [orgUnitId]);

  useEffect(() => {
    if (!ready || !user?.organizationId) return;
    void load();
  }, [ready, user?.organizationId, load]);

  async function createPosition(e: React.FormEvent) {
    e.preventDefault();
    if (!orgUnitId || !name.trim()) return;
    setBusy(true);
    const res = await wfFetch("positions", {
      method: "POST",
      body: JSON.stringify({ orgUnitId, name: name.trim(), totalSlots }),
    });
    setBusy(false);
    if (res.ok) {
      setName("");
      await load();
    }
  }

  if (!ready) return null;

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <Link href="/workspace/workforce/org-structure" className={SECONDARY_BUTTON_CLASS}>
            {t("goOrg")}
          </Link>
        }
      />
      <form onSubmit={(e) => void createPosition(e)} className={`${CARD_CONTAINER_CLASS} mb-4 grid gap-3 p-4 sm:grid-cols-4`}>
        <label className="block text-[13px] font-medium text-[#34495E]">
          {t("fieldOrgUnit")}
          <select className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]" value={orgUnitId} onChange={(e) => setOrgUnitId(e.target.value)} required>
            {units.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </label>
        <label className="block text-[13px] font-medium text-[#34495E]">
          {t("fieldName")}
          <input className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="block text-[13px] font-medium text-[#34495E]">
          {t("fieldSlots")}
          <input type="number" min={1} className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]" value={totalSlots} onChange={(e) => setTotalSlots(Number(e.target.value))} />
        </label>
        <div className="flex items-end">
          <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={busy}>{t("create")}</button>
        </div>
      </form>
      {loading ? (
        <p className="text-sm text-[#7F8C8D]">{t("loading")}</p>
      ) : (
        <div className={`${CARD_CONTAINER_CLASS} overflow-x-auto`}>
          <table className="min-w-full text-[13px]">
            <thead>
              <tr className="border-b border-[#D5DADF]">
                <th className="p-2 text-left font-semibold">{t("colOrgUnit")}</th>
                <th className="p-2 text-left font-semibold">{t("colName")}</th>
                <th className="p-2 text-right font-semibold">{t("colSlots")}</th>
              </tr>
            </thead>
            <tbody>
              {(Array.isArray(rows) ? rows : []).map((r) => (
                <tr key={r.id} className="border-t border-[#EBEDF0]">
                  <td className="p-2">{r.orgUnit?.name ?? "—"}</td>
                  <td className="p-2">{r.name}</td>
                  <td className="p-2 text-right tabular-nums">
                    {r._count?.employments ?? 0} / {r.totalSlots}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
