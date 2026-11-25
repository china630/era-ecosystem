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
  key: "wa_twilio",
  name: "Twilio WhatsApp",
  category: "MESSENGER",
  family: "hmac_body",
  regions: ["AZ", "CIS", "GLOBAL"],
  tier: "P1",
  docsUrl: "https://www.twilio.com/docs/whatsapp",
  verified: "V",
  auth: "api_key",
  fields: [
    stringField("accountSid", { ru: "Account SID", az: "Account SID", en: "Account SID" }, true),
    secretField("authToken", { ru: "Auth token", az: "Auth token", en: "Auth token" }),
    stringField("fromNumber", {
      ru: "From (whatsapp:+…)",
      az: "From",
      en: "From (whatsapp:+…)",
    }, true),
  ],
  inbound: {
    mode: "webhook",
    events: ["message", "status"],
    verify: "X-Twilio-Signature",
  },
  outbound: ["sendText"],
  capabilities: { media: true },
  rateLimit: { perSecond: 10 },
  setupSteps: {
    ru: ["Twilio WA sandbox/number", "Account SID + Auth Token", "Webhook URL + signature"],
    en: ["Twilio WA sandbox/number", "Account SID + Auth Token", "Webhook URL + signature"],
    az: ["Twilio WA", "SID + Auth Token", "Webhook + signature"],
  },
  autoRegisterWebhook: false,
};

function headerStr(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

function parseForm(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of raw.split("&")) {
    const [k, v] = part.split("=");
    if (k) out[decodeURIComponent(k.replace(/\+/g, " "))] = decodeURIComponent((v ?? "").replace(/\+/g, " "));
  }
  return out;
}

/** Twilio signature: HMAC-SHA1(url + sorted params) base64. */
export function verifyTwilioSignature(
  authToken: string,
  signature: string | undefined,
  url: string,
  params: Record<string, string>,
): boolean {
  if (!signature || !authToken) return false;
  const data =
    url +
    Object.keys(params)
      .sort()
      .map((k) => k + params[k])
      .join("");
  const expected = createHmac("sha1", authToken).update(Buffer.from(data, "utf8")).digest("base64");
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export const twilioWhatsappAdapter: MessagingAdapter = {
  ...catalogAdapter(manifest, {
    async testConnection(ctx): Promise<TestResult> {
      const sid = String(ctx.config.accountSid ?? ctx.secrets.accountSid ?? "");
      const token = String(ctx.secrets.authToken ?? "");
      if (!sid || !token) return { ok: false, message: "accountSid and authToken required" };
      const basic = Buffer.from(`${sid}:${token}`).toString("base64");
      const res = await ctx.http.request({
        method: "GET",
        url: `https://api.twilio.com/2010-04-01/Accounts/${sid}.json`,
        headers: { Authorization: `Basic ${basic}` },
      });
      return res.status === 200
        ? { ok: true, message: "Twilio account ok", details: { json: res.json } }
        : { ok: false, message: `HTTP ${res.status}`, details: { body: res.text } };
    },
    verifyWebhook(req, ctx): VerifyResult {
      const token = String(ctx.secrets.authToken ?? "");
      const sig = headerStr(req.headers["x-twilio-signature"]);
      const params = parseForm(req.rawBody.toString("utf8") || "");
      const url = ctx.webhookUrl || String(req.query._url ?? "");
      return verifyTwilioSignature(token, sig, url, params)
        ? { ok: true }
        : { ok: false, reason: "twilio signature mismatch" };
    },
    async normalize(req: RawRequest): Promise<NormalizedEvent[]> {
      const params = parseForm(req.rawBody.toString("utf8") || "");
      const from = (params.From || "").replace(/^whatsapp:/, "");
      const body = params.Body || "";
      const sid = params.MessageSid || params.SmsMessageSid || "";
      if (!from && !sid) return [];
      if (params.MessageStatus && !body) {
        return [];
      }
      return [
        {
          kind: "message.in",
          at: new Date().toISOString(),
          chatId: from,
          contact: { phone: from },
          message: { externalId: sid || undefined, type: "text", text: body },
        },
      ];
    },
  }),
  async sendMessage(ctx: AdapterContext, msg: OutboundMessage) {
    const sid = String(ctx.config.accountSid ?? ctx.secrets.accountSid ?? "");
    const token = String(ctx.secrets.authToken ?? "");
    const from = String(ctx.config.fromNumber ?? "");
    if (!sid || !token || !from) throw new Error("accountSid/authToken/fromNumber required");
    const to = msg.chatId.startsWith("whatsapp:")
      ? msg.chatId
      : `whatsapp:${msg.chatId.startsWith("+") ? msg.chatId : `+${msg.chatId}`}`;
    const basic = Buffer.from(`${sid}:${token}`).toString("base64");
    const form = new URLSearchParams({
      From: from.startsWith("whatsapp:") ? from : `whatsapp:${from}`,
      To: to,
      Body: msg.text ?? "",
    });
    const res = await ctx.http.request({
      method: "POST",
      url: `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      headers: {
        Authorization: `Basic ${basic}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });
    if (res.status >= 300) throw new Error(`Twilio WA send failed: ${res.text}`);
    const json = res.json as { sid?: string };
    return { externalId: String(json.sid ?? ""), raw: res.json };
  },
};
