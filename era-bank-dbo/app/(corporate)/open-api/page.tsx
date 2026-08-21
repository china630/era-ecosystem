"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CatalogField } from "@era/satellite-kit/ui";
import { OPEN_API_PERMISSIONS } from "@/lib/open-api-permissions";

type KeyRow = {
  id: string;
  status: string;
  permissionsJson: unknown;
  createdAt: string;
};

export default function OpenApiKeysPage() {
  const t = useTranslations("openApi");
  const tc = useTranslations("common");
  const [items, setItems] = useState<KeyRow[]>([]);
  const [permissions, setPermissions] = useState<string[]>(["accounts:read"]);
  const [rawKey, setRawKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    setLoading(true);
    fetch("/api/open-api-keys")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? tc("error"));
        setItems(data.items ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : tc("error")))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function createKey() {
    setBusy(true);
    setError(null);
    setRawKey(null);
    try {
      const res = await fetch("/api/open-api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? tc("error"));
      setRawKey(typeof data.rawKey === "string" ? data.rawKey : null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : tc("error"));
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/open-api-keys/${id}/revoke`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? tc("error"));
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : tc("error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">{t("title")}</h1>
      <p className="text-sm text-dbo-muted">{t("subtitle")}</p>
      {loading ? <p className="text-sm text-dbo-muted">{tc("loading")}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {rawKey ? (
        <p className="break-all rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
          {t("shownOnce")}: {rawKey}
        </p>
      ) : null}

      <CatalogField
        kind="MULTI"
        label={t("permissions")}
        value={permissions}
        onChange={(next) => setPermissions(Array.isArray(next) ? next : [next])}
        options={OPEN_API_PERMISSIONS.map((p) => ({ value: p.value, label: p.label }))}
      />
      <button
        type="button"
        className="rounded-lg bg-dbo-primary px-3 py-2 text-sm text-white disabled:opacity-50"
        disabled={busy || permissions.length === 0}
        onClick={() => void createKey()}
      >
        {t("create")}
      </button>

      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id} className="rounded-lg border border-slate-200 p-3 text-sm">
            <p className="font-mono text-xs">{item.id}</p>
            <p className="text-dbo-muted">{item.status}</p>
            {item.status === "ACTIVE" ? (
              <button
                type="button"
                className="mt-2 text-xs text-red-700"
                disabled={busy}
                onClick={() => void revoke(item.id)}
              >
                {t("revoke")}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
