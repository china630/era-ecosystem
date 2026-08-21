"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { SuperAdminDataTable } from "../../../../components/super-admin-data-table";
import { cpAdminFetch } from "../../../../lib/cp-admin-fetch";
import { ORCH_TOKEN_KEY } from "../../../../lib/orch-api";

export default function MdmCompaniesPage() {
  const t = useTranslations("superAdmin.mdmCompanies");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<Array<Record<string, string>>>([]);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState("");
  const [name, setName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await cpAdminFetch(`mdm/companies?page=${page}&pageSize=25`);
    if (res.ok) {
      const data = (await res.json()) as {
        total: number;
        items: Array<{
          id: string;
          name: string;
          taxId: string;
          organizationId: string | null;
          updatedAt: string;
        }>;
      };
      setTotal(data.total);
      setItems(
        data.items.map((i) => ({
          id: i.id,
          name: i.name,
          taxId: i.taxId,
          organizationId: i.organizationId ?? "",
          updatedAt: i.updatedAt,
        })),
      );
    }
    setLoading(false);
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  async function lookupVoen() {
    const voen = taxId.replace(/\D/g, "");
    if (!/^\d{10}$/.test(voen)) {
      setError(t("invalidVoen"));
      return;
    }
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const token =
        typeof window !== "undefined" ? localStorage.getItem(ORCH_TOKEN_KEY) : null;
      const res = await fetch("/api/cp-mdm/organizations/lookup-by-voen", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ taxId: voen }),
      });
      if (!res.ok) {
        setError(t("lookupFailed"));
        return;
      }
      const data = (await res.json()) as {
        found?: boolean;
        name?: string;
        organizationId?: string;
      };
      if (data.name) setName(data.name);
      if (data.organizationId) setOrgId(data.organizationId);
      setMsg(data.found ? t("lookupFound") : t("lookupNotFound"));
    } finally {
      setBusy(false);
    }
  }

  async function linkCompany(e: React.FormEvent) {
    e.preventDefault();
    const voen = taxId.replace(/\D/g, "");
    if (!orgId.trim() || !name.trim() || !/^\d{10}$/.test(voen)) {
      setError(t("linkRequired"));
      return;
    }
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const token =
        typeof window !== "undefined" ? localStorage.getItem(ORCH_TOKEN_KEY) : null;
      const res = await fetch("/api/cp-mdm/organizations/link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          organizationId: orgId.trim(),
          name: name.trim(),
          taxId: voen,
        }),
      });
      if (!res.ok) {
        setError(t("linkFailed"));
        return;
      }
      setMsg(t("linkOk"));
      await load();
    } finally {
      setBusy(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / 25));

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      <p className="text-sm text-[#7F8C8D]">{t("hint")}</p>

      <form
        onSubmit={(e) => void linkCompany(e)}
        className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}
      >
        <h2 className="text-sm font-semibold text-[#34495E]">{t("linkTitle")}</h2>
        <p className="text-xs text-[#7F8C8D]">{t("linkHint")}</p>
        <div className="flex flex-wrap gap-2">
          <input
            className={MODAL_INPUT_CLASS}
            placeholder={t("colTaxId")}
            value={taxId}
            onChange={(e) => setTaxId(e.target.value)}
            maxLength={10}
          />
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={busy}
            onClick={() => void lookupVoen()}
          >
            {t("lookup")}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            className={`${MODAL_INPUT_CLASS} min-w-[16rem]`}
            placeholder={t("colOrg")}
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
          />
          <input
            className={`${MODAL_INPUT_CLASS} min-w-[12rem]`}
            placeholder={t("colName")}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={busy}>
            {t("linkSubmit")}
          </button>
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {msg ? <p className="text-sm text-emerald-700">{msg}</p> : null}
      </form>

      <SuperAdminDataTable
        loading={loading}
        columns={["name", "taxId", "organizationId", "updatedAt"]}
        headers={{
          name: t("colName"),
          taxId: t("colTaxId"),
          organizationId: t("colOrg"),
          updatedAt: t("colUpdated"),
        }}
        rows={items}
      />
      <div className="flex items-center gap-2 text-sm">
        <button
          type="button"
          className={PRIMARY_BUTTON_CLASS}
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          {t("prev")}
        </button>
        <span>{t("page", { page, total: totalPages })}</span>
        <button
          type="button"
          className={PRIMARY_BUTTON_CLASS}
          disabled={page * 25 >= total}
          onClick={() => setPage((p) => p + 1)}
        >
          {t("next")}
        </button>
      </div>
    </div>
  );
}
