import { catalogAdapter, secretField, stringField } from "./_factory";
import type { ProviderManifest } from "../types";

const manifest: ProviderManifest = {
  key: "generic_call_webhook",
  name: "Generic call webhook / own PBX",
  category: "TELEPHONY",
  family: "generic_call_webhook",
  regions: ["AZ","CIS","GLOBAL"],
  tier: "P0",
  docsUrl: "https://example.invalid",
  verified: "V",
  auth: "api_key",
  fields: [{ key: "apiKey", label: { ru: "API key", az: "API key", en: "API key" }, type: "secret", secret: true, required: true }],
  inbound: { mode: "webhook", events: ["message"], verify: "secret header or ?k=" },
  outbound: ["sendText"],
  capabilities: {"media":false},
  rateLimit: {"perSecond":10},
  setupSteps: {"ru":["Вставьте ключи","Проверить","Включить"],"en":["Paste keys","Test","Enable"],"az":["Açarları daxil edin","Yoxla","Aktiv et"]},
  autoRegisterWebhook: false,
};

export const genericCallWebhookAdapter = catalogAdapter(manifest);
