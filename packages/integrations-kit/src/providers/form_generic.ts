import { catalogAdapter, secretField } from "./_factory";
import { safeEqual } from "../crypto";
import type {
  BaseAdapter,
  NormalizedEvent,
  ProviderManifest,
  RawRequest,
  TestResult,
  VerifyResult,
} from "../types";

const manifest: ProviderManifest = {
  key: "form_generic",
  name: "Generic lead form webhook",
  category: "LEAD_FORM",
  family: "bot_webhook_secret",
  regions: ["GLOBAL"],
  tier: "P0",
  docsUrl: "https://era-365.online",
  verified: "V",
  auth: "api_key",
  fields: [
    secretField("webhookSecret", {
      ru: "Form secret",
      az: "Form secret",
      en: "Form secret",
    }),
  ],
  inbound: {
    mode: "webhook",
    events: ["lead"],
    verify: "x-webhook-secret + math captcha",
  },
  outbound: [],
  capabilities: {},
  setupSteps: {
    ru: [
      "Создайте коннект",
      "POST на webhook URL с заголовком x-webhook-secret (не ?k=)",
      "Сначала GET …/challenge, в теле challengeToken + challengeAnswer",
      "Поля phone/email/name/utm_*",
    ],
    en: [
      "Create connection",
      "POST webhook URL with x-webhook-secret header (not ?k=)",
      "GET …/challenge first; body needs challengeToken + challengeAnswer",
      "Fields phone/email/name/utm_*",
    ],
    az: [
      "Bağlantı yaradın",
      "Webhook URL-ə x-webhook-secret header ilə POST (?k= yox)",
      "Əvvəl GET …/challenge; body-də challengeToken + challengeAnswer",
      "phone/email/name/utm_*",
    ],
  },
};

function verify(req: RawRequest, ctx: { webhookSecret: string; secrets: Record<string, string> }): VerifyResult {
  const secret = ctx.secrets.webhookSecret || ctx.webhookSecret;
  if (!secret) return { ok: false, reason: "missing webhookSecret" };
  const header = Array.isArray(req.headers["x-webhook-secret"])
    ? req.headers["x-webhook-secret"][0]
    : req.headers["x-webhook-secret"];
  if (header && safeEqual(header, secret)) return { ok: true };
  return { ok: false, reason: "form secret mismatch" };
}

async function normalize(req: RawRequest): Promise<NormalizedEvent[]> {
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(req.rawBody.toString("utf8") || "{}") as Record<string, unknown>;
  } catch {
    return [];
  }
  const fields: Record<string, string> = {};
  for (const [k, v] of Object.entries(body)) {
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      fields[k] = String(v);
    }
  }
  return [
    {
      kind: "lead.captured",
      at: new Date().toISOString(),
      source: "form_generic",
      fields,
      contact: {
        phone: fields.phone || fields.contactPhone,
        email: fields.email || fields.contactEmail,
        name: fields.name || fields.contactName,
      },
      utm: {
        utm_source: fields.utm_source ?? "",
        utm_medium: fields.utm_medium ?? "",
        utm_campaign: fields.utm_campaign ?? "",
      },
    },
  ];
}

export const formGenericAdapter: BaseAdapter = catalogAdapter(manifest, {
  async testConnection(ctx): Promise<TestResult> {
    return ctx.webhookSecret || ctx.secrets.webhookSecret
      ? { ok: true, message: "Form webhook secret present" }
      : { ok: false, message: "webhookSecret required" };
  },
  verifyWebhook: verify,
  normalize,
});
