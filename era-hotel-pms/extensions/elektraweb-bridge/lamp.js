/**
 * Toolbar lamp (gray / yellow / green / red). Pure helpers — no Chrome APIs.
 * Popup, options, and the service worker share this file.
 */

export const NO_EW_TOKEN_ERROR =
  "SPA write: no Elektraweb LoginToken yet — click in SPA";

export const LAMP_PATHS = {
  gray: { 16: "icons/lamp-gray-16.png", 32: "icons/lamp-gray-32.png" },
  green: { 16: "icons/lamp-green-16.png", 32: "icons/lamp-green-32.png" },
  yellow: { 16: "icons/lamp-yellow-16.png", 32: "icons/lamp-yellow-32.png" },
  red: { 16: "icons/lamp-red-16.png", 32: "icons/lamp-red-32.png" },
};

const LAMP_TITLES = {
  en: {
    gray: "Gray: not logged in — open settings",
    yellow: "Yellow: logged in, capture off — or open Elektraweb SPA",
    green: "Green: session live",
    red: "Red: login expired or sync error — open settings",
  },
  ru: {
    gray: "Серый: нет входа — откройте настройки",
    yellow: "Жёлтый: вход есть, перехват выключен — или откройте SPA в Elektraweb",
    green: "Зелёный: сессия живая",
    red: "Красный: сессия истекла или ошибка синка — откройте настройки",
  },
  az: {
    gray: "Boz: giriş yoxdur — parametrləri açın",
    yellow: "Sarı: giriş var, tutma bağlıdır — və ya Elektraweb SPA açın",
    green: "Yaşıl: sessiya canlıdır",
    red: "Qırmızı: sessiya bitib və ya sinxron xətası — parametrləri açın",
  },
};

export function lampTitle(locale, color) {
  const loc = locale === "en" || locale === "az" || locale === "ru" ? locale : "ru";
  return LAMP_TITLES[loc][color] || LAMP_TITLES.ru[color];
}

/** True when JWT `exp` is in the past. Missing `exp` → not expired (wait for 401). */
export function jwtIsExpired(token) {
  if (!token || typeof token !== "string") return true;
  const parts = token.split(".");
  if (parts.length < 2) return true;
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = "=".repeat((4 - (b64.length % 4)) % 4);
    const json = JSON.parse(atob(b64 + pad));
    if (typeof json.exp !== "number") return false;
    return json.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

/**
 * @param {{
 *   token?: string,
 *   enabled?: boolean,
 *   deskRole?: string,
 *   writeEnabled?: boolean,
 *   lastError?: string | null,
 *   ewLoginToken?: string,
 * }} s
 * @returns {{ color: "gray" | "yellow" | "green" | "red", reason: string }}
 */
export function resolveBridgeLamp(s) {
  const token = s?.token || "";
  if (!token) return { color: "gray", reason: "noToken" };
  if (jwtIsExpired(token)) return { color: "red", reason: "expired" };
  if (!s.enabled) return { color: "yellow", reason: "captureOff" };
  const err = String(s.lastError || "");
  if (err === NO_EW_TOKEN_ERROR) return { color: "yellow", reason: "noEwToken" };
  if (err) return { color: "red", reason: "error" };
  const writeOn = s.deskRole === "sanatorium" && !!s.writeEnabled;
  if (writeOn && !s.ewLoginToken) return { color: "yellow", reason: "noEwToken" };
  return { color: "green", reason: "ok" };
}
