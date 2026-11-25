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
  key: "fb_messenger",
  name: "Facebook Messenger",
  category: "MESSENGER",
  family: "meta_graph",
  regions: ["AZ", "CIS", "GLOBAL"],
  tier: "P1",
  docsUrl: "https://developers.facebook.com/docs/messenger-platform",
  verified: "V",
  auth: "oauth",
  fields: [
    secretField("accessToken", {
      ru: "Page access token",
      az: "Page access token",
      en: "Page access token",
    }),
    stringField("pageId", { ru: "Page ID", az: "Page ID", en: "Page ID" }, true),
    secretField("appSecret", { ru: "App secret", az: "App secret", en: "App secret" }),
    stringField("verifyToken", {
      ru: "Verify token",
      az: "Verify token",
      en: "Verify token",
    }),
    stringField("graphVersion", {
      ru: "Graph version",
      az: "Graph version",
      en: "Graph version",
    }),
  ],
  inbound: { mode: "webhook", events: ["message"], verify: "X-Hub-Signature-256" },
  outbound: ["sendText"],
  capabilities: { media: true },
  rateLimit: { perSecond: 20 },
  setupSteps: {
    ru: ["Meta App + Messenger", "Page token + appSecret", "Webhook + verify token"],
    en: ["Meta App + Messenger", "Page token + appSecret", "Webhook + verify token"],
    az: ["Meta App + Messenger", "Page token + appSecret", "Webhook + verify token"],
  },
};

function graphVersion(ctx: AdapterContext): string {
  const v = String(ctx.config.graphVersion ?? "v21.0");
  return v.startsWith("v") ? v : `v${v}`;
}

function headerStr(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export const fbMessengerAdapter: MessagingAdapter = {
  ...catalogAdapter(manifest, {
    async testConnection(ctx): Promise<TestResult> {
      const token = String(ctx.secrets.accessToken ?? "");
      const pageId = String(ctx.config.pageId ?? "");
      if (!token || !pageId) return { ok: false, message: "accessToken and pageId required" };
      const res = await ctx.http.request({
        method: "GET",
        url: `https://graph.facebook.com/${graphVersion(ctx)}/${pageId}?fields=name`,
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.status === 200
        ? { ok: true, message: "Messenger page ok", details: { json: res.json } }
        : { ok: false, message: `Graph HTTP ${res.status}`, details: { body: res.text } };
    },
    handleChallenge(req, ctx) {
      const challenge = req.query["hub.challenge"];
      if (!challenge) return null;
      const expected = String(ctx.config.verifyToken ?? ctx.secrets.verifyToken ?? "");
      if (!expected || req.query["hub.verify_token"] !== expected) {
        return { status: 403, body: "verify_token mismatch" };
      }
      return { status: 200, body: String(challenge) };
    },
    verifyWebhook(req, ctx): VerifyResult {
      const sig = headerStr(req.headers["x-hub-signature-256"]);
      const appSecret = ctx.secrets.appSecret || "";
      if (!appSecret) return { ok: false, reason: "missing appSecret" };
      return verifyMetaHubSignature(req.rawBody, sig, appSecret)
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
      const events: NormalizedEvent[] = [];
      for (const entry of (body.entry as unknown[]) ?? []) {
        const messaging =
          ((entry as { messaging?: unknown[] }).messaging as Record<string, unknown>[]) ?? [];
        for (const m of messaging) {
          const sender = m.sender as { id?: string } | undefined;
          const message = m.message as { mid?: string; text?: string } | undefined;
          if (!sender?.id || !message) continue;
          events.push({
            kind: "message.in",
            at: m.timestamp
              ? new Date(Number(m.timestamp)).toISOString()
              : new Date().toISOString(),
            chatId: sender.id,
            contact: { handle: sender.id },
            message: {
              externalId: message.mid,
              type: "text",
              text: message.text,
            },
          });
        }
      }
      return events;
    },
  }),
  async sendMessage(ctx: AdapterContext, msg: OutboundMessage) {
    const token = String(ctx.secrets.accessToken ?? "");
    if (!token) throw new Error("accessToken required");
    const res = await ctx.http.request({
      method: "POST",
      url: `https://graph.facebook.com/${graphVersion(ctx)}/me/messages`,
      headers: { Authorization: `Bearer ${token}` },
      body: {
        recipient: { id: msg.chatId },
        message: { text: msg.text ?? "" },
      },
    });
    if (res.status >= 300) throw new Error(`Messenger send failed: ${res.text}`);
    const json = res.json as { message_id?: string };
    return { externalId: String(json.message_id ?? ""), raw: res.json };
  },
};
