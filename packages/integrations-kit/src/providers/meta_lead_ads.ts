import {
  catalogAdapter,
  secretField,
  stringField,
  verifyMetaHubSignature,
} from "./_factory";
import type {
  AdapterContext,
  BaseAdapter,
  NormalizedEvent,
  ProviderManifest,
  RawRequest,
  TestResult,
  VerifyResult,
} from "../types";

const manifest: ProviderManifest = {
  key: "meta_lead_ads",
  name: "Meta Lead Ads",
  category: "LEAD_FORM",
  family: "meta_graph",
  regions: ["AZ", "CIS", "GLOBAL"],
  tier: "P1",
  docsUrl: "https://developers.facebook.com/docs/marketing-api/guides/lead-ads",
  verified: "V",
  auth: "oauth",
  fields: [
    secretField("accessToken", {
      ru: "Page access token",
      az: "Page access token",
      en: "Page access token",
    }),
    stringField("pageId", { ru: "Page ID", az: "Page ID", en: "Page ID" }, true),
    secretField("appSecret", { ru: "App secret", az: "App secret", en: "App secret" }),
    stringField("verifyToken", {
      ru: "Verify token",
      az: "Verify token",
      en: "Verify token",
    }),
    stringField("graphVersion", {
      ru: "Graph version",
      az: "Graph version",
      en: "Graph version",
    }),
  ],
  inbound: { mode: "webhook", events: ["leadgen"], verify: "X-Hub-Signature-256" },
  outbound: [],
  capabilities: { media: false },
  rateLimit: { perSecond: 10 },
  setupSteps: {
    ru: ["Lead Ads + Page", "Webhook leadgen", "Page token с leads_retrieval"],
    en: ["Lead Ads + Page", "Webhook leadgen", "Page token with leads_retrieval"],
    az: ["Lead Ads + Page", "Webhook leadgen", "Page token"],
  },
};

function graphVersion(ctx: AdapterContext): string {
  const v = String(ctx.config.graphVersion ?? "v21.0");
  return v.startsWith("v") ? v : `v${v}`;
}

function headerStr(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export const metaLeadAdsAdapter: BaseAdapter = {
  ...catalogAdapter(manifest, {
    async testConnection(ctx): Promise<TestResult> {
      const token = String(ctx.secrets.accessToken ?? "");
      const pageId = String(ctx.config.pageId ?? "");
      if (!token || !pageId) return { ok: false, message: "accessToken and pageId required" };
      const res = await ctx.http.request({
        method: "GET",
        url: `https://graph.facebook.com/${graphVersion(ctx)}/${pageId}?fields=name`,
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.status === 200
        ? { ok: true, message: "Lead Ads page ok", details: { json: res.json } }
        : { ok: false, message: `Graph HTTP ${res.status}` };
    },
    handleChallenge(req, ctx) {
      const challenge = req.query["hub.challenge"];
      if (!challenge) return null;
      const expected = String(ctx.config.verifyToken ?? "");
      if (!expected || req.query["hub.verify_token"] !== expected) {
        return { status: 403, body: "verify_token mismatch" };
      }
      return { status: 200, body: String(challenge) };
    },
    verifyWebhook(req, ctx): VerifyResult {
      const sig = headerStr(req.headers["x-hub-signature-256"]);
      const appSecret = ctx.secrets.appSecret || "";
      if (!appSecret) return { ok: false, reason: "missing appSecret" };
      return verifyMetaHubSignature(req.rawBody, sig, appSecret)
        ? { ok: true }
        : { ok: false, reason: "signature mismatch" };
    },
    async normalize(req: RawRequest, ctx: AdapterContext): Promise<NormalizedEvent[]> {
      let body: Record<string, unknown> = {};
      try {
        body = JSON.parse(req.rawBody.toString("utf8") || "{}") as Record<string, unknown>;
      } catch {
        return [];
      }
      const events: NormalizedEvent[] = [];
      const token = String(ctx.secrets.accessToken ?? "");
      for (const entry of (body.entry as unknown[]) ?? []) {
        const changes =
          ((entry as { changes?: unknown[] }).changes as Record<string, unknown>[]) ?? [];
        for (const ch of changes) {
          const value = ch.value as { leadgen_id?: string; form_id?: string } | undefined;
          const leadgenId = value?.leadgen_id;
          if (!leadgenId) continue;
          const fields: Record<string, string> = {
            leadgen_id: leadgenId,
            form_id: value?.form_id ? String(value.form_id) : "",
          };
          if (token) {
            try {
              const res = await ctx.http.request({
                method: "GET",
                url: `https://graph.facebook.com/${graphVersion(ctx)}/${leadgenId}?fields=field_data,created_time`,
                headers: { Authorization: `Bearer ${token}` },
              });
              const data = res.json as {
                field_data?: Array<{ name?: string; values?: string[] }>;
              };
              for (const f of data.field_data ?? []) {
                if (f.name && f.values?.[0]) fields[f.name] = f.values[0];
              }
            } catch {
              /* keep ids only */
            }
          }
          events.push({
            kind: "lead.captured",
            at: new Date().toISOString(),
            source: "meta_lead_ads",
            fields,
            contact: {
              phone: fields.phone_number || fields.phone,
              email: fields.email,
              name: fields.full_name || fields.name,
            },
          });
        }
      }
      return events;
    },
  }),
};
