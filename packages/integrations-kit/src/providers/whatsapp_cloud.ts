import {
  catalogAdapter,
  secretField,
  stringField,
  verifyMetaHubSignature,
} from "./_factory";
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
  key: "whatsapp_cloud",
  name: "WhatsApp Cloud API",
  category: "MESSENGER",
  family: "meta_graph",
  regions: ["AZ", "CIS", "GLOBAL"],
  tier: "P0",
  docsUrl: "https://developers.facebook.com/docs/whatsapp/cloud-api",
  verified: "V",
  auth: "api_key",
  fields: [
    secretField("accessToken", {
      ru: "Access token",
      az: "Access token",
      en: "Access token",
    }),
    stringField(
      "phoneNumberId",
      { ru: "Phone number ID", az: "Phone number ID", en: "Phone number ID" },
      true,
    ),
    stringField("graphVersion", {
      ru: "Graph version",
      az: "Graph version",
      en: "Graph version",
    }),
    secretField("appSecret", { ru: "App secret", az: "App secret", en: "App secret" }),
    stringField("verifyToken", {
      ru: "Webhook verify token",
      az: "Webhook verify token",
      en: "Webhook verify token",
    }),
  ],
  inbound: {
    mode: "webhook",
    events: ["message", "status"],
    verify: "X-Hub-Signature-256",
  },
  outbound: ["sendText", "sendMedia", "sendTemplate"],
  capabilities: { templates: true, window24h: true, media: true },
  rateLimit: { perSecond: 10 },
  setupSteps: {
    ru: [
      "Создайте Meta App + WhatsApp product",
      "Укажите phoneNumberId, accessToken, appSecret, verifyToken",
      "Проверить → Включить; webhook URL скопируйте в Meta",
    ],
    en: [
      "Create Meta App + WhatsApp product",
      "Set phoneNumberId, accessToken, appSecret, verifyToken",
      "Test → Enable; paste webhook URL into Meta",
    ],
    az: [
      "Meta App + WhatsApp product yaradın",
      "phoneNumberId, accessToken, appSecret, verifyToken daxil edin",
      "Yoxla → Aktiv et; webhook URL-i Meta-ya yapışdırın",
    ],
  },
  autoRegisterWebhook: false,
};

function graphVersion(ctx: AdapterContext): string {
  const v = String(ctx.config.graphVersion ?? ctx.secrets.graphVersion ?? "v21.0");
  return v.startsWith("v") ? v : `v${v}`;
}

function phoneNumberId(ctx: AdapterContext): string {
  return String(ctx.config.phoneNumberId ?? ctx.secrets.phoneNumberId ?? "");
}

function accessToken(ctx: AdapterContext): string {
  return String(ctx.secrets.accessToken ?? ctx.secrets.apiKey ?? "");
}

async function normalizeWhatsApp(
  req: RawRequest,
  _ctx: AdapterContext,
): Promise<NormalizedEvent[]> {
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(req.rawBody.toString("utf8") || "{}") as Record<string, unknown>;
  } catch {
    return [];
  }
  const events: NormalizedEvent[] = [];
  const entries = (body.entry as unknown[]) ?? [];
  for (const entry of entries) {
    const changes =
      ((entry as { changes?: unknown[] }).changes as unknown[]) ?? [];
    for (const change of changes) {
      const value = (change as { value?: Record<string, unknown> }).value ?? {};
      const contacts = (value.contacts as { profile?: { name?: string }; wa_id?: string }[]) ?? [];
      const messages = (value.messages as Record<string, unknown>[]) ?? [];
      const statuses = (value.statuses as Record<string, unknown>[]) ?? [];
      for (const m of messages) {
        const from = String(m.from ?? "");
        const contact = contacts.find((c) => c.wa_id === from);
        const textObj = m.text as { body?: string } | undefined;
        events.push({
          kind: "message.in",
          at: m.timestamp
            ? new Date(Number(m.timestamp) * 1000).toISOString()
            : new Date().toISOString(),
          chatId: from,
          contact: {
            phone: from.startsWith("+") ? from : `+${from}`,
            name: contact?.profile?.name,
          },
          message: {
            externalId: m.id ? String(m.id) : undefined,
            type: String(m.type ?? "text"),
            text: textObj?.body,
            payload: m,
          },
        });
      }
      for (const s of statuses) {
        const statusRaw = String(s.status ?? "").toLowerCase();
        const status =
          statusRaw === "read"
            ? "READ"
            : statusRaw === "delivered"
              ? "DELIVERED"
              : statusRaw === "failed"
                ? "FAILED"
                : "SENT";
        events.push({
          kind: "message.status",
          externalId: String(s.id ?? ""),
          status,
          at: s.timestamp
            ? new Date(Number(s.timestamp) * 1000).toISOString()
            : new Date().toISOString(),
        });
      }
    }
  }
  return events;
}

export const whatsappCloudAdapter: MessagingAdapter = {
  ...catalogAdapter(manifest, {
    async testConnection(ctx): Promise<TestResult> {
      const token = accessToken(ctx);
      const phoneId = phoneNumberId(ctx);
      if (!token || !phoneId) {
        return { ok: false, message: "accessToken and phoneNumberId required" };
      }
      const url = `https://graph.facebook.com/${graphVersion(ctx)}/${phoneId}?fields=display_phone_number,verified_name`;
      const res = await ctx.http.request({
        method: "GET",
        url,
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status !== 200) {
        return {
          ok: false,
          message: `Graph phone lookup HTTP ${res.status}`,
          details: { body: res.text },
        };
      }
      return { ok: true, message: "WhatsApp Cloud phone ok", details: { json: res.json } };
    },
    handleChallenge(req, ctx) {
      const challenge = req.query["hub.challenge"];
      if (!challenge) return null;
      const token = req.query["hub.verify_token"];
      const expected = String(
        ctx.config.verifyToken ?? ctx.secrets.verifyToken ?? ctx.webhookSecret ?? "",
      );
      if (!expected || !token || token !== expected) {
        return { status: 403, body: "verify_token mismatch" };
      }
      return { status: 200, body: String(challenge) };
    },
    verifyWebhook(req, ctx): VerifyResult {
      const sig = Array.isArray(req.headers["x-hub-signature-256"])
        ? req.headers["x-hub-signature-256"][0]
        : req.headers["x-hub-signature-256"];
      const appSecret = ctx.secrets.appSecret || "";
      if (!appSecret) return { ok: false, reason: "missing appSecret" };
      if (verifyMetaHubSignature(req.rawBody, sig, appSecret)) return { ok: true };
      return { ok: false, reason: "X-Hub-Signature-256 mismatch" };
    },
    normalize: normalizeWhatsApp,
  }),
  async sendMessage(ctx: AdapterContext, msg: OutboundMessage) {
    const token = accessToken(ctx);
    const phoneId = phoneNumberId(ctx);
    if (!token || !phoneId) throw new Error("accessToken and phoneNumberId required");
    const to = msg.chatId.replace(/^\+/, "");
    let payload: Record<string, unknown>;
    if (msg.type === "template" && msg.templateName) {
      payload = {
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: msg.templateName,
          language: { code: String(msg.payload?.language ?? "en") },
        },
      };
    } else {
      payload = {
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: msg.text ?? "" },
      };
    }
    const url = `https://graph.facebook.com/${graphVersion(ctx)}/${phoneId}/messages`;
    const res = await ctx.http.request({
      method: "POST",
      url,
      headers: { Authorization: `Bearer ${token}` },
      body: payload,
    });
    if (res.status >= 300) {
      throw new Error(`WA send failed: ${res.text}`);
    }
    const json = res.json as { messages?: { id?: string }[] };
    return {
      externalId: String(json.messages?.[0]?.id ?? ""),
      raw: res.json,
    };
  },
};
