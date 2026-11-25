import { createHmac } from "node:crypto";
import { catalogAdapter, eventAt, secretField, stringField } from "./_factory";
import { safeEqual } from "../crypto";
import type {
  AdapterContext,
  AdapterHttpResponse,
  NormalizedEvent,
  ProviderManifest,
  RawRequest,
  TelephonyAdapter,
  TestResult,
  VerifyResult,
} from "../types";

const API_BASE = "https://web.vats.az/vats/api";

const manifest: ProviderManifest = {
  key: "virtualats_az",
  name: "VirtualATS.az",
  category: "TELEPHONY",
  family: "vats_az_hmac",
  regions: ["AZ"],
  tier: "P1",
  docsUrl:
    "https://my.azerizone.net/index.php?rp=%2Fknowledgebase%2F1%2FAPI-istifad%C9%99-etm%C9%99kl%C9%99-VirtualATS-il%C9%99-inteqrasiya.html",
  verified: "V",
  auth: "api_key",
  fields: [
    secretField("apiKey", { ru: "Webhook apiKey", az: "Webhook apiKey", en: "Webhook apiKey" }),
    secretField("publicKey", { ru: "Public key", az: "Public key", en: "Public key" }),
    secretField("secretKey", { ru: "Secret key", az: "Secret key", en: "Secret key" }),
    stringField("defaultNumber", {
      ru: "Default CLI",
      az: "Default nömrə",
      en: "Default caller number",
    }),
  ],
  inbound: { mode: "webhook", events: ["NEW", "UPDATE", "HANGUP"], verify: "apiKey JSON" },
  outbound: ["originate"],
  capabilities: { recording: true, clickToCall: true },
  setupSteps: {
    ru: ["Ключи из Azerizone", "Webhook URL CRM", "publicKey/secretKey для REST"],
    en: ["Keys from Azerizone", "CRM webhook URL", "publicKey/secretKey for REST"],
    az: ["Azerizone açarları", "CRM webhook", "REST üçün publicKey/secretKey"],
  },
};

export function virtualatsSign(
  publicKey: string,
  secretKey: string,
  signPayload: string,
): { header: string; token: string } {
  const token = String(Date.now());
  const sign = createHmac("sha1", secretKey).update(token + signPayload).digest("hex");
  return { header: `${publicKey}:${token}:${sign}`, token };
}

function verify(req: RawRequest, ctx: AdapterContext): VerifyResult {
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(req.rawBody.toString("utf8") || "{}") as Record<string, unknown>;
  } catch {
    return { ok: false, reason: "invalid JSON" };
  }
  const expected = String(ctx.secrets.apiKey ?? ctx.webhookSecret ?? "");
  const got = String(body.apiKey ?? "");
  if (!expected) return { ok: false, reason: "missing apiKey" };
  return safeEqual(got, expected) ? { ok: true } : { ok: false, reason: "apiKey mismatch" };
}

async function normalize(req: RawRequest): Promise<NormalizedEvent[]> {
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(req.rawBody.toString("utf8") || "{}") as Record<string, unknown>;
  } catch {
    return [];
  }
  const callId = String(body.callId ?? "");
  if (!callId) return [];
  const at = eventAt(body, ["callDate"]);
  const direction =
    String(body.direction ?? "INBOUND").toUpperCase() === "OUTBOUND"
      ? "OUTBOUND"
      : "INBOUND";
  const from = String(body.callerId ?? body.source ?? "");
  const to = String(body.destination ?? "");
  const extension = String(body.answeredNumber ?? "");
  const disposition = String(body.disposition ?? "").toUpperCase();
  const state = String(body.state ?? "").toUpperCase();

  if (state === "NEW") {
    return [
      {
        kind: "call.ringing",
        at,
        call: { externalCallId: callId, direction, fromNumber: from, toNumber: to, extension },
      },
    ];
  }
  if (state === "UPDATE" && disposition === "ANSWERED") {
    return [
      {
        kind: "call.answered",
        at,
        call: { externalCallId: callId, direction, fromNumber: from, toNumber: to, extension },
      },
    ];
  }
  if (state === "HANGUP") {
    if (disposition === "ANSWERED") {
      return [
        {
          kind: "call.ended",
          at,
          call: {
            externalCallId: callId,
            direction,
            fromNumber: from,
            toNumber: to,
            extension,
            durationSec: Number(body.talkTime ?? body.duration ?? 0) || undefined,
            recordingUrl: body.recordConversation
              ? String(body.recordConversation)
              : undefined,
          },
        },
      ];
    }
    return [
      {
        kind: "call.missed",
        at,
        call: { externalCallId: callId, direction, fromNumber: from, toNumber: to, extension },
      },
    ];
  }
  return [];
}

function respond(): AdapterHttpResponse {
  return {
    status: 200,
    body: JSON.stringify({ result: "success", errors: [] }),
    contentType: "application/json",
  };
}

export const virtualatsAzAdapter: TelephonyAdapter = {
  ...catalogAdapter(manifest, {
    async testConnection(ctx): Promise<TestResult> {
      const publicKey = String(ctx.secrets.publicKey ?? "");
      const secretKey = String(ctx.secrets.secretKey ?? "");
      if (!publicKey || !secretKey) {
        return { ok: false, message: "publicKey and secretKey required" };
      }
      const { header } = virtualatsSign(publicKey, secretKey, "");
      const res = await ctx.http.request({
        method: "GET",
        url: `${API_BASE}/account/list`,
        headers: { "vats-authentication": header },
      });
      return res.status < 400
        ? { ok: true, message: "VirtualATS account list ok", details: { status: res.status } }
        : { ok: false, message: `VirtualATS HTTP ${res.status}`, details: { body: res.text } };
    },
    verifyWebhook: verify,
    normalize,
    respond: () => respond(),
  }),
  async originateCall(ctx, p) {
    const publicKey = String(ctx.secrets.publicKey ?? "");
    const secretKey = String(ctx.secrets.secretKey ?? "");
    const defaultNumber = String(ctx.config.defaultNumber ?? "");
    if (!publicKey || !secretKey) throw new Error("publicKey/secretKey required");
    const path = `/call/originate?to=${encodeURIComponent(p.to)}&number=${encodeURIComponent(p.fromExtension)}${defaultNumber ? `&defaultNumber=${encodeURIComponent(defaultNumber)}` : ""}`;
    const { header } = virtualatsSign(publicKey, secretKey, path);
    const res = await ctx.http.request({
      method: "GET",
      url: `${API_BASE}${path}`,
      headers: { "vats-authentication": header },
    });
    if (res.status >= 300) throw new Error(`VirtualATS originate failed: ${res.text}`);
    const json = res.json as { value?: string | number };
    return { externalCallId: String(json.value ?? "") || undefined };
  },
  async fetchRecording(ctx: AdapterContext, ref: string) {
    const publicKey = String(ctx.secrets.publicKey ?? "");
    const secretKey = String(ctx.secrets.secretKey ?? "");
    if (!publicKey || !secretKey) throw new Error("publicKey/secretKey required");
    const path = `/storageFile/download/${encodeURIComponent(ref)}`;
    const { header } = virtualatsSign(publicKey, secretKey, ref);
    const res = await ctx.http.request({
      method: "GET",
      url: `${API_BASE}${path}?vats-authentication=${encodeURIComponent(header)}`,
    });
    if (res.status >= 300) throw new Error(`VirtualATS download failed: ${res.text}`);
    return { url: res.text.match(/https?:\/\/[^\s"]+/)?.[0] };
  },
};