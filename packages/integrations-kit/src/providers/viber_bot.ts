import { createHmac, timingSafeEqual } from "node:crypto";
import { catalogAdapter, secretField, stringField } from "./_factory";
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
  key: "viber_bot",
  name: "Viber Bot",
  category: "MESSENGER",
  family: "hmac_body",
  regions: ["AZ", "CIS", "GLOBAL"],
  tier: "P1",
  docsUrl: "https://developers.viber.com/docs/api/rest-bot-api/",
  verified: "V",
  auth: "api_key",
  fields: [
    secretField("authToken", {
      ru: "X-Viber-Auth-Token",
      az: "X-Viber-Auth-Token",
      en: "X-Viber-Auth-Token",
    }),
    stringField("senderName", { ru: "Sender name", az: "Sender name", en: "Sender name" }, true),
    stringField("senderAvatarUrl", {
      ru: "Sender avatar URL",
      az: "Avatar URL",
      en: "Sender avatar URL",
    }),
  ],
  inbound: {
    mode: "webhook",
    events: ["message", "subscribed", "conversation_started"],
    verify: "X-Viber-Content-Signature HMAC-SHA256",
  },
  outbound: ["sendText"],
  capabilities: { media: true },
  rateLimit: { perSecond: 10 },
  setupSteps: {
    ru: [
      "Коммерческий бот Viber (партнёр / Rakuten)",
      "authToken + senderName",
      "set_webhook на CRM hooks URL",
    ],
    en: [
      "Commercial Viber bot (partner / Rakuten)",
      "authToken + senderName",
      "set_webhook to CRM hooks URL",
    ],
    az: ["Viber commercial bot", "authToken + senderName", "set_webhook CRM hooks URL"],
  },
  autoRegisterWebhook: true,
};

function authToken(ctx: AdapterContext): string {
  return String(ctx.secrets.authToken ?? ctx.secrets.apiKey ?? "");
}

function headerStr(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

function verifyViberSig(rawBody: Buffer, sig: string | undefined, token: string): boolean {
  if (!sig || !token) return false;
  const expected = createHmac("sha256", token).update(rawBody).digest("hex");
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(sig);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export const viberBotAdapter: MessagingAdapter = {
  ...catalogAdapter(manifest, {
    async testConnection(ctx): Promise<TestResult> {
      const token = authToken(ctx);
      if (!token) return { ok: false, message: "authToken required" };
      const res = await ctx.http.request({
        method: "POST",
        url: "https://chatapi.viber.com/pa/get_account_info",
        headers: { "X-Viber-Auth-Token": token },
        body: {},
      });
      const json = res.json as { status?: number; status_message?: string };
      return json?.status === 0
        ? { ok: true, message: "Viber account ok", details: { json } }
        : {
            ok: false,
            message: json?.status_message ?? `HTTP ${res.status}`,
            details: { body: res.text },
          };
    },
    async onEnable(ctx) {
      const token = authToken(ctx);
      if (!token || !ctx.webhookUrl) return;
      await ctx.http.request({
        method: "POST",
        url: "https://chatapi.viber.com/pa/set_webhook",
        headers: { "X-Viber-Auth-Token": token },
        body: {
          url: ctx.webhookUrl,
          event_types: [
            "delivered",
            "seen",
            "failed",
            "subscribed",
            "unsubscribed",
            "conversation_started",
          ],
          send_name: true,
          send_photo: true,
        },
      });
    },
    async onDisable(ctx) {
      const token = authToken(ctx);
      if (!token) return;
      await ctx.http.request({
        method: "POST",
        url: "https://chatapi.viber.com/pa/set_webhook",
        headers: { "X-Viber-Auth-Token": token },
        body: { url: "" },
      });
    },
    verifyWebhook(req, ctx): VerifyResult {
      const token = authToken(ctx);
      const sig = headerStr(req.headers["x-viber-content-signature"]);
      return verifyViberSig(req.rawBody, sig, token)
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
      const event = String(body.event ?? "");
      if (event !== "message" && event !== "conversation_started") return [];
      const sender = body.sender as { id?: string; name?: string } | undefined;
      const message = body.message as { text?: string; type?: string; media?: string } | undefined;
      const chatId = String(sender?.id ?? "");
      if (!chatId) return [];
      return [
        {
          kind: "message.in",
          at: body.timestamp
            ? new Date(Number(body.timestamp)).toISOString()
            : new Date().toISOString(),
          chatId,
          contact: { handle: chatId, name: sender?.name },
          message: {
            externalId: body.message_token ? String(body.message_token) : undefined,
            type: message?.type === "picture" ? "image" : "text",
            text: message?.text ?? (event === "conversation_started" ? "[started]" : ""),
            mediaUrl: message?.media,
          },
        },
      ];
    },
  }),
  async sendMessage(ctx: AdapterContext, msg: OutboundMessage) {
    const token = authToken(ctx);
    if (!token) throw new Error("authToken required");
    const res = await ctx.http.request({
      method: "POST",
      url: "https://chatapi.viber.com/pa/send_message",
      headers: { "X-Viber-Auth-Token": token },
      body: {
        receiver: msg.chatId,
        type: "text",
        text: msg.text ?? "",
        sender: {
          name: String(ctx.config.senderName ?? "ERA CRM"),
          avatar: ctx.config.senderAvatarUrl
            ? String(ctx.config.senderAvatarUrl)
            : undefined,
        },
      },
    });
    const json = res.json as { status?: number; message_token?: number; status_message?: string };
    if (json?.status !== 0) {
      throw new Error(json?.status_message ?? `Viber send failed: ${res.text}`);
    }
    return { externalId: String(json.message_token ?? ""), raw: res.json };
  },
};
