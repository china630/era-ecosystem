"use client";

import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import { ERA_I18N_COOKIE, uiLang, type Locale } from "@era/i18n-common";
import { resources } from "./resources";

const LANG_STORAGE_KEY = ERA_I18N_COOKIE;
const LEGACY_STORAGE_KEY = "erafinance_i18n_lang";

function migrateLegacyStorage() {
  try {
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy && !localStorage.getItem(LANG_STORAGE_KEY)) {
      localStorage.setItem(LANG_STORAGE_KEY, legacy.trim().toLowerCase());
    }
    const v = localStorage.getItem(LANG_STORAGE_KEY);
    if (v) {
      const norm = v.trim().toLowerCase();
      if (norm && norm !== v) localStorage.setItem(LANG_STORAGE_KEY, norm);
    }
  } catch {
    /* ignore */
  }
}

migrateLegacyStorage();

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    react: {
      bindI18nStore: "added updated",
    },
    fallbackLng: { en: ["az"], ru: ["az"], default: ["az"] },
    supportedLngs: ["az", "ru", "en"],
    cleanCode: true,
    load: "languageOnly",
    nonExplicitSupportedLngs: true,
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: LANG_STORAGE_KEY,
    },
  });

function persistLanguage(lng: Locale) {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lng);
    localStorage.setItem(LEGACY_STORAGE_KEY, lng);
    document.cookie = `${ERA_I18N_COOKIE}=${lng};path=/;max-age=31536000;SameSite=Lax`;
  } catch {
    /* ignore */
  }
}

function ensureSupportedLanguage() {
  const fixed = uiLang(i18n.language);
  persistLanguage(fixed);
  if (i18n.language !== fixed) {
    void i18n.changeLanguage(fixed);
  }
}

i18n.on("initialized", ensureSupportedLanguage);
i18n.on("languageChanged", ensureSupportedLanguage);

export default i18n;
