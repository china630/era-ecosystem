"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { orchFetch } from "../../../../lib/orch-api";
import { useAuth } from "../../../../lib/auth-context";

type PublicCfg = {
  apiBase: string;
  hasApiKey: boolean;
  pmsCertified: boolean;
  updatedAt: string | null;
};

export default function SuperAdminChannexVendorPage() {
  const t = useTranslations("superAdmin");
  const { token } = useAuth();
  const [cfg, setCfg] = useState<PublicCfg | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [apiBase, setApiBase] = useState("");
  const [pmsCertified, setPmsCertified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!token) return;
    setError(null);
    const res = await orchFetch("/v1/admin/vendors/channex", { token });
    if (!res.ok) {
      setError(t("channexVendorLoadFailed", { default: "Load failed" }));
      return;
    }
    const data = (await res.json()) as PublicCfg;
    setCfg(data);
    setApiBase(data.apiBase);
    setPmsCertified(Boolean(data.pmsCertified));
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function save(extra?: {
    useProductionBase?: boolean;
    clearKey?: boolean;
  }) {
    if (!token) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const body: Record<string, unknown> = { pmsCertified };
      if (extra?.useProductionBase !== undefined) {
        body.useProductionBase = extra.useProductionBase;
      } else if (apiBase.trim()) {
        body.apiBase = apiBase.trim();
      }
      if (extra?.clearKey) body.apiKey = null;
      else if (apiKey.trim()) body.apiKey = apiKey.trim();
      const res = await orchFetch("/v1/admin/vendors/channex", {
        token,
        method: "PUT",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError(t("channexVendorSaveFailed", { default: "Save failed" }));
        return;
      }
      const data = (await res.json()) as PublicCfg;
      setCfg(data);
      setApiBase(data.apiBase);
      setPmsCertified(Boolean(data.pmsCertified));
      setApiKey("");
      setMessage(t("channexVendorSaved", { default: "Saved" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-6">
      <h1 className="text-xl font-semibold text-[#2C3E50]">
        {t("channexVendorTitle", { default: "Channex partner credentials" })}
      </h1>
      <p className="text-sm text-[#7F8C8D]">
        One ERA partner API key for all hotel properties. Not stored in satellite compose.
        PMS certification is a Control Plane flag — not hotel env.
      </p>
      {error ? <p className="text-sm text-[#E74C3C]">{error}</p> : null}
      {message ? <p className="text-sm text-[#27AE60]">{message}</p> : null}
      <section className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
        <p className="text-sm text-[#34495E]">
          Key configured: <strong>{cfg?.hasApiKey ? "yes" : "no"}</strong>
          {cfg?.updatedAt ? ` · updated ${cfg.updatedAt}` : ""}
        </p>
        <label className="block text-sm text-[#34495E]">
          API base
          <input
            className={`${MODAL_INPUT_CLASS} mt-1 w-full`}
            value={apiBase}
            onChange={(e) => setApiBase(e.target.value)}
          />
        </label>
        <label className="block text-sm text-[#34495E]">
          Partner API key (leave blank to keep)
          <input
            className={`${MODAL_INPUT_CLASS} mt-1 w-full`}
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-[#34495E]">
          <input
            type="checkbox"
            checked={pmsCertified}
            onChange={(e) => setPmsCertified(e.target.checked)}
          />
          PMS certified (required for live production ARI)
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={busy}
            onClick={() => void save()}
          >
            Save
          </button>
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            disabled={busy}
            onClick={() => void save({ useProductionBase: false })}
          >
            Use staging base
          </button>
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            disabled={busy}
            onClick={() => void save({ useProductionBase: true })}
          >
            Use production base
          </button>
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            disabled={busy}
            onClick={() => void save({ clearKey: true })}
          >
            Clear key
          </button>
        </div>
      </section>
    </main>
  );
}
