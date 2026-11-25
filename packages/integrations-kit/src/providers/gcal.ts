import { catalogAdapter, secretField, stringField } from "./_factory";
import type {
  AdapterContext,
  BaseAdapter,
  ProviderManifest,
  TestResult,
} from "../types";

const manifest: ProviderManifest = {
  key: "gcal",
  name: "Google Calendar",
  category: "CALENDAR",
  family: "oauth2",
  regions: ["AZ", "CIS", "GLOBAL"],
  tier: "P1",
  docsUrl: "https://developers.google.com/calendar/api/guides/push",
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
      ru: "Calendar id (primary)",
      az: "Calendar id",
      en: "Calendar id (primary)",
    }),
  ],
  inbound: { mode: "webhook", events: ["sync"], verify: "channel token" },
  outbound: [],
  capabilities: { media: false },
  rateLimit: { perSecond: 5 },
  setupSteps: {
    ru: ["OAuth calendar.events", "calendarId=primary", "watch renew cron"],
    en: ["OAuth calendar.events", "calendarId=primary", "watch renew cron"],
    az: ["OAuth calendar.events", "calendarId=primary", "watch renew"],
  },
  autoRegisterWebhook: false,
};

/** Insert/patch helpers used by CRM calendar sync worker. */
export async function gcalUpsertEvent(
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
  const cal = encodeURIComponent(String(ctx.config.calendarId ?? "primary"));
  if (!token) throw new Error("accessToken required");
  const body = {
    summary: event.summary,
    description: event.description,
    start: { dateTime: event.startIso },
    end: { dateTime: event.endIso },
  };
  if (event.id) {
    const res = await ctx.http.request({
      method: "PATCH",
      url: `https://www.googleapis.com/calendar/v3/calendars/${cal}/events/${encodeURIComponent(event.id)}`,
      headers: { Authorization: `Bearer ${token}` },
      body,
    });
    if (res.status >= 300) throw new Error(`gcal patch failed: ${res.text}`);
    return { externalId: String((res.json as { id?: string }).id ?? event.id), raw: res.json };
  }
  const res = await ctx.http.request({
    method: "POST",
    url: `https://www.googleapis.com/calendar/v3/calendars/${cal}/events`,
    headers: { Authorization: `Bearer ${token}` },
    body,
  });
  if (res.status >= 300) throw new Error(`gcal insert failed: ${res.text}`);
  return { externalId: String((res.json as { id?: string }).id ?? ""), raw: res.json };
}

export const gcalAdapter: BaseAdapter = {
  ...catalogAdapter(manifest, {
    async testConnection(ctx): Promise<TestResult> {
      const token = String(ctx.secrets.accessToken ?? "");
      if (!token) return { ok: false, message: "accessToken required (Google OAuth)" };
      const cal = encodeURIComponent(String(ctx.config.calendarId ?? "primary"));
      const res = await ctx.http.request({
        method: "GET",
        url: `https://www.googleapis.com/calendar/v3/calendars/${cal}`,
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.status === 200
        ? { ok: true, message: "Google Calendar ok", details: { json: res.json } }
        : { ok: false, message: `HTTP ${res.status}`, details: { body: res.text } };
    },
  }),
};
