/**
 * I-4: Meta CAPI, GA4 MP, Twilio SMS, 3CX, ERA externalcall public telephony face.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { catalogAdapter, secretField, stringField } from "./_factory";
import { safeEqual } from "../crypto";
import { verifyTwilioSignature } from "./wa_twilio";
import type {
  AdapterContext,
  BaseAdapter,
  MessagingAdapter,
  NormalizedEvent,
  OutboundMessage,
  ProviderManifest,
  RawRequest,
  TelephonyAdapter,
  TestResult,
  VerifyResult,
} from "../types";

function headerStr(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

function parseForm(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of raw.split("&")) {
    const [k, v] = part.split("=");
    if (k) {
      out[decodeURIComponent(k.replace(/\+/g, " "))] = decodeURIComponent(
        (v ?? "").replace(/\+/g, " "),
      );
    }
  }
  return out;
}

export const metaCapiAdapter: BaseAdapter = catalogAdapter(
  {
    key: "meta_capi",
    name: "Meta Conversions API",
    category: "ADS",
    regions: ["AZ", "CIS", "GLOBAL"],
    tier: "P2",
    docsUrl: "https://developers.facebook.com/docs/marketing-api/conversions-api",
    verified: "V",
    auth: "api_key",
    fields: [
      stringField("pixelId", { ru: "Pixel / dataset id", az: "Pixel id", en: "Pixel / dataset id" }, true),
      secretField("accessToken", {
        ru: "Access token",
        az: "Access token",
        en: "Access token",
      }),
    ],
    inbound: { mode: "none", events: [], verify: "n/a" },
    outbound: [],
    capabilities: {},
    setupSteps: {
      ru: ["Pixel id + token", "CRM шлёт Lead/Purchase при WON", "Хэш PII SHA-256"],
      en: ["Pixel id + token", "CRM sends Lead/Purchase on WON", "Hash PII SHA-256"],
      az: ["Pixel id + token", "WON → Lead/Purchase", "PII SHA-256"],
    },
  } satisfies ProviderManifest,
  {
    async testConnection(ctx): Promise<TestResult> {
      const pixelId = String(ctx.config.pixelId ?? "");
      const token = String(ctx.secrets.accessToken ?? "");
      if (!pixelId || !token) return { ok: false, message: "pixelId/accessToken required" };
      return { ok: true, message: "Meta CAPI credentials present" };
    },
  },
);

/** Fire a Conversions API event (used by CRM convert hooks). */
export async function metaCapiSendEvent(
  ctx: AdapterContext,
  event: {
    eventName: string;
    eventTime?: number;
    emails?: string[];
    phones?: string[];
    value?: number;
    currency?: string;
  },
): Promise<unknown> {
  const pixelId = String(ctx.config.pixelId ?? "");
  const token = String(ctx.secrets.accessToken ?? "");
  if (!pixelId || !token) throw new Error("pixelId/accessToken required");
  const { createHash } = await import("node:crypto");
  const hash = (v?: string) =>
    v ? createHash("sha256").update(v.trim().toLowerCase()).digest("hex") : undefined;
  const res = await ctx.http.request({
    method: "POST",
    url: `https://graph.facebook.com/v21.0/${encodeURIComponent(pixelId)}/events`,
    headers: { Authorization: `Bearer ${token}` },
    body: {
      data: [
        {
          event_name: event.eventName,
          event_time: event.eventTime ?? Math.floor(Date.now() / 1000),
          action_source: "system_generated",
          user_data: {
            em: (event.emails ?? []).map(hash).filter(Boolean),
            ph: (event.phones ?? []).map(hash).filter(Boolean),
          },
          custom_data:
            event.value != null
              ? { value: event.value, currency: event.currency ?? "AZN" }
              : undefined,
        },
      ],
    },
  });
  if (res.status >= 300) throw new Error(`Meta CAPI failed: ${res.text}`);
  return res.json;
}

export const ga4MpAdapter: BaseAdapter = catalogAdapter(
  {
    key: "ga4_mp",
    name: "GA4 Measurement Protocol",
    category: "ANALYTICS",
    regions: ["AZ", "CIS", "GLOBAL"],
    tier: "P2",
    docsUrl: "https://developers.google.com/analytics/devguides/collection/protocol/ga4",
    verified: "V",
    auth: "api_key",
    fields: [
      stringField("measurementId", {
        ru: "Measurement id (G-…)",
        az: "Measurement id",
        en: "Measurement id (G-…)",
      }, true),
      secretField("apiSecret", { ru: "API secret", az: "API secret", en: "API secret" }),
    ],
    inbound: { mode: "none", events: [], verify: "n/a" },
    outbound: [],
    capabilities: {},
    setupSteps: {
      ru: ["GA4 measurementId + apiSecret", "client_id с сайта", "События CRM → MP"],
      en: ["GA4 measurementId + apiSecret", "client_id from site", "CRM events → MP"],
      az: ["GA4 measurementId + apiSecret", "client_id", "CRM → MP"],
    },
  } satisfies ProviderManifest,
  {
    async testConnection(ctx): Promise<TestResult> {
      const mid = String(ctx.config.measurementId ?? "");
      const secret = String(ctx.secrets.apiSecret ?? "");
      if (!mid || !secret) return { ok: false, message: "measurementId/apiSecret required" };
      const res = await ctx.http.request({
        method: "POST",
        url: `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(mid)}&api_secret=${encodeURIComponent(secret)}`,
        body: {
          client_id: "era-crm-test",
          events: [{ name: "era_crm_ping", params: { debug: 1 } }],
        },
      });
      return res.status < 300
        ? { ok: true, message: "GA4 MP accepted ping" }
        : { ok: false, message: `HTTP ${res.status}` };
    },
  },
);

export const smsTwilioAdapter: MessagingAdapter = {
  ...catalogAdapter(
    {
      key: "sms_twilio",
      name: "Twilio SMS",
      category: "SMS",
      family: "hmac_body",
      regions: ["AZ", "CIS", "GLOBAL"],
      tier: "P2",
      docsUrl: "https://www.twilio.com/docs/messaging",
      verified: "V",
      auth: "api_key",
      fields: [
        stringField("accountSid", { ru: "Account SID", az: "Account SID", en: "Account SID" }, true),
        secretField("authToken", { ru: "Auth token", az: "Auth token", en: "Auth token" }),
        stringField("fromNumber", { ru: "From number", az: "From", en: "From number" }, true),
      ],
      inbound: { mode: "webhook", events: ["message"], verify: "X-Twilio-Signature" },
      outbound: ["sendText"],
      capabilities: {},
      rateLimit: { perSecond: 10 },
      setupSteps: {
        ru: ["Twilio SID + token", "From number", "Webhook signature"],
        en: ["Twilio SID + token", "From number", "Webhook signature"],
        az: ["Twilio SID + token", "From", "Webhook"],
      },
    } satisfies ProviderManifest,
    {
      async testConnection(ctx): Promise<TestResult> {
        const sid = String(ctx.config.accountSid ?? "");
        const token = String(ctx.secrets.authToken ?? "");
        if (!sid || !token) return { ok: false, message: "accountSid/authToken required" };
        const basic = Buffer.from(`${sid}:${token}`).toString("base64");
        const res = await ctx.http.request({
          method: "GET",
          url: `https://api.twilio.com/2010-04-01/Accounts/${sid}.json`,
          headers: { Authorization: `Basic ${basic}` },
        });
        return res.status === 200
          ? { ok: true, message: "Twilio SMS account ok" }
          : { ok: false, message: `HTTP ${res.status}` };
      },
      verifyWebhook(req, ctx): VerifyResult {
        const token = String(ctx.secrets.authToken ?? "");
        const sig = headerStr(req.headers["x-twilio-signature"]);
        return verifyTwilioSignature(
          token,
          sig,
          ctx.webhookUrl || "",
          parseForm(req.rawBody.toString("utf8") || ""),
        )
          ? { ok: true }
          : { ok: false, reason: "twilio signature mismatch" };
      },
      async normalize(req: RawRequest): Promise<NormalizedEvent[]> {
        const p = parseForm(req.rawBody.toString("utf8") || "");
        const from = p.From || "";
        if (!from) return [];
        return [
          {
            kind: "message.in",
            at: new Date().toISOString(),
            chatId: from,
            contact: { phone: from },
            message: {
              externalId: p.MessageSid || p.SmsSid,
              type: "text",
              text: p.Body || "",
            },
          },
        ];
      },
    },
  ),
  async sendMessage(ctx: AdapterContext, msg: OutboundMessage) {
    const sid = String(ctx.config.accountSid ?? "");
    const token = String(ctx.secrets.authToken ?? "");
    const from = String(ctx.config.fromNumber ?? "");
    if (!sid || !token || !from) throw new Error("accountSid/authToken/fromNumber required");
    const basic = Buffer.from(`${sid}:${token}`).toString("base64");
    const form = new URLSearchParams({
      From: from,
      To: msg.chatId,
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
    if (res.status >= 300) throw new Error(`Twilio SMS failed: ${res.text}`);
    return { externalId: String((res.json as { sid?: string }).sid ?? ""), raw: res.json };
  },
};

export const threeCxAdapter: TelephonyAdapter = {
  ...catalogAdapter(
    {
      key: "threecx",
      name: "3CX Call Control",
      category: "TELEPHONY",
      family: "cloud_phone_oauth",
      regions: ["AZ", "CIS", "GLOBAL"],
      tier: "P2",
      docsUrl: "https://www.3cx.com/docs/call-control-api/",
      verified: "V",
      auth: "oauth2",
      fields: [
        stringField("fqdn", { ru: "3CX FQDN", az: "FQDN", en: "3CX FQDN" }, true),
        stringField("clientId", { ru: "Client id", az: "Client id", en: "Client id" }, true),
        secretField("clientSecret", {
          ru: "Client secret",
          az: "Client secret",
          en: "Client secret",
        }),
        secretField("accessToken", {
          ru: "Access token",
          az: "Access token",
          en: "Access token",
        }),
      ],
      inbound: { mode: "webhook", events: ["call"], verify: "secret or OAuth" },
      outbound: ["originateCall"],
      capabilities: {},
      rateLimit: { perSecond: 5 },
      setupSteps: {
        ru: ["3CX Call Control client", "FQDN + token", "CRM webhook / journaling"],
        en: ["3CX Call Control client", "FQDN + token", "CRM webhook / journaling"],
        az: ["3CX Call Control", "FQDN + token", "CRM webhook"],
      },
    } satisfies ProviderManifest,
    {
      async testConnection(ctx): Promise<TestResult> {
        const fqdn = String(ctx.config.fqdn ?? "").replace(/\/$/, "");
        const token = String(ctx.secrets.accessToken ?? "");
        if (!fqdn || !token) return { ok: false, message: "fqdn/accessToken required" };
        const res = await ctx.http.request({
          method: "GET",
          url: `https://${fqdn}/callcontrol/participants`,
          headers: { Authorization: `Bearer ${token}` },
        });
        return res.status < 500
          ? { ok: res.status < 400, message: `3CX HTTP ${res.status}` }
          : { ok: false, message: `3CX HTTP ${res.status}` };
      },
      verifyWebhook(req, ctx): VerifyResult {
        const secret = String(ctx.secrets.webhookSecret ?? ctx.webhookSecret ?? ctx.secrets.clientSecret ?? "");
        if (!secret) return { ok: true };
        const got = headerStr(req.headers["x-3cx-signature"]) || req.query.k;
        return got && safeEqual(String(got), secret)
          ? { ok: true }
          : { ok: false, reason: "signature mismatch" };
      },
      async normalize(req: RawRequest): Promise<NormalizedEvent[]> {
        let body: Record<string, unknown> = {};
        try {
          body = JSON.parse(req.rawBody.toString("utf8") || "{}") as Record<string, unknown>;
        } catch {
          body = {};
        }
        const callId = String(body.callId ?? body.id ?? Date.now());
        const status = String(body.status ?? body.event ?? "").toLowerCase();
        let kind: "call.ringing" | "call.answered" | "call.ended" | "call.missed" = "call.ended";
        if (status.includes("ring") || status.includes("dialing")) kind = "call.ringing";
        else if (status.includes("connected") || status.includes("answer")) kind = "call.answered";
        else if (status.includes("miss") || status.includes("noanswer")) kind = "call.missed";
        return [
          {
            kind,
            at: new Date().toISOString(),
            call: {
              externalCallId: callId,
              direction: "INBOUND",
              fromNumber: body.from ? String(body.from) : undefined,
              toNumber: body.to ? String(body.to) : undefined,
            },
          },
        ];
      },
    },
  ),
  async originateCall(ctx, p) {
    const fqdn = String(ctx.config.fqdn ?? "").replace(/\/$/, "");
    const token = String(ctx.secrets.accessToken ?? "");
    if (!fqdn || !token) throw new Error("fqdn/accessToken required");
    const res = await ctx.http.request({
      method: "POST",
      url: `https://${fqdn}/callcontrol/makecall`,
      headers: { Authorization: `Bearer ${token}` },
      body: { from: p.fromExtension, to: p.to },
    });
    if (res.status >= 300) throw new Error(`3CX makecall failed: ${res.text}`);
    return { externalCallId: `3cx-${Date.now()}` };
  },
};

/** Bitrix-like public telephony API face — vendors POST here with HMAC. */
export const eraExternalcallAdapter: TelephonyAdapter = {
  ...catalogAdapter(
    {
      key: "era_externalcall",
      name: "ERA public telephony API",
      category: "TELEPHONY",
      family: "generic_call_webhook",
      regions: ["AZ", "CIS", "GLOBAL"],
      tier: "P2",
      docsUrl: "https://docs.era.local/crm/externalcall",
      verified: "V",
      auth: "api_key",
      fields: [
        secretField("hmacSecret", {
          ru: "HMAC secret",
          az: "HMAC secret",
          en: "HMAC secret",
        }),
      ],
      inbound: {
        mode: "webhook",
        events: ["externalcall.register", "externalcall.finish"],
        verify: "x-era-signature",
      },
      outbound: ["originateCall"],
      capabilities: {},
      rateLimit: { perSecond: 20 },
      setupSteps: {
        ru: ["Выдайте hmacSecret вендору", "POST hooks/era_externalcall/{publicId}", "События register/finish"],
        en: ["Give hmacSecret to vendor", "POST hooks/era_externalcall/{publicId}", "register/finish events"],
        az: ["hmacSecret ver", "hooks URL", "register/finish"],
      },
    } satisfies ProviderManifest,
    {
      async testConnection(ctx): Promise<TestResult> {
        const secret = String(ctx.secrets.hmacSecret ?? "");
        if (!secret || secret.length < 16) {
          return { ok: false, message: "hmacSecret min 16 chars" };
        }
        return { ok: true, message: "ERA externalcall ready" };
      },
      verifyWebhook(req, ctx): VerifyResult {
        const secret = String(ctx.secrets.hmacSecret ?? ctx.webhookSecret ?? "");
        const sig = headerStr(req.headers["x-era-signature"]);
        if (!secret || !sig) return { ok: false, reason: "missing signature" };
        const expected = createHmac("sha256", secret).update(req.rawBody).digest("hex");
        try {
          const a = Buffer.from(expected);
          const b = Buffer.from(sig.replace(/^sha256=/i, ""));
          return a.length === b.length && timingSafeEqual(a, b)
            ? { ok: true }
            : { ok: false, reason: "signature mismatch" };
        } catch {
          return { ok: false, reason: "signature mismatch" };
        }
      },
      async normalize(req: RawRequest): Promise<NormalizedEvent[]> {
        let body: Record<string, unknown> = {};
        try {
          body = JSON.parse(req.rawBody.toString("utf8") || "{}") as Record<string, unknown>;
        } catch {
          return [];
        }
        const event = String(body.event ?? body.method ?? "externalcall.finish");
        const callId = String(body.CALL_ID ?? body.callId ?? Date.now());
        const kind =
          event.includes("register") || event.includes("start")
            ? "call.ringing"
            : event.includes("miss")
              ? "call.missed"
              : "call.ended";
        return [
          {
            kind,
            at: new Date().toISOString(),
            call: {
              externalCallId: callId,
              direction:
                String(body.CALL_TYPE ?? body.direction ?? "1") === "2" ? "OUTBOUND" : "INBOUND",
              fromNumber: body.PHONE_NUMBER ? String(body.PHONE_NUMBER) : undefined,
              toNumber: body.USER_PHONE ? String(body.USER_PHONE) : undefined,
              durationSec: Number(body.CALL_DURATION ?? 0) || undefined,
              recordingUrl: body.CALL_RECORD_URL ? String(body.CALL_RECORD_URL) : undefined,
            },
          },
        ];
      },
    },
  ),
  async originateCall() {
    // Vendors initiate; CRM acknowledges queue only.
    return { externalCallId: `era-ext-${Date.now()}` };
  },
};
