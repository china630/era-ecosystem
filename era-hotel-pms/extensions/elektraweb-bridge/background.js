import { LAMP_PATHS, NO_EW_TOKEN_ERROR, lampTitle, resolveBridgeLamp } from './lamp.js';

/**
 * Guest Cards = ~100 rows/page → 1 queue envelope per page.
 * Old MAX_QUEUE=40 dropped oldest pages while hotel waited on serial MDM resolve
 * (~100 HTTP/page). Cap high; never shift() under load. Soft warn only.
 */
const MAX_QUEUE = 2000;
const FLUSH_BATCH = 3;

let flushInFlight = false;
let flushAgain = false;

async function getSettings() {
  const data = await chrome.storage.local.get([
    'enabled',
    'writeEnabled',
    'deskRole',
    'locale',
    'hotelBaseUrl',
    'token',
    'organizationId',
    'elektrawebHotelId',
    'login',
    'fullName',
    'lastSyncAt',
    'lastError',
    'lastResult',
    'ewLoginToken',
    'queueDepth',
    'queueDropped',
  ]);
  const sessionStore = chrome.storage.session
    ? await chrome.storage.session.get(['ewLoginToken'])
    : {};
  const deskRole = data.deskRole === 'sanatorium' ? 'sanatorium' : 'hotel_fo';
  return {
    enabled: !!data.enabled,
    writeEnabled: deskRole === 'sanatorium' && !!data.writeEnabled,
    deskRole,
    locale: data.locale === 'en' || data.locale === 'az' ? data.locale : 'ru',
    hotelBaseUrl: (data.hotelBaseUrl || '').replace(/\/$/, ''),
    token: data.token || '',
    organizationId: data.organizationId || '',
    elektrawebHotelId: data.elektrawebHotelId || '',
    login: data.login || '',
    fullName: data.fullName || '',
    lastSyncAt: data.lastSyncAt || null,
    lastError: data.lastError || null,
    lastResult: data.lastResult || null,
    ewLoginToken: sessionStore.ewLoginToken || data.ewLoginToken || '',
    queueDepth: Number(data.queueDepth) || 0,
    queueDropped: Number(data.queueDropped) || 0,
  };
}

async function refreshToolbarLamp() {
  const s = await getSettings();
  const { color } = resolveBridgeLamp(s);
  try {
    await chrome.action.setIcon({ path: LAMP_PATHS[color] });
    await chrome.action.setTitle({ title: lampTitle(s.locale, color) });
  } catch {
    /* icon files missing or action unavailable */
  }
}

async function setPartial(patch) {
  await chrome.storage.local.set(patch);
}

async function enqueue(payload) {
  const { queue = [], queueDropped = 0 } = await chrome.storage.local.get([
    'queue',
    'queueDropped',
  ]);
  queue.push(payload);
  let dropped = Number(queueDropped) || 0;
  // Prefer dropping non-guest traffic if hard-capped (FOCP floods).
  while (queue.length > MAX_QUEUE) {
    const dropIdx = queue.findIndex((item) => {
      const hint = String(item?.entityHint || item?.entity || '').toLowerCase();
      return hint !== 'guest';
    });
    if (dropIdx >= 0) {
      queue.splice(dropIdx, 1);
    } else {
      queue.shift();
    }
    dropped += 1;
  }
  await chrome.storage.local.set({
    queue,
    queueDepth: queue.length,
    queueDropped: dropped,
    ...(dropped > (Number(queueDropped) || 0)
      ? {
          lastError: `Queue overflow: dropped ${dropped} envelope(s). Slow scroll; wait Queue=0.`,
        }
      : {}),
  });
}

async function getEwWriteSession() {
  const sessionStore = chrome.storage.session
    ? await chrome.storage.session.get(['ewLoginToken', 'ewApiHost'])
    : {};
  const local = await chrome.storage.local.get(['ewLoginToken', 'ewApiHost']);
  return {
    token: sessionStore.ewLoginToken || local.ewLoginToken || '',
    apiHost: sessionStore.ewApiHost || local.ewApiHost || '',
  };
}

async function drainOutbox() {
  const settings = await getSettings();
  if (!settings.writeEnabled || !settings.hotelBaseUrl || !settings.token) return;
  const { token, apiHost } = await getEwWriteSession();
  if (!token || !apiHost) {
    await setPartial({ lastError: NO_EW_TOKEN_ERROR });
    return;
  }
  try {
    const res = await fetch(`${settings.hotelBaseUrl}/api/integrations/elektraweb-bridge/outbox`, {
      headers: { Authorization: `Bearer ${settings.token}` },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      await setPartial({ lastError: json.error || `Outbox HTTP ${res.status}` });
      return;
    }
    const items = json.items || json.data?.items || [];
    if (!json.writeEnabled && !items.length) return;
    for (const item of items) {
      const body = { ...(item.insert?.body || {}), LoginToken: token };
      const ewRes = await fetch(`https://${apiHost}${item.insert?.urlPath || '/Execute/SP_SPA_SAVE'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const ewText = await ewRes.text();
      await fetch(
        `${settings.hotelBaseUrl}/api/integrations/elektraweb-bridge/outbox/${item.id}/ack`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${settings.token}`,
          },
          body: JSON.stringify({
            ok: ewRes.ok,
            error: ewRes.ok ? null : ewText.slice(0, 400),
          }),
        },
      );
    }
    if (items.length) {
      await setPartial({ lastSyncAt: new Date().toISOString(), lastError: null });
    }
  } catch (e) {
    await setPartial({ lastError: e instanceof Error ? e.message : String(e) });
  }
}

/** One small batch — guest pages are large; keep concurrency low. */
async function flushOneBatch() {
  const settings = await getSettings();
  if (!settings.enabled || !settings.hotelBaseUrl || !settings.token) return false;

  const { queue = [] } = await chrome.storage.local.get('queue');
  if (!queue.length) {
    await setPartial({ queueDepth: 0 });
    return false;
  }

  const batch = queue.splice(0, FLUSH_BATCH);
  await chrome.storage.local.set({ queue, queueDepth: queue.length });

  try {
    const res = await fetch(`${settings.hotelBaseUrl}/api/integrations/elektraweb-bridge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.token}`,
      },
      body: JSON.stringify({ items: batch }),
    });
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = { error: text };
    }
    if (!res.ok) {
      await setPartial({ lastError: json.error || `HTTP ${res.status}` });
      const { queue: q2 = [] } = await chrome.storage.local.get('queue');
      const restored = [...batch, ...q2];
      await chrome.storage.local.set({
        queue: restored.slice(0, MAX_QUEUE),
        queueDepth: Math.min(restored.length, MAX_QUEUE),
      });
      return false;
    }
    await setPartial({
      lastSyncAt: new Date().toISOString(),
      lastError: null,
      lastResult: json,
      organizationId: json.organizationId || settings.organizationId,
      elektrawebHotelId: json.elektrawebHotelId || settings.elektrawebHotelId,
    });
    return true;
  } catch (e) {
    await setPartial({ lastError: e instanceof Error ? e.message : String(e) });
    const { queue: q2 = [] } = await chrome.storage.local.get('queue');
    const restored = [...batch, ...q2];
    await chrome.storage.local.set({
      queue: restored.slice(0, MAX_QUEUE),
      queueDepth: Math.min(restored.length, MAX_QUEUE),
    });
    return false;
  }
}

async function flushQueue() {
  if (flushInFlight) {
    flushAgain = true;
    return;
  }
  flushInFlight = true;
  try {
    do {
      flushAgain = false;
      // Drain until empty or a hard failure (HTTP error leaves items re-queued).
      for (;;) {
        const ok = await flushOneBatch();
        const { queue = [] } = await chrome.storage.local.get('queue');
        if (!queue.length) break;
        if (!ok) break;
      }
    } while (flushAgain);
  } finally {
    flushInFlight = false;
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'elektraweb-select' && msg.payload) {
    (async () => {
      const settings = await getSettings();
      if (!settings.enabled) {
        sendResponse({ ok: false, reason: 'disabled' });
        return;
      }
      await enqueue(msg.payload);
      // Kick drain; do not block the EW page on full queue empty.
      void flushQueue()
        .then(() => drainOutbox())
        .then(() => refreshToolbarLamp());
      const { queue = [] } = await chrome.storage.local.get('queue');
      sendResponse({ ok: true, queueDepth: queue.length });
    })();
    return true;
  }
  if (msg?.type === 'elektraweb-token' && msg.payload) {
    (async () => {
      const patch = {
        ewApiHost: msg.payload.apiHost || '',
        ewLoginToken: msg.payload.loginToken || '',
      };
      if (chrome.storage.session) await chrome.storage.session.set(patch);
      else await chrome.storage.local.set(patch);
      await chrome.storage.local.set({ ewApiHost: patch.ewApiHost });
      await refreshToolbarLamp();
      sendResponse({ ok: true });
    })();
    return true;
  }
  if (msg?.type === 'get-status') {
    getSettings().then(async (s) => {
      const { queue = [] } = await chrome.storage.local.get('queue');
      sendResponse({ ...s, queueDepth: queue.length });
    });
    return true;
  }
  if (msg?.type === 'flush') {
    flushQueue()
      .then(() => drainOutbox())
      .then(() => refreshToolbarLamp())
      .then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg?.type === 'open-options') {
    void chrome.runtime.openOptionsPage();
    sendResponse({ ok: true });
    return true;
  }
  return false;
});

chrome.alarms.create('ew-bridge-flush', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'ew-bridge-flush') {
    void flushQueue().then(() => drainOutbox()).then(() => refreshToolbarLamp());
  }
});

chrome.storage.onChanged.addListener(() => {
  void refreshToolbarLamp();
});

function isElektrawebUrl(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'elektraweb.com' || host.endsWith('.elektraweb.com');
  } catch {
    return false;
  }
}

const injectingFrames = new Set();

async function injectIntoFrame(tabId, frameId) {
  const key = `${tabId}:${frameId}`;
  if (injectingFrames.has(key)) return;
  injectingFrames.add(key);
  const target = { tabId, frameIds: [frameId] };
  try {
    await chrome.scripting.executeScript({
      target,
      files: ['injected.js'],
      world: 'MAIN',
      injectImmediately: true,
    });
    await chrome.scripting.executeScript({
      target,
      files: ['content.js'],
      world: 'ISOLATED',
      injectImmediately: true,
    });
  } catch {
    /* chrome://, discarded tab, or host not permitted */
  } finally {
    injectingFrames.delete(key);
  }
}

async function injectTabFrames(tabId) {
  try {
    const frames = await chrome.webNavigation.getAllFrames({ tabId });
    if (!frames || !frames.length) {
      await injectIntoFrame(tabId, 0);
      return;
    }
    for (const frame of frames) {
      if (frame.url && isElektrawebUrl(frame.url)) {
        await injectIntoFrame(tabId, frame.frameId);
      }
    }
  } catch {
    await injectIntoFrame(tabId, 0);
  }
}

async function injectAllElektrawebTabs() {
  let tabs = [];
  try {
    tabs = await chrome.tabs.query({});
  } catch {
    return;
  }
  for (const tab of tabs) {
    if (!tab.id) continue;
    if (tab.url && isElektrawebUrl(tab.url)) {
      await injectTabFrames(tab.id);
      continue;
    }
    try {
      const frames = await chrome.webNavigation.getAllFrames({ tabId: tab.id });
      const hit = (frames || []).some((f) => f.url && isElektrawebUrl(f.url));
      if (hit) await injectTabFrames(tab.id);
    } catch {
      /* ignore */
    }
  }
}

chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.url && isElektrawebUrl(details.url)) {
    void injectIntoFrame(details.tabId, details.frameId);
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;
  const url = tab.url || changeInfo.url || '';
  if (url && isElektrawebUrl(url)) {
    void injectTabFrames(tabId);
    return;
  }
  /* App/PWA windows sometimes report empty url; still try frames. */
  if (!url || url === 'about:blank') {
    void injectTabFrames(tabId);
  }
});

chrome.windows.onCreated.addListener(() => {
  setTimeout(() => void injectAllElektrawebTabs(), 400);
});

chrome.runtime.onStartup.addListener(() => {
  void refreshToolbarLamp();
  void injectAllElektrawebTabs();
});

chrome.runtime.onInstalled.addListener(() => {
  void chrome.storage.local.get(['locale', 'deskRole']).then((data) => {
    const patch = {};
    if (!data.locale) patch.locale = 'ru';
    if (!data.deskRole) patch.deskRole = 'hotel_fo';
    if (Object.keys(patch).length) void chrome.storage.local.set(patch);
    void refreshToolbarLamp();
    void injectAllElektrawebTabs();
  });
});

void refreshToolbarLamp();
void injectAllElektrawebTabs();
