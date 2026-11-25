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

const GRAPH = "https://graph.microsoft.com/v1.0";

const manifest: ProviderManifest = {
  key: "ms_graph_mail",
  name: "Microsoft Graph Mail",
  category: "EMAIL",
  family: "oauth2",
  regions: ["AZ", "CIS", "GLOBAL"],
  tier: "P1",
  docsUrl: "https://learn.microsoft.com/en-us/graph/api/resources/mail-api-overview",
  verified: "V",
  auth: "oauth2",
  fields: [
    secretField("accessToken", { ru: "Access token", az: "Access token", en: "Access token" }),
    secretField("refreshToken", {
      ru: "Refresh token",
      az: "Refresh token",
      en: "Refresh token",
    }),
    stringField("userId", { ru: "User id / me", az: "User", en: "User id / me" }),
  ],
  inbound: { mode: "webhook", events: ["message"], verify: "clientState + validationToken" },
  outbound: ["sendText"],
  capabilities: { media: false },
  rateLimit: { perSecond: 5 },
  setupSteps: {
    ru: ["Entra OAuth Mail.ReadWrite", "Refresh token", "Включить"],
    en: ["Entra OAuth Mail.ReadWrite", "Refresh token", "Enable"],
    az: ["Entra OAuth", "Refresh token", "Aktiv et"],
  },
  autoRegisterWebhook: false,
};

function userPath(ctx: AdapterContext): string {
  const id = String(ctx.config.userId ?? "me");
  return id === "me" ? "me" : `users/${id}`;
}

export const msGraphMailAdapter: MessagingAdapter = {
  ...catalogAdapter(manifest, {
    async testConnection(ctx): Promise<TestResult> {
      const token = String(ctx.secrets.accessToken ?? "");
      if (!token) return { ok: false, message: "accessToken required (complete Microsoft OAuth)" };
      const res = await ctx.http.request({
        method: "GET",
        url: `${GRAPH}/${userPath(ctx)}/mailboxSettings`,
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.status === 200
        ? { ok: true, message: "Graph mailbox ok", details: { json: res.json } }
        : { ok: false, message: `Graph HTTP ${res.status}`, details: { body: res.text } };
    },
    handleChallenge(req) {
      const token = req.query.validationToken;
      if (token != null) {
        return { status: 200, body: String(token) };
      }
      return null;
    },
    verifyWebhook(req, ctx) {
      const expected = String(ctx.secrets.clientState ?? ctx.webhookSecret ?? "");
      if (!expected) return { ok: true };
      let body: Record<string, unknown> = {};
      try {
        body = JSON.parse(req.rawBody.toString("utf8") || "{}") as Record<string, unknown>;
      } catch {
        return { ok: true };
      }
      const values = (body.value as Array<{ clientState?: string }>) ?? [];
      const ok = values.every((v) => !v.clientState || v.clientState === expected);
      return ok ? { ok: true } : { ok: false, reason: "clientState mismatch" };
    },
    respond(_events, req) {
      const token = req.query.validationToken;
      if (token != null) {
        return {
          status: 200,
          body: String(token),
          contentType: "text/plain",
        };
      }
      return { status: 202, body: "" };
    },
    async normalize(req: RawRequest): Promise<NormalizedEvent[]> {
      let body: Record<string, unknown> = {};
      try {
        body = JSON.parse(req.rawBody.toString("utf8") || "{}") as Record<string, unknown>;
      } catch {
        return [];
      }
      const value = (body.value as unknown[]) ?? (body.messages as unknown[]) ?? [];
      const events: NormalizedEvent[] = [];
      for (const item of value) {
        const m = item as {
          id?: string;
          conversationId?: string;
          subject?: string;
          bodyPreview?: string;
          from?: { emailAddress?: { address?: string; name?: string } };
          receivedDateTime?: string;
        };
        const email = m.from?.emailAddress?.address;
        const chatId = String(m.conversationId ?? email ?? m.id ?? "");
        if (!chatId) continue;
        events.push({
          kind: "message.in",
          at: m.receivedDateTime ?? new Date().toISOString(),
          chatId,
          contact: { email, name: m.from?.emailAddress?.name },
          message: {
            externalId: m.id,
            type: "text",
            text: `Subject: ${m.subject ?? ""}\n\n${m.bodyPreview ?? ""}`,
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
    const res = await ctx.http.request({
      method: "POST",
      url: `${GRAPH}/${userPath(ctx)}/sendMail`,
      headers: { Authorization: `Bearer ${token}` },
      body: {
        message: {
          subject: String(msg.payload?.subject ?? "Message from CRM"),
          body: { contentType: "Text", content: msg.text ?? "" },
          toRecipients: [{ emailAddress: { address: to } }],
        },
        saveToSentItems: true,
      },
    });
    if (res.status >= 300) throw new Error(`Graph sendMail failed: ${res.text}`);
    return { externalId: `ms-${Date.now()}`, raw: res.json ?? { status: res.status } };
  },
};
