import { ewApplyI18n, ewLocale, ewT } from "./i18n.js";
import { lampTitle, resolveBridgeLamp } from "./lamp.js";

const $ = (id) => document.getElementById(id);

function paintLamp(state, locale) {
  const { color } = resolveBridgeLamp(state);
  $("lampDot").setAttribute("data-color", color);
  $("lampHint").textContent = lampTitle(locale, color);
}

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function render() {
  const s = await chrome.storage.local.get([
    "enabled",
    "writeEnabled",
    "deskRole",
    "locale",
    "token",
    "organizationId",
    "elektrawebHotelId",
    "login",
    "hotelBaseUrl",
    "lastSyncAt",
    "lastError",
    "ewLoginToken",
  ]);
  const sessionStore = chrome.storage.session
    ? await chrome.storage.session.get(["ewLoginToken"])
    : {};
  s.ewLoginToken = sessionStore.ewLoginToken || s.ewLoginToken || "";
  const locale = ewLocale(s.locale);
  const sanatorium = s.deskRole === "sanatorium";
  ewApplyI18n(document, locale);
  document.documentElement.lang = locale;
  paintLamp(s, locale);

  $("enabled").checked = !!s.enabled;
  $("writeRow").hidden = !sanatorium;
  $("writeEnabled").checked = !!s.writeEnabled && sanatorium;
  $("deskLabel").textContent = sanatorium ? ewT(locale, "deskSan") : ewT(locale, "deskFo");

  if (!s.token) {
    $("status").innerHTML = `<p class="err">${esc(ewT(locale, "notLoggedIn"))}</p>`;
    return;
  }
  const sync = s.lastSyncAt || ewT(locale, "noSync");
  const health = s.lastError
    ? `<div class="ew-pop-row err">${esc(s.lastError)}</div>`
    : `<div class="ew-pop-row ok">${esc(ewT(locale, "ok"))}</div>`;
  $("status").innerHTML = `
    <div class="ew-pop-row"><strong>${esc(s.login || "user")}</strong></div>
    <div class="ew-pop-row">${esc(ewT(locale, "ewHotel"))}: <code>${esc(s.elektrawebHotelId || "—")}</code></div>
    <div class="ew-pop-row">${esc(ewT(locale, "lastSync"))}: ${esc(sync)}</div>
    ${health}
  `;
}

$("enabled").addEventListener("change", async () => {
  await chrome.storage.local.set({ enabled: $("enabled").checked });
});

$("writeEnabled").addEventListener("change", async () => {
  const s = await chrome.storage.local.get(["deskRole"]);
  if (s.deskRole !== "sanatorium") {
    $("writeEnabled").checked = false;
    return;
  }
  await chrome.storage.local.set({ writeEnabled: $("writeEnabled").checked });
});

$("openOptions").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

$("flush").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "flush" }, () => void render());
});

chrome.storage.onChanged.addListener(() => {
  void render();
});

void render();
