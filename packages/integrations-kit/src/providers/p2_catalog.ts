import { catalogAdapter, secretField } from "./_factory";
import type { BaseAdapter, ProviderManifest, TestResult } from "../types";

function p2(key: string, name: string, category: ProviderManifest["category"]): BaseAdapter {
  const manifest: ProviderManifest = {
    key,
    name: `${name} (P2 blocked until demand)`,
    category,
    regions: ["GLOBAL", "CIS", "AZ"],
    tier: "P2",
    docsUrl: `blocked://p2/${key}`,
    verified: "U",
    auth: "api_key",
    fields: [secretField("apiKey", { ru: "API key", az: "API key", en: "API key" })],
    inbound: { mode: "webhook", events: ["*"], verify: "secret header" },
    outbound: ["sendText"],
    capabilities: {},
    setupSteps: {
      ru: [
        "P2 по запросу клиента — live-адаптер не подключён",
        "Не включать в прод до реализации DoD",
      ],
      en: [
        "P2 on client demand — not a live adapter",
        "Do not enable in prod until DoD implementation",
      ],
      az: [
        "P2 müştəri tələbi ilə — live adapter yoxdur",
        "DoD olmadan prod-a qoşmayın",
      ],
    },
  };
  return catalogAdapter(manifest, {
    async testConnection(): Promise<TestResult> {
      return {
        ok: false,
        message: "P2 on demand — not a live adapter",
      };
    },
  });
}

/**
 * MSM.az SMS — public marketing page only; HTTP/XML API spec is issued on request
 * (info@msm.az). Do not invent endpoints until the vendor pack lands (TZ T-I27).
 */
export const msmAzAwaitingSpecAdapter: BaseAdapter = catalogAdapter(
  {
    key: "msm_az",
    name: "MSM.az SMS (awaiting spec)",
    category: "SMS",
    regions: ["AZ"],
    tier: "P1",
    docsUrl: "https://www.msm.az/ru/heller/api",
    verified: "U",
    auth: "api_key",
    fields: [
      secretField("apiKey", {
        ru: "API key (после спеки)",
        az: "API key (spesifikasiyadan sonra)",
        en: "API key (after vendor spec)",
      }),
    ],
    inbound: { mode: "webhook", events: ["dlr", "inbound"], verify: "per MSM spec" },
    outbound: ["sendText"],
    capabilities: {},
    setupSteps: {
      ru: [
        "Запросить HTTP/XML API у info@msm.az",
        "После спеки: live adapter + DLR webhook + sendText",
        "До спеки testConnection всегда fail — не подключать в прод",
      ],
      en: [
        "Request HTTP/XML API from info@msm.az",
        "After spec: live adapter + DLR webhook + sendText",
        "Until then testConnection always fails — do not enable in prod",
      ],
      az: [
        "info@msm.az-dən HTTP/XML API istəyin",
        "Spesifikasiyadan sonra: live adapter + DLR + sendText",
        "O vaxta qədər testConnection fail — prod-a qoşmayın",
      ],
    },
  } satisfies ProviderManifest,
  {
    async testConnection(): Promise<TestResult> {
      return {
        ok: false,
        message:
          "MSM.az: vendor HTTP/XML API specification not received (contact info@msm.az) — adapter blocked",
      };
    },
  },
);

/** Remaining P2 backlog — promote to live adapters when a client needs them. */
export const p2CatalogAdapters: BaseAdapter[] = [
  p2("telegram_user", "Telegram userbot (risk)", "MESSENGER"),
  p2("apple_mfb", "Apple Messages for Business", "MESSENGER"),
  p2("avito", "Avito messages", "MESSENGER"),
  p2("freeswitch", "FreeSWITCH bridge", "TELEPHONY"),
  catalogAdapter(
    {
      key: "collabo_az",
      name: "Collabo.az (awaiting spec)",
      category: "TELEPHONY",
      regions: ["AZ"],
      tier: "P1",
      docsUrl: "https://collabo.az/",
      verified: "U",
      auth: "api_key",
      fields: [
        secretField("apiKey", {
          ru: "API key (после спеки)",
          az: "API key (spesifikasiyadan sonra)",
          en: "API key (after vendor spec)",
        }),
      ],
      inbound: { mode: "webhook", events: ["*"], verify: "per Collabo spec" },
      outbound: ["originate"],
      capabilities: {},
      setupSteps: {
        ru: [
          "Запросить API у Collabo.az",
          "До спеки — только catalog; или generic_call_webhook",
        ],
        en: [
          "Request API from Collabo.az",
          "Until spec — catalog only; or configure generic_call_webhook",
        ],
        az: [
          "Collabo.az-dən API istəyin",
          "Spesifikasiyaya qədər — catalog və ya generic_call_webhook",
        ],
      },
    } satisfies ProviderManifest,
    {
      async testConnection(): Promise<TestResult> {
        return {
          ok: false,
          message:
            "Collabo.az: vendor API specification not received — adapter blocked",
        };
      },
    },
  ),
  msmAzAwaitingSpecAdapter,
  p2("vonage", "Vonage (P2 on demand)", "TELEPHONY"),
  p2("plivo", "Plivo (P2 on demand)", "TELEPHONY"),
  p2("telnyx", "Telnyx (P2 on demand)", "TELEPHONY"),
  p2("sinch", "Sinch (P2 on demand)", "TELEPHONY"),
  p2("infobip", "Infobip (P2 on demand)", "TELEPHONY"),
  p2("voximplant", "Voximplant (P2 on demand)", "TELEPHONY"),
  p2("exolve", "Exolve (P2 on demand)", "TELEPHONY"),
  p2("google_ads_conversions", "Google Ads offline conversions", "ADS"),
  p2("google_ads_lead_form", "Google Ads lead form", "LEAD_FORM"),
  p2("sheets_export", "Google Sheets export", "ANALYTICS"),
  p2("bi_export", "BI export", "ANALYTICS"),
  p2("stt_openai", "Speech-to-text", "AI"),
  p2("llm_assist", "LLM assist", "AI"),
  p2("maps_geocode", "Maps geocode", "OTHER"),
];
