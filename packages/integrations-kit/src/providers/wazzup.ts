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

const API = "https://api.wazzup24.com/v3";

const manifest: ProviderManifest = {
  key: "wazzup",
  name: "Wazzup aggregator",
  category: "MESSENGER",
  family: "bot_webhook_secret",
  regions: ["AZ", "CIS", "GLOBAL"],
  tier: "P1",
  docsUrl: "https://wazzup24.ru/help/api-ru/webhooks-2/",
  verified: "C",
  auth: "api_key",
  fields: [
    secretField("apiKey", { ru: "API key", az: "API key", en: "API key" }),
    stringField("channelId", { ru: "Default channelId", az: "channelId", en: "Default channelId" }),
    secretField("webhookSecret", {
      ru: "Webhook secret (optional)",
      az: "Webhook secret",
      en: "Webhook secret (optional)",
    }),
  ],
  inbound: { mode: "webhook", events: ["messagesAndStatuses"], verify: "secret or Bearer" },
  outbound: ["sendText"],
  capabilities: { media: true },
  rateLimit: { perSecond: 10 },
  setupSteps: {
    ru: ["API key Wazzup", "PATCH /v3/webhooks → CRM hooks", "channelId для исходящих"],
    en: ["Wazzup API key", "PATCH /v3/webhooks → CRM hooks", "channelId for outbound"],
    az: ["Wazzup API key", "webhooks → CRM", "channelId"],
  },
  autoRegisterWebhook: true,
};

function headerStr(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export const wazzupAdapter: MessagingAdapter = {
  ...catalogAdapter(manifest, {
    async testConnection(ctx): Promise<TestResult> {
      const key = String(ctx.secrets.apiKey ?? "");
      if (!key) return { ok: false, message: "apiKey required" };
      const res = await ctx.http.request({
        method: "GET",
        url: `${API}/channels`,
        headers: { Authorization: `Bearer ${key}` },
      });
      return res.status === 200
        ? { ok: true, message: "Wazzup channels ok", details: { json: res.json } }
        : { ok: false, message: `HTTP ${res.status}`, details: { body: res.text } };
    },
    async onEnable(ctx) {
      const key = String(ctx.secrets.apiKey ?? "");
      if (!key || !ctx.webhookUrl) return;
      await ctx.http.request({
        method: "PATCH",
        url: `${API}/webhooks`,
        headers: { Authorization: `Bearer ${key}` },
        body: {
          webhooksUri: ctx.webhookUrl,
          subscriptions: {
            messagesAndStatuses: true,
            contactsAndDealsCreation: false,
            channelsUpdates: false,
            templateStatus: false,
          },
        },
      });
    },
    verifyWebhook(req, ctx): VerifyResult {
      const secret = String(ctx.secrets.webhookSecret ?? ctx.webhookSecret ?? "");
      if (!secret) return { ok: true }; // Wazzup often IP-only; optional secret
      const got =
        headerStr(req.headers["x-wazzup-signature"]) ||
        headerStr(req.headers["x-webhook-secret"]) ||
        req.query.k;
      return got && safeEqual(String(got), secret)
        ? { ok: true }
        : { ok: false, reason: "signature mismatch" };
    },
    async normalize(req: RawRequest): Promise<NormalizedEvent[]> {
      let body: Record<string, unknown> = {};
      try {
        body = JSON.parse(req.rawBody.toString("utf8") || "{}") as Record<string, unknown>;
      } catch {
        return [];
      }
      const items = (body.messages as unknown[]) ?? (Array.isArray(body) ? body : [body]);
      const events: NormalizedEvent[] = [];
      for (const item of items) {
        const m = item as {
          messageId?: string;
          chatId?: string;
          chatType?: string;
          text?: string;
          status?: string;
          contact?: { name?: string; phone?: string };
          dateTime?: string;
        };
        if (!m.chatId && !m.text) continue;
        if (m.status && !m.text) continue;
        events.push({
          kind: "message.in",
          at: m.dateTime ?? new Date().toISOString(),
          chatId: String(m.chatId ?? ""),
          contact: {
            phone: m.contact?.phone,
            name: m.contact?.name,
            handle: m.chatId,
          },
          message: {
            externalId: m.messageId,
            type: "text",
            text: m.text ?? "",
          },
        });
      }
      return events;
    },
  }),
  async sendMessage(ctx: AdapterContext, msg: OutboundMessage) {
    const key = String(ctx.secrets.apiKey ?? "");
    const channelId = String(
      msg.payload?.channelId ?? ctx.config.channelId ?? "",
    );
    if (!key) throw new Error("apiKey required");
    if (!channelId) throw new Error("channelId required");
    const res = await ctx.http.request({
      method: "POST",
      url: `${API}/message`,
      headers: { Authorization: `Bearer ${key}` },
      body: {
        channelId,
        chatId: msg.chatId,
        chatType: String(msg.payload?.chatType ?? "whatsapp"),
        text: msg.text ?? "",
      },
    });
    if (res.status >= 300) throw new Error(`Wazzup send failed: ${res.text}`);
    const json = res.json as { messageId?: string };
    return { externalId: String(json.messageId ?? ""), raw: res.json };
  },
};
