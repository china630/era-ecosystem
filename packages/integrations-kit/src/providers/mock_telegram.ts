import { catalogAdapter, secretField, verifyTelegramSecretToken } from "./_factory";
import type {
  MessagingAdapter,
  NormalizedEvent,
  ProviderManifest,
  RawRequest,
  TestResult,
  VerifyResult,
} from "../types";

const manifest: ProviderManifest = {
  key: "mock_telegram",
  name: "Mock Telegram (local UAT)",
  category: "MESSENGER",
  family: "bot_webhook_secret",
  regions: ["GLOBAL"],
  tier: "P0",
  docsUrl: "https://core.telegram.org/bots/api",
  verified: "V",
  auth: "api_key",
  fields: [
    secretField("botToken", { ru: "Mock token", az: "Mock token", en: "Mock token" }),
  ],
  inbound: { mode: "webhook", events: ["message"], verify: "X-Telegram-Bot-Api-Secret-Token" },
  outbound: ["sendText"],
  capabilities: { media: false },
  rateLimit: { perSecond: 50 },
  setupSteps: {
    ru: ["Создайте коннект", "Скопируйте webhook URL", "POST JSON {message:{chat:{id},text}} с заголовком secret"],
    en: ["Create connection", "Copy webhook URL", "POST JSON with secret header"],
    az: ["Bağlantı yaradın", "Webhook URL kopyalayın", "Secret header ilə POST"],
  },
  autoRegisterWebhook: false,
};

async function normalize(req: RawRequest): Promise<NormalizedEvent[]> {
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(req.rawBody.toString("utf8") || "{}") as Record<string, unknown>;
  } catch {
    return [];
  }
  const msg = (body.message as Record<string, unknown> | undefined) ?? body;
  const chat = (msg.chat as { id?: unknown } | undefined) ?? {};
  const chatId = String(chat.id ?? body.chatId ?? "mock-chat");
  const text = String(msg.text ?? body.text ?? "");
  return [
    {
      kind: "message.in",
      at: new Date().toISOString(),
      chatId,
      contact: {
        phone: body.phone ? String(body.phone) : undefined,
        name: body.name ? String(body.name) : "Mock user",
      },
      message: {
        externalId: msg.message_id != null ? String(msg.message_id) : undefined,
        type: "text",
        text,
      },
    },
  ];
}

export const mockTelegramAdapter: MessagingAdapter = {
  ...catalogAdapter(manifest, {
    async testConnection(ctx): Promise<TestResult> {
      if (!ctx.webhookSecret && !ctx.secrets.webhookSecret) {
        return { ok: false, message: "webhookSecret required" };
      }
      return { ok: true, message: "Mock Telegram ready" };
    },
    verifyWebhook(req, ctx): VerifyResult {
      const header = Array.isArray(req.headers["x-telegram-bot-api-secret-token"])
        ? req.headers["x-telegram-bot-api-secret-token"][0]
        : req.headers["x-telegram-bot-api-secret-token"];
      const secret = ctx.webhookSecret || ctx.secrets.webhookSecret || "";
      if (verifyTelegramSecretToken(header, secret)) return { ok: true };
      if (req.query.k && secret && req.query.k === secret) return { ok: true };
      return { ok: false, reason: "mock secret mismatch" };
    },
    normalize,
  }),
  async sendMessage(_ctx, msg) {
    return { externalId: `mock-${Date.now()}`, raw: { ok: true, chatId: msg.chatId } };
  },
};
