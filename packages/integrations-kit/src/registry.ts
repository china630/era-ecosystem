import type { BaseAdapter, ProviderManifest } from "./types";
import { mockTelegramAdapter } from "./providers/mock_telegram";
import { telegramBotAdapter } from "./providers/telegram_bot";
import { whatsappCloudAdapter } from "./providers/whatsapp_cloud";
import { wa360dialogAdapter } from "./providers/wa_360dialog";
import { instagramAdapter } from "./providers/instagram";
import { emailImapSmtpAdapter } from "./providers/email_imap_smtp";
import { webchatAdapter } from "./providers/webchat";
import { formGenericAdapter } from "./providers/form_generic";
import { formTildaAdapter } from "./providers/form_tilda";
import { genericMessengerAdapter } from "./providers/generic_messenger";
import { smsLsimAdapter } from "./providers/sms_lsim";
import { smsGenericAdapter } from "./providers/sms_generic";
import { zadarmaAdapter } from "./providers/zadarma";
import { novofonAdapter } from "./providers/novofon";
import { mangoOfficeAdapter } from "./providers/mango_office";
import { sipuniAdapter } from "./providers/sipuni";
import { virtualatsAzAdapter } from "./providers/virtualats_az";
import { genericCallWebhookAdapter } from "./providers/generic_call_webhook";
import { asteriskBridgeAdapter } from "./providers/asterisk";
import { viberBotAdapter } from "./providers/viber_bot";
import { vkCommunityAdapter } from "./providers/vk_community";
import { maxBotAdapter } from "./providers/max_bot";
import { fbMessengerAdapter } from "./providers/fb_messenger";
import { metaLeadAdsAdapter } from "./providers/meta_lead_ads";
import { gmailApiAdapter } from "./providers/gmail_api";
import { msGraphMailAdapter } from "./providers/ms_graph_mail";
import { megafonVatsAdapter } from "./providers/megafon_vats";
import { gravitelAdapter } from "./providers/gravitel";
import { mtsVatsAdapter } from "./providers/mts_vats";
import { wazzupAdapter } from "./providers/wazzup";
import { twilioWhatsappAdapter } from "./providers/wa_twilio";
import { gcalAdapter } from "./providers/gcal";
import { ms365CalendarAdapter } from "./providers/ms365_calendar";
import { icsFeedAdapter } from "./providers/ics_feed";
import { outboundWebhooksAdapter } from "./providers/outbound_webhooks";
import { publicApiKeysAdapter } from "./providers/public_api_keys";
import {
  rostelecomVatsAdapter,
  beelineCloudPbxAdapter,
  uisAdapter,
  onlinePbxAdapter,
  telphinAdapter,
  twilioVoiceAdapter,
} from "./providers/cloud_pbx_p1";
import {
  waGreenApiAdapter,
  okBotAdapter,
  wechatOaAdapter,
  lineAdapter,
} from "./providers/p2_messengers";
import {
  metaCapiAdapter,
  ga4MpAdapter,
  smsTwilioAdapter,
  threeCxAdapter,
  eraExternalcallAdapter,
} from "./providers/p2_analytics_cpaas";
import { p2CatalogAdapters } from "./providers/p2_catalog";

const adapters: BaseAdapter[] = [
  mockTelegramAdapter,
  telegramBotAdapter,
  whatsappCloudAdapter,
  wa360dialogAdapter,
  instagramAdapter,
  emailImapSmtpAdapter,
  webchatAdapter,
  formGenericAdapter,
  formTildaAdapter,
  genericMessengerAdapter,
  smsLsimAdapter,
  smsGenericAdapter,
  zadarmaAdapter,
  novofonAdapter,
  mangoOfficeAdapter,
  sipuniAdapter,
  virtualatsAzAdapter,
  genericCallWebhookAdapter,
  asteriskBridgeAdapter,
  viberBotAdapter,
  vkCommunityAdapter,
  maxBotAdapter,
  fbMessengerAdapter,
  metaLeadAdsAdapter,
  gmailApiAdapter,
  msGraphMailAdapter,
  megafonVatsAdapter,
  gravitelAdapter,
  mtsVatsAdapter,
  wazzupAdapter,
  twilioWhatsappAdapter,
  gcalAdapter,
  ms365CalendarAdapter,
  icsFeedAdapter,
  outboundWebhooksAdapter,
  publicApiKeysAdapter,
  rostelecomVatsAdapter,
  beelineCloudPbxAdapter,
  uisAdapter,
  onlinePbxAdapter,
  telphinAdapter,
  twilioVoiceAdapter,
  waGreenApiAdapter,
  okBotAdapter,
  wechatOaAdapter,
  lineAdapter,
  metaCapiAdapter,
  ga4MpAdapter,
  smsTwilioAdapter,
  threeCxAdapter,
  eraExternalcallAdapter,
  ...p2CatalogAdapters,
];

const byKey = new Map(adapters.map((a) => [a.manifest.key, a]));

export function listManifests(): ProviderManifest[] {
  return adapters.map((a) => a.manifest);
}

export function getAdapter(providerKey: string): BaseAdapter | undefined {
  return byKey.get(providerKey);
}

export function getManifest(providerKey: string): ProviderManifest | undefined {
  return byKey.get(providerKey)?.manifest;
}
