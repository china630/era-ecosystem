import { catalogAdapter, secretField, stringField } from "./_factory";
import type {
  AdapterContext,
  MessagingAdapter,
  NormalizedEvent,
  OutboundMessage,
  ProviderManifest,
  RawRequest,
  TestResult,
} from "../types";

const manifest: ProviderManifest = {
  key: "gmail_api",
  name: "Gmail API",
  category: "EMAIL",
  family: "oauth2",
  regions: ["AZ", "CIS", "GLOBAL"],
  tier: "P1",
  docsUrl: "https://developers.google.com/gmail/api/guides/push",
  verified: "V",
  auth: "oauth2",
  fields: [
    secretField("accessToken", { ru: "Access token", az: "Access token", en: "Access token" }),
    secretField("refreshToken", {
      ru: "Refresh token",
      az: "Refresh token",
      en: "Refresh token",
    }),
    stringField("userId", { ru: "User (me)", az: "User", en: "User (me)" }),
  ],
  inbound: { mode: "webhook", events: ["message"], verify: "Pub/Sub push (OIDC planned)" },
  outbound: ["sendText"],
  capabilities: { media: false },
  rateLimit: { perSecond: 5 },
  setupSteps: {
    ru: ["Google OAuth (gmail.modify)", "Сохранить refresh token", "Включить — poller/history"],
    en: ["Google OAuth (gmail.modify)", "Store refresh token", "Enable — poller/history"],
    az: ["Google OAuth", "Refresh token saxla", "Aktiv et"],
  },
  autoRegisterWebhook: false,
};

function userId(ctx: AdapterContext): string {
  return String(ctx.config.userId ?? "me");
}

export const gmailApiAdapter: MessagingAdapter = {
  ...catalogAdapter(manifest, {
    async testConnection(ctx): Promise<TestResult> {
      const token = String(ctx.secrets.accessToken ?? "");
      if (!token) return { ok: false, message: "accessToken required (complete Google OAuth)" };
      const res = await ctx.http.request({
        method: "GET",
        url: `https://gmail.googleapis.com/gmail/v1/users/${userId(ctx)}/profile`,
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.status === 200
        ? { ok: true, message: "Gmail profile ok", details: { json: res.json } }
        : { ok: false, message: `Gmail HTTP ${res.status}`, details: { body: res.text } };
    },
    async normalize(req: RawRequest): Promise<NormalizedEvent[]> {
      // Pub/Sub push: base64 {emailAddress,historyId} — history.list worker planned (ADR §7.1).
      let body: Record<string, unknown> = {};
      try {
        body = JSON.parse(req.rawBody.toString("utf8") || "{}") as Record<string, unknown>;
      } catch {
        return [];
      }
      const messages = (body.messages as unknown[]) ?? [];
      const events: NormalizedEvent[] = [];
      for (const m of messages) {
        const msg = m as {
          id?: string;
          threadId?: string;
          from?: string;
          subject?: string;
          snippet?: string;
          internalDate?: string;
        };
        const chatId = String(msg.threadId ?? msg.from ?? msg.id ?? "");
        if (!chatId) continue;
        events.push({
          kind: "message.in",
          at: msg.internalDate
            ? new Date(Number(msg.internalDate)).toISOString()
            : new Date().toISOString(),
          chatId,
          contact: { email: msg.from, name: msg.from },
          message: {
            externalId: msg.id,
            type: "text",
            text: `Subject: ${msg.subject ?? ""}\n\n${msg.snippet ?? ""}`,
          },
        });
      }
      return events;
    },
  }),
  async sendMessage(ctx: AdapterContext, msg: OutboundMessage) {
    const token = String(ctx.secrets.accessToken ?? "");
    if (!token) throw new Error("accessToken required");
    const to = msg.chatId.includes("@") ? msg.chatId : String(msg.payload?.to ?? "");
    if (!to.includes("@")) throw new Error("chatId/to must be email");
    const subject = String(msg.payload?.subject ?? "Message from CRM");
    const raw = [
      `To: ${to}`,
      `Subject: ${subject}`,
      "Content-Type: text/plain; charset=utf-8",
      "",
      msg.text ?? "",
    ].join("\r\n");
    const encoded = Buffer.from(raw)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const res = await ctx.http.request({
      method: "POST",
      url: `https://gmail.googleapis.com/gmail/v1/users/${userId(ctx)}/messages/send`,
      headers: { Authorization: `Bearer ${token}` },
      body: { raw: encoded },
    });
    if (res.status >= 300) throw new Error(`Gmail send failed: ${res.text}`);
    const json = res.json as { id?: string };
    return { externalId: String(json.id ?? ""), raw: res.json };
  },
};
