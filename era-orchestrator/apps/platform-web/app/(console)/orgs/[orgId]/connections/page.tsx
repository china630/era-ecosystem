"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  GHOST_BUTTON_CLASS,
  MODAL_INPUT_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  labelSatelliteKey,
} from "@era/satellite-kit/ui";
import { useAuth } from "@/lib/auth-context";
import { orchFetch } from "@/lib/orch-api";
import { ENDPOINT_PRESETS, type SatelliteEndpoint } from "@/lib/org-hub-shared";
import { useOrgShell } from "../org-shell";

export default function OrgEndpointsPage() {
  const { orgId } = useOrgShell();
  const { token } = useAuth();
  const t = useTranslations("superAdmin.orgHub");
  const [endpoints, setEndpoints] = useState<SatelliteEndpoint[]>([]);
  const [endpointDraft, setEndpointDraft] = useState<
    Record<string, { baseUrl: string; enabled: boolean }>
  >({});
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const satLabel = useCallback(
    (key: string) => {
      switch (key) {
        case "industry_hotel_pms":
          return t("satHotel");
        case "industry_clinic":
          return t("satClinic");
        case "industry_fnb_pos":
          return t("satFnb");
        case "industry_retail":
          return t("satRetail");
        case "finance_core":
          return t("satFinance");
        default:
          return labelSatelliteKey(key);
      }
    },
    [t],
  );

  const reload = useCallback(async () => {
    if (!token || !orgId) return;
    setLoading(true);
    try {
      const epRes = await orchFetch(`/v1/admin/orgs/${orgId}/satellite-endpoints`, { token });
      if (epRes.ok) {
        const eps = (await epRes.json()) as SatelliteEndpoint[];
        setEndpoints(eps);
        const draft: Record<string, { baseUrl: string; enabled: boolean }> = {};
        for (const key of ENDPOINT_PRESETS) {
          const row = eps.find((e) => e.satelliteKey === key);
          draft[key] = { baseUrl: row?.baseUrl ?? "", enabled: row?.enabled ?? false };
        }
        setEndpointDraft(draft);
      }
    } finally {
      setLoading(false);
    }
  }, [token, orgId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function syncSatelliteBindings() {
    if (!token || !orgId) return;
    setSyncing(true);
    setMessage("");
    try {
      const res = await orchFetch(`/v1/admin/orgs/${orgId}/sync-satellite-bindings`, {
        token,
        method: "POST",
      });
      if (!res.ok) {
        setMessage(t("syncFailed", { status: res.status }));
        return;
      }
      const body = (await res.json()) as {
        results?: Array<{ satelliteKey: string; ok: boolean; error?: string }>;
      };
      const results = body.results ?? [];
      const ok = results.filter((r) => r.ok).length;
      const fail = results.filter((r) => !r.ok);
      if (results.length === 0) {
        setMessage(t("syncEmpty"));
        return;
      }
      if (fail.length === 0) {
        setMessage(t("syncOk", { count: ok }));
        return;
      }
      setMessage(
        t("syncPartial", {
          ok,
          total: results.length,
          failed: fail
            .map((f) => `${f.satelliteKey}${f.error ? ` (${f.error.slice(0, 80)})` : ""}`)
            .join("; "),
        }),
      );
    } finally {
      setSyncing(false);
    }
  }

  async function saveEndpoint(key: string) {
    if (!token) return;
    const row = endpointDraft[key];
    if (!row?.baseUrl.trim()) return;
    setMessage("");
    const res = await orchFetch(`/v1/admin/orgs/${orgId}/satellite-endpoints/${key}`, {
      token,
      method: "PUT",
      body: JSON.stringify({
        satelliteKey: key,
        baseUrl: row.baseUrl.trim(),
        enabled: row.enabled,
      }),
    });
    if (!res.ok) {
      setMessage(t("endpointSaveFailed", { key, status: res.status }));
      return;
    }
    setMessage(t("endpointSaved", { key: satLabel(key) }));
    await reload();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("endpointsTitle")}
        subtitle={t("endpointsHint")}
        actions={
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={syncing || !token}
            onClick={() => void syncSatelliteBindings()}
          >
            {syncing ? t("syncing") : t("syncBindings")}
          </button>
        }
      />
      {loading ? <p className="text-sm text-[#7F8C8D]">{t("loading")}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      <section className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
        {ENDPOINT_PRESETS.map((key) => (
          <div key={key} className="flex flex-wrap items-center gap-2 border-b border-[#ECF0F1] py-2 text-sm">
            <span className="w-40 text-sm font-medium text-[#34495E]">{satLabel(key)}</span>
            <label className="flex min-w-[16rem] flex-1 flex-col text-xs text-[#7F8C8D]">
              {t("endpointUrlLabel")}
              <input
                className={`${MODAL_INPUT_CLASS} mt-1`}
                value={endpointDraft[key]?.baseUrl ?? ""}
                onChange={(e) =>
                  setEndpointDraft((prev) => ({
                    ...prev,
                    [key]: {
                      ...prev[key],
                      baseUrl: e.target.value,
                      enabled: prev[key]?.enabled ?? true,
                    },
                  }))
                }
              />
            </label>
            <label className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={endpointDraft[key]?.enabled ?? false}
                onChange={(e) =>
                  setEndpointDraft((prev) => ({
                    ...prev,
                    [key]: { baseUrl: prev[key]?.baseUrl ?? "", enabled: e.target.checked },
                  }))
                }
              />
              {t("enabled")}
            </label>
            <button type="button" className={GHOST_BUTTON_CLASS} onClick={() => void saveEndpoint(key)}>
              {t("save")}
            </button>
          </div>
        ))}
        {endpoints.length > 0 ? (
          <p className="text-xs text-[#7F8C8D]">{t("endpointsRegistered", { count: endpoints.length })}</p>
        ) : null}
      </section>
    </div>
  );
}
