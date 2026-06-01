import { createNextIntlRequest } from "@era/i18n-common/server";
import type { Locale } from "@era/i18n-common";
import azMessages from "../../messages/az.json";
import enMessages from "../../messages/en.json";
import ruMessages from "../../messages/ru.json";

const APP_MESSAGES: Record<Locale, Record<string, unknown>> = {
  az: azMessages as Record<string, unknown>,
  en: enMessages as Record<string, unknown>,
  ru: ruMessages as Record<string, unknown>,
};

export default createNextIntlRequest(async (locale) => APP_MESSAGES[locale]);
