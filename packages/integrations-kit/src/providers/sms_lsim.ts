import { createHash } from "node:crypto";
import { catalogAdapter, parseJsonOrForm, secretField, stringField } from "./_factory";
import type {
  AdapterContext,
  MessagingAdapter,
  NormalizedEvent,
  OutboundMessage,
  ProviderManifest,
  RawRequest,
  TestResult,
} from "../types";

const manifest: ProviderManifest = {
  key: "sms_lsim",
  name: "LSIM SMS (AZ)",
  category: "SMS",
  regions: ["AZ"],
  tier: "P0",
  docsUrl: "https://docs.lsim.az/quicksms.html",
  verified: "C",
  auth: "api_key",
  fields: [
    secretField("login", { ru: "Login", az: "Login", en: "Login" }),
    secretField("password", { ru: "Password", az: "Şifrə", en: "Password" }),
    stringField("sender", { ru: "Sender", az: "Sender", en: "Sender" }, true),
  ],
  inbound: { mode: "webhook", events: ["dlr"], verify: "per LSIM DLR GET" },
  outbound: ["sendText"],
  capabilities: { deliveryReport: true },
  setupSteps: {
    ru: ["Учётные данные LSIM", "Sender ID", "Проверить баланс", "DLR webhook"],
    en: ["LSIM credentials", "Sender ID", "Test balance", "DLR webhook"],
    az: ["LSIM credentials", "Sender ID", "Balansı yoxla", "DLR webhook"],
  },
};

function md5(text: string): string {
  return createHash("md5").update(text).digest("hex");
}

function lsimSendKey(login: string, password: string, msisdn: string, text: string, sender: string): string {
  return md5(`${md5(password)}${login}${text}${msisdn}${sender}`);
}

function lsimBalanceKey(login: string, password: string): string {
  return md5(`${md5(password)}${login}`);
}

async function normalizeLsimDlr(req: RawRequest): Promise<NormalizedEvent[]> {
  const body = parseJsonOrForm(req.rawBody, req.contentType, req.query);
  const status = body.status ?? body.trans_id;
  if (status == null && body.trans_id == null) return [];
  const raw = String(body.status ?? "101").toUpperCase();
  const mapped =
    /102|103|104|105|106/i.test(raw)
      ? "FAILED"
      : raw === "101" || /DELIV/i.test(raw)
        ? "DELIVERED"
        : "SENT";
  return [
    {
      kind: "message.status",
      at: new Date().toISOString(),
      externalId: String(body.trans_id ?? body.transactionId ?? ""),
      status: mapped,
    },
  ];
}

export const smsLsimAdapter: MessagingAdapter = {
  ...catalogAdapter(manifest, {
    async testConnection(ctx): Promise<TestResult> {
      const login = ctx.secrets.login;
      const password = ctx.secrets.password;
      if (!login || !password) return { ok: false, message: "login/password required" };
      const key = lsimBalanceKey(login, password);
      const res = await ctx.http.request({
        method: "GET",
        url: `https://apps.lsim.az/quicksms/v1/balance?login=${encodeURIComponent(login)}&key=${encodeURIComponent(key)}`,
      });
      if (res.status >= 300) {
        return { ok: false, message: `LSIM balance HTTP ${res.status}`, details: { body: res.text } };
      }
      return { ok: true, message: "LSIM balance ok", details: { json: res.json } };
    },
    normalize: normalizeLsimDlr,
  }),
  async sendMessage(ctx: AdapterContext, msg: OutboundMessage) {
    const login = ctx.secrets.login;
    const password = ctx.secrets.password;
    const sender = String(ctx.config.sender ?? ctx.secrets.sender ?? "");
    if (!login || !password || !sender) throw new Error("login/password/sender required");
    const text = msg.text ?? "";
    const key = lsimSendKey(login, password, msg.chatId, text, sender);
    const res = await ctx.http.request({
      method: "POST",
      url: "https://apps.lsim.az/quicksms/v1/smssender",
      headers: { "content-type": "application/json" },
      body: {
        login,
        key,
        msisdn: msg.chatId,
        text,
        sender,
        scheduled: "NOW",
        unicode: false,
      },
    });
    if (res.status >= 300) throw new Error(`LSIM send failed: ${res.text}`);
    const json = res.json as { obj?: string; errorCode?: number; errorMessage?: string };
    if (typeof json.errorCode === "number" && json.errorCode < 0) {
      throw new Error(json.errorMessage ?? `LSIM error ${json.errorCode}`);
    }
    return { externalId: String(json.obj ?? `lsim-${Date.now()}`), raw: res.json ?? res.text };
  },
};