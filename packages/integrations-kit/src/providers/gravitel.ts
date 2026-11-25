import { catalogAdapter, eventAt, parseJsonOrForm, secretField, stringField } from "./_factory";
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
  key: "gravitel",
  name: "Gravitel",
  category: "TELEPHONY",
  family: "gravitel_rest",
  regions: ["CIS"],
  tier: "P1",
  docsUrl: "https://gravitel.ru/upload/docs/gravitel_rest_api.pdf",
  verified: "V",
  auth: "api_key",
  fields: [
    stringField("domain", { ru: "Домен", az: "Domain", en: "Domain" }, true),
    secretField("apiKey", { ru: "X-API-KEY", az: "X-API-KEY", en: "X-API-KEY" }),
    secretField("webhookSecret", {
      ru: "Ключ входящих вебхуков",
      az: "Webhook secret",
      en: "Inbound webhook token",
    }),
  ],
  inbound: {
    mode: "webhook",
    events: ["history", "event", "client"],
    verify: "header or query k",
  },
  outbound: ["originateCall"],
  capabilities: { recording: true, clickToCall: true },
  setupSteps: {
    ru: ["Домен + X-API-KEY", "Подпути /history /event /client", "Секрет вебхука"],
    en: ["Domain + X-API-KEY", "Subpaths /history /event /client", "Webhook secret"],
    az: ["Domain + API key", "Alt yollar", "Webhook secret"],
  },
};

function headerStr(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

function verify(req: RawRequest, ctx: AdapterContext): VerifyResult {
  const token = String(ctx.secrets.webhookSecret ?? ctx.webhookSecret ?? ctx.secrets.apiKey ?? "");
  if (!token) return { ok: true };
  const header = headerStr(req.headers["x-api-key"]) || headerStr(req.headers["x-gravitel-token"]);
  const queryK = req.query.k;
  if (header && safeEqual(header, token)) return { ok: true };
  if (queryK && safeEqual(queryK, token)) return { ok: true };
  return { ok: false, reason: "gravitel webhook auth mismatch" };
}

function subRoute(subPath?: string): "history" | "event" | "client" | "other" {
  const p = (subPath ?? "").replace(/^\/+/, "").toLowerCase();
  if (p === "history" || p.startsWith("history/")) return "history";
  if (p === "event" || p.startsWith("event/")) return "event";
  if (p === "client" || p.startsWith("client/")) return "client";
  return "other";
}

async function normalize(req: RawRequest): Promise<NormalizedEvent[]> {
  const body = parseJsonOrForm(req.rawBody, req.contentType, req.query);
  const route = subRoute(req.subPath);
  const callId = String(body.id ?? body.call_id ?? "");
  if (!callId) return [];
  const at = eventAt(body, ["when"]);
  const phone = String(body.phone ?? body.client ?? "");
  const extension = String(body.extension ?? body.provision ?? "");
  const direction =
    String(body.direction ?? "in").toLowerCase().startsWith("out") ? "OUTBOUND" : "INBOUND";

  if (route === "event") {
    const stage = String(body.stage ?? "").toLowerCase();
    if (stage === "alerting") {
      return [
        {
          kind: "call.ringing",
          at,
          call: {
            externalCallId: callId,
            direction,
            fromNumber: phone,
            toNumber: extension,
            extension,
          },
        },
      ];
    }
    if (stage === "talking") {
      return [
        {
          kind: "call.answered",
          at,
          call: {
            externalCallId: callId,
            direction,
            fromNumber: phone,
            toNumber: extension,
            extension,
          },
        },
      ];
    }
    return [];
  }

  if (route === "history" || route === "other") {
    const result = String(body.result ?? "").toLowerCase();
    if (result === "success") {
      return [
        {
          kind: "call.ended",
          at,
          call: {
            externalCallId: callId,
            direction,
            fromNumber: phone,
            toNumber: extension,
            extension,
            durationSec: Number(body.duration ?? 0) || undefined,
            recordingUrl: body.record ? String(body.record) : undefined,
          },
        },
      ];
    }
    return [
      {
        kind: "call.missed",
        at,
        call: {
          externalCallId: callId,
          direction,
          fromNumber: phone,
          toNumber: extension,
          extension,
        },
      },
    ];
  }
  return [];
}

function respondClient(_events: NormalizedEvent[], req: RawRequest): AdapterHttpResponse | null {
  if (subRoute(req.subPath) !== "client") return null;
  return {
    status: 200,
    body: JSON.stringify({ contact_name: "", responsible: "" }),
    contentType: "application/json",
  };
}

export const gravitelAdapter: TelephonyAdapter = {
  ...catalogAdapter(manifest, {
    async testConnection(ctx): Promise<TestResult> {
      const domain = String(ctx.config.domain ?? "");
      const apiKey = String(ctx.secrets.apiKey ?? "");
      if (!domain || !apiKey) return { ok: false, message: "domain and apiKey required" };
      const res = await ctx.http.request({
        method: "GET",
        url: `https://crm.aicall.ru/v1/${encodeURIComponent(domain)}/balance`,
        headers: { "X-API-KEY": apiKey },
      });
      return res.status < 400
        ? { ok: true, message: "Gravitel balance ok" }
        : { ok: false, message: `Gravitel HTTP ${res.status}`, details: { body: res.text } };
    },
    verifyWebhook: verify,
    normalize,
    respond(events, req) {
      const client = respondClient(events, req);
      if (client) return client;
      return { status: 200, body: JSON.stringify({ ok: true }) };
    },
  }),
  async originateCall(ctx, p) {
    const domain = String(ctx.config.domain ?? "");
    const apiKey = String(ctx.secrets.apiKey ?? "");
    if (!domain || !apiKey) throw new Error("domain/apiKey required");
    const res = await ctx.http.request({
      method: "POST",
      url: `https://crm.aicall.ru/v1/${encodeURIComponent(domain)}/makecall`,
      headers: { "X-API-KEY": apiKey },
      body: {
        extension: p.fromExtension,
        number: p.to,
      },
    });
    if (res.status >= 300) throw new Error(`Gravitel makecall failed: ${res.text}`);
    const json = res.json as { id?: string };
    return { externalCallId: String(json.id ?? "") || undefined };
  },
};