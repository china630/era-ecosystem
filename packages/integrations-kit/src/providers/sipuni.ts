import { createHash } from "node:crypto";
import {
  catalogAdapter,
  eventAt,
  parseJsonOrForm,
  secretField,
} from "./_factory";
import { safeEqual } from "../crypto";
import type {
  AdapterHttpResponse,
  NormalizedEvent,
  ProviderManifest,
  RawRequest,
  TelephonyAdapter,
  TestResult,
  VerifyResult,
} from "../types";

const manifest: ProviderManifest = {
  key: "sipuni",
  name: "Sipuni",
  category: "TELEPHONY",
  family: "generic_call_webhook",
  regions: ["CIS", "GLOBAL"],
  tier: "P0",
  docsUrl: "https://sipuni.com/",
  verified: "C",
  auth: "api_key",
  fields: [
    secretField("apiKey", { ru: "API key", az: "API key", en: "API key" }),
    secretField("accountId", { ru: "Номер аккаунта", az: "Hesab nömrəsi", en: "Account number" }),
    secretField("webhookSecret", { ru: "Webhook secret", az: "Webhook secret", en: "Webhook secret" }),
  ],
  inbound: { mode: "webhook", events: ["1", "2", "3"], verify: "query/header secret" },
  outbound: ["callback"],
  capabilities: { recording: true },
  setupSteps: {
    ru: ["Ключ Sipuni", "Webhook события 1/2/3", "Секрет в query k="],
    en: ["Sipuni key", "Webhook events 1/2/3", "Secret as query k="],
    az: ["Sipuni key", "Webhook 1/2/3", "Secret ?k="],
  },
};

function verify(req: RawRequest, ctx: { webhookSecret: string; secrets: Record<string, string> }): VerifyResult {
  const secret = ctx.secrets.webhookSecret || ctx.webhookSecret || ctx.secrets.apiKey || "";
  if (!secret) return { ok: false, reason: "missing secret" };
  const header = Array.isArray(req.headers["x-webhook-secret"])
    ? req.headers["x-webhook-secret"][0]
    : req.headers["x-webhook-secret"];
  if (header && safeEqual(header, secret)) return { ok: true };
  if (req.query.k && safeEqual(req.query.k, secret)) return { ok: true };
  return { ok: false, reason: "sipuni secret mismatch" };
}

function sipuniBody(req: RawRequest): Record<string, unknown> {
  return parseJsonOrForm(req.rawBody, req.contentType, req.query);
}

async function normalize(req: RawRequest): Promise<NormalizedEvent[]> {
  const body = sipuniBody(req);
  const event = String(body.event ?? "");
  const callId = String(body.call_id ?? body.uniqueid ?? "");
  if (!callId) return [];
  const from = String(body.src_num ?? body.src ?? "");
  const to = String(body.dst_num ?? body.dst ?? "");
  const at = eventAt(body, ["timestamp", "call_start_timestamp"]);
  const direction =
    String(body.src_type ?? "") === "2" ? "OUTBOUND" : "INBOUND";

  if (event === "1") {
    return [
      {
        kind: "call.ringing",
        at,
        call: { externalCallId: callId, direction, fromNumber: from, toNumber: to },
      },
    ];
  }
  if (event === "3") {
    return [
      {
        kind: "call.answered",
        at,
        call: { externalCallId: callId, direction, fromNumber: from, toNumber: to },
      },
    ];
  }
  if (event === "2") {
    const status = String(body.status ?? "").toUpperCase();
    const answerTs = Number(body.call_answer_timestamp ?? 0);
    const ts = Number(body.timestamp ?? 0);
    const durationSec =
      status === "ANSWER" && answerTs > 0 && ts > answerTs ? ts - answerTs : undefined;
    if (status === "ANSWER") {
      return [
        {
          kind: "call.ended",
          at,
          call: {
            externalCallId: callId,
            direction,
            fromNumber: from,
            toNumber: to,
            durationSec,
            recordingUrl: body.call_record_link
              ? String(body.call_record_link)
              : undefined,
          },
        },
      ];
    }
    return [
      {
        kind: "call.missed",
        at,
        call: { externalCallId: callId, direction, fromNumber: from, toNumber: to },
      },
    ];
  }
  return [];
}

function respondSuccess(): AdapterHttpResponse {
  return {
    status: 200,
    body: JSON.stringify({ success: true }),
    contentType: "application/json",
  };
}

function callbackHash(
  user: string,
  secret: string,
  phoneFrom: string,
  phoneTo: string,
  sipnumber: string,
): string {
  return createHash("md5")
    .update(`${phoneFrom}+${phoneTo}+${sipnumber}+${sipnumber}+${user}+${secret}`)
    .digest("hex");
}

export const sipuniAdapter: TelephonyAdapter = {
  ...catalogAdapter(manifest, {
    async testConnection(ctx): Promise<TestResult> {
      return ctx.secrets.apiKey
        ? { ok: true, message: "Sipuni apiKey present" }
        : { ok: false, message: "apiKey required" };
    },
    verifyWebhook: verify,
    normalize,
    respond: () => respondSuccess(),
  }),
  async originateCall(ctx, p) {
    const user = String(ctx.secrets.accountId ?? ctx.secrets.apiKey ?? "");
    const secret = String(ctx.secrets.apiKey ?? "");
    if (!user || !secret) throw new Error("accountId/apiKey required");
    const sipnumber = p.fromExtension;
    const hash = callbackHash(user, secret, p.fromExtension, p.to, sipnumber);
    const params = new URLSearchParams({
      user,
      phone: p.to,
      sipnumber,
      hash,
    });
    const res = await ctx.http.request({
      method: "POST",
      url: `https://sipuni.com/api/callback/call_number?${params.toString()}`,
    });
    if (res.status >= 300) throw new Error(`Sipuni callback failed: ${res.text}`);
    return { externalCallId: `sipuni-${Date.now()}` };
  },
};