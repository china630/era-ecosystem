const MAX_QUEUE = 40;

async function getSettings() {
  const data = await chrome.storage.local.get([
    'enabled',
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
  return {
    enabled: !!data.enabled,
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
      sendResponse({ ok: true });
    })();
    return true;
  }
  if (msg?.type === 'get-status') {
    getSettings().then((s) => sendResponse(s));
    return true;
  }
  if (msg?.type === 'flush') {
    flushQueue().then(() => sendResponse({ ok: true }));
    return true;
  }
  return false;
});

chrome.alarms.create('ew-bridge-flush', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'ew-bridge-flush') void flushQueue();
});
