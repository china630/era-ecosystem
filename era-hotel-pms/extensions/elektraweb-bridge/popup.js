const $ = (id) => document.getElementById(id);

async function render() {
  const s = await chrome.storage.local.get([
    'enabled',
    'token',
    'organizationId',
    'elektrawebHotelId',
    'login',
    'hotelBaseUrl',
    'lastSyncAt',
    'lastError',
  ]);
  $('enabled').checked = !!s.enabled;
  if (!s.token) {
    $('status').innerHTML = '<p class="err">Not logged in — open settings.</p>';
    return;
  }
  $('status').innerHTML = `
    <div class="row"><strong>${s.login || 'user'}</strong></div>
    <div class="row">Org: <code>${s.organizationId || '—'}</code></div>
    <div class="row">EW hotel: <code>${s.elektrawebHotelId || '—'}</code></div>
    <div class="row">URL: <code>${s.hotelBaseUrl || '—'}</code></div>
    <div class="row">${s.lastSyncAt ? 'Last sync: ' + s.lastSyncAt : 'No sync yet'}</div>
    ${s.lastError ? `<div class="row err">${s.lastError}</div>` : '<div class="row ok">OK</div>'}
  `;
}

$('enabled').addEventListener('change', async () => {
  await chrome.storage.local.set({ enabled: $('enabled').checked });
});

$('openOptions').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

$('flush').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'flush' }, () => void render());
});

void render();
