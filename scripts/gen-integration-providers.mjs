import fs from "node:fs";
import path from "node:path";

const root = "D:/My Projects/era-ecosystem";
const dir = path.join(root, "packages/integrations-kit/src/providers");
fs.mkdirSync(dir, { recursive: true });

function w(name, body) {
  fs.writeFileSync(path.join(dir, name), body.replace(/\r\n/g, "\n"), "utf8");
  console.log(name);
}

function adapterFile(exportName, key, name, category, tier, family, extra = {}) {
  const regions = JSON.stringify(extra.regions ?? ["AZ", "CIS", "GLOBAL"]);
  const outbound = JSON.stringify(extra.outbound ?? ["sendText"]);
  const events = JSON.stringify(extra.events ?? ["message"]);
  const mode = extra.mode ?? "webhook";
  const verify = extra.verify ?? "secret header or ?k=";
  const docsUrl = extra.docsUrl ?? "https://example.invalid";
  const fields =
    extra.fieldsCode ??
    `[{ key: "apiKey", label: { ru: "API key", az: "API key", en: "API key" }, type: "secret", secret: true, required: true }]`;
  const setup = JSON.stringify(
    extra.setup ?? {
      ru: ["Вставьте ключи", "Проверить", "Включить"],
      en: ["Paste keys", "Test", "Enable"],
      az: ["Açarları daxil edin", "Yoxla", "Aktiv et"],
    },
  );
  return `import { catalogAdapter, secretField, stringField } from "./_factory";
import type { ProviderManifest } from "../types";

const manifest: ProviderManifest = {
  key: ${JSON.stringify(key)},
  name: ${JSON.stringify(name)},
  category: ${JSON.stringify(category)},
  family: ${JSON.stringify(family ?? undefined)},
  regions: ${regions},
  tier: ${JSON.stringify(tier)},
  docsUrl: ${JSON.stringify(docsUrl)},
  verified: ${JSON.stringify(extra.verified ?? "C")},
  auth: ${JSON.stringify(extra.auth ?? "api_key")},
  fields: ${fields},
  inbound: { mode: ${JSON.stringify(mode)}, events: ${events}, verify: ${JSON.stringify(verify)} },
  outbound: ${outbound},
  capabilities: ${JSON.stringify(extra.capabilities ?? { media: false })},
  rateLimit: ${JSON.stringify(extra.rateLimit ?? { perSecond: 10 })},
  setupSteps: ${setup},
  autoRegisterWebhook: ${extra.autoRegisterWebhook ? "true" : "false"},
};

export const ${exportName} = catalogAdapter(manifest);
`;
}

const providers = [
  ["mockTelegramAdapter", "mock_telegram", "Mock Telegram (dev)", "MESSENGER", "P0", "bot_webhook_secret", {
    verified: "V", docsUrl: "https://core.telegram.org/bots/api",
    fieldsCode: `[secretField("botToken", { ru: "Токен", az: "Token", en: "Token" })]`,
    autoRegisterWebhook: false, verify: "X-Telegram-Bot-Api-Secret-Token",
  }],
  ["telegramBotAdapter", "telegram_bot", "Telegram Bot", "MESSENGER", "P0", "bot_webhook_secret", {
    verified: "V", docsUrl: "https://core.telegram.org/bots/api",
    fieldsCode: `[secretField("botToken", { ru: "Токен бота", az: "Bot tokeni", en: "Bot token" })]`,
    autoRegisterWebhook: true, verify: "X-Telegram-Bot-Api-Secret-Token", rateLimit: { perSecond: 30 },
  }],
  ["whatsappCloudAdapter", "whatsapp_cloud", "WhatsApp Cloud API", "MESSENGER", "P0", "meta_graph", {
    verified: "V", docsUrl: "https://developers.facebook.com/docs/whatsapp/cloud-api",
    fieldsCode: `[secretField("accessToken", { ru: "Access token", az: "Access token", en: "Access token" }), stringField("phoneNumberId", { ru: "Phone number ID", az: "Phone number ID", en: "Phone number ID" }, true), stringField("graphVersion", { ru: "Graph version", az: "Graph version", en: "Graph version" }), secretField("appSecret", { ru: "App secret", az: "App secret", en: "App secret" })]`,
    outbound: ["sendText", "sendMedia", "sendTemplate"], capabilities: { templates: true, window24h: true, media: true },
    verify: "X-Hub-Signature-256",
  }],
  ["wa360dialogAdapter", "wa_360dialog", "360dialog WhatsApp", "MESSENGER", "P0", "meta_graph", {
    verified: "V", docsUrl: "https://docs.360dialog.com/",
    fieldsCode: `[secretField("apiKey", { ru: "API key", az: "API key", en: "API key" }), stringField("channelId", { ru: "Channel ID", az: "Channel ID", en: "Channel ID" }, true)]`,
  }],
  ["instagramAdapter", "instagram", "Instagram Direct", "MESSENGER", "P0", "meta_graph", {
    verified: "V", docsUrl: "https://developers.facebook.com/docs/instagram-platform",
    fieldsCode: `[secretField("accessToken", { ru: "Page token", az: "Page token", en: "Page token" }), stringField("igUserId", { ru: "IG user ID", az: "IG user ID", en: "IG user ID" }, true)]`,
    auth: "oauth2",
  }],
  ["emailImapSmtpAdapter", "email_imap_smtp", "Email IMAP/SMTP", "EMAIL", "P0", "imap_smtp", {
    mode: "polling", verified: "V",
    fieldsCode: `[stringField("imapHost", { ru: "IMAP host", az: "IMAP host", en: "IMAP host" }, true), stringField("smtpHost", { ru: "SMTP host", az: "SMTP host", en: "SMTP host" }, true), stringField("username", { ru: "Username", az: "Username", en: "Username" }, true), secretField("password", { ru: "Password", az: "Password", en: "Password" })]`,
  }],
  ["webchatAdapter", "webchat", "Web chat widget", "WEB_CHAT", "P0", undefined, { verified: "V" }],
  ["formGenericAdapter", "form_generic", "Generic lead webhook", "LEAD_FORM", "P0", "generic_lead_webhook", { verified: "V" }],
  ["formTildaAdapter", "form_tilda", "Tilda forms", "LEAD_FORM", "P0", "generic_lead_webhook", { verified: "C", docsUrl: "https://tilda.cc" }],
  ["genericMessengerAdapter", "generic_messenger", "Generic messenger webhook", "MESSENGER", "P0", "generic_messenger_webhook", { verified: "V" }],
  ["smsLsimAdapter", "sms_lsim", "LSIM SMS (AZ)", "SMS", "P0", undefined, {
    regions: ["AZ"], verified: "C", docsUrl: "https://lsim.az",
  }],
  ["smsGenericAdapter", "sms_generic", "Generic SMS HTTP", "SMS", "P0", undefined, { verified: "V" }],
  ["zadarmaAdapter", "zadarma", "Zadarma", "TELEPHONY", "P0", "zadarma_like", {
    verified: "V", docsUrl: "https://zadarma.com/en/support/api/",
    outbound: ["originateCall", "getRecording"], events: ["NOTIFY_START", "NOTIFY_END", "NOTIFY_RECORD"],
  }],
  ["novofonAdapter", "novofon", "Novofon", "TELEPHONY", "P0", "zadarma_like", {
    verified: "V", docsUrl: "https://api.novofon.com/", outbound: ["originateCall"],
  }],
  ["mangoOfficeAdapter", "mango_office", "Mango Office", "TELEPHONY", "P0", "signed_json_sha256", {
    verified: "V", docsUrl: "https://docs.mango-office.ru/",
    fieldsCode: `[secretField("apiKey", { ru: "API key (vpbx_api_key)", az: "API key", en: "API key" }), secretField("apiSalt", { ru: "API salt", az: "API salt", en: "API salt" })]`,
  }],
  ["sipuniAdapter", "sipuni", "Sipuni", "TELEPHONY", "P0", "generic_call_webhook", {
    verified: "V", docsUrl: "https://doc.sipuni.com/",
  }],
  ["virtualatsAzAdapter", "virtualats_az", "VirtualATS.az", "TELEPHONY", "P0", "vats_az_hmac", {
    regions: ["AZ"], verified: "V", docsUrl: "https://virtualats.az/",
  }],
  ["genericCallWebhookAdapter", "generic_call_webhook", "Generic call webhook / own PBX", "TELEPHONY", "P0", "generic_call_webhook", { verified: "V" }],
  ["asteriskBridgeAdapter", "asterisk", "Asterisk via era-pbx-bridge", "TELEPHONY", "P0", "asterisk", {
    verified: "V", mode: "bridge", docsUrl: "https://docs.asterisk.org/",
    fieldsCode: `[secretField("bridgeSecret", { ru: "Bridge HMAC secret", az: "Bridge HMAC", en: "Bridge HMAC secret" }), stringField("amiHost", { ru: "AMI host", az: "AMI host", en: "AMI host" })]`,
  }],
  ["viberBotAdapter", "viber_bot", "Viber Bot", "MESSENGER", "P1", "hmac_body", { verified: "V", docsUrl: "https://developers.viber.com/" }],
  ["vkCommunityAdapter", "vk_community", "VK Community", "MESSENGER", "P1", "bot_webhook_secret", { verified: "V", regions: ["CIS"] }],
  ["maxBotAdapter", "max_bot", "MAX Bot", "MESSENGER", "P1", "bot_webhook_secret", { verified: "V", regions: ["CIS"] }],
  ["fbMessengerAdapter", "fb_messenger", "Facebook Messenger", "MESSENGER", "P1", "meta_graph", { verified: "V" }],
  ["metaLeadAdsAdapter", "meta_lead_ads", "Meta Lead Ads", "LEAD_FORM", "P1", "meta_graph", { verified: "V" }],
  ["gmailApiAdapter", "gmail_api", "Gmail API", "EMAIL", "P1", undefined, { auth: "oauth2", mode: "polling", verified: "V" }],
  ["msGraphMailAdapter", "ms_graph_mail", "Microsoft Graph Mail", "EMAIL", "P1", undefined, { auth: "oauth2", mode: "polling", verified: "V" }],
  ["megafonVatsAdapter", "megafon_vats", "Megafon VATS", "TELEPHONY", "P1", "vats_crm_api", { verified: "C", regions: ["CIS"] }],
  ["gravitelAdapter", "gravitel", "Gravitel", "TELEPHONY", "P1", "gravitel_rest", { verified: "V", regions: ["CIS"] }],
  ["mtsVatsAdapter", "mts_vats", "MTS VATS", "TELEPHONY", "P1", "vats_crm_api", { verified: "V", regions: ["CIS"] }],
  ["wazzupAdapter", "wazzup", "Wazzup aggregator", "MESSENGER", "P1", undefined, { verified: "C" }],
  ["twilioWhatsappAdapter", "wa_twilio", "Twilio WhatsApp", "MESSENGER", "P1", "hmac_body", { verified: "V" }],
  ["gcalAdapter", "gcal", "Google Calendar", "CALENDAR", "P1", undefined, { auth: "oauth2", verified: "V" }],
  ["ms365CalendarAdapter", "ms365_calendar", "Microsoft 365 Calendar", "CALENDAR", "P1", undefined, { auth: "oauth2", verified: "V" }],
  ["icsFeedAdapter", "ics_feed", "ICS feed (tasks)", "CALENDAR", "P0", undefined, { mode: "none", verified: "V" }],
  ["outboundWebhooksAdapter", "outbound_webhooks", "ERA outbound webhooks", "OTHER", "P1", undefined, { mode: "none", verified: "V" }],
  ["publicApiKeysAdapter", "public_api_keys", "Tenant API keys", "OTHER", "P1", undefined, { mode: "none", verified: "V" }],
];

for (const p of providers) {
  const [exportName, key, name, category, tier, family, extra] = p;
  w(`${key}.ts`, adapterFile(exportName, key, name, category, tier, family, extra));
}

// P2 long-tail catalog
const p2 = [
  ["telegram_user", "Telegram userbot (risk)", "MESSENGER"],
  ["wa_green_api", "Green-API WhatsApp (risk)", "MESSENGER"],
  ["wechat_oa", "WeChat Official Account", "MESSENGER"],
  ["line", "LINE Messaging", "MESSENGER"],
  ["apple_mfb", "Apple Messages for Business", "MESSENGER"],
  ["ok_bot", "Odnoklassniki Bot", "MESSENGER"],
  ["rostelecom_vats", "Rostelecom VATS", "TELEPHONY"],
  ["beeline_cloudpbx", "Beeline Cloud PBX", "TELEPHONY"],
  ["uis", "UIS", "TELEPHONY"],
  ["onlinepbx", "OnlinePBX", "TELEPHONY"],
  ["telphin", "Telphin", "TELEPHONY"],
  ["twilio_voice", "Twilio Voice", "TELEPHONY"],
  ["freeswitch", "FreeSWITCH bridge", "TELEPHONY"],
  ["collabo_az", "Collabo.az", "TELEPHONY"],
  ["meta_capi", "Meta Conversions API", "ADS"],
  ["google_ads_conversions", "Google Ads offline conversions", "ADS"],
  ["ga4_mp", "GA4 Measurement Protocol", "ANALYTICS"],
  ["sheets_export", "Google Sheets export", "ANALYTICS"],
  ["bi_export", "BI export", "ANALYTICS"],
  ["stt_openai", "Speech-to-text", "AI"],
  ["llm_assist", "LLM assist", "AI"],
  ["maps_geocode", "Maps geocode", "OTHER"],
  ["era_externalcall", "ERA public telephony API", "TELEPHONY"],
];

let p2Body = `import { catalogAdapter, secretField } from "./_factory";
import type { BaseAdapter, ProviderManifest } from "../types";

function p2(key: string, name: string, category: ProviderManifest["category"]): BaseAdapter {
  const manifest: ProviderManifest = {
    key, name, category, regions: ["GLOBAL", "CIS", "AZ"], tier: "P2",
    docsUrl: "https://example.invalid/" + key, verified: "U", auth: "api_key",
    fields: [secretField("apiKey", { ru: "API key", az: "API key", en: "API key" })],
    inbound: { mode: "webhook", events: ["*"], verify: "secret or ?k=" },
    outbound: ["sendText"], capabilities: {}, setupSteps: { ru: ["P2 on demand"], en: ["P2 on demand"], az: ["P2 on demand"] },
  };
  return catalogAdapter(manifest);
}

export const p2CatalogAdapters: BaseAdapter[] = [
`;
for (const [key, name, cat] of p2) {
  p2Body += `  p2(${JSON.stringify(key)}, ${JSON.stringify(name)}, ${JSON.stringify(cat)}),\n`;
}
p2Body += "];\n";
w("p2_catalog.ts", p2Body);

console.log("providers done", providers.length + p2.length);
