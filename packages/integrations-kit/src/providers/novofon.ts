import { zadarmaAdapter } from "./zadarma";
import type { TelephonyAdapter } from "../types";

/**
 * Novofon shares Zadarma-compatible NOTIFY_* telephony webhooks (same signature family).
 */
export const novofonAdapter: TelephonyAdapter = {
  ...zadarmaAdapter,
  manifest: {
    ...zadarmaAdapter.manifest,
    key: "novofon",
    name: "Novofon (NOTIFY_* / Zadarma-compatible)",
    docsUrl: "https://novofon.com/",
    setupSteps: {
      ru: [
        "API key/secret в кабинете Novofon",
        "Webhook: события NOTIFY_* (совместимы с Zadarma)",
        "Подпись HMAC-SHA1 как у Zadarma",
        "Проверить → Включить",
      ],
      en: [
        "API key/secret from Novofon cabinet",
        "Webhook: NOTIFY_* events (Zadarma-compatible)",
        "HMAC-SHA1 signature same as Zadarma",
        "Test → Enable",
      ],
      az: [
        "Novofon API key/secret",
        "Webhook: NOTIFY_* (Zadarma uyğun)",
        "Zadarma kimi HMAC imza",
        "Yoxla → Aktiv et",
      ],
    },
  },
};