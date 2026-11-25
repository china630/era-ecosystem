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
  key: "vk_community",
  name: "VK Community",
  category: "MESSENGER",
  family: "bot_webhook_secret",
  regions: ["CIS"],
  tier: "P1",
  docsUrl: "https://dev.vk.com/ru/api/callback/getting-started",
  verified: "V",
  auth: "api_key",
  fields: [
    stringField("groupId", { ru: "Group ID", az: "Group ID", en: "Group ID" }, true),
    secretField("accessToken", {
      ru: "Community access token",
      az: "Access token",
      en: "Community access token",
    }),
    stringField("confirmationCode", {
      ru: "Confirmation string",
      az: "Confirmation",
      en: "Confirmation string",
    }, true),
    secretField("secretKey", { ru: "Callback secret", az: "Secret", en: "Callback secret" }),
    stringField("apiVersion", { ru: "API version", az: "API version", en: "API version" }),
  ],
  inbound: {
    mode: "webhook",
    events: ["message_new"],
    verify: "body.secret",
  },
  outbound: ["sendText"],
  capabilities: { media: false },
  rateLimit: { perSecond: 5 },
  setupSteps: {
    ru: ["Callback API → URL CRM", "confirmation + secret", "messages.send scope"],
    en: ["Callback API → CRM URL", "confirmation + secret", "messages.send scope"],
    az: ["Callback API → CRM URL", "confirmation + secret", "messages.send"],
  },
  autoRegisterWebhook: false,
};

function parseBody(req: RawRequest): Record<string, unknown> {
  try {
    return JSON.parse(req.rawBody.toString("utf8") || "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
}

export const vkCommunityAdapter: MessagingAdapter = {
  ...catalogAdapter(manifest, {
    async testConnection(ctx): Promise<TestResult> {
      const token = String(ctx.secrets.accessToken ?? "");
      const groupId = String(ctx.config.groupId ?? "");
      if (!token || !groupId) return { ok: false, message: "accessToken and groupId required" };
      const v = String(ctx.config.apiVersion ?? "5.199");
      const res = await ctx.http.request({
        method: "GET",
        url: `https://api.vk.com/method/groups.getById?group_id=${encodeURIComponent(groupId)}&access_token=${encodeURIComponent(token)}&v=${encodeURIComponent(v)}`,
      });
      const json = res.json as { response?: unknown; error?: { error_msg?: string } };
      if (json?.error) return { ok: false, message: json.error.error_msg ?? "VK error" };
      return { ok: true, message: "VK group ok", details: { json } };
    },
    handleChallenge(req, ctx) {
      const body = parseBody(req);
      if (String(body.type ?? "") !== "confirmation") return null;
      const code = String(ctx.config.confirmationCode ?? "");
      if (!code) return { status: 403, body: "confirmationCode missing" };
      return { status: 200, body: code };
    },
    verifyWebhook(req, ctx): VerifyResult {
      const body = parseBody(req);
      if (String(body.type ?? "") === "confirmation") return { ok: true };
      const expected = String(ctx.secrets.secretKey ?? ctx.webhookSecret ?? "");
      const got = body.secret != null ? String(body.secret) : "";
      if (!expected) return { ok: false, reason: "missing secretKey" };
      return safeEqual(got, expected)
        ? { ok: true }
        : { ok: false, reason: "secret mismatch" };
    },
    async normalize(req: RawRequest): Promise<NormalizedEvent[]> {
      const body = parseBody(req);
      if (String(body.type ?? "") !== "message_new") return [];
      const obj = (body.object as { message?: Record<string, unknown> } | undefined)?.message
        ?? (body.object as Record<string, unknown> | undefined);
      if (!obj) return [];
      const peerId = String(obj.peer_id ?? obj.from_id ?? "");
      if (!peerId) return [];
      return [
        {
          kind: "message.in",
          at: obj.date
            ? new Date(Number(obj.date) * 1000).toISOString()
            : new Date().toISOString(),
          chatId: peerId,
          contact: { handle: peerId },
          message: {
            externalId: obj.id != null ? String(obj.id) : undefined,
            type: "text",
            text: typeof obj.text === "string" ? obj.text : "",
          },
        },
      ];
    },
  }),
  async sendMessage(ctx: AdapterContext, msg: OutboundMessage) {
    const token = String(ctx.secrets.accessToken ?? "");
    if (!token) throw new Error("accessToken required");
    const v = String(ctx.config.apiVersion ?? "5.199");
    const randomId = Math.floor(Math.random() * 2_000_000_000);
    const url =
      `https://api.vk.com/method/messages.send?access_token=${encodeURIComponent(token)}` +
      `&v=${encodeURIComponent(v)}` +
      `&peer_id=${encodeURIComponent(msg.chatId)}` +
      `&random_id=${randomId}` +
      `&message=${encodeURIComponent(msg.text ?? "")}`;
    const res = await ctx.http.request({ method: "GET", url });
    const json = res.json as { response?: number; error?: { error_msg?: string } };
    if (json?.error) throw new Error(json.error.error_msg ?? "VK send failed");
    return { externalId: String(json.response ?? randomId), raw: res.json };
  },
};
