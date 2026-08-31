/**
 * Positions an extension-origin iframe on Elektraweb.
 * UI lives in overlay-frame.html so EW CSS cannot hide labels.
 */
const HOST_ID = "era-ew-bridge-overlay";
const MSG = "era-ew-overlay";

function clampPos(left, top) {
  const w = 320;
  const h = 44;
  const maxL = Math.max(8, window.innerWidth - w - 8);
  const maxT = Math.max(8, window.innerHeight - h - 8);
  return {
    left: Math.min(maxL, Math.max(8, left)),
    top: Math.min(maxT, Math.max(8, top)),
  };
}

function defaultPos() {
  return { left: window.innerWidth - 400, top: window.innerHeight - 72 };
}

function shouldUseStoredPos(left, top) {
  if (typeof left !== "number" || typeof top !== "number") return false;
  if (left > window.innerWidth - 180) return false;
  return true;
}

function viewportBigEnough() {
  return window.innerWidth >= 400 && window.innerHeight >= 280;
}

function topLampAlreadyVisible() {
  try {
    const el = window.top.document.getElementById(HOST_ID);
    if (!el) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 20 || r.height < 20) return false;
    const vw = window.top.innerWidth;
    const vh = window.top.innerHeight;
    return r.bottom > 0 && r.right > 0 && r.top < vh && r.left < vw;
  } catch {
    return false;
  }
}

function applyHostPos(host, left, top) {
  const pos = clampPos(left, top);
  const bottom = Math.max(8, window.innerHeight - pos.top - 44);
  host.style.setProperty("position", "fixed", "important");
  host.style.setProperty("left", `${pos.left}px`, "important");
  host.style.setProperty("right", "auto", "important");
  host.style.setProperty("top", "auto", "important");
  host.style.setProperty("bottom", `${bottom}px`, "important");
  return pos;
}

function styleHost(host, iframe) {
  host.style.setProperty("display", "block", "important");
  host.style.setProperty("z-index", "2147483646", "important");
  host.style.setProperty("width", "320px", "important");
  host.style.setProperty("height", "56px", "important");
  host.style.setProperty("overflow", "visible", "important");
  host.style.setProperty("background", "transparent", "important");
  host.style.setProperty("border", "0", "important");
  host.style.setProperty("margin", "0", "important");
  host.style.setProperty("padding", "0", "important");
  host.style.setProperty("pointer-events", "auto", "important");
  iframe.setAttribute("allowtransparency", "true");
  iframe.title = "ERA Elektraweb Bridge";
  iframe.style.cssText =
    "display:block;width:320px;height:56px;border:0;background:transparent;color-scheme:light;overflow:hidden";
}

function mountHost() {
  const existing = document.getElementById(HOST_ID);
  if (existing) existing.remove();
  const host = document.createElement("div");
  host.id = HOST_ID;
  const iframe = document.createElement("iframe");
  iframe.src = chrome.runtime.getURL("overlay-frame.html");
  styleHost(host, iframe);
  host.appendChild(iframe);
  document.documentElement.appendChild(host);
  return { host, iframe };
}

async function start() {
  if (!viewportBigEnough()) return;
  if (window.top !== window) {
    if (topLampAlreadyVisible()) return;
    await new Promise((r) => setTimeout(r, 300));
    if (topLampAlreadyVisible()) return;
  }
  if (window.__eraEwOverlayStarted) return;
  window.__eraEwOverlayStarted = true;
  const { host, iframe } = mountHost();
  let dragOrig = null;
  const stored = await chrome.storage.local.get(["overlayLeft", "overlayTop"]);
  if (shouldUseStoredPos(stored.overlayLeft, stored.overlayTop)) {
    applyHostPos(host, stored.overlayLeft, stored.overlayTop);
  } else {
    const d = defaultPos();
    applyHostPos(host, d.left, d.top);
  }

  window.addEventListener("message", async (event) => {
    if (event.source !== iframe.contentWindow) return;
    const data = event.data;
    if (!data || data.source !== MSG) return;
    if (data.type === "resize" && typeof data.height === "number") {
      const h = Math.min(480, Math.max(52, data.height + 4));
      iframe.style.height = `${h}px`;
      host.style.setProperty("height", `${h}px`, "important");
      return;
    }
    if (data.type === "drag-start") {
      dragOrig = {
        left: host.offsetLeft,
        top: host.offsetTop + host.offsetHeight - 44,
      };
      return;
    }
    if (data.type === "drag-move" && dragOrig) {
      applyHostPos(host, dragOrig.left + data.dx, dragOrig.top + data.dy);
      return;
    }
    if (data.type === "drag-end") {
      const pos = applyHostPos(
        host,
        host.offsetLeft,
        host.offsetTop + host.offsetHeight - 44,
      );
      await chrome.storage.local.set({ overlayLeft: pos.left, overlayTop: pos.top });
      dragOrig = null;
    }
  });

  const keepOnTop = new MutationObserver(() => {
    const parent = host.parentElement;
    if (parent && parent.lastElementChild !== host) parent.appendChild(host);
  });
  keepOnTop.observe(document.documentElement, { childList: true });
  window.addEventListener("resize", async () => {
    const s = await chrome.storage.local.get(["overlayLeft", "overlayTop"]);
    if (shouldUseStoredPos(s.overlayLeft, s.overlayTop)) {
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
