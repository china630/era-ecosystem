const MAX_QUEUE = 40;

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
  ]);
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
  };
}

async function setPartial(patch) {
  await chrome.storage.local.set(patch);
}

async function enqueue(payload) {
  const { queue = [] } = await chrome.storage.local.get('queue');
  queue.push(payload);
  while (queue.length > MAX_QUEUE) queue.shift();
  await chrome.storage.local.set({ queue });
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
    await setPartial({ lastError: 'SPA write: no Elektraweb LoginToken yet — click in SPA' });
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

async function flushQueue() {
  const settings = await getSettings();
  if (!settings.enabled || !settings.hotelBaseUrl || !settings.token) return;

  const { queue = [] } = await chrome.storage.local.get('queue');
  if (!queue.length) return;

  const batch = queue.splice(0, 10);
  await chrome.storage.local.set({ queue });

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
      // re-queue failed batch (best effort)
      const { queue: q2 = [] } = await chrome.storage.local.get('queue');
      await chrome.storage.local.set({ queue: [...batch, ...q2].slice(0, MAX_QUEUE) });
      return;
    }
    await setPartial({
      lastSyncAt: new Date().toISOString(),
      lastError: null,
      lastResult: json,
      organizationId: json.organizationId || settings.organizationId,
      elektrawebHotelId: json.elektrawebHotelId || settings.elektrawebHotelId,
    });
  } catch (e) {
    await setPartial({ lastError: e instanceof Error ? e.message : String(e) });
    const { queue: q2 = [] } = await chrome.storage.local.get('queue');
    await chrome.storage.local.set({ queue: [...batch, ...q2].slice(0, MAX_QUEUE) });
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
      await flushQueue();
      await drainOutbox();
      sendResponse({ ok: true });
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
      sendResponse({ ok: true });
    })();
    return true;
  }
  if (msg?.type === 'get-status') {
    getSettings().then((s) => sendResponse(s));
    return true;
  }
  if (msg?.type === 'flush') {
    flushQueue()
      .then(() => drainOutbox())
      .then(() => sendResponse({ ok: true }));
    return true;
  }
  return false;
});

chrome.alarms.create('ew-bridge-flush', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'ew-bridge-flush') {
    void flushQueue();
    void drainOutbox();
  }
});

chrome.runtime.onInstalled.addListener(() => {
  void chrome.storage.local.get(['locale', 'deskRole']).then((data) => {
    const patch = {};
    if (!data.locale) patch.locale = 'ru';
    if (!data.deskRole) patch.deskRole = 'hotel_fo';
    if (Object.keys(patch).length) void chrome.storage.local.set(patch);
  });
});
