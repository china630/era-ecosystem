import { createHash } from "node:crypto";
import {
  catalogAdapter,
  eventAt,
  inferCallDirection,
  parseJsonOrForm,
  secretField,
} from "./_factory";
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

const manifest: ProviderManifest = {
  key: "mango_office",
  name: "Mango Office",
  category: "TELEPHONY",
  family: "signed_json_sha256",
  regions: ["CIS", "GLOBAL"],
  tier: "P0",
  docsUrl: "https://www.mango-office.ru/support/integraciya/",
  verified: "V",
  auth: "api_key",
  fields: [
    secretField("apiKey", { ru: "API key (vpbx_api_key)", az: "API key", en: "API key" }),
    secretField("apiSalt", { ru: "API salt", az: "API salt", en: "API salt" }),
  ],
  inbound: { mode: "webhook", events: ["call", "summary"], verify: "sha256(json+salt)" },
  outbound: ["callback"],
  capabilities: { recording: true, clickToCall: true },
  setupSteps: {
    ru: ["Ключ и salt из ЛК Mango", "Webhook events/call + summary", "Проверить подпись"],
    en: ["Key + salt from Mango cabinet", "Webhook events/call + summary", "Verify signature"],
    az: ["Mango key+salt", "Webhook events", "İmzanı yoxla"],
  },
};

function mangoEnvelope(
  req: RawRequest,
): { json: string; sign: string; apiKey: string; inner: Record<string, unknown> } | null {
  const outer = parseJsonOrForm(req.rawBody, req.contentType, req.query);
  const json = String(outer.json ?? "");
  const sign = String(outer.sign ?? "");
  const apiKey = String(outer.vpbx_api_key ?? "");
  let inner: Record<string, unknown> = {};
  if (json) {
    try {
      inner = JSON.parse(json) as Record<string, unknown>;
    } catch {
      return null;
    }
  } else {
    inner = outer;
  }
  return { json: json || JSON.stringify(inner), sign, apiKey, inner };
}

function verify(req: RawRequest, ctx: { secrets: Record<string, string> }): VerifyResult {
  const salt = ctx.secrets.apiSalt || ctx.secrets.webhookSecret || "";
  const key = ctx.secrets.apiKey || "";
  if (!salt || !key) return { ok: false, reason: "missing apiKey/apiSalt" };
  const env = mangoEnvelope(req);
  if (!env) return { ok: false, reason: "invalid mango body" };
  if (env.apiKey && env.apiKey !== key) return { ok: false, reason: "api key mismatch" };
  const expected = createHash("sha256").update(key + env.json + salt).digest("hex");
  return safeEqual(env.sign.toLowerCase(), expected.toLowerCase())
    ? { ok: true }
    : { ok: false, reason: "mango sign mismatch" };
}

function subPathKind(subPath: string): string {
  const p = subPath.replace(/^\/+/, "").toLowerCase();
  if (p.includes("summary")) return "summary";
  if (p.includes("recording") || p.includes("record/")) return "recording";
  if (p.includes("result/callback")) return "callback_result";
  return "call";
}

async function normalize(req: RawRequest): Promise<NormalizedEvent[]> {
  const env = mangoEnvelope(req);
  if (!env) return [];
  const inner = env.inner;
  const callId = String(inner.entry_id ?? inner.call_id ?? "");
  if (!callId) return [];
  const fromObj = inner.from as { extension?: string; number?: string } | undefined;
  const toObj = inner.to as { extension?: string; number?: string } | undefined;
  const from = String(fromObj?.number ?? "");
  const to = String(toObj?.number ?? "");
  const extension = String(fromObj?.extension ?? toObj?.extension ?? "");
  const direction = inferCallDirection(inner, { outboundIfExtensionFrom: true });
  const at = eventAt(inner, ["timestamp"]);
  const route = subPathKind(req.subPath ?? "");

  if (route === "callback_result") return [];

  if (route === "recording") {
    const recordingId = String(inner.recording_id ?? "");
    if (!recordingId) return [];
    return [
      {
        kind: "call.recording",
        at,
        externalCallId: callId,
        url: recordingId,
      },
    ];
  }

  if (route === "summary") {
    const entryResult = Number(inner.entry_result ?? inner.entryResult ?? -1);
    const talkTime = Number(inner.talk_time ?? 0);
    const endTime = Number(inner.end_time ?? inner.timestamp ?? 0);
    if (entryResult === 0) {
      return [
        {
          kind: "call.missed",
          at,
          call: { externalCallId: callId, direction, fromNumber: from, toNumber: to, extension },
        },
      ];
    }
    const durationSec =
      talkTime > 0 && endTime > talkTime ? Math.max(0, endTime - talkTime) : undefined;
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
          durationSec,
        },
      },
    ];
  }

  const callState = String(inner.call_state ?? "").trim();
  if (callState === "Appeared") {
    return [
      {
        kind: "call.ringing",
        at,
        call: { externalCallId: callId, direction, fromNumber: from, toNumber: to, extension },
      },
    ];
  }
  if (callState === "Connected") {
    return [
      {
        kind: "call.answered",
        at,
        call: { externalCallId: callId, direction, fromNumber: from, toNumber: to, extension },
      },
    ];
  }
  if (callState === "Disconnected") return [];
  return [];
}

export const mangoOfficeAdapter: TelephonyAdapter = {
  ...catalogAdapter(manifest, {
    async testConnection(ctx): Promise<TestResult> {
      return ctx.secrets.apiKey && ctx.secrets.apiSalt
        ? { ok: true, message: "Mango credentials present" }
        : { ok: false, message: "apiKey and apiSalt required" };
    },
    verifyWebhook: verify,
    normalize,
  }),
  async originateCall(ctx, p) {
    const key = ctx.secrets.apiKey;
    const salt = ctx.secrets.apiSalt;
    if (!key || !salt) throw new Error("apiKey/apiSalt required");
    const commandId = `crm-${Date.now()}`;
    const json = JSON.stringify({
      command_id: commandId,
      from: { extension: p.fromExtension },
      to_number: p.to,
    });
    const sign = createHash("sha256").update(key + json + salt).digest("hex");
    const params = new URLSearchParams({
      vpbx_api_key: key,
      sign,
      json,
    });
    const res = await ctx.http.request({
      method: "POST",
      url: "https://app.mango-office.ru/vpbx/commands/callback",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    if (res.status >= 300) throw new Error(`Mango callback failed: ${res.text}`);
    return { externalCallId: commandId };
  },
  async fetchRecording(ctx: AdapterContext, ref: string) {
    const key = ctx.secrets.apiKey;
    const salt = ctx.secrets.apiSalt;
    if (!key || !salt) throw new Error("apiKey/apiSalt required");
    const inner = JSON.stringify({ recording_id: ref, action: "download" });
    const sign = createHash("sha256").update(key + inner + salt).digest("hex");
    const params = new URLSearchParams({ vpbx_api_key: key, sign, json: inner });
    const res = await ctx.http.request({
      method: "POST",
      url: "https://app.mango-office.ru/vpbx/queries/recording/post",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    if (res.status >= 300) throw new Error(`Mango recording failed: ${res.text}`);
    const loc = res.text.match(/https?:\/\/[^\s"]+/);
    return { url: loc?.[0] };
  },
};