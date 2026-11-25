import { catalogAdapter, secretField, stringField } from "./_factory";
import type { ProviderManifest, TestResult } from "../types";

/** Catalog face for E14 — runtime is WebhookSubscription + dispatcher in era-crm. */
const manifest: ProviderManifest = {
  key: "outbound_webhooks",
  name: "ERA outbound webhooks",
  category: "OTHER",
  family: undefined,
  regions: ["AZ", "CIS", "GLOBAL"],
  tier: "P1",
  docsUrl: "https://docs.era.local/crm/outbound-webhooks",
  verified: "V",
  auth: "api_key",
  fields: [
    stringField("url", { ru: "Webhook URL", az: "Webhook URL", en: "Webhook URL" }, true),
    secretField("signingSecret", {
      ru: "HMAC signing secret",
      az: "HMAC secret",
      en: "HMAC signing secret",
    }),
    stringField("events", {
      ru: "Events (comma: crm.lead.*,crm.message.*,crm.call.*,crm.task.*)",
      az: "Events",
      en: "Events (comma-separated)",
    }),
  ],
  inbound: { mode: "none", events: [], verify: "n/a" },
  outbound: [],
  capabilities: { media: false },
  rateLimit: { perSecond: 5 },
  setupSteps: {
    ru: [
      "Создайте подписку в /admin/integrations (или API)",
      "События crm.lead.* / crm.message.* / crm.call.* / crm.task.*",
      "Проверяйте X-Era-Signature HMAC-SHA256",
    ],
    en: [
      "Create subscription in /admin/integrations (or API)",
      "Events crm.lead.* / crm.message.* / crm.call.* / crm.task.*",
      "Verify X-Era-Signature HMAC-SHA256",
    ],
    az: ["Subscription yarat", "Events crm.*", "X-Era-Signature yoxla"],
  },
  autoRegisterWebhook: false,
};

export const outboundWebhooksAdapter = catalogAdapter(manifest, {
  async testConnection(ctx): Promise<TestResult> {
    const url = String(ctx.config.url ?? "");
    const secret = String(ctx.secrets.signingSecret ?? ctx.secrets.apiKey ?? "");
    if (!url.startsWith("https://") && !url.startsWith("http://127.0.0.1")) {
      return { ok: false, message: "url must be https (or localhost for lab)" };
    }
    if (!secret || secret.length < 16) {
      return { ok: false, message: "signingSecret min 16 chars" };
    }
    return { ok: true, message: "Outbound webhook config ok — enable to deliver events" };
  },
});
