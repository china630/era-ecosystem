import { createHash, createHmac } from "node:crypto";
import { catalogAdapter, eventAt, parseJsonOrForm, secretField, stringField } from "./_factory";
import { safeEqual } from "../crypto";
import type {
  NormalizedEvent,
  ProviderManifest,
  RawRequest,
  TelephonyAdapter,
  TestResult,
  VerifyResult,
} from "../types";

const manifest: ProviderManifest = {
  key: "zadarma",
  name: "Zadarma",
  category: "TELEPHONY",
  family: "zadarma_like",
  regions: ["AZ", "CIS", "GLOBAL"],
  tier: "P0",
  docsUrl: "https://zadarma.com/support/api/",
  verified: "V",
  auth: "api_key",
  fields: [
    secretField("apiKey", { ru: "API key", az: "API key", en: "API key" }),
    secretField("apiSecret", { ru: "API secret", az: "API secret", en: "API secret" }),
    stringField("pbxId", { ru: "PBX id", az: "PBX id", en: "Pbx id" }),
  ],
  inbound: { mode: "webhook", events: ["NOTIFY_*"], verify: "HMAC-SHA1 Signature" },
  outbound: ["callback"],
  capabilities: { recording: true, clickToCall: true },
  setupSteps: {
    ru: ["API key/secret в кабинете Zadarma", "Webhook URL + Signature", "Проверить → Включить"],
    en: ["API key/secret from Zadarma cabinet", "Webhook URL + Signature", "Test → Enable"],
    az: ["Zadarma API key/secret", "Webhook URL + imza", "Yoxla → Aktiv et"],
  },
};

function headerStr(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

function zadarmaWebhookSign(payload: string, secret: string): string {
  const hex = createHmac("sha1", secret).update(payload).digest("hex");
  return Buffer.from(hex, "utf8").toString("base64");
}

function webhookPayloadString(event: string, body: Record<string, unknown>): string {
  const caller = String(body.caller_id ?? "");
  const called = String(body.called_did ?? "");
  const callStart = String(body.call_start ?? "");
  const destination = String(body.destination ?? body.called_did ?? "");
  const internal = String(body.internal ?? "");
  const pbxCallId = String(body.pbx_call_id ?? "");
  const recId = String(body.call_id_with_rec ?? "");
  switch (event) {
    case "NOTIFY_ANSWER":
      return caller + destination + callStart;
    case "NOTIFY_OUT_START":
    case "NOTIFY_OUT_END":
      return internal + destination + callStart;
    case "NOTIFY_RECORD":
      return pbxCallId + recId;
    case "NOTIFY_START":
    case "NOTIFY_INTERNAL":
    case "NOTIFY_END":
    default:
      return caller + called + callStart;
  }
}

export function zadarmaRestSign(
  methodPath: string,
  qs: string,
  secret: string,
): string {
  const md5 = createHash("md5").update(qs).digest("hex");
  const hex = createHmac("sha1", secret).update(methodPath + qs + md5).digest("hex");
  return Buffer.from(hex, "utf8").toString("base64");
}

function verifyZadarma(req: RawRequest, ctx: { secrets: Record<string, string> }): VerifyResult {
  const secret = ctx.secrets.apiSecret || ctx.secrets.webhookSecret || "";
  if (!secret) return { ok: false, reason: "missing apiSecret" };
  const body = parseJsonOrForm(req.rawBody, req.contentType, req.query);
  const event = String(body.event ?? body.Event ?? "");
  const sig =
    headerStr(req.headers["signature"]) ||
    headerStr(req.headers["x-zadarma-signature"]) ||
    String(body.Signature ?? "");
  if (!sig) return { ok: false, reason: "missing signature header" };
  const expected = zadarmaWebhookSign(webhookPayloadString(event, body), secret);
  return safeEqual(sig, expected)
    ? { ok: true }
    : { ok: false, reason: "zadarma signature mismatch" };
}

async function normalize(req: RawRequest): Promise<NormalizedEvent[]> {
  const body = parseJsonOrForm(req.rawBody, req.contentType, req.query);
  const event = String(body.event ?? body.Event ?? "");
  const callId = String(body.pbx_call_id ?? body.call_id ?? body.callId ?? "");
  if (!callId) return [];
  const from = String(body.caller_id ?? body.from ?? "");
  const to = String(body.called_did ?? body.to ?? "");
  const at = eventAt(body, ["call_start"]);
  const outbound =
    event.includes("OUT") || Boolean(body.internal) && event.includes("NOTIFY_OUT");
  const direction = outbound ? "OUTBOUND" : "INBOUND";
  const extension = body.internal ? String(body.internal) : undefined;

  if (event === "NOTIFY_START" || event === "NOTIFY_INTERNAL" || event === "NOTIFY_OUT_START") {
    return [
      {
        kind: "call.ringing",
        at,
        call: {
          externalCallId: callId,
          direction,
          fromNumber: from,
          toNumber: to,
          extension,
        },
      },
    ];
  }
  if (event === "NOTIFY_ANSWER") {
    return [
      {
        kind: "call.answered",
        at,
        call: { externalCallId: callId, direction, fromNumber: from, toNumber: to, extension },
      },
    ];
  }
  if (event === "NOTIFY_END" || event === "NOTIFY_OUT_END") {
    const disposition = String(body.disposition ?? "").toLowerCase();
    const kind =
      disposition === "no answer" || disposition === "busy" || disposition === "failed"
        ? "call.missed"
        : "call.ended";
    return [
      {
        kind,
        at,
        call: {
          externalCallId: callId,
          direction,
          fromNumber: from,
          toNumber: to,
          extension,
          durationSec: Number(body.duration ?? 0) || undefined,
          recordingUrl: body.is_recorded ? String(body.call_id_with_rec ?? "") : undefined,
        },
      },
    ];
  }
  if (event === "NOTIFY_RECORD") {
    return [
      {
        kind: "call.recording",
        at,
        externalCallId: callId,
        url: String(body.call_id_with_rec ?? ""),
      },
    ];
  }
  return [];
}

export const zadarmaAdapter: TelephonyAdapter = {
  ...catalogAdapter(manifest, {
    async testConnection(ctx): Promise<TestResult> {
      if (!ctx.secrets.apiKey || !ctx.secrets.apiSecret) {
        return { ok: false, message: "apiKey and apiSecret required" };
      }
      return { ok: true, message: "Zadarma credentials present" };
    },
    verifyWebhook: verifyZadarma,
    handleChallenge(req) {
      const echo = req.query.zd_echo;
      if (echo != null) return { status: 200, body: String(echo) };
      return null;
    },
    normalize,
  }),
  async originateCall(ctx, p) {
    const key = ctx.secrets.apiKey;
    const secret = ctx.secrets.apiSecret;
    if (!key || !secret) throw new Error("apiKey/apiSecret required");
    const qs = `from=${encodeURIComponent(p.fromExtension)}&to=${encodeURIComponent(p.to)}`;
    const path = "/v1/request/callback/";
    const sig = zadarmaRestSign(path, qs, secret);
    const res = await ctx.http.request({
      method: "GET",
      url: `https://api.zadarma.com${path}?${qs}`,
      headers: { Authorization: `${key}:${sig}` },
    });
    if (res.status >= 300) throw new Error(`Zadarma callback failed: ${res.text}`);
    const json = res.json as { call_id?: string; pbx_call_id?: string };
    return {
      externalCallId: String(json.pbx_call_id ?? json.call_id ?? "") || undefined,
    };
  },
};