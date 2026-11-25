import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { safeEqual } from "../crypto";
import type {
  AdapterContext,
  BaseAdapter,
  NormalizedEvent,
  ProviderManifest,
  RawRequest,
  TestResult,
  VerifyResult,
} from "../types";

function headerStr(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export function verifyMetaHubSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  appSecret: string,
): boolean {
  if (!signatureHeader || !appSecret) return false;
  const expected =
    "sha256=" + createHmac("sha256", appSecret).update(rawBody).digest("hex");
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(signatureHeader);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function verifyTelegramSecretToken(
  header: string | undefined,
  secret: string,
): boolean {
  if (!header || !secret) return false;
  return safeEqual(header, secret);
}

/** Minimal adapter factory for catalog providers (normalize/send filled per family later). */
export function catalogAdapter(
  manifest: ProviderManifest,
  hooks?: Partial<BaseAdapter>,
): BaseAdapter {
  return {
    manifest,
    async testConnection(ctx: AdapterContext): Promise<TestResult> {
      if (hooks?.testConnection) return hooks.testConnection(ctx);
      // Honest default: no live ping unless the provider implements one.
      const hasSecret = Object.values(ctx.secrets).some((v) => String(v).trim());
      if (!hasSecret && !ctx.webhookSecret) {
        return {
          ok: false,
          message: `${manifest.name}: credentials required (no stub ping)`,
        };
      }
      return {
        ok: false,
        message: `${manifest.name}: live testConnection not implemented for this provider yet`,
        details: { provider: manifest.key },
      };
    },
    async onEnable(ctx) {
      if (hooks?.onEnable) return hooks.onEnable(ctx);
    },
    async onDisable(ctx) {
      if (hooks?.onDisable) return hooks.onDisable(ctx);
    },
    verifyWebhook(req, ctx): VerifyResult {
      if (hooks?.verifyWebhook) return hooks.verifyWebhook(req, ctx);
      const family = manifest.family ?? "";
      if (family === "meta_graph" || family === "hmac_body") {
        const sig =
          headerStr(req.headers["x-hub-signature-256"]) ||
          headerStr(req.headers["x-era-signature"]);
        const secret =
          ctx.secrets.appSecret ||
          ctx.secrets.webhookSecret ||
          ctx.webhookSecret;
        if (!secret) return { ok: false, reason: "missing appSecret/webhookSecret" };
        if (verifyMetaHubSignature(req.rawBody, sig, secret)) return { ok: true };
        return { ok: false, reason: "signature mismatch" };
      }
      if (family === "bot_webhook_secret") {
        const header =
          headerStr(req.headers["x-telegram-bot-api-secret-token"]) ||
          headerStr(req.headers["x-webhook-secret"]);
        const secret = ctx.secrets.webhookSecret || ctx.webhookSecret;
        if (verifyTelegramSecretToken(header, secret)) return { ok: true };
        // query.k rejected — use header only (audit v3 §5.3)
        return { ok: false, reason: "signature mismatch" };
      }
      const header =
        headerStr(req.headers["x-telegram-bot-api-secret-token"]) ||
        headerStr(req.headers["x-hub-signature-256"]) ||
        headerStr(req.headers["x-era-signature"]) ||
        headerStr(req.headers["x-webhook-secret"]);
      if (header && ctx.webhookSecret && safeEqual(header, ctx.webhookSecret)) {
        return { ok: true };
      }
      if (!ctx.webhookSecret && !ctx.secrets.webhookSecret) {
        return { ok: false, reason: "missing webhookSecret" };
      }
      // query.k rejected — header / HMAC only
      return { ok: false, reason: "signature mismatch" };
    },
    handleChallenge(req, ctx) {
      if (hooks?.handleChallenge) return hooks.handleChallenge(req, ctx);
      const challenge = req.query["hub.challenge"] || req.query.echostr;
      if (!challenge) return null;
      const verifyToken =
        String(ctx.config.verifyToken ?? ctx.secrets.verifyToken ?? "") ||
        ctx.webhookSecret;
      const mode = String(req.query["hub.mode"] ?? "");
      const token = req.query["hub.verify_token"];
      // Meta: require mode=subscribe AND matching verify_token (audit v2 §5).
      // Bare hub.challenge without mode/token must not 200.
      if (req.query["hub.challenge"] != null) {
        if (mode !== "subscribe") {
          return { status: 403, body: "hub.mode=subscribe required" };
        }
        if (!verifyToken || !token || !safeEqual(String(token), verifyToken)) {
          return { status: 403, body: "verify_token mismatch" };
        }
        return { status: 200, body: String(challenge) };
      }
      // WeChat-style echostr: require sha1(token+timestamp+nonce) signature.
      if (req.query.echostr) {
        if (!verifyToken) return { status: 403, body: "verify_token required" };
        const signature = String(req.query.signature ?? "");
        const timestamp = String(req.query.timestamp ?? "");
        const nonce = String(req.query.nonce ?? "");
        if (!signature || !timestamp || !nonce) {
          return { status: 403, body: "wechat signature params required" };
        }
        const sorted = [verifyToken, timestamp, nonce].sort().join("");
        const expected = createHash("sha1").update(sorted).digest("hex");
        if (!safeEqual(signature, expected)) {
          return { status: 403, body: "wechat signature mismatch" };
        }
        return { status: 200, body: String(challenge) };
      }
      return { status: 403, body: "challenge rejected" };
    },
    async normalize(req, ctx) {
      if (hooks?.normalize) return hooks.normalize(req, ctx);
      return defaultNormalize(req, manifest);
    },
    idempotencyKey(req) {
      if (hooks?.idempotencyKey) return hooks.idempotencyKey(req);
      return createHash("sha256").update(req.rawBody).digest("hex");
    },
  };
}

function defaultNormalize(
  req: RawRequest,
  manifest: ProviderManifest,
): NormalizedEvent[] {
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(req.rawBody.toString("utf8") || "{}") as Record<
      string,
      unknown
    >;
  } catch {
    body = {};
  }
  const at = new Date().toISOString();
  if (manifest.category === "TELEPHONY") {
    const callId = String(body.callId ?? body.call_id ?? body.externalCallId ?? at);
    return [
      {
        kind: "call.ended",
        at,
        call: {
          externalCallId: callId,
          direction:
            String(body.direction ?? "INBOUND").toUpperCase() === "OUTBOUND"
              ? "OUTBOUND"
              : "INBOUND",
          fromNumber: body.from ? String(body.from) : undefined,
          toNumber: body.to ? String(body.to) : undefined,
          extension: body.extension ? String(body.extension) : undefined,
          durationSec: Number(body.duration ?? 0) || undefined,
          recordingUrl: body.recordingUrl
            ? String(body.recordingUrl)
            : undefined,
        },
      },
    ];
  }
  if (manifest.category === "LEAD_FORM" || manifest.category === "WEB_CHAT") {
    const fields: Record<string, string> = {};
    for (const [k, v] of Object.entries(body)) {
      if (typeof v === "string") fields[k] = v;
      else if (typeof v === "number" || typeof v === "boolean") fields[k] = String(v);
    }
    return [
      {
        kind: "lead.captured",
        at,
        source: manifest.key,
        fields,
        contact: {
          phone: fields.phone || fields.contactPhone,
          email: fields.email || fields.contactEmail,
          name: fields.name || fields.contactName,
        },
        utm: {
          utm_source: fields.utm_source ?? "",
          utm_medium: fields.utm_medium ?? "",
          utm_campaign: fields.utm_campaign ?? "",
        },
      },
    ];
  }
  const chatId = String(
    body.chatId ??
      (body.message as { chat?: { id?: unknown } } | undefined)?.chat?.id ??
      body.from ??
      "unknown",
  );
  const text =
    typeof body.text === "string"
      ? body.text
      : String(
          (body.message as { text?: string } | undefined)?.text ??
            body.body ??
            "",
        );
  return [
    {
      kind: "message.in",
      at,
      chatId,
      contact: {
        phone: body.phone ? String(body.phone) : undefined,
        name: body.name ? String(body.name) : undefined,
        handle: body.username ? String(body.username) : undefined,
      },
      message: {
        externalId: body.message_id ? String(body.message_id) : undefined,
        type: "text",
        text,
      },
    },
  ];
}

export function secretField(
  key: string,
  label: { ru: string; az: string; en: string },
): import("../types").ManifestField {
  return { key, label, type: "secret", secret: true, required: true };
}

export function stringField(
  key: string,
  label: { ru: string; az: string; en: string },
  required = false,
): import("../types").ManifestField {
  return { key, label, type: "string", required };
}

function headerOne(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string | undefined {
  const v = headers[name] ?? headers[name.toLowerCase()];
  return headerStr(v);
}

/** Parse JSON body or application/x-www-form-urlencoded (+ query merge for GET). */
export function parseJsonOrForm(
  rawBody: Buffer,
  contentType?: string,
  query?: Record<string, string | undefined>,
): Record<string, unknown> {
  const raw = rawBody.toString("utf8") || "";
  const ct = (contentType ?? "").toLowerCase();
  if (ct.includes("application/json") || raw.trim().startsWith("{")) {
    try {
      return JSON.parse(raw || "{}") as Record<string, unknown>;
    } catch {
      /* fall through */
    }
  }
  const out: Record<string, unknown> = { ...(query ?? {}) };
  const text = ct.includes("json") && !raw.includes("=") ? raw : raw;
  if (text.includes("=") || ct.includes("form-urlencoded") || ct.includes("x-www-form-urlencoded")) {
    try {
      const params = new URLSearchParams(text.replace(/^\?/, ""));
      for (const [k, v] of params.entries()) out[k] = v;
    } catch {
      for (const part of text.split("&")) {
        const eq = part.indexOf("=");
        if (eq < 0) continue;
        const k = part.slice(0, eq);
        const v = part.slice(eq + 1);
        out[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, " "));
      }
    }
    return out;
  }
  if (raw.trim().startsWith("{")) {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      /* empty */
    }
  }
  return out;
}

const EVENT_TIME_KEYS = [
  "at",
  "timestamp",
  "callDate",
  "call_start",
  "call_start_timestamp",
  "start",
  "when",
  "date",
  "event_time",
  "callDateUtc",
] as const;

/** Resolve ISO timestamp from vendor payload (fallback: now). */
export function eventAt(
  payload: Record<string, unknown>,
  extraKeys: string[] = [],
): string {
  for (const key of [...extraKeys, ...EVENT_TIME_KEYS]) {
    const v = payload[key];
    if (v == null || v === "") continue;
    if (typeof v === "number") {
      const ms = v < 1e12 ? v * 1000 : v;
      const d = new Date(ms);
      if (!Number.isNaN(d.getTime())) return d.toISOString();
    }
    const s = String(v);
    if (/^\d{10}$/.test(s)) return new Date(Number(s) * 1000).toISOString();
    if (/^\d{13}$/.test(s)) return new Date(Number(s)).toISOString();
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date().toISOString();
}

export function inferCallDirection(
  payload: Record<string, unknown>,
  hints?: { outboundIfExtensionFrom?: boolean },
): "INBOUND" | "OUTBOUND" | "INTERNAL" {
  const raw = String(
    payload.direction ?? payload.type ?? payload.call_type ?? payload.callType ?? "",
  ).toLowerCase();
  if (raw.includes("out") || raw === "outbound") return "OUTBOUND";
  if (raw.includes("in") || raw === "inbound") return "INBOUND";
  if (raw.includes("internal") || raw === "inner") return "INTERNAL";
  if (hints?.outboundIfExtensionFrom) {
    const from = payload.from as { extension?: string } | undefined;
    if (from && typeof from === "object" && from.extension) return "OUTBOUND";
    if (payload.src_type === "2" || payload.src_type === 2) return "OUTBOUND";
  }
  return "INBOUND";
}

/** Thin OAuth2 refresh stub — returns new tokens when endpoint + refreshToken configured. */
export async function refreshOAuthToken(
  ctx: AdapterContext,
  opts: {
    tokenUrl: string;
    clientId?: string;
    clientSecret?: string;
    refreshToken: string;
    scope?: string;
  },
): Promise<{ accessToken: string; refreshToken?: string; expiresIn?: number } | null> {
  const refreshToken = opts.refreshToken.trim();
  if (!refreshToken || !opts.tokenUrl) return null;
  const body: Record<string, string> = {
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  };
  if (opts.clientId) body.client_id = opts.clientId;
  if (opts.clientSecret) body.client_secret = opts.clientSecret;
  if (opts.scope) body.scope = opts.scope;
  const res = await ctx.http.request({
    method: "POST",
    url: opts.tokenUrl,
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  if (res.status >= 300) {
    ctx.log.warn("refreshOAuthToken failed", { status: res.status, body: res.text });
    return null;
  }
  const json = res.json as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!json?.access_token) return null;
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresIn: json.expires_in,
  };
}

export function contentTypeFromRequest(
  headers: Record<string, string | string[] | undefined>,
): string | undefined {
  return headerOne(headers, "content-type");
}
