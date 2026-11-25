import { catalogAdapter, secretField, stringField } from "./_factory";
import type {
  AdapterContext,
  BaseAdapter,
  ProviderManifest,
  TestResult,
} from "../types";

const GRAPH = "https://graph.microsoft.com/v1.0";

const manifest: ProviderManifest = {
  key: "ms365_calendar",
  name: "Microsoft 365 Calendar",
  category: "CALENDAR",
  family: "oauth2",
  regions: ["AZ", "CIS", "GLOBAL"],
  tier: "P1",
  docsUrl: "https://learn.microsoft.com/en-us/graph/api/resources/calendar",
  verified: "V",
  auth: "oauth2",
  fields: [
    secretField("accessToken", { ru: "Access token", az: "Access token", en: "Access token" }),
    secretField("refreshToken", {
      ru: "Refresh token",
      az: "Refresh token",
      en: "Refresh token",
    }),
    stringField("calendarId", {
      ru: "Calendar id (optional)",
      az: "Calendar id",
      en: "Calendar id (optional)",
    }),
  ],
  inbound: { mode: "webhook", events: ["sync"], verify: "clientState" },
  outbound: [],
  capabilities: { media: false },
  rateLimit: { perSecond: 5 },
  setupSteps: {
    ru: ["Entra Calendars.ReadWrite", "Refresh token", "subscription renew"],
    en: ["Entra Calendars.ReadWrite", "Refresh token", "subscription renew"],
    az: ["Entra Calendars.ReadWrite", "Refresh token", "subscription renew"],
  },
  autoRegisterWebhook: false,
};

export async function ms365UpsertEvent(
  ctx: AdapterContext,
  event: {
    id?: string;
    summary: string;
    description?: string;
    startIso: string;
    endIso: string;
  },
): Promise<{ externalId: string; raw: unknown }> {
  const token = String(ctx.secrets.accessToken ?? "");
  if (!token) throw new Error("accessToken required");
  const cal = ctx.config.calendarId
    ? `me/calendars/${encodeURIComponent(String(ctx.config.calendarId))}/events`
    : "me/events";
  const body = {
    subject: event.summary,
    body: { contentType: "Text", content: event.description ?? "" },
    start: { dateTime: event.startIso, timeZone: "UTC" },
    end: { dateTime: event.endIso, timeZone: "UTC" },
  };
  if (event.id) {
    const res = await ctx.http.request({
      method: "PATCH",
      url: `${GRAPH}/me/events/${encodeURIComponent(event.id)}`,
      headers: { Authorization: `Bearer ${token}` },
      body,
    });
    if (res.status >= 300) throw new Error(`ms365 patch failed: ${res.text}`);
    return { externalId: String((res.json as { id?: string }).id ?? event.id), raw: res.json };
  }
  const res = await ctx.http.request({
    method: "POST",
    url: `${GRAPH}/${cal}`,
    headers: { Authorization: `Bearer ${token}` },
    body,
  });
  if (res.status >= 300) throw new Error(`ms365 insert failed: ${res.text}`);
  return { externalId: String((res.json as { id?: string }).id ?? ""), raw: res.json };
}

export const ms365CalendarAdapter: BaseAdapter = {
  ...catalogAdapter(manifest, {
    async testConnection(ctx): Promise<TestResult> {
      const token = String(ctx.secrets.accessToken ?? "");
      if (!token) return { ok: false, message: "accessToken required (Microsoft OAuth)" };
      const res = await ctx.http.request({
        method: "GET",
        url: `${GRAPH}/me/calendar`,
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.status === 200
        ? { ok: true, message: "M365 calendar ok", details: { json: res.json } }
        : { ok: false, message: `HTTP ${res.status}`, details: { body: res.text } };
    },
  }),
};
