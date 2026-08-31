/**
 * In-page lamp on app.elektraweb.com (Chrome "Open as window" has no toolbar).
 * Isolated world + closed Shadow DOM — not a remote bookmarklet.
 */
import { ewLocale, ewT } from "./i18n.js";
import { lampTitle, resolveBridgeLamp } from "./lamp.js";

const HOST_ID = "era-ew-bridge-overlay";
const COLORS = {
  gray: "#6b7280",
  green: "#16a34a",
  yellow: "#ca8a04",
  red: "#dc2626",
};

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
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
    "lastSyncAt",
    "lastError",
    "ewLoginToken",
    "overlayLeft",
    "overlayTop",
  ]);
  const sessionStore = chrome.storage.session
    ? await chrome.storage.session.get(["ewLoginToken"])
    : {};
  s.ewLoginToken = sessionStore.ewLoginToken || s.ewLoginToken || "";
  return s;
}

function overlayCss() {
  return `
    :host {
      all: initial;
      display: block !important;
      position: fixed !important;
      z-index: 2147483646 !important;
      width: 44px;
      height: 44px;
      pointer-events: none;
      overflow: visible;
    }
    .wrap {
      font-family: "Segoe UI", system-ui, sans-serif;
      font-size: 13px;
      color: #1a2332;
      pointer-events: none;
      overflow: visible;
    }
    .lamp, .panel { pointer-events: auto; }
    .lamp {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      border: 3px solid #fff;
      box-shadow: 0 2px 10px rgba(0,0,0,.35), 0 0 0 1px rgba(0,0,0,.12);
      cursor: pointer;
      display: block;
      padding: 0;
      background: ${COLORS.gray};
    }
    .lamp:focus-visible { outline: 2px solid #0b5fff; outline-offset: 2px; }
    .panel {
      display: none;
      position: absolute;
      right: 0;
      bottom: 52px;
      width: 300px;
      background: #fff;
      border: 1px solid #d7dee6;
      border-radius: 10px;
      box-shadow: 0 8px 28px rgba(0,0,0,.22);
      padding: 12px;
      box-sizing: border-box;
    }
    .panel.open { display: block; }
    .head { display: flex; gap: 8px; align-items: flex-start; margin: 0 0 6px; }
    .head h1 { font-size: 14px; margin: 0 0 2px; }
    .tag { color: #5c6b7a; font-size: 12px; margin: 0; }
    .hint { color: #5c6b7a; font-size: 12px; line-height: 1.35; margin: 0 0 8px; }
    .status { margin: 0 0 8px; }
    .row { margin: 5px 0; }
    .ok { color: #0a7a2f; }
    .err { color: #b00020; }
    .switch { display: flex; align-items: center; gap: 8px; font-weight: 600; margin: 8px 0; cursor: pointer; }
    .actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
    button {
      padding: 6px 10px;
      border: 0;
      border-radius: 6px;
      background: #0b5fff;
      color: #fff;
      font-weight: 600;
      font-size: 12px;
      cursor: pointer;
    }
    button.secondary { background: #4b5563; }
    code { font-size: 11px; }
  `;
}

function clampPos(left, top) {
  const size = 44;
  const maxL = Math.max(8, window.innerWidth - size - 8);
  const maxT = Math.max(8, window.innerHeight - size - 8);
  return {
    left: Math.min(maxL, Math.max(8, left)),
    top: Math.min(maxT, Math.max(8, top)),
  };
}

function defaultPos() {
  return { left: window.innerWidth - 62, top: window.innerHeight - 62 };
}

function mountHost() {
  const existing = document.getElementById(HOST_ID);
  if (existing) existing.remove();
  const host = document.createElement("div");
  host.id = HOST_ID;
  host.style.cssText = "";
  const shadow = host.attachShadow({ mode: "closed" });
  shadow.innerHTML = `
    <style>${overlayCss()}</style>
    <div class="wrap">
      <button type="button" class="lamp" id="lamp" aria-label="ERA Elektraweb Bridge"></button>
      <div class="panel" id="panel" role="dialog">
        <div class="head">
          <div>
            <h1 id="title"></h1>
            <p class="tag" id="deskLabel"></p>
          </div>
        </div>
        <p class="hint" id="lampHint"></p>
        <div class="status" id="status"></div>
        <label class="switch"><input type="checkbox" id="enabled" /><span id="enabledLbl"></span></label>
        <label class="switch" id="writeRow"><input type="checkbox" id="writeEnabled" /><span id="writeLbl"></span></label>
        <div class="actions">
          <button type="button" class="secondary" id="openOptions"></button>
          <button type="button" id="flush"></button>
        </div>
      </div>
    </div>
  `;
  const root = document.documentElement;
  root.appendChild(host);
  return { host, shadow };
}

function applyHostPos(host, left, top) {
  const pos = clampPos(left, top);
  host.style.left = `${pos.left}px`;
  host.style.top = `${pos.top}px`;
  host.style.right = "auto";
  host.style.bottom = "auto";
  return pos;
}

async function render(shadow) {
  const s = await loadState();
  const locale = ewLocale(s.locale);
  const { color } = resolveBridgeLamp(s);
  const sanatorium = s.deskRole === "sanatorium";
  const lamp = shadow.getElementById("lamp");
  lamp.style.background = COLORS[color];
  lamp.title = lampTitle(locale, color);
  shadow.getElementById("title").textContent = ewT(locale, "extName");
  shadow.getElementById("deskLabel").textContent = sanatorium
    ? ewT(locale, "deskSan")
    : ewT(locale, "deskFo");
  shadow.getElementById("lampHint").textContent = lampTitle(locale, color);
  shadow.getElementById("enabledLbl").textContent = ewT(locale, "inboundToggle");
  shadow.getElementById("writeLbl").textContent = ewT(locale, "writeToggle");
  shadow.getElementById("openOptions").textContent = ewT(locale, "openSettings");
  shadow.getElementById("flush").textContent = ewT(locale, "flushNow");
  shadow.getElementById("enabled").checked = !!s.enabled;
  const writeRow = shadow.getElementById("writeRow");
  writeRow.hidden = !sanatorium;
  shadow.getElementById("writeEnabled").checked = !!s.writeEnabled && sanatorium;

  const status = shadow.getElementById("status");
  if (!s.token) {
    status.innerHTML = `<p class="err">${esc(ewT(locale, "notLoggedIn"))}</p>`;
    return;
  }
  const sync = s.lastSyncAt || ewT(locale, "noSync");
  const health = s.lastError
    ? `<div class="row err">${esc(ewT(locale, "err"))}: ${esc(s.lastError)}</div>`
    : `<div class="row ok">${esc(ewT(locale, "ok"))}</div>`;
  status.innerHTML = `
    <div class="row"><strong>${esc(s.login || "user")}</strong></div>
    <div class="row">${esc(ewT(locale, "ewHotel"))}: <code>${esc(s.elektrawebHotelId || "—")}</code></div>
    <div class="row">${esc(ewT(locale, "lastSync"))}: ${esc(sync)}</div>
    ${health}
  `;
}

function bind(host, shadow) {
  const lamp = shadow.getElementById("lamp");
  const panel = shadow.getElementById("panel");
  let dragging = false;
  let moved = false;
  let startX = 0;
  let startY = 0;
  let origLeft = 0;
  let origTop = 0;

  lamp.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    dragging = true;
    moved = false;
    startX = e.clientX;
    startY = e.clientY;
    origLeft = host.offsetLeft;
    origTop = host.offsetTop;
    lamp.setPointerCapture(e.pointerId);
  });
  lamp.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved = true;
    if (moved) applyHostPos(host, origLeft + dx, origTop + dy);
  });
  lamp.addEventListener("pointerup", async (e) => {
    if (!dragging) return;
    dragging = false;
    try {
      lamp.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (moved) {
      const pos = applyHostPos(host, host.offsetLeft, host.offsetTop);
      await chrome.storage.local.set({ overlayLeft: pos.left, overlayTop: pos.top });
      return;
    }
    panel.classList.toggle("open");
    if (panel.classList.contains("open")) void render(shadow);
  });

  shadow.getElementById("enabled").addEventListener("change", async (e) => {
    await chrome.storage.local.set({ enabled: e.target.checked });
  });
  shadow.getElementById("writeEnabled").addEventListener("change", async (e) => {
    const s = await chrome.storage.local.get(["deskRole"]);
    if (s.deskRole !== "sanatorium") {
      e.target.checked = false;
      return;
    }
    await chrome.storage.local.set({ writeEnabled: e.target.checked });
  });
  shadow.getElementById("openOptions").addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "open-options" });
  });
  shadow.getElementById("flush").addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "flush" }, () => void render(shadow));
  });

  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Escape") panel.classList.remove("open");
    },
    true,
  );
}

async function start() {
  const { host, shadow } = mountHost();
  const stored = await chrome.storage.local.get(["overlayLeft", "overlayTop"]);
  if (typeof stored.overlayLeft === "number" && typeof stored.overlayTop === "number") {
    applyHostPos(host, stored.overlayLeft, stored.overlayTop);
  } else {
    const d = defaultPos();
    applyHostPos(host, d.left, d.top);
  }
  bind(host, shadow);
  await render(shadow);
  const keepOnTop = new MutationObserver(() => {
    const parent = host.parentElement;
    if (parent && parent.lastElementChild !== host) parent.appendChild(host);
  });
  keepOnTop.observe(document.documentElement, { childList: true });
  chrome.storage.onChanged.addListener(() => {
    void render(shadow);
  });
  window.addEventListener("resize", async () => {
    const s = await chrome.storage.local.get(["overlayLeft", "overlayTop"]);
    if (typeof s.overlayLeft === "number" && typeof s.overlayTop === "number") {
      applyHostPos(host, s.overlayLeft, s.overlayTop);
    } else {
      const d = defaultPos();
      applyHostPos(host, d.left, d.top);
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => void start(), { once: true });
} else {
  void start();
}
