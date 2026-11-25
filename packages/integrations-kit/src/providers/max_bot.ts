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

const API = "https://platform-api2.max.ru";

const manifest: ProviderManifest = {
  key: "max_bot",
  name: "MAX Bot",
  category: "MESSENGER",
  family: "bot_webhook_secret",
  regions: ["CIS"],
  tier: "P1",
  docsUrl: "https://dev.max.ru/docs-api",
  verified: "V",
  auth: "api_key",
  fields: [
    secretField("accessToken", {
      ru: "Access token",
      az: "Access token",
      en: "Access token",
    }),
    secretField("webhookSecret", {
      ru: "Subscription secret",
      az: "Secret",
      en: "Subscription secret",
    }),
  ],
  inbound: {
    mode: "webhook",
    events: ["message_created", "bot_started"],
    verify: "X-Max-Bot-Api-Secret",
  },
  outbound: ["sendText"],
  capabilities: { media: true },
  rateLimit: { perSecond: 10 },
  setupSteps: {
    ru: ["Токен бота MAX", "subscriptions → CRM hooks", "HTTPS :443"],
    en: ["MAX bot token", "subscriptions → CRM hooks", "HTTPS :443"],
    az: ["MAX bot token", "subscriptions → CRM hooks", "HTTPS :443"],
  },
  autoRegisterWebhook: true,
};

function headerStr(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export const maxBotAdapter: MessagingAdapter = {
  ...catalogAdapter(manifest, {
    async testConnection(ctx): Promise<TestResult> {
      const token = String(ctx.secrets.accessToken ?? ctx.secrets.apiKey ?? "");
      if (!token) return { ok: false, message: "accessToken required" };
      const res = await ctx.http.request({
        method: "GET",
        url: `${API}/me`,
        headers: { Authorization: token },
      });
      return res.status === 200
        ? { ok: true, message: "MAX bot ok", details: { json: res.json } }
        : { ok: false, message: `HTTP ${res.status}`, details: { body: res.text } };
    },
    async onEnable(ctx) {
      const token = String(ctx.secrets.accessToken ?? "");
      const secret = String(ctx.secrets.webhookSecret ?? ctx.webhookSecret ?? "");
      if (!token || !ctx.webhookUrl || !secret) return;
      await ctx.http.request({
        method: "POST",
        url: `${API}/subscriptions`,
        headers: { Authorization: token, "content-type": "application/json" },
        body: {
          url: ctx.webhookUrl,
          update_types: ["message_created", "bot_started", "message_callback"],
          secret,
        },
      });
    },
    verifyWebhook(req, ctx): VerifyResult {
      const expected = String(ctx.secrets.webhookSecret ?? ctx.webhookSecret ?? "");
      const got = headerStr(req.headers["x-max-bot-api-secret"]);
      if (!expected) return { ok: false, reason: "missing webhookSecret" };
      return got && safeEqual(got, expected)
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
      const updateType = String(body.update_type ?? body.type ?? "");
      if (updateType !== "message_created" && updateType !== "bot_started") return [];
      const message = (body.message as Record<string, unknown> | undefined) ?? body;
      const sender = (message.sender as { user_id?: number; name?: string } | undefined)
        ?? (body.user as { user_id?: number; name?: string } | undefined);
      const chat = message.recipient as { chat_id?: number } | undefined;
      const chatId = String(
        chat?.chat_id ?? sender?.user_id ?? body.chat_id ?? "",
      );
      if (!chatId) return [];
      const textBody = message.body as { text?: string } | undefined;
      return [
        {
          kind: "message.in",
          at: body.timestamp
            ? new Date(Number(body.timestamp)).toISOString()
            : new Date().toISOString(),
          chatId,
          contact: {
            handle: sender?.user_id != null ? String(sender.user_id) : chatId,
            name: sender?.name,
          },
          message: {
            externalId: message.mid ? String(message.mid) : undefined,
            type: "text",
            text:
              textBody?.text ??
              (typeof message.text === "string" ? message.text : "") ??
              (updateType === "bot_started" ? "[bot_started]" : ""),
          },
        },
      ];
    },
  }),
  async sendMessage(ctx: AdapterContext, msg: OutboundMessage) {
    const token = String(ctx.secrets.accessToken ?? "");
    if (!token) throw new Error("accessToken required");
    const res = await ctx.http.request({
      method: "POST",
      url: `${API}/messages`,
      headers: { Authorization: token },
      body: {
        chat_id: Number(msg.chatId) || msg.chatId,
        text: msg.text ?? "",
      },
    });
    if (res.status >= 300) throw new Error(`MAX send failed: ${res.text}`);
    const json = res.json as { message?: { mid?: string }; mid?: string };
    return {
      externalId: String(json.message?.mid ?? json.mid ?? ""),
      raw: res.json,
    };
  },
};
