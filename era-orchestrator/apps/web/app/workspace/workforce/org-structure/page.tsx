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

type OrgUnit = {
  id: string;
  name: string;
  code: string | null;
  parentId: string | null;
  status: string;
  _count?: { employments: number; positions: number };
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

export default function OrgStructurePage() {
  const { ready, user } = useRequireAuth();
  const t = useTranslations("workforceOrg");
  const [items, setItems] = useState<OrgUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await wfFetch("org-units");
    if (!res.ok) {
      if (res.status === 404) {
        setError("bootstrap");
        setItems([]);
        setLoading(false);
        return;
      }
      setError(`${res.status}`);
      setLoading(false);
      return;
    }
    const data = (await res.json()) as { items: OrgUnit[] };
    setItems(data.items ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!ready || !user?.organizationId) return;
    void load();
  }, [ready, user?.organizationId, load]);

  async function bootstrap() {
    setBusy(true);
    const res = await wfFetch("scope/bootstrap", { method: "POST", body: "{}" });
    setBusy(false);
    if (!res.ok) {
      setError(await res.text());
      return;
    }
    await load();
  }

  async function createUnit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const res = await wfFetch("org-units", {
      method: "POST",
      body: JSON.stringify({
        name: name.trim(),
        ...(parentId ? { parentId } : {}),
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(await res.text());
      return;
    }
    setName("");
    await load();
  }

  if (!ready) return null;

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/workspace/workforce/positions" className={SECONDARY_BUTTON_CLASS}>
              {t("goPositions")}
            </Link>
            <Link href="/workspace/workforce/employments" className={SECONDARY_BUTTON_CLASS}>
              {t("goEmployments")}
            </Link>
          </div>
        }
      />

      {error === "bootstrap" ? (
        <div className={`${CARD_CONTAINER_CLASS} mb-4 p-4`}>
          <p className="text-sm text-[#34495E]">{t("bootstrapHint")}</p>
          <button type="button" className={`${PRIMARY_BUTTON_CLASS} mt-3`} disabled={busy} onClick={() => void bootstrap()}>
            {t("bootstrap")}
          </button>
        </div>
      ) : null}

      <form onSubmit={(e) => void createUnit(e)} className={`${CARD_CONTAINER_CLASS} mb-4 grid gap-3 p-4 sm:grid-cols-3`}>
        <label className="block text-[13px] font-medium text-[#34495E]">
          {t("fieldName")}
          <input className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="block text-[13px] font-medium text-[#34495E]">
          {t("fieldParent")}
          <select className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]" value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">{t("rootParent")}</option>
            {items.filter((u) => u.status === "ACTIVE").map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={busy}>{t("create")}</button>
        </div>
      </form>

      {error && error !== "bootstrap" ? <p className="mb-3 text-sm text-red-700">{error}</p> : null}
      {loading ? (
        <p className="text-sm text-[#7F8C8D]">{t("loading")}</p>
      ) : (
        <div className={`${CARD_CONTAINER_CLASS} overflow-x-auto`}>
          <table className="min-w-full text-[13px]">
            <thead>
              <tr className="border-b border-[#D5DADF]">
                <th className="p-2 text-left font-semibold">{t("colName")}</th>
                <th className="p-2 text-left font-semibold">{t("colCode")}</th>
                <th className="p-2 text-left font-semibold">{t("colStatus")}</th>
                <th className="p-2 text-right font-semibold">{t("colCounts")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((u) => (
                <tr key={u.id} className="border-t border-[#EBEDF0]">
                  <td className="p-2">{u.name}</td>
                  <td className="p-2">{u.code ?? "—"}</td>
                  <td className="p-2">{u.status}</td>
                  <td className="p-2 text-right tabular-nums">
                    {u._count?.employments ?? 0} / {u._count?.positions ?? 0}
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
