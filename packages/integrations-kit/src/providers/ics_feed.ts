import { catalogAdapter, secretField, stringField } from "./_factory";
import type { ProviderManifest, TestResult } from "../types";

const manifest: ProviderManifest = {
  key: "ics_feed",
  name: "ICS feed (tasks)",
  category: "CALENDAR",
  family: undefined,
  regions: ["AZ", "CIS", "GLOBAL"],
  tier: "P0",
  docsUrl: "https://datatracker.ietf.org/doc/html/rfc5545",
  verified: "V",
  auth: "api_key",
  fields: [
    secretField("feedToken", {
      ru: "Feed secret token",
      az: "Feed token",
      en: "Feed secret token",
    }),
    stringField("horizonDays", {
      ru: "Horizon days",
      az: "Horizon days",
      en: "Horizon days",
    }),
  ],
  inbound: { mode: "none", events: [], verify: "token in URL" },
  outbound: [],
  capabilities: { media: false },
  rateLimit: { perSecond: 5 },
  setupSteps: {
    ru: ["Сгенерируйте feedToken", "Подпишитесь на /api/integrations/ics/{token}"],
    en: ["Set feedToken", "Subscribe to /api/integrations/ics/{token}"],
    az: ["feedToken təyin et", "/api/integrations/ics/{token} abunə ol"],
  },
  autoRegisterWebhook: false,
};

export const icsFeedAdapter = catalogAdapter(manifest, {
  async testConnection(ctx): Promise<TestResult> {
    const token = String(ctx.secrets.feedToken ?? "");
    if (!token || token.length < 16) {
      return { ok: false, message: "feedToken required (min 16 chars)" };
    }
    return {
      ok: true,
      message: "ICS token configured — subscribe with public ICS URL",
    };
  },
});
