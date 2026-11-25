import { catalogAdapter, stringField } from "./_factory";
import type { ProviderManifest, TestResult } from "../types";

/** Catalog face for E15 — runtime is TenantApiKey in era-crm. */
const manifest: ProviderManifest = {
  key: "public_api_keys",
  name: "Tenant API keys",
  category: "OTHER",
  family: undefined,
  regions: ["AZ", "CIS", "GLOBAL"],
  tier: "P1",
  docsUrl: "https://docs.era.local/crm/public-api-keys",
  verified: "V",
  auth: "api_key",
  fields: [
    stringField("name", { ru: "Key name", az: "Key name", en: "Key name" }, true),
    stringField("scopes", {
      ru: "Scopes (comma)",
      az: "Scopes",
      en: "Scopes (comma-separated)",
    }),
    stringField("expiresAt", {
      ru: "Expires ISO (optional)",
      az: "Expires",
      en: "Expires ISO (optional)",
    }),
  ],
  inbound: { mode: "none", events: [], verify: "n/a" },
  outbound: [],
  capabilities: { media: false },
  rateLimit: { perSecond: 30 },
  setupSteps: {
    ru: [
      "Создайте ключ через API /admin UI",
      "Bearer token показывается один раз",
      "Scopes ограничивают /api/*",
    ],
    en: [
      "Create key via API / admin UI",
      "Bearer token shown once",
      "Scopes gate /api/*",
    ],
    az: ["API key yarat", "Bearer bir dəfə göstərilir", "Scopes /api/*"],
  },
  autoRegisterWebhook: false,
};

export const publicApiKeysAdapter = catalogAdapter(manifest, {
  async testConnection(ctx): Promise<TestResult> {
    const name = String(ctx.config.name ?? "").trim();
    if (!name) return { ok: false, message: "name required" };
    return {
      ok: true,
      message: "Use POST /api/admin/api-keys to mint a tenant key (token once)",
    };
  },
});
