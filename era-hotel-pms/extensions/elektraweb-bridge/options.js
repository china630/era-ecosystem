import { ewApplyI18n, ewLocale, ewT } from "./i18n.js";
import { lampTitle, resolveBridgeLamp } from "./lamp.js";

const $ = (id) => document.getElementById(id);

function paintLamp(data, locale) {
  const { color } = resolveBridgeLamp(data);
  $("lampDot").setAttribute("data-color", color);
  $("lampHint").textContent = lampTitle(locale, color);
}

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function loadState() {
  const data = await chrome.storage.local.get([
    "token",
    "organizationId",
    "elektrawebHotelId",
    "login",
    "fullName",
    "hotelBaseUrl",
    "enabled",
    "writeEnabled",
    "deskRole",
    "locale",
    "lastSyncAt",
    "lastError",
    "queue",
    "ewLoginToken",
  ]);
  const sessionStore = chrome.storage.session
    ? await chrome.storage.session.get(["ewLoginToken"])
    : {};
  data.ewLoginToken = sessionStore.ewLoginToken || data.ewLoginToken || "";
  return data;
}

function deskRoleOf(data) {
  return data.deskRole === "sanatorium" ? "sanatorium" : "hotel_fo";
}

function renderSession(data, locale) {
  if (!data.token) {
    $("session").textContent = ewT(locale, "sessionNone");
    return;
  }
  $("session").innerHTML = `
    <div><strong>${esc(data.fullName || data.login)}</strong> (${esc(data.login)})</div>
    <div>Hotel URL: <code>${esc(data.hotelBaseUrl || "—")}</code></div>
    <div>ERA org: <code>${esc(data.organizationId || "—")}</code></div>
    <div>Elektraweb HOTELID: <code>${esc(data.elektrawebHotelId || "—")}</code></div>
  `;
}

function renderInboundMeta(data, locale) {
  const q = Array.isArray(data.queue) ? data.queue.length : 0;
  const sync = data.lastSyncAt ? data.lastSyncAt : ewT(locale, "noSync");
  const err = data.lastError
    ? `<span class="err">${esc(ewT(locale, "err"))}: ${esc(data.lastError)}</span>`
    : `<span class="ok">${esc(ewT(locale, "ok"))}</span>`;
  $("inboundMeta").innerHTML = `
    <div>${esc(ewT(locale, "lastSync"))}: ${esc(sync)}</div>
    <div>${esc(ewT(locale, "queue"))}: ${q}</div>
    <div>${err}</div>
  `;
}

function renderWrite(data, locale) {
  const sanatorium = deskRoleOf(data) === "sanatorium";
  $("writeEnabled").disabled = !sanatorium;
  if (!sanatorium) {
    $("writeBanner").textContent = ewT(locale, "writeFoBlocked");
    return;
  }
  $("writeBanner").textContent = ewT(locale, "writeIdle");
}

function applyLocaleButtons(locale) {
  document.querySelectorAll(".ew-lang button").forEach((btn) => {
    btn.setAttribute("aria-pressed", btn.getAttribute("data-locale") === locale ? "true" : "false");
  });
  document.documentElement.lang = locale;
}

async function render() {
  const data = await loadState();
  const locale = ewLocale(data.locale);
  ewApplyI18n(document, locale);
  applyLocaleButtons(locale);
  paintLamp(data, locale);

  if (data.hotelBaseUrl) $("hotelBaseUrl").value = data.hotelBaseUrl;
  if (data.organizationId) $("organizationId").value = data.organizationId;
  if (data.login) $("login").value = data.login;
  $("enabled").checked = !!data.enabled;
  $("writeEnabled").checked = !!data.writeEnabled && deskRoleOf(data) === "sanatorium";
  const role = deskRoleOf(data);
  document.querySelectorAll('input[name="deskRole"]').forEach((el) => {
    el.checked = el.value === role;
  });

  renderSession(data, locale);
  renderInboundMeta(data, locale);
  renderWrite(data, locale);
}

$("btnLogin").addEventListener("click", async () => {
  const hotelBaseUrl = $("hotelBaseUrl").value.trim().replace(/\/$/, "");
  const organizationId = $("organizationId").value.trim();
  const login = $("login").value.trim();
  const password = $("password").value;
  const data = await loadState();
  const locale = ewLocale(data.locale);
  $("msg").innerHTML = "";
  if (!hotelBaseUrl || !login || !password) {
    $("msg").innerHTML = `<p class="err">${esc(ewT(locale, "fillAll"))}</p>`;
    return;
  }
  if (!organizationId) {
    $("msg").innerHTML = `<p class="err">${esc(ewT(locale, "fillOrg"))}</p>`;
    return;
  }
  try {
    const res = await fetch(`${hotelBaseUrl}/api/integrations/elektraweb-bridge/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login, password, organizationId }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      $("msg").innerHTML = `<p class="err">${esc(json.error || `${ewT(locale, "loginFailed")} (${res.status})`)}</p>`;
      return;
    }
    await chrome.storage.local.set({
      hotelBaseUrl,
      token: json.token,
      organizationId: json.organizationId || organizationId,
      elektrawebHotelId: String(json.elektrawebHotelId),
      login: json.user?.login || login,
      fullName: json.user?.fullName || "",
      enabled: true,
      lastError: null,
    });
    $("password").value = "";
    $("msg").innerHTML = `<p class="ok">${esc(ewT(locale, "sessionOk"))}</p>`;
    await render();
  } catch (e) {
    $("msg").innerHTML = `<p class="err">${esc(e instanceof Error ? e.message : String(e))}</p>`;
  }
});

$("btnLogout").addEventListener("click", async () => {
  const data = await loadState();
  const locale = ewLocale(data.locale);
  await chrome.storage.local.remove([
    "token",
    "organizationId",
    "elektrawebHotelId",
    "login",
    "fullName",
    "lastResult",
    "lastError",
    "queue",
  ]);
  await chrome.storage.local.set({ enabled: false, writeEnabled: false });
  $("msg").innerHTML = `<p class="ok">${esc(ewT(locale, "loggedOut"))}</p>`;
  await render();
});

$("enabled").addEventListener("change", async () => {
  await chrome.storage.local.set({ enabled: $("enabled").checked });
});

$("writeEnabled").addEventListener("change", async () => {
  const data = await loadState();
  if (deskRoleOf(data) !== "sanatorium") {
    $("writeEnabled").checked = false;
    return;
  }
  await chrome.storage.local.set({ writeEnabled: $("writeEnabled").checked });
});

document.querySelectorAll('input[name="deskRole"]').forEach((el) => {
  el.addEventListener("change", async () => {
    const deskRole = el.value === "sanatorium" ? "sanatorium" : "hotel_fo";
    const patch = { deskRole };
    if (deskRole !== "sanatorium") patch.writeEnabled = false;
    await chrome.storage.local.set(patch);
    await render();
  });
});

document.querySelectorAll(".ew-lang button").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const locale = ewLocale(btn.getAttribute("data-locale"));
    await chrome.storage.local.set({ locale });
    await render();
  });
});

$("flush").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "flush" }, () => void render());
});

chrome.storage.onChanged.addListener(() => {
  void render();
});

void render();
