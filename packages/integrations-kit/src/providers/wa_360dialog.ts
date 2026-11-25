import { whatsappCloudAdapter } from "./whatsapp_cloud";
import type { AdapterContext, MessagingAdapter, OutboundMessage, TestResult } from "../types";

/** 360dialog is Meta Cloud API-compatible; base URL overridable via config.apiBase. */
function graphBase(ctx: AdapterContext): string {
  return String(ctx.config.apiBase ?? "https://waba-v2.360dialog.io").replace(/\/$/, "");
}

export const wa360dialogAdapter: MessagingAdapter = {
  ...whatsappCloudAdapter,
  manifest: {
    ...whatsappCloudAdapter.manifest,
    key: "wa_360dialog",
    name: "WhatsApp 360dialog",
    docsUrl: "https://docs.360dialog.com/",
  },
  async testConnection(ctx): Promise<TestResult> {
    const token = String(ctx.secrets.accessToken ?? ctx.secrets.apiKey ?? "");
    if (!token) return { ok: false, message: "accessToken required" };
    const res = await ctx.http.request({
      method: "GET",
      url: `${graphBase(ctx)}/v1/configs/webhook`,
      headers: { "D360-API-KEY": token },
    });
    if (res.status >= 400) {
      return {
        ok: false,
        message: `360dialog webhook config HTTP ${res.status}`,
        details: { body: res.text },
      };
    }
    return { ok: true, message: "360dialog reachable", details: { json: res.json } };
  },
  async sendMessage(ctx: AdapterContext, msg: OutboundMessage) {
    const token = String(ctx.secrets.accessToken ?? ctx.secrets.apiKey ?? "");
    if (!token) throw new Error("accessToken required");
    const to = msg.chatId.replace(/^\+/, "");
    const res = await ctx.http.request({
      method: "POST",
      url: `${graphBase(ctx)}/messages`,
      headers: { "D360-API-KEY": token },
      body: {
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: msg.text ?? "" },
      },
    });
    if (res.status >= 300) throw new Error(`360dialog send failed: ${res.text}`);
    const json = res.json as { messages?: { id?: string }[] };
    return { externalId: String(json.messages?.[0]?.id ?? ""), raw: res.json };
  },
};
