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
import { verifyTelegramSecretToken } from "./_factory";

const manifest: ProviderManifest = {
  key: "telegram_bot",
  name: "Telegram Bot",
  category: "MESSENGER",
  family: "bot_webhook_secret",
  regions: ["AZ", "CIS", "GLOBAL"],
  tier: "P0",
  docsUrl: "https://core.telegram.org/bots/api",
  verified: "V",
  auth: "api_key",
  fields: [
    secretField("botToken", { ru: "Токен бота", az: "Bot tokeni", en: "Bot token" }),
    stringField("businessConnectionId", {
      ru: "Business connection id (optional)",
      az: "Business connection id",
      en: "Business connection id",
    }),
  ],
  inbound: {
    mode: "webhook",
    events: ["message", "business_message"],
    verify: "X-Telegram-Bot-Api-Secret-Token",
  },
  outbound: ["sendText"],
  capabilities: { media: true, business: true },
  rateLimit: { perSecond: 30 },
  setupSteps: {
    ru: [
      "Создайте бота у @BotFather и скопируйте token",
      "Вставьте token, нажмите Проверить",
      "Включите — setWebhook с secret_token зарегистрируется автоматически",
    ],
    en: [
      "Create a bot via @BotFather and copy the token",
      "Paste token, click Test",
      "Enable — setWebhook with secret_token is registered automatically",
    ],
    az: [
      "BotFather ilə bot yaradın və tokeni kopyalayın",
      "Tokeni yapışdırın, Yoxla basın",
      "Aktiv et — setWebhook secret_token ilə avtomatik yazılacaq",
    ],
  },
  autoRegisterWebhook: true,
};

function botToken(ctx: AdapterContext): string {
  return String(ctx.secrets.botToken ?? ctx.secrets.apiKey ?? "");
}

function api(ctx: AdapterContext, method: string) {
  return `https://api.telegram.org/bot${botToken(ctx)}/${method}`;
}

async function normalizeTelegram(
  req: RawRequest,
  _ctx: AdapterContext,
): Promise<NormalizedEvent[]> {
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(req.rawBody.toString("utf8") || "{}") as Record<string, unknown>;
  } catch {
    return [];
  }
  const msg =
    (body.message as Record<string, unknown> | undefined) ||
    (body.business_message as Record<string, unknown> | undefined) ||
    (body.edited_message as Record<string, unknown> | undefined);
  if (!msg) return [];
  const chat = msg.chat as { id?: number | string } | undefined;
  const from = msg.from as { id?: number; username?: string; first_name?: string } | undefined;
  const chatId = String(chat?.id ?? "");
  if (!chatId) return [];
  const text =
    typeof msg.text === "string"
      ? msg.text
      : typeof msg.caption === "string"
        ? msg.caption
        : "";
  const at = msg.date
    ? new Date(Number(msg.date) * 1000).toISOString()
    : new Date().toISOString();
  return [
    {
      kind: "message.in",
      at,
      chatId,
      contact: {
        handle: from?.username ? `@${from.username}` : undefined,
        name: from?.first_name,
      },
      message: {
        externalId: msg.message_id != null ? String(msg.message_id) : undefined,
        type: "text",
        text,
        payload: {
          business_connection_id: body.business_connection_id,
          update_id: body.update_id,
        },
      },
    },
  ];
}

export const telegramBotAdapter: MessagingAdapter = {
  ...catalogAdapter(manifest, {
    async testConnection(ctx): Promise<TestResult> {
      const token = botToken(ctx);
      if (!token) return { ok: false, message: "botToken required" };
      const res = await ctx.http.request({ method: "GET", url: api(ctx, "getMe") });
      if (res.status !== 200) {
        return { ok: false, message: `getMe HTTP ${res.status}`, details: { body: res.text } };
      }
      const ok = Boolean((res.json as { ok?: boolean } | null)?.ok);
      return {
        ok,
        message: ok ? "Telegram getMe ok" : "Telegram getMe failed",
        details: { json: res.json },
      };
    },
    async onEnable(ctx) {
      const token = botToken(ctx);
      if (!token) throw new Error("botToken required");
      if (!ctx.webhookUrl) throw new Error("webhookUrl required");
      const secret = ctx.webhookSecret || ctx.secrets.webhookSecret;
      if (!secret) throw new Error("webhookSecret required for setWebhook");
      const res = await ctx.http.request({
        method: "POST",
        url: api(ctx, "setWebhook"),
        body: {
          url: ctx.webhookUrl,
          secret_token: secret,
          allowed_updates: ["message", "edited_message", "business_message", "callback_query"],
        },
      });
      if (res.status !== 200 || !(res.json as { ok?: boolean } | null)?.ok) {
        throw new Error(`setWebhook failed: ${res.text}`);
      }
    },
    async onDisable(ctx) {
      const token = botToken(ctx);
      if (!token) return;
      await ctx.http.request({ method: "POST", url: api(ctx, "deleteWebhook"), body: {} });
    },
    verifyWebhook(req, ctx): VerifyResult {
      const header = Array.isArray(req.headers["x-telegram-bot-api-secret-token"])
        ? req.headers["x-telegram-bot-api-secret-token"][0]
        : req.headers["x-telegram-bot-api-secret-token"];
      const secret = ctx.webhookSecret || ctx.secrets.webhookSecret || "";
      if (verifyTelegramSecretToken(header, secret)) return { ok: true };
      return { ok: false, reason: "telegram secret_token mismatch" };
    },
    normalize: normalizeTelegram,
  }),
  async sendMessage(ctx: AdapterContext, msg: OutboundMessage) {
    const token = botToken(ctx);
    if (!token) throw new Error("botToken required");
    const body: Record<string, unknown> = {
      chat_id: msg.chatId,
      text: msg.text ?? "",
    };
    const businessId =
      msg.payload?.business_connection_id ||
      ctx.config.businessConnectionId ||
      ctx.secrets.businessConnectionId;
    if (businessId) body.business_connection_id = businessId;
    const res = await ctx.http.request({
      method: "POST",
      url: api(ctx, "sendMessage"),
      body,
    });
    if (res.status !== 200 || !(res.json as { ok?: boolean } | null)?.ok) {
      throw new Error(`sendMessage failed: ${res.text}`);
    }
    const result = res.json as {
      result?: { message_id?: number };
    };
    return {
      externalId: String(result.result?.message_id ?? ""),
      raw: res.json,
    };
  },
};
