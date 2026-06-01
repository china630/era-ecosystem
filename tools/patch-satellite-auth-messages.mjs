#!/usr/bin/env node
/** Add shared auth i18n namespace to satellite message files missing it. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const AUTH = {
  az: {
    loginFailed: "Giriş uğursuz oldu",
    footerLegalNavAria: "Hüquqi keçidlər və kömək",
    footerFaq: "FAQ",
    footerTerms: "İstifadə şərtləri",
    footerPrivacy: "Məxfilik",
    footerStatus: "Status",
  },
  ru: {
    loginFailed: "Ошибка входа",
    footerLegalNavAria: "Юридические ссылки и справка",
    footerFaq: "FAQ",
    footerTerms: "Условия использования",
    footerPrivacy: "Конфиденциальность",
    footerStatus: "Статус",
  },
  en: {
    loginFailed: "Login failed",
    footerLegalNavAria: "Legal links and help",
    footerFaq: "FAQ",
    footerTerms: "Terms of use",
    footerPrivacy: "Privacy",
    footerStatus: "Status",
  },
};

const MESSAGE_DIRS = [
  "era-clinic/messages",
  "era-retail-pos/messages",
  "era-logistics/messages",
  "era-construction/messages",
  "era-crm/messages",
  "era-auto-service/messages",
  "era-wholesale/messages",
  "era-fnb-pos/messages",
  "era-orchestrator/apps/web/messages",
];

const FOOTER_KEYS = [
  "footerLegalNavAria",
  "footerFaq",
  "footerTerms",
  "footerPrivacy",
  "footerStatus",
];

for (const dir of MESSAGE_DIRS) {
  for (const locale of ["az", "ru", "en"]) {
    const file = path.join(root, dir, `${locale}.json`);
    if (!fs.existsSync(file)) continue;
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    const base = AUTH[locale];
    if (!data.auth) {
      data.auth = { ...base };
      console.log("added auth:", file);
    } else {
      let changed = false;
      for (const [k, v] of Object.entries(base)) {
        if (data.auth[k] === undefined) {
          data.auth[k] = v;
          changed = true;
        }
      }
      if (changed) console.log("patched auth:", file);
      else console.log("skip (complete):", file);
    }
    fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  }
}

// Hotel PMS: only footer keys (has auth but may lack footer*)
const hotelDir = path.join(root, "era-hotel-pms/messages");
for (const locale of ["az", "ru", "en"]) {
  const file = path.join(hotelDir, `${locale}.json`);
  if (!fs.existsSync(file)) continue;
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  data.auth ??= {};
  let changed = false;
  for (const k of FOOTER_KEYS) {
    if (data.auth[k] === undefined) {
      data.auth[k] = AUTH[locale][k];
      changed = true;
    }
  }
  if (changed) {
    fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    console.log("patched hotel footer auth:", file);
  }
}
