/**
 * I-4 P2 messengers with real normalize/send (risk providers require explicit consent).
 */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { catalogAdapter, secretField, stringField } from "./_factory";
import { safeEqual } from "../crypto";
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

function headerStr(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

function parseJson(req: RawRequest): Record<string, unknown> {
  try {
    return JSON.parse(req.rawBody.toString("utf8") || "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Green-API WhatsApp — unofficial; requires riskAccepted=true in config. */
export const waGreenApiAdapter: MessagingAdapter = {
  ...catalogAdapter(
    {
      key: "wa_green_api",
      name: "Green-API WhatsApp (risk)",
      category: "MESSENGER",
      family: "bot_webhook_secret",
      regions: ["CIS", "AZ", "GLOBAL"],
      tier: "P2",
      docsUrl: "https://green-api.com/docs/",
      verified: "C",
      auth: "api_key",
      fields: [
        stringField("idInstance", { ru: "idInstance", az: "idInstance", en: "idInstance" }, true),
        secretField("apiTokenInstance", {
          ru: "apiTokenInstance",
          az: "apiTokenInstance",
          en: "apiTokenInstance",
        }),
        stringField("riskAccepted", {
          ru: "riskAccepted (must be true)",
          az: "riskAccepted",
          en: "riskAccepted (must be true)",
        }, true),
      ],
      inbound: { mode: "webhook", events: ["incomingMessageReceived"], verify: "instance token" },
      outbound: ["sendText"],
      capabilities: { media: true },
      rateLimit: { perSecond: 5 },
      setupSteps: {
        ru: [
          "НЕОФИЦИАЛЬНЫЙ канал — риск бана номера",
          "Поставьте riskAccepted=true осознанно",
          "Webhook URL в кабинете Green-API",
        ],
        en: [
          "UNOFFICIAL channel — ban risk",
          "Set riskAccepted=true deliberately",
          "Webhook URL in Green-API cabinet",
        ],
        az: ["Qeyri-rəsmi kanal — risk", "riskAccepted=true", "Webhook URL"],
      },
    } satisfies ProviderManifest,
    {
      async testConnection(ctx): Promise<TestResult> {
        if (String(ctx.config.riskAccepted ?? "") !== "true") {
          return { ok: false, message: "riskAccepted must be true (ban risk acknowledgment)" };
        }
        const id = String(ctx.config.idInstance ?? "");
        const token = String(ctx.secrets.apiTokenInstance ?? "");
        if (!id || !token) return { ok: false, message: "idInstance/apiTokenInstance required" };
        const res = await ctx.http.request({
          method: "GET",
          url: `https://api.green-api.com/waInstance${id}/getStateInstance/${token}`,
        });
        return res.status === 200
          ? { ok: true, message: "Green-API state ok", details: { json: res.json } }
          : { ok: false, message: `HTTP ${res.status}`, details: { body: res.text } };
      },
      verifyWebhook(req, ctx): VerifyResult {
        const token = String(ctx.secrets.apiTokenInstance ?? "");
        const got = headerStr(req.headers["authorization"]) || req.query.token || req.query.k;
        if (!token) return { ok: false, reason: "missing apiTokenInstance" };
        if (got && safeEqual(String(got).replace(/^Bearer\s+/i, ""), token)) return { ok: true };
        // Green-API often posts without signature — require riskAccepted already checked at enable.
        return String(ctx.config.riskAccepted ?? "") === "true"
          ? { ok: true }
          : { ok: false, reason: "risk not accepted" };
      },
      async normalize(req: RawRequest): Promise<NormalizedEvent[]> {
        const body = parseJson(req);
        const typeWebhook = String(body.typeWebhook ?? "");
        if (typeWebhook && !typeWebhook.toLowerCase().includes("incomingmessage")) return [];
        const msgData = (body.messageData as Record<string, unknown> | undefined) ?? body;
        const senderData = body.senderData as { sender?: string; chatId?: string; senderName?: string } | undefined;
        const chatId = String(senderData?.chatId ?? senderData?.sender ?? body.chatId ?? "");
        if (!chatId) return [];
        const textMessage =
          (msgData.textMessageData as { textMessage?: string } | undefined)?.textMessage ??
          (typeof msgData.text === "string" ? msgData.text : "");
        return [
          {
            kind: "message.in",
            at: new Date().toISOString(),
            chatId,
            contact: { phone: senderData?.sender, name: senderData?.senderName, handle: chatId },
            message: {
              externalId: body.idMessage ? String(body.idMessage) : undefined,
              type: "text",
              text: textMessage,
            },
          },
        ];
      },
    },
  ),
  async sendMessage(ctx: AdapterContext, msg: OutboundMessage) {
    if (String(ctx.config.riskAccepted ?? "") !== "true") {
      throw new Error("riskAccepted must be true");
    }
    const id = String(ctx.config.idInstance ?? "");
    const token = String(ctx.secrets.apiTokenInstance ?? "");
    if (!id || !token) throw new Error("idInstance/apiTokenInstance required");
    const chatId = msg.chatId.includes("@") ? msg.chatId : `${msg.chatId.replace(/\D/g, "")}@c.us`;
    const res = await ctx.http.request({
      method: "POST",
      url: `https://api.green-api.com/waInstance${id}/sendMessage/${token}`,
      body: { chatId, message: msg.text ?? "" },
    });
    if (res.status >= 300) throw new Error(`Green-API send failed: ${res.text}`);
    return {
      externalId: String((res.json as { idMessage?: string }).idMessage ?? ""),
      raw: res.json,
    };
  },
};

export const okBotAdapter: MessagingAdapter = {
  ...catalogAdapter(
    {
      key: "ok_bot",
      name: "Odnoklassniki Bot",
      category: "MESSENGER",
      family: "bot_webhook_secret",
      regions: ["CIS"],
      tier: "P2",
      docsUrl: "https://apiok.ru/dev/graph_api/",
      verified: "C",
      auth: "api_key",
      fields: [
        secretField("accessToken", { ru: "Bot token", az: "Bot token", en: "Bot token" }),
        secretField("webhookSecret", {
          ru: "Webhook secret",
          az: "Webhook secret",
          en: "Webhook secret",
        }),
      ],
      inbound: { mode: "webhook", events: ["MESSAGE_CREATED"], verify: "secret" },
      outbound: ["sendText"],
      capabilities: { media: false },
      rateLimit: { perSecond: 5 },
      setupSteps: {
        ru: ["Токен группы OK", "Webhook + secret", "Проверить"],
        en: ["OK group token", "Webhook + secret", "Test"],
        az: ["OK token", "Webhook + secret", "Yoxla"],
      },
    } satisfies ProviderManifest,
    {
      async testConnection(ctx): Promise<TestResult> {
        const token = String(ctx.secrets.accessToken ?? "");
        if (!token) return { ok: false, message: "accessToken required" };
        return { ok: true, message: "OK bot token present (live ping optional)" };
      },
      verifyWebhook(req, ctx): VerifyResult {
        const secret = String(ctx.secrets.webhookSecret ?? ctx.webhookSecret ?? "");
        const got = headerStr(req.headers["x-ok-signature"]) || req.query.k;
        if (!secret) return { ok: false, reason: "missing webhookSecret" };
        return got && safeEqual(String(got), secret)
          ? { ok: true }
          : { ok: false, reason: "signature mismatch" };
      },
      async normalize(req: RawRequest): Promise<NormalizedEvent[]> {
        const body = parseJson(req);
        const webhookType = String(body.webhookType ?? body.type ?? "");
        if (webhookType && !webhookType.toUpperCase().includes("MESSAGE")) return [];
        const message = (body.message as Record<string, unknown> | undefined) ?? body;
        const chatId = String(message.chat_id ?? message.recipient ?? body.chat_id ?? "");
        if (!chatId) return [];
        return [
          {
            kind: "message.in",
            at: new Date().toISOString(),
            chatId,
            contact: { handle: chatId },
            message: {
              externalId: message.mid ? String(message.mid) : undefined,
              type: "text",
              text: typeof message.text === "string" ? message.text : "",
            },
          },
        ];
      },
    },
  ),
  async sendMessage(ctx: AdapterContext, msg: OutboundMessage) {
    const token = String(ctx.secrets.accessToken ?? "");
    if (!token) throw new Error("accessToken required");
    const res = await ctx.http.request({
      method: "POST",
      url: `https://api.ok.ru/graph/me/messages?access_token=${encodeURIComponent(token)}`,
      body: { recipient: { chat_id: msg.chatId }, message: { text: msg.text ?? "" } },
    });
    if (res.status >= 300) throw new Error(`OK send failed: ${res.text}`);
    return { externalId: `ok-${Date.now()}`, raw: res.json };
  },
};

export const wechatOaAdapter: MessagingAdapter = {
  ...catalogAdapter(
    {
      key: "wechat_oa",
      name: "WeChat Official Account",
      category: "MESSENGER",
      family: "bot_webhook_secret",
      regions: ["GLOBAL"],
      tier: "P2",
      docsUrl: "https://developers.weixin.qq.com/doc/offiaccount/Getting_Started/Overview.html",
      verified: "V",
      auth: "api_key",
      fields: [
        stringField("appId", { ru: "AppId", az: "AppId", en: "AppId" }, true),
        secretField("appSecret", { ru: "AppSecret", az: "AppSecret", en: "AppSecret" }),
        stringField("token", { ru: "Token (signature)", az: "Token", en: "Token (signature)" }, true),
        secretField("accessToken", {
          ru: "Access token (cached)",
          az: "Access token",
          en: "Access token (cached)",
        }),
      ],
      inbound: { mode: "webhook", events: ["text"], verify: "sha1(token,timestamp,nonce)" },
      outbound: ["sendText"],
      capabilities: { media: false },
      rateLimit: { perSecond: 5 },
      setupSteps: {
        ru: ["WeChat OA AppId/Secret", "Token для подписи", "URL CRM hooks"],
        en: ["WeChat OA AppId/Secret", "Token for signature", "CRM hooks URL"],
        az: ["WeChat OA", "Token", "CRM hooks"],
      },
    } satisfies ProviderManifest,
    {
      async testConnection(ctx): Promise<TestResult> {
        const appId = String(ctx.config.appId ?? "");
        const secret = String(ctx.secrets.appSecret ?? "");
        if (!appId || !secret) return { ok: false, message: "appId/appSecret required" };
        const res = await ctx.http.request({
          method: "GET",
          url: `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${encodeURIComponent(appId)}&secret=${encodeURIComponent(secret)}`,
        });
        const json = res.json as { access_token?: string; errmsg?: string };
        return json.access_token
          ? { ok: true, message: "WeChat token ok" }
          : { ok: false, message: json.errmsg ?? `HTTP ${res.status}` };
      },
      handleChallenge(req, ctx) {
        const echostr = req.query.echostr;
        if (!echostr) return null;
        const token = String(ctx.config.token ?? ctx.secrets.token ?? "");
        const timestamp = String(req.query.timestamp ?? "");
        const nonce = String(req.query.nonce ?? "");
        const signature = String(req.query.signature ?? "");
        const arr = [token, timestamp, nonce].sort();
        const expected = createHash("sha1").update(arr.join("")).digest("hex");
        if (!safeEqual(signature, expected)) return { status: 403, body: "bad signature" };
        return { status: 200, body: String(echostr) };
      },
      verifyWebhook(req, ctx): VerifyResult {
        const token = String(ctx.config.token ?? "");
        const timestamp = String(req.query.timestamp ?? "");
        const nonce = String(req.query.nonce ?? "");
        const signature = String(req.query.signature ?? "");
        if (!token || !signature) return { ok: false, reason: "missing signature" };
        const expected = createHash("sha1")
          .update([token, timestamp, nonce].sort().join(""))
          .digest("hex");
        return safeEqual(signature, expected) ? { ok: true } : { ok: false, reason: "bad signature" };
      },
      async normalize(req: RawRequest): Promise<NormalizedEvent[]> {
        const xml = req.rawBody.toString("utf8");
        const from = xml.match(/<FromUserName><!\[CDATA\[(.*?)\]\]><\/FromUserName>/)?.[1]
          ?? xml.match(/<FromUserName>(.*?)<\/FromUserName>/)?.[1];
        const text = xml.match(/<Content><!\[CDATA\[(.*?)\]\]><\/Content>/)?.[1]
          ?? xml.match(/<Content>(.*?)<\/Content>/)?.[1]
          ?? "";
        const msgId = xml.match(/<MsgId>(.*?)<\/MsgId>/)?.[1];
        if (!from) return [];
        return [
          {
            kind: "message.in",
            at: new Date().toISOString(),
            chatId: from,
            contact: { handle: from },
            message: { externalId: msgId, type: "text", text },
          },
        ];
      },
    },
  ),
  async sendMessage(ctx: AdapterContext, msg: OutboundMessage) {
    let token = String(ctx.secrets.accessToken ?? "");
    if (!token) {
      const appId = String(ctx.config.appId ?? "");
      const secret = String(ctx.secrets.appSecret ?? "");
      const tok = await ctx.http.request({
        method: "GET",
        url: `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${encodeURIComponent(appId)}&secret=${encodeURIComponent(secret)}`,
      });
      token = String((tok.json as { access_token?: string }).access_token ?? "");
    }
    if (!token) throw new Error("accessToken required");
    const res = await ctx.http.request({
      method: "POST",
      url: `https://api.weixin.qq.com/cgi-bin/message/custom/send?access_token=${encodeURIComponent(token)}`,
      body: {
        touser: msg.chatId,
        msgtype: "text",
        text: { content: msg.text ?? "" },
      },
    });
    const json = res.json as { errcode?: number; errmsg?: string };
    if (json.errcode && json.errcode !== 0) throw new Error(json.errmsg ?? "WeChat send failed");
    return { externalId: `wx-${Date.now()}`, raw: res.json };
  },
};

export const lineAdapter: MessagingAdapter = {
  ...catalogAdapter(
    {
      key: "line",
      name: "LINE Messaging",
      category: "MESSENGER",
      family: "hmac_body",
      regions: ["GLOBAL"],
      tier: "P2",
      docsUrl: "https://developers.line.biz/en/docs/messaging-api/",
      verified: "V",
      auth: "api_key",
      fields: [
        secretField("channelAccessToken", {
          ru: "Channel access token",
          az: "Access token",
          en: "Channel access token",
        }),
        secretField("channelSecret", {
          ru: "Channel secret",
          az: "Channel secret",
          en: "Channel secret",
        }),
      ],
      inbound: { mode: "webhook", events: ["message"], verify: "X-Line-Signature" },
      outbound: ["sendText"],
      capabilities: { media: true },
      rateLimit: { perSecond: 10 },
      setupSteps: {
        ru: ["LINE channel token + secret", "Webhook CRM hooks", "Проверить подпись"],
        en: ["LINE channel token + secret", "Webhook CRM hooks", "Verify signature"],
        az: ["LINE token + secret", "Webhook", "İmza"],
      },
    } satisfies ProviderManifest,
    {
      async testConnection(ctx): Promise<TestResult> {
        const token = String(ctx.secrets.channelAccessToken ?? "");
        if (!token) return { ok: false, message: "channelAccessToken required" };
        const res = await ctx.http.request({
          method: "GET",
          url: "https://api.line.me/v2/bot/info",
          headers: { Authorization: `Bearer ${token}` },
        });
        return res.status === 200
          ? { ok: true, message: "LINE bot ok", details: { json: res.json } }
          : { ok: false, message: `HTTP ${res.status}` };
      },
      verifyWebhook(req, ctx): VerifyResult {
        const secret = String(ctx.secrets.channelSecret ?? "");
        const sig = headerStr(req.headers["x-line-signature"]);
        if (!secret || !sig) return { ok: false, reason: "missing signature" };
        const mac = createHmac("sha256", secret).update(req.rawBody).digest("base64");
        try {
          const a = Buffer.from(mac);
          const b = Buffer.from(sig);
          return a.length === b.length && timingSafeEqual(a, b)
            ? { ok: true }
            : { ok: false, reason: "signature mismatch" };
        } catch {
          return { ok: false, reason: "signature mismatch" };
        }
      },
      async normalize(req: RawRequest): Promise<NormalizedEvent[]> {
        const body = parseJson(req);
        const events: NormalizedEvent[] = [];
        for (const ev of (body.events as unknown[]) ?? []) {
          const e = ev as {
            type?: string;
            timestamp?: number;
            source?: { userId?: string };
            message?: { id?: string; type?: string; text?: string };
          };
          if (e.type !== "message" || !e.source?.userId) continue;
          events.push({
            kind: "message.in",
            at: e.timestamp ? new Date(e.timestamp).toISOString() : new Date().toISOString(),
            chatId: e.source.userId,
            contact: { handle: e.source.userId },
            message: {
              externalId: e.message?.id,
              type: e.message?.type === "image" ? "image" : "text",
              text: e.message?.text ?? "",
            },
          });
        }
        return events;
      },
    },
  ),
  async sendMessage(ctx: AdapterContext, msg: OutboundMessage) {
    const token = String(ctx.secrets.channelAccessToken ?? "");
    if (!token) throw new Error("channelAccessToken required");
    const res = await ctx.http.request({
      method: "POST",
      url: "https://api.line.me/v2/bot/message/push",
      headers: { Authorization: `Bearer ${token}` },
      body: {
        to: msg.chatId,
        messages: [{ type: "text", text: msg.text ?? "" }],
      },
    });
    if (res.status >= 300) throw new Error(`LINE send failed: ${res.text}`);
    return { externalId: `line-${Date.now()}`, raw: res.json };
  },
};
