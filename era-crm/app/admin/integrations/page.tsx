"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  CatalogField,
  Field,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  FORM_STACK_CLASS,
} from "@era/satellite-kit/ui";

type ManifestField = {
  key: string;
  label: { ru?: string; az?: string; en?: string };
  type: string;
  required?: boolean;
  secret?: boolean;
};

type Manifest = {
  key: string;
  name: string;
  category: string;
  tier: string;
  regions: string[];
  fields?: ManifestField[];
  setupSteps?: { en?: string[]; ru?: string[]; az?: string[] };
};

type Connection = {
  id: string;
  providerKey: string;
  displayName: string;
  status: string;
  enabled: boolean;
  webhookUrl?: string;
  secretsMask?: Record<string, string>;
  lastTestOk?: boolean | null;
  lastError?: string | null;
};

type ExtensionRow = { userId: string; extension: string };

const TELEPHONY_EXTENSION_KEYS = new Set([
  "asterisk",
  "zadarma",
  "novofon",
  "mango_office",
  "sipuni",
  "gravitel",
  "megafon_vats",
  "mts_vats",
  "virtualats_az",
]);

export default function AdminIntegrationsPage() {
  const t = useTranslations("integrations");
  const locale = useLocale() as "en" | "ru" | "az";
  const [catalog, setCatalog] = useState<Manifest[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [providerKey, setProviderKey] = useState("mock_telegram");
  const [displayName, setDisplayName] = useState("");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [filterTier, setFilterTier] = useState<"ALL" | "P0" | "P1" | "P2">("ALL");
  const [extConnectionId, setExtConnectionId] = useState("");
  const [extensions, setExtensions] = useState<ExtensionRow[]>([
    { userId: "", extension: "" },
  ]);

  const selected = useMemo(
    () => catalog.find((m) => m.key === providerKey) ?? null,
    [catalog, providerKey],
  );

  const setupSteps = useMemo(() => {
    if (!selected?.setupSteps) return [];
    const loc = selected.setupSteps[locale];
    return (loc?.length ? loc : selected.setupSteps.en) ?? [];
  }, [selected, locale]);

  async function load() {
    const [cRes, nRes] = await Promise.all([
      fetch("/api/integrations/catalog"),
      fetch("/api/integrations/connections"),
    ]);
    const cData = await cRes.json();
    const nData = await nRes.json();
    if (cRes.ok) setCatalog(cData.items ?? []);
    if (nRes.ok) setConnections(nData.items ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    setFieldValues({});
  }, [providerKey]);

  async function create() {
    setMessage("");
    const secrets: Record<string, string> = {};
    const config: Record<string, string> = {};
    for (const f of selected?.fields ?? []) {
      const v = (fieldValues[f.key] ?? "").trim();
      if (!v) continue;
      if (f.secret || f.type === "secret") secrets[f.key] = v;
      else config[f.key] = v;
    }
    const res = await fetch("/api/integrations/connections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        providerKey,
        displayName: displayName || providerKey,
        secrets,
        config,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "Failed");
      return;
    }
    setFieldValues({});
    await load();
    setMessage(t("created"));
  }

  async function test(id: string) {
    const res = await fetch(`/api/integrations/connections/${id}/test`, { method: "POST" });
    const data = await res.json();
    setMessage(data.message ?? JSON.stringify(data));
    await load();
  }

  async function enable(id: string, on: boolean) {
    const res = await fetch(`/api/integrations/connections/${id}/${on ? "enable" : "disable"}`, {
      method: "POST",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setMessage(data.error ?? "Failed");
    await load();
  }

  async function startOAuth(path: string, id: string) {
    setMessage("");
    const res = await fetch(
      `${path}?connectionId=${encodeURIComponent(id)}`,
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(data.error ?? "OAuth start failed");
      return;
    }
    if (data.url) window.location.href = String(data.url);
  }

  async function loadExtensions(id: string) {
    setExtConnectionId(id);
    const res = await fetch(`/api/integrations/connections/${id}/extensions`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(data.error ?? "Failed to load extensions");
      return;
    }
    const items = (data.items ?? []) as ExtensionRow[];
    setExtensions(items.length ? items : [{ userId: "", extension: "" }]);
  }

  async function saveExtensions() {
    if (!extConnectionId) return;
    const res = await fetch(
      `/api/integrations/connections/${extConnectionId}/extensions`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: extensions }),
      },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(data.error ?? "Failed to save extensions");
      return;
    }
    setMessage("Extensions saved");
    setExtensions(
      (data.items as ExtensionRow[])?.length
        ? (data.items as ExtensionRow[])
        : [{ userId: "", extension: "" }],
    );
  }

  const filtered = catalog.filter((m) => filterTier === "ALL" || m.tier === filterTier);
  const providerOptions = filtered.map((m) => ({
    value: m.key,
    label: `${m.name} (${m.tier})`,
  }));

  return (
    <div className="space-y-6 p-4">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      {message ? <p className="text-sm text-[var(--era-muted)]">{message}</p> : null}

      <section className={CARD_CONTAINER_CLASS}>
        <div className="mb-3 flex flex-wrap gap-2">
          {(["ALL", "P0", "P1", "P2"] as const).map((tier) => (
            <button
              key={tier}
              type="button"
              className={filterTier === tier ? PRIMARY_BUTTON_CLASS : SECONDARY_BUTTON_CLASS}
              onClick={() => setFilterTier(tier)}
            >
              {tier}
            </button>
          ))}
        </div>
        <p className="mb-2 text-sm">
          {t("catalog")}: {t("catalogCount", { count: filtered.length })}
        </p>
        <div className={FORM_STACK_CLASS}>
          <CatalogField
            kind="SEARCHABLE"
            label={t("provider")}
            value={providerKey}
            onChange={(v) => setProviderKey(String(Array.isArray(v) ? v[0] : v))}
            options={providerOptions}
          />
          <Field
            label={t("displayName")}
            preset="shortText"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          {(selected?.fields ?? []).map((f) => (
            <Field
              key={f.key}
              label={f.label[locale] || f.label.en || f.label.ru || f.key}
              preset={f.secret || f.type === "secret" ? "shortText" : "shortText"}
              type={f.secret || f.type === "secret" ? "password" : "text"}
              value={fieldValues[f.key] ?? ""}
              onChange={(e) =>
                setFieldValues((prev) => ({ ...prev, [f.key]: e.target.value }))
              }
            />
          ))}
          {setupSteps.length ? (
            <ol className="list-decimal pl-5 text-xs text-[#7F8C8D]">
              {setupSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          ) : null}
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void create()}>
            {t("newConnection")}
          </button>
        </div>
      </section>

      <section className={CARD_CONTAINER_CLASS}>
        <h2 className="mb-3 font-medium">{t("connections")}</h2>
        <ul className="space-y-3">
          {connections.map((c) => (
            <li key={c.id} className="rounded border border-[#D5DADF] p-3 text-sm">
              <div className="font-medium">
                {c.displayName} · {c.providerKey}
              </div>
              <div className="text-xs text-[#7F8C8D]">
                {c.status} · {c.enabled ? t("statusEnabled") : t("statusDisabled")}
                {c.lastTestOk != null ? ` · test=${c.lastTestOk ? "ok" : "fail"}` : ""}
              </div>
              {c.webhookUrl ? (
                <p className="mt-1 break-all font-mono text-[11px]">{c.webhookUrl}</p>
              ) : null}
              {c.secretsMask ? (
                <p className="text-[11px] text-[#7F8C8D]">
                  secrets: {Object.entries(c.secretsMask).map(([k, v]) => `${k}=${v}`).join(", ")}
                </p>
              ) : null}
              {c.lastError ? <p className="text-xs text-red-600">{c.lastError}</p> : null}
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void test(c.id)}>
                  {t("test")}
                </button>
                <button
                  type="button"
                  className={PRIMARY_BUTTON_CLASS}
                  onClick={() => void enable(c.id, !c.enabled)}
                >
                  {c.enabled ? t("disable") : t("enable")}
                </button>
                {(c.providerKey === "instagram" ||
                  c.providerKey === "fb_messenger" ||
                  c.providerKey === "whatsapp_cloud" ||
                  c.providerKey === "meta_lead_ads") && (
                  <button
                    type="button"
                    className={SECONDARY_BUTTON_CLASS}
                    onClick={() =>
                      void startOAuth("/api/integrations/oauth/meta/start", c.id)
                    }
                  >
                    Meta OAuth
                  </button>
                )}
                {(c.providerKey === "gmail_api" || c.providerKey === "gcal") && (
                  <button
                    type="button"
                    className={SECONDARY_BUTTON_CLASS}
                    onClick={() =>
                      void startOAuth(
                        "/api/integrations/oauth/google/start",
                        c.id,
                      )
                    }
                  >
                    Google OAuth
                  </button>
                )}
                {(c.providerKey === "ms_graph_mail" ||
                  c.providerKey === "ms365_calendar") && (
                  <button
                    type="button"
                    className={SECONDARY_BUTTON_CLASS}
                    onClick={() =>
                      void startOAuth(
                        "/api/integrations/oauth/microsoft/start",
                        c.id,
                      )
                    }
                  >
                    Microsoft OAuth
                  </button>
                )}
                {TELEPHONY_EXTENSION_KEYS.has(c.providerKey) ? (
                  <button
                    type="button"
                    className={SECONDARY_BUTTON_CLASS}
                    onClick={() => void loadExtensions(c.id)}
                  >
                    {t("extensions")}
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {extConnectionId ? (
        <section className={CARD_CONTAINER_CLASS}>
          <h2 className="mb-3 font-medium">
            {t("extensionsTitle", { id: extConnectionId })}
          </h2>
          <div className={FORM_STACK_CLASS}>
            {extensions.map((row, idx) => (
              <div key={idx} className="flex flex-wrap gap-2">
                <Field
                  label={t("extensionsUserId")}
                  preset="shortText"
                  value={row.userId}
                  onChange={(e) => {
                    const next = [...extensions];
                    next[idx] = { ...row, userId: e.target.value };
                    setExtensions(next);
                  }}
                />
                <Field
                  label={t("extensionsExtension")}
                  preset="shortText"
                  value={row.extension}
                  onChange={(e) => {
                    const next = [...extensions];
                    next[idx] = { ...row, extension: e.target.value };
                    setExtensions(next);
                  }}
                />
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                onClick={() =>
                  setExtensions([...extensions, { userId: "", extension: "" }])
                }
              >
                {t("extensionsAddRow")}
              </button>
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                onClick={() => void saveExtensions()}
              >
                {t("extensionsSave")}
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
