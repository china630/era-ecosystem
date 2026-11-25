import { createHmac, timingSafeEqual } from "node:crypto";
import { catalogAdapter, secretField, stringField } from "./_factory";
import type {
  AdapterContext,
  NormalizedEvent,
  ProviderManifest,
  RawRequest,
  TelephonyAdapter,
  TestResult,
  VerifyResult,
} from "../types";

const manifest: ProviderManifest = {
  key: "asterisk",
  name: "Asterisk via era-pbx-bridge",
  category: "TELEPHONY",
  family: "asterisk",
  regions: ["AZ", "CIS", "GLOBAL"],
  tier: "P0",
  docsUrl: "https://docs.asterisk.org/",
  verified: "V",
  auth: "api_key",
  fields: [
    secretField("bridgeSecret", {
      ru: "Bridge HMAC secret",
      az: "Bridge HMAC",
      en: "Bridge HMAC secret",
    }),
    stringField("bridgeUrl", {
      ru: "Bridge base URL",
      az: "Bridge URL",
      en: "Bridge base URL",
    }, true),
    stringField("amiHost", { ru: "AMI host (info)", az: "AMI host", en: "AMI host" }),
  ],
  inbound: {
    mode: "bridge",
    events: ["call.ringing", "call.ended", "call.missed"],
    verify: "x-era-signature HMAC-SHA256",
  },
  outbound: ["originateCall"],
  capabilities: { media: false },
  rateLimit: { perSecond: 10 },
  setupSteps: {
    ru: ["Поднять tools/era-pbx-bridge", "BRIDGE_HMAC_SECRET = bridgeSecret", "CRM webhook URL"],
    en: ["Run tools/era-pbx-bridge", "BRIDGE_HMAC_SECRET = bridgeSecret", "CRM webhook URL"],
    az: ["era-pbx-bridge işə sal", "BRIDGE_HMAC_SECRET = bridgeSecret", "CRM webhook URL"],
  },
  autoRegisterWebhook: false,
};

function headerStr(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

function verifyBridgeHmac(rawBody: Buffer, signature: string | undefined, secret: string): boolean {
  if (!signature || !secret) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(signature.replace(/^sha256=/i, ""));
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export const asteriskBridgeAdapter: TelephonyAdapter = {
  ...catalogAdapter(manifest, {
    async testConnection(ctx): Promise<TestResult> {
      const url = String(ctx.config.bridgeUrl ?? "").replace(/\/$/, "");
      const secret = String(ctx.secrets.bridgeSecret ?? "");
      if (!url || !secret) return { ok: false, message: "bridgeUrl and bridgeSecret required" };
      try {
        const res = await ctx.http.request({
          method: "GET",
          url: `${url}/health`,
        });
        return res.status === 200
          ? { ok: true, message: "bridge health ok", details: { json: res.json } }
          : { ok: false, message: `bridge HTTP ${res.status}` };
      } catch (err) {
        return { ok: false, message: err instanceof Error ? err.message : String(err) };
      }
    },
    verifyWebhook(req, ctx): VerifyResult {
      const secret = String(ctx.secrets.bridgeSecret ?? ctx.webhookSecret ?? "");
      const sig = headerStr(req.headers["x-era-signature"]);
      return verifyBridgeHmac(req.rawBody, sig, secret)
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
      const kindRaw = String(body.kind ?? "call.ended");
      const kind =
        kindRaw === "call.ringing" ||
        kindRaw === "call.answered" ||
        kindRaw === "call.missed" ||
        kindRaw === "call.ended"
          ? kindRaw
          : "call.ended";
      const callId = String(body.callId ?? body.externalCallId ?? Date.now());
      const direction =
        String(body.direction ?? "INBOUND").toUpperCase() === "OUTBOUND"
          ? "OUTBOUND"
          : "INBOUND";
      return [
        {
          kind,
          at: new Date().toISOString(),
          call: {
            externalCallId: callId,
            direction,
            fromNumber: body.from ? String(body.from) : undefined,
            toNumber: body.to ? String(body.to) : undefined,
            extension: body.extension ? String(body.extension) : undefined,
            durationSec: Number(body.duration ?? 0) || undefined,
            recordingUrl: body.recordingUrl ? String(body.recordingUrl) : undefined,
          },
        },
      ];
    },
  }),
  async originateCall(ctx: AdapterContext, p) {
    const url = String(ctx.config.bridgeUrl ?? "").replace(/\/$/, "");
    const secret = String(ctx.secrets.bridgeSecret ?? "");
    if (!url || !secret) throw new Error("bridgeUrl/bridgeSecret required");
    const body = JSON.stringify({
      fromExtension: p.fromExtension,
      to: p.to,
    });
    const sig = createHmac("sha256", secret).update(body).digest("hex");
    const res = await ctx.http.request({
      method: "POST",
      url: `${url}/originate`,
      headers: {
        "content-type": "application/json",
        "x-era-signature": sig,
      },
      body: JSON.parse(body),
    });
    if (res.status >= 300) throw new Error(`bridge originate failed: ${res.text}`);
    const json = (res.json ?? {}) as { externalCallId?: string };
    return { externalCallId: json.externalCallId };
  },
};
