import { catalogAdapter, secretField, stringField } from "./_factory";
import { safeEqual } from "../crypto";
import type {
  MessagingAdapter,
  NormalizedEvent,
  ProviderManifest,
  RawRequest,
  TestResult,
  VerifyResult,
} from "../types";

const manifest: ProviderManifest = {
  key: "webchat",
  name: "Website webchat widget",
  category: "WEB_CHAT",
  family: "bot_webhook_secret",
  regions: ["GLOBAL"],
  tier: "P0",
  docsUrl: "https://era-365.online",
  verified: "V",
  auth: "api_key",
  fields: [
    stringField("allowedOrigins", {
      ru: "Allowed origins (comma)",
      az: "Allowed origins",
      en: "Allowed origins",
    }),
    secretField("webhookSecret", {
      ru: "Widget secret",
      az: "Widget secret",
      en: "Widget secret",
    }),
  ],
  inbound: { mode: "webhook", events: ["message"], verify: "x-webhook-secret header only" },
  outbound: ["sendText"],
  capabilities: { media: false },
  setupSteps: {
    ru: [
      "Создайте коннект",
      "Вставьте publicId в data-public-id виджета",
      "Передайте secret только как data-secret (заголовок x-webhook-secret) — не в query ?k= и не логируйте скрипт с секретом в публичный HTML",
    ],
    en: [
      "Create connection",
      "Set widget data-public-id",
      "Pass secret only as data-secret (x-webhook-secret header) — never ?k=; widget fetches /challenge math captcha before POST",
    ],
    az: [
      "Bağlantı yaradın",
      "data-public-id qoyun",
      "Secret yalnız data-secret (x-webhook-secret) — ?k= query istifadə etməyin; skripti secret ilə public HTML-də loglamayın",
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
  // query.k intentionally rejected (logs / Referer) — audit v3 §5.3
  return { ok: false, reason: "webchat secret mismatch" };
}

async function normalize(req: RawRequest): Promise<NormalizedEvent[]> {
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(req.rawBody.toString("utf8") || "{}") as Record<string, unknown>;
  } catch {
    return [];
  }
  const chatId = String(body.chatId ?? body.sessionId ?? body.phone ?? "webchat");
  const text = String(body.text ?? body.message ?? "");
  const at = new Date().toISOString();
  if (body.phone || body.email || body.name) {
    return [
      {
        kind: "lead.captured",
        at,
        source: "webchat",
        fields: Object.fromEntries(
          Object.entries(body).filter(([, v]) => typeof v === "string") as [string, string][],
        ),
        contact: {
          phone: body.phone ? String(body.phone) : undefined,
          email: body.email ? String(body.email) : undefined,
          name: body.name ? String(body.name) : undefined,
        },
      },
      ...(text
        ? [
            {
              kind: "message.in" as const,
              at,
              chatId,
              contact: {
                phone: body.phone ? String(body.phone) : undefined,
                name: body.name ? String(body.name) : undefined,
              },
              message: { type: "text", text },
            },
          ]
        : []),
    ];
  }
  return [
    {
      kind: "message.in",
      at,
      chatId,
      contact: { name: body.name ? String(body.name) : "Web visitor" },
      message: { type: "text", text },
    },
  ];
}

export const webchatAdapter: MessagingAdapter = {
  ...catalogAdapter(manifest, {
    async testConnection(ctx): Promise<TestResult> {
      return ctx.webhookSecret || ctx.secrets.webhookSecret
        ? { ok: true, message: "Webchat secret present" }
        : { ok: false, message: "webhookSecret required" };
    },
    verifyWebhook: verify,
    normalize,
  }),
  async sendMessage(_ctx, msg) {
    return { externalId: `webchat-out-${Date.now()}`, raw: { delivered: true, chatId: msg.chatId } };
  },
};
