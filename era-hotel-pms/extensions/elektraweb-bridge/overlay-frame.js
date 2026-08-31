/**
 * Isolated UI document (chrome-extension://) — Elektraweb CSS cannot hide text.
 */
import { ewLocale, ewT } from "./i18n.js";
import { jwtIsExpired, lampTitle, resolveBridgeLamp } from "./lamp.js";

const COLORS = {
  gray: "#6b7280",
  green: "#16a34a",
  yellow: "#ca8a04",
  red: "#dc2626",
};
const MSG = "era-ew-overlay";

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function post(payload) {
  window.parent.postMessage({ source: MSG, ...payload }, "*");
}

function notifySize() {
  const h = Math.ceil(document.documentElement.scrollHeight);
  post({ type: "resize", height: Math.max(52, h) });
}

function needsAuth(s) {
  return !s.token || jwtIsExpired(s.token);
}

function hasSetup(s) {
  return !!(s.hotelBaseUrl && s.organizationId);
}

async function loadState() {
  const s = await chrome.storage.local.get([
    "enabled",
    "writeEnabled",
    "deskRole",
    "locale",
    "token",
    "organizationId",
    "elektrawebHotelId",
    "login",
    "fullName",
    "hotelBaseUrl",
    "lastSyncAt",
    "lastError",
    "ewLoginToken",
  ]);
  const sessionStore = chrome.storage.session
    ? await chrome.storage.session.get(["ewLoginToken"])
    : {};
  s.ewLoginToken = sessionStore.ewLoginToken || s.ewLoginToken || "";
  return s;
}

function openSettings() {
  chrome.runtime.sendMessage({ type: "open-options" });
}

async function render() {
  const s = await loadState();
  const locale = ewLocale(s.locale);
  const { color } = resolveBridgeLamp(s);
  const sanatorium = s.deskRole === "sanatorium";
  const auth = needsAuth(s);
  const setup = hasSetup(s);
  const lamp = document.getElementById("lamp");
  lamp.style.background = COLORS[color];
  lamp.title = lampTitle(locale, color);
  document.getElementById("title").textContent = ewT(locale, "extName");
  document.getElementById("deskLabel").textContent = sanatorium
    ? ewT(locale, "deskSan")
    : ewT(locale, "deskFo");
  document.getElementById("lampHint").textContent = lampTitle(locale, color);
  document.getElementById("enabledLbl").textContent = ewT(locale, "inboundToggle");
  document.getElementById("writeLbl").textContent = ewT(locale, "writeToggle");
  document.getElementById("openOptions").textContent = ewT(locale, "openSettings");
  document.getElementById("openOptionsLogin").textContent = ewT(locale, "openSettings");
  document.getElementById("openOptionsSetup").textContent = ewT(locale, "openSettings");
  document.getElementById("flush").textContent = ewT(locale, "flushNow");
  document.getElementById("btnLogin").textContent = ewT(locale, "btnLogin");
  document.getElementById("loginHint").textContent = ewT(locale, "overlayLoginHint");
  document.getElementById("loginLblText").textContent = ewT(locale, "login");
  document.getElementById("passwordLblText").textContent = ewT(locale, "password");
  document.getElementById("enabled").checked = !!s.enabled;
  document.getElementById("writeRow").hidden = !sanatorium;
  document.getElementById("writeEnabled").checked = !!s.writeEnabled && sanatorium;

  const loginBox = document.getElementById("loginBox");
  const opsBox = document.getElementById("opsBox");
  const setupActions = document.getElementById("setupActions");
  const status = document.getElementById("status");
  const loginInput = document.getElementById("ovLogin");
  const passwordInput = document.getElementById("ovPassword");

  loginBox.hidden = !(auth && setup);
  opsBox.hidden = auth;
  setupActions.hidden = !(auth && !setup);

  if (auth && setup && document.activeElement !== loginInput) {
    loginInput.value = s.login || "";
  }

  if (auth && !setup) {
    status.innerHTML = `<p class="err">${esc(ewT(locale, "overlayNeedSetup"))}</p>`;
    notifySize();
    return;
  }
  if (auth) {
    const why = !s.token ? ewT(locale, "notLoggedIn") : ewT(locale, "sessionExpired");
    status.innerHTML = `<p class="err">${esc(why)}</p>`;
    notifySize();
    return;
  }

  passwordInput.value = "";
  const sync = s.lastSyncAt || ewT(locale, "noSync");
  const health = s.lastError
    ? `<div class="row err">${esc(ewT(locale, "err"))}: ${esc(s.lastError)}</div>`
    : `<div class="row ok">${esc(ewT(locale, "ok"))}</div>`;
  status.innerHTML = `
    <div class="row"><strong>${esc(s.fullName || s.login || "user")}</strong></div>
    <div class="row">${esc(ewT(locale, "ewHotel"))}: <code>${esc(s.elektrawebHotelId || "—")}</code></div>
    <div class="row">${esc(ewT(locale, "lastSync"))}: ${esc(sync)}</div>
    ${health}
  `;
  notifySize();
}

async function submitLogin(event) {
  event.preventDefault();
  const s = await loadState();
  const locale = ewLocale(s.locale);
  const msg = document.getElementById("loginMsg");
  const login = document.getElementById("ovLogin").value.trim();
  const password = document.getElementById("ovPassword").value;
  const hotelBaseUrl = String(s.hotelBaseUrl || "").replace(/\/$/, "");
  const organizationId = String(s.organizationId || "").trim();
  msg.innerHTML = "";
  if (!hotelBaseUrl || !organizationId) {
    msg.innerHTML = `<p class="err">${esc(ewT(locale, "overlayNeedSetup"))}</p>`;
    return;
  }
  if (!login || !password) {
    msg.innerHTML = `<p class="err">${esc(ewT(locale, "fillLoginPassword"))}</p>`;
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
      msg.innerHTML = `<p class="err">${esc(json.error || `${ewT(locale, "loginFailed")} (${res.status})`)}</p>`;
      return;
    }
    await chrome.storage.local.set({
      hotelBaseUrl,
      token: json.token,
      organizationId: json.organizationId || organizationId,
      elektrawebHotelId: String(json.elektrawebHotelId ?? s.elektrawebHotelId ?? ""),
      login: json.user?.login || login,
      fullName: json.user?.fullName || "",
      enabled: true,
      lastError: null,
    });
    document.getElementById("ovPassword").value = "";
    msg.innerHTML = `<p class="ok">${esc(ewT(locale, "sessionOk"))}</p>`;
    await render();
  } catch (e) {
    msg.innerHTML = `<p class="err">${esc(e instanceof Error ? e.message : String(e))}</p>`;
  }
}

function bind() {
  const lamp = document.getElementById("lamp");
  const panel = document.getElementById("panel");
  let dragging = false;
  let moved = false;
  let startX = 0;
  let startY = 0;

  lamp.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    dragging = true;
    moved = false;
    startX = e.screenX;
    startY = e.screenY;
    lamp.setPointerCapture(e.pointerId);
    post({ type: "drag-start" });
  });
  lamp.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.screenX - startX;
    const dy = e.screenY - startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved = true;
    if (moved) post({ type: "drag-move", dx, dy });
  });
  lamp.addEventListener("pointerup", (e) => {
    if (!dragging) return;
    dragging = false;
    try {
      lamp.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (moved) {
      post({ type: "drag-end" });
      return;
    }
    panel.classList.toggle("open");
    if (panel.classList.contains("open")) void render();
    else notifySize();
  });

  document.getElementById("loginBox").addEventListener("submit", (e) => {
    void submitLogin(e);
  });
  document.getElementById("enabled").addEventListener("change", async (e) => {
    await chrome.storage.local.set({ enabled: e.target.checked });
  });
  document.getElementById("writeEnabled").addEventListener("change", async (e) => {
    const s = await chrome.storage.local.get(["deskRole"]);
    if (s.deskRole !== "sanatorium") {
      e.target.checked = false;
      return;
    }
    await chrome.storage.local.set({ writeEnabled: e.target.checked });
  });
  for (const id of ["openOptions", "openOptionsLogin", "openOptionsSetup"]) {
    document.getElementById(id).addEventListener("click", openSettings);
  }
  document.getElementById("flush").addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "flush" }, () => void render());
  });
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key !== "Escape") return;
      panel.classList.remove("open");
      notifySize();
    },
    true,
  );
}

bind();
void render();
chrome.storage.onChanged.addListener(() => {
  void render();
});
setInterval(() => {
  const open = document.getElementById("panel").classList.contains("open");
  if (open) void render();
  else {
    void loadState().then((s) => {
      const { color } = resolveBridgeLamp(s);
      document.getElementById("lamp").style.background = COLORS[color];
      document.getElementById("lamp").title = lampTitle(ewLocale(s.locale), color);
    });
  }
}, 30000);
