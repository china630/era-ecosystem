import { catalogAdapter, secretField, stringField } from "./_factory";
import { safeEqual } from "../crypto";
import type {
  AdapterContext,
  MessagingAdapter,
  NormalizedEvent,
  OutboundMessage,
  ProviderManifest,
  RawRequest,
  TestResult,
  VerifyResult,
} from "../types";

const manifest: ProviderManifest = {
  key: "sms_generic",
  name: "Generic SMS HTTP",
  category: "SMS",
  regions: ["AZ", "CIS", "GLOBAL"],
  tier: "P0",
  docsUrl: "#sms-generic-http",
  verified: "V",
  auth: "api_key",
  fields: [
    secretField("apiKey", { ru: "API key", az: "API key", en: "API key" }),
    stringField(
      "sendUrl",
      { ru: "Send URL (POST)", az: "Send URL (POST)", en: "Send URL (POST)" },
      true,
    ),
    stringField(
      "balanceUrl",
      { ru: "Balance URL (GET, optional)", az: "Balance URL (GET)", en: "Balance URL (GET, optional)" },
      false,
    ),
    secretField("webhookSecret", {
      ru: "Webhook secret",
      az: "Webhook secret",
      en: "Webhook secret",
    }),
  ],
  inbound: { mode: "webhook", events: ["message", "dlr"], verify: "x-webhook-secret" },
  outbound: ["sendText"],
  capabilities: { deliveryReport: true },
  rateLimit: { perSecond: 10 },
  setupSteps: {
    ru: [
      "См. docs/adr/crm/01-integrations-architecture.md (SMS generic HTTP)",
      "sendUrl POST + apiKey; balanceUrl необязателен",
      "Webhook: заголовок x-webhook-secret",
    ],
    en: [
      "See docs/adr/crm/01-integrations-architecture.md (SMS generic HTTP)",
      "sendUrl POST + apiKey; balanceUrl optional",
      "Webhook: x-webhook-secret header",
    ],
    az: [
      "docs/adr/crm/01-integrations-architecture.md (SMS generic HTTP)",
      "sendUrl POST + apiKey; balanceUrl istəyə görə",
      "Webhook: x-webhook-secret header",
    ],
  },
  autoRegisterWebhook: false,
};

function verify(req: RawRequest, ctx: { webhookSecret: string; secrets: Record<string, string> }): VerifyResult {
  const secret = ctx.secrets.webhookSecret || ctx.webhookSecret;
  if (!secret) return { ok: false, reason: "missing webhookSecret" };
  const header = Array.isArray(req.headers["x-webhook-secret"])
    ? req.headers["x-webhook-secret"][0]
    : req.headers["x-webhook-secret"];
  if (header && safeEqual(header, secret)) return { ok: true };
  return { ok: false, reason: "webhook secret mismatch" };
}

async function normalize(req: RawRequest): Promise<NormalizedEvent[]> {
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(req.rawBody.toString("utf8") || "{}") as Record<string, unknown>;
  } catch {
    return [];
  }
  const status = body.status ?? body.delivery_status ?? body.dlr_status;
  if (status != null) {
    const raw = String(status).toUpperCase();
    const mapped =
      /FAIL|REJECT|UNDELIV/i.test(raw)
        ? "FAILED"
        : /DELIV|SUCCESS|OK/i.test(raw)
          ? "DELIVERED"
          : "SENT";
    return [
      {
        kind: "message.status",
        at: new Date().toISOString(),
        externalId: String(body.message_id ?? body.id ?? body.msg_id ?? ""),
        status: mapped,
      },
    ];
  }
  const text = String(body.text ?? body.message ?? body.sms ?? "");
  const chatId = String(body.msisdn ?? body.to ?? body.phone ?? body.chat_id ?? "");
  if (!chatId && !text) return [];
  return [
    {
      kind: "message.in",
      at: new Date().toISOString(),
      chatId,
      contact: { phone: chatId },
      message: { text, type: "text" },
    },
  ];
}

export const smsGenericAdapter: MessagingAdapter = {
  ...catalogAdapter(manifest, {
    async testConnection(ctx): Promise<TestResult> {
      const balanceUrl = String(ctx.config.balanceUrl ?? "").trim();
      const apiKey = ctx.secrets.apiKey;
      if (!apiKey) return { ok: false, message: "apiKey required" };
      if (!balanceUrl) {
        return { ok: true, message: "apiKey present (no balanceUrl configured)" };
      }
      const res = await ctx.http.request({
        method: "GET",
        url: balanceUrl,
        headers: { Authorization: `Bearer ${apiKey}`, "X-Api-Key": apiKey },
      });
      if (res.status >= 300) {
        return { ok: false, message: `balance HTTP ${res.status}`, details: { body: res.text } };
      }
      return { ok: true, message: "balance ok", details: { json: res.json } };
    },
    verifyWebhook: verify,
    normalize,
  }),
  async sendMessage(ctx: AdapterContext, msg: OutboundMessage) {
    const sendUrl = String(ctx.config.sendUrl ?? "").trim();
    const apiKey = ctx.secrets.apiKey;
    if (!sendUrl || !apiKey) throw new Error("sendUrl and apiKey required");
    const res = await ctx.http.request({
      method: "POST",
      url: sendUrl,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "X-Api-Key": apiKey,
      },
      body: {
        to: msg.chatId,
        text: msg.text ?? "",
        msisdn: msg.chatId,
        message: msg.text ?? "",
      },
    });
    if (res.status >= 300) throw new Error(`SMS send failed: ${res.text}`);
    const ext =
      (res.json as { id?: string; message_id?: string } | undefined)?.id ??
      (res.json as { message_id?: string } | undefined)?.message_id ??
      `sms-gen-${Date.now()}`;
    return { externalId: String(ext), raw: res.json ?? res.text };
  },
};