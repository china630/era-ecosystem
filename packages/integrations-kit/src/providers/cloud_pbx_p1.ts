/**
 * T-I26 P1 cloud PBX adapters promoted from p2 catalog stubs.
 */
import { createHash } from "node:crypto";
import { catalogAdapter, eventAt, secretField, stringField } from "./_factory";
import { safeEqual } from "../crypto";
import { verifyTwilioSignature } from "./wa_twilio";
import type {
  AdapterContext,
  NormalizedEvent,
  ProviderManifest,
  RawRequest,
  TelephonyAdapter,
  TestResult,
  VerifyResult,
} from "../types";

function parseJsonOrForm(req: RawRequest): Record<string, unknown> {
  const raw = req.rawBody.toString("utf8") || "";
  try {
    if (raw.trim().startsWith("{")) return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    /* form */
  }
  const out: Record<string, unknown> = { ...req.query };
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

type CallKind = "call.ringing" | "call.answered" | "call.ended" | "call.missed";

function callEvent(
  kind: CallKind,
  callId: string,
  body: Record<string, unknown>,
): NormalizedEvent {
  return {
    kind,
    at: new Date().toISOString(),
    call: {
      externalCallId: callId,
      direction:
        String(body.direction ?? "INBOUND").toUpperCase().startsWith("OUT")
          ? "OUTBOUND"
          : "INBOUND",
      fromNumber: body.from || body.caller || body.phone
        ? String(body.from ?? body.caller ?? body.phone)
        : undefined,
      toNumber: body.to || body.callee || body.extension
        ? String(body.to ?? body.callee ?? body.extension)
        : undefined,
      extension: body.extension ? String(body.extension) : undefined,
      durationSec: Number(body.duration ?? body.call_duration ?? 0) || undefined,
      recordingUrl: body.recording || body.recordingUrl || body.call_record_link
        ? String(body.recording ?? body.recordingUrl ?? body.call_record_link)
        : undefined,
    },
  };
}

function headerStr(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

function build(
  key: string,
  name: string,
  docsUrl: string,
  family: string,
  fields: ProviderManifest["fields"],
  hooks: {
    testConnection: (ctx: AdapterContext) => Promise<TestResult>;
    verifyWebhook: (req: RawRequest, ctx: AdapterContext) => VerifyResult;
    normalize: (req: RawRequest, ctx: AdapterContext) => Promise<NormalizedEvent[]>;
    originateCall: (
      ctx: AdapterContext,
      p: { fromExtension: string; to: string },
    ) => Promise<{ externalCallId?: string }>;
  },
): TelephonyAdapter {
  const manifest: ProviderManifest = {
    key,
    name,
    category: "TELEPHONY",
    family,
    regions: ["CIS", "GLOBAL", "AZ"],
    tier: "P1",
    docsUrl,
    verified: "V",
    auth: "api_key",
    fields,
    inbound: { mode: "webhook", events: ["call"], verify: "provider-specific" },
    outbound: ["originateCall"],
    capabilities: { media: false },
    rateLimit: { perSecond: 10 },
    setupSteps: {
      ru: ["Секреты из ЛК", "Webhook → CRM hooks", "Проверить"],
      en: ["Secrets from cabinet", "Webhook → CRM hooks", "Test"],
      az: ["Kabinet secrets", "Webhook → CRM", "Yoxla"],
    },
    autoRegisterWebhook: false,
  };
  return {
    ...catalogAdapter(manifest, {
      testConnection: hooks.testConnection,
      verifyWebhook: hooks.verifyWebhook,
      normalize: hooks.normalize,
    }),
    originateCall: hooks.originateCall,
  };
}

export const rostelecomVatsAdapter = build(
  "rostelecom_vats",
  "Rostelecom VATS",
  "https://rt-static.rt.ru/",
  "signed_json_sha256",
  [
    stringField("clientId", { ru: "X-Client-ID", az: "Client ID", en: "X-Client-ID" }, true),
    secretField("signKey", { ru: "Sign key", az: "Sign key", en: "Sign key" }),
  ],
  {
    async testConnection(ctx) {
      const id = String(ctx.config.clientId ?? "");
      const key = String(ctx.secrets.signKey ?? "");
      if (!id || !key) return { ok: false, message: "clientId and signKey required" };
      return { ok: true, message: "Rostelecom credentials present" };
    },
    verifyWebhook(req, ctx) {
      const clientId = String(ctx.config.clientId ?? "");
      const key = String(ctx.secrets.signKey ?? "");
      const hdrId = headerStr(req.headers["x-client-id"]);
      const sign = headerStr(req.headers["x-client-sign"]);
      if (!key || !clientId) return { ok: false, reason: "missing credentials" };
      if (hdrId && hdrId !== clientId) return { ok: false, reason: "client id mismatch" };
      const expected = createHash("sha256")
        .update(clientId + req.rawBody.toString("utf8") + key)
        .digest("hex");
      return sign && safeEqual(sign, expected)
        ? { ok: true }
        : { ok: false, reason: "sign mismatch" };
    },
    async normalize(req) {
      const body = parseJsonOrForm(req);
      const callId = String(body.session_id ?? body.call_id ?? "");
      if (!callId) return [];
      const state = String(body.state ?? body.event ?? "").toLowerCase();
      if (state === "disconnected") return [];
      let kind: CallKind = "call.ended";
      if (state === "new" || state === "calling") {
        kind = "call.ringing";
      } else if (state === "connected") {
        kind = "call.answered";
      } else if (state === "end") {
        kind = "call.ended";
      } else if (state.includes("miss") || state.includes("cancel")) {
        kind = "call.missed";
      } else if (state === "analytics") {
        return [];
      }
      const type = String(body.type ?? "").toLowerCase();
      const direction =
        type === "outbound" || type === "out" ? "OUTBOUND" : type === "internal" ? "INTERNAL" : "INBOUND";
      return [
        {
          ...callEvent(kind, callId, { ...body, direction }),
          at: eventAt(body, ["timestamp"]),
        },
      ];
    },
    async originateCall(ctx, p) {
      const clientId = String(ctx.config.clientId ?? "");
      const signKey = String(ctx.secrets.signKey ?? "");
      const base = String(ctx.config.apiUrl ?? "https://api.cloudpbx.rt.ru");
      if (!clientId || !signKey) throw new Error("clientId/signKey required");
      const jsonBody = JSON.stringify({
        request_number: p.to,
        from_sipuri: p.fromExtension,
      });
      const sign = createHash("sha256").update(clientId + jsonBody + signKey).digest("hex");
      const res = await ctx.http.request({
        method: "POST",
        url: `${base.replace(/\/$/, "")}/call_back`,
        headers: {
          "X-Client-ID": clientId,
          "X-Client-Sign": sign,
          "content-type": "application/json",
        },
        body: jsonBody,
      });
      if (res.status >= 300) throw new Error(`Rostelecom callback failed: ${res.text}`);
      const json = res.json as { session_id?: string };
      return { externalCallId: String(json.session_id ?? "") || `rt-${Date.now()}` };
    },
  },
);

export const beelineCloudPbxAdapter = build(
  "beeline_cloudpbx",
  "Beeline Cloud PBX",
  "https://cloudpbx.beeline.ru/apidoc",
  "xsi_subscription",
  [
    secretField("apiToken", {
      ru: "X-MPBX-API-AUTH-TOKEN",
      az: "API token",
      en: "X-MPBX-API-AUTH-TOKEN",
    }),
    stringField("subscriptionExpires", {
      ru: "Subscription expires (ISO)",
      az: "Expires",
      en: "Subscription expires (ISO)",
    }),
  ],
  {
    async testConnection(ctx) {
      const token = String(ctx.secrets.apiToken ?? "");
      if (!token) return { ok: false, message: "apiToken required" };
      const res = await ctx.http.request({
        method: "GET",
        url: "https://cloudpbx.beeline.ru/apis/portal/abonents",
        headers: { "X-MPBX-API-AUTH-TOKEN": token },
      });
      return res.status < 500
        ? { ok: res.status < 400, message: `Beeline HTTP ${res.status}`, details: { body: res.text } }
        : { ok: false, message: `Beeline HTTP ${res.status}` };
    },
    verifyWebhook(req, ctx) {
      const token = String(ctx.secrets.apiToken ?? ctx.webhookSecret ?? "");
      const got =
        headerStr(req.headers["x-mpbx-api-auth-token"]) ||
        headerStr(req.headers["x-webhook-secret"]) ||
        req.query.k;
      if (!token) return { ok: false, reason: "missing apiToken" };
      return got && safeEqual(String(got), token)
        ? { ok: true }
        : { ok: false, reason: "token mismatch" };
    },
    async normalize(req) {
      const body = parseJsonOrForm(req);
      const callId = String(body.callId ?? body.call_id ?? body.xsiEventId ?? Date.now());
      const event = String(body.event ?? body.eventType ?? body.type ?? "").toUpperCase();
      let kind: CallKind = "call.ended";
      if (event.includes("RING") || event.includes("ORIGINATED") || event.includes("START")) {
        kind = "call.ringing";
      } else if (event.includes("ANSWER") || event.includes("ESTABLISHED")) {
        kind = "call.answered";
      } else if (event.includes("MISS") || event.includes("NOANSWER")) {
        kind = "call.missed";
      }
      return [callEvent(kind, callId, body)];
    },
    async originateCall(ctx, p) {
      const token = String(ctx.secrets.apiToken ?? "");
      if (!token) throw new Error("apiToken required");
      const abonent = encodeURIComponent(p.fromExtension);
      const res = await ctx.http.request({
        method: "POST",
        url: `https://cloudpbx.beeline.ru/apis/portal/abonents/${abonent}/call?phoneNumber=${encodeURIComponent(p.to)}`,
        headers: { "X-MPBX-API-AUTH-TOKEN": token },
      });
      if (res.status >= 300) throw new Error(`Beeline call failed: ${res.text}`);
      return { externalCallId: `bee-${Date.now()}` };
    },
  },
);

export const uisAdapter = build(
  "uis",
  "UIS",
  "https://www.uiscom.ru/academiya/spravochnyj-centr/dokumentatsiya-api/",
  "generic_call_webhook",
  [secretField("apiToken", { ru: "API token", az: "API token", en: "API token" })],
  {
    async testConnection(ctx) {
      const token = String(ctx.secrets.apiToken ?? "");
      if (!token) return { ok: false, message: "apiToken required" };
      return { ok: true, message: "UIS token present" };
    },
    verifyWebhook(req, ctx) {
      const token = String(ctx.secrets.apiToken ?? ctx.webhookSecret ?? "");
      const got =
        headerStr(req.headers["authorization"])?.replace(/^Bearer\s+/i, "") ||
        req.query.token ||
        req.query.k;
      if (!token) return { ok: false, reason: "missing apiToken" };
      return got && safeEqual(String(got), token)
        ? { ok: true }
        : { ok: false, reason: "token mismatch" };
    },
    async normalize(req) {
      const body = parseJsonOrForm(req);
      const callId = String(body.call_session_id ?? body.call_id ?? Date.now());
      const event = String(body.notification_type ?? body.event ?? "").toLowerCase();
      let kind: CallKind = "call.ended";
      if (event.includes("start") || event.includes("incoming")) kind = "call.ringing";
      else if (event.includes("answer")) kind = "call.answered";
      else if (event.includes("miss")) kind = "call.missed";
      return [callEvent(kind, callId, body)];
    },
    async originateCall(ctx, p) {
      const token = String(ctx.secrets.apiToken ?? "");
      if (!token) throw new Error("apiToken required");
      const res = await ctx.http.request({
        method: "POST",
        url: "https://callapi.uiscom.ru/v2.0",
        headers: { Authorization: `Bearer ${token}` },
        body: {
          jsonrpc: "2.0",
          id: 1,
          method: "start.employee_call",
          params: { phone: p.to, employee_id: p.fromExtension },
        },
      });
      if (res.status >= 300) throw new Error(`UIS call failed: ${res.text}`);
      return { externalCallId: `uis-${Date.now()}` };
    },
  },
);

export const onlinePbxAdapter = build(
  "onlinepbx",
  "OnlinePBX",
  "https://kb.onlinepbx.ru/vebkhuki-onlinepbx",
  "generic_call_webhook",
  [
    stringField("domain", { ru: "Domain", az: "Domain", en: "Domain" }, true),
    secretField("authKey", { ru: "Auth key", az: "Auth key", en: "Auth key" }),
  ],
  {
    async testConnection(ctx) {
      const domain = String(ctx.config.domain ?? "");
      const key = String(ctx.secrets.authKey ?? "");
      if (!domain || !key) return { ok: false, message: "domain and authKey required" };
      const res = await ctx.http.request({
        method: "POST",
        url: `https://api2.onlinepbx.ru/${domain}/auth.json`,
        body: { auth_key: key },
      });
      return res.status === 200
        ? { ok: true, message: "OnlinePBX auth ok", details: { json: res.json } }
        : { ok: false, message: `HTTP ${res.status}`, details: { body: res.text } };
    },
    verifyWebhook(req, ctx) {
      const key = String(ctx.secrets.authKey ?? ctx.webhookSecret ?? "");
      const body = parseJsonOrForm(req);
      const got = String(body.auth_key ?? body.key ?? req.query.k ?? "");
      if (!key) return { ok: true };
      return safeEqual(got, key) ? { ok: true } : { ok: false, reason: "auth_key mismatch" };
    },
    async normalize(req) {
      const body = parseJsonOrForm(req);
      const callId = String(body.uuid ?? body.call_id ?? Date.now());
      const event = String(body.event ?? body.name ?? "").toLowerCase();
      let kind: CallKind = "call.ended";
      if (event.includes("start") || event.includes("ring")) kind = "call.ringing";
      else if (event.includes("answer")) kind = "call.answered";
      else if (event.includes("miss")) kind = "call.missed";
      return [callEvent(kind, callId, body)];
    },
    async originateCall(ctx, p) {
      const domain = String(ctx.config.domain ?? "");
      const key = String(ctx.secrets.authKey ?? "");
      if (!domain || !key) throw new Error("domain/authKey required");
      const keyId = String(ctx.config.keyId ?? "1");
      const authHeader = `${keyId}:${key}`;
      const res = await ctx.http.request({
        method: "POST",
        url: `https://api2.onlinepbx.ru/${domain}/call/now.json`,
        headers: { Authorization: authHeader },
        body: { from: p.fromExtension, to: p.to },
      });
      if (res.status >= 300) throw new Error(`OnlinePBX call failed: ${res.text}`);
      return { externalCallId: `opbx-${Date.now()}` };
    },
  },
);

export const telphinAdapter = build(
  "telphin",
  "Telphin",
  "https://www.telphin.ru/subscribers/documentation-rest-api",
  "oauth2",
  [
    stringField("clientId", { ru: "OAuth client id", az: "Client id", en: "OAuth client id" }, true),
    secretField("clientSecret", {
      ru: "OAuth client secret",
      az: "Client secret",
      en: "OAuth client secret",
    }),
    secretField("accessToken", {
      ru: "Access token",
      az: "Access token",
      en: "Access token",
    }),
  ],
  {
    async testConnection(ctx) {
      const token = String(ctx.secrets.accessToken ?? "");
      if (!token) return { ok: false, message: "accessToken required" };
      const res = await ctx.http.request({
        method: "GET",
        url: "https://apiproxy.telphin.ru/api/ver1.0/client/@me",
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.status === 200
        ? { ok: true, message: "Telphin client ok", details: { json: res.json } }
        : { ok: false, message: `HTTP ${res.status}`, details: { body: res.text } };
    },
    verifyWebhook(req, ctx) {
      const secret = String(ctx.secrets.webhookSecret ?? ctx.webhookSecret ?? ctx.secrets.clientSecret ?? "");
      if (!secret) return { ok: true };
      const got = headerStr(req.headers["x-telphin-signature"]) || req.query.k;
      return got && safeEqual(String(got), secret)
        ? { ok: true }
        : { ok: false, reason: "signature mismatch" };
    },
    async normalize(req) {
      const body = parseJsonOrForm(req);
      const callId = String(body.call_id ?? body.id ?? Date.now());
      const event = String(body.event_type ?? body.event ?? "").toLowerCase();
      let kind: CallKind = "call.ended";
      if (event.includes("dial") || event.includes("ring")) kind = "call.ringing";
      else if (event.includes("answer")) kind = "call.answered";
      else if (event.includes("miss") || event.includes("busy")) kind = "call.missed";
      return [callEvent(kind, callId, body)];
    },
    async originateCall(ctx, p) {
      const token = String(ctx.secrets.accessToken ?? "");
      if (!token) throw new Error("accessToken required");
      const res = await ctx.http.request({
        method: "POST",
        url: "https://apiproxy.telphin.ru/api/ver1.0/client/@me/calls/callback/",
        headers: { Authorization: `Bearer ${token}` },
        body: { src_num: [p.fromExtension], dst_num: p.to },
      });
      if (res.status >= 300) throw new Error(`Telphin callback failed: ${res.text}`);
      return { externalCallId: `tel-${Date.now()}` };
    },
  },
);

export const twilioVoiceAdapter = build(
  "twilio_voice",
  "Twilio Voice",
  "https://www.twilio.com/docs/voice",
  "cpaas",
  [
    stringField("accountSid", { ru: "Account SID", az: "Account SID", en: "Account SID" }, true),
    secretField("authToken", { ru: "Auth token", az: "Auth token", en: "Auth token" }),
    stringField("fromNumber", { ru: "From number", az: "From", en: "From number" }, true),
  ],
  {
    async testConnection(ctx) {
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
        ? { ok: true, message: "Twilio Voice account ok" }
        : { ok: false, message: `HTTP ${res.status}` };
    },
    verifyWebhook(req, ctx) {
      const token = String(ctx.secrets.authToken ?? "");
      const sig = headerStr(req.headers["x-twilio-signature"]);
      const params: Record<string, string> = {};
      const body = parseJsonOrForm(req);
      for (const [k, v] of Object.entries(body)) params[k] = String(v ?? "");
      return verifyTwilioSignature(token, sig, ctx.webhookUrl || "", params)
        ? { ok: true }
        : { ok: false, reason: "twilio signature mismatch" };
    },
    async normalize(req) {
      const body = parseJsonOrForm(req);
      const callId = String(body.CallSid ?? body.call_sid ?? Date.now());
      const status = String(body.CallStatus ?? body.CallStatus ?? body.StatusCallbackEvent ?? "").toLowerCase();
      let kind: CallKind = "call.ended";
      if (status.includes("ring") || status === "initiated") kind = "call.ringing";
      else if (status.includes("answer") || status === "in-progress") kind = "call.answered";
      else if (status.includes("no-answer") || status.includes("busy") || status.includes("canceled")) {
        kind = "call.missed";
      }
      return [
        callEvent(kind, callId, {
          from: body.From,
          to: body.To,
          direction: body.Direction,
          duration: body.CallDuration,
          recordingUrl: body.RecordingUrl,
        }),
      ];
    },
    async originateCall(ctx, p) {
      const sid = String(ctx.config.accountSid ?? "");
      const token = String(ctx.secrets.authToken ?? "");
      const from = String(ctx.config.fromNumber ?? "");
      if (!sid || !token || !from) throw new Error("accountSid/authToken/fromNumber required");
      const basic = Buffer.from(`${sid}:${token}`).toString("base64");
      const twiml = `<Response><Dial>${p.to}</Dial></Response>`;
      const form = new URLSearchParams({
        To: p.fromExtension,
        From: from,
        Twiml: twiml,
      });
      const res = await ctx.http.request({
        method: "POST",
        url: `https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json`,
        headers: {
          Authorization: `Basic ${basic}`,
          "content-type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      });
      if (res.status >= 300) throw new Error(`Twilio Voice failed: ${res.text}`);
      return { externalCallId: String((res.json as { sid?: string }).sid ?? "") };
    },
  },
);
