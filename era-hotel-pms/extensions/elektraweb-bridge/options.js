const $ = (id) => document.getElementById(id);

async function refreshSessionBox() {
  const data = await chrome.storage.local.get([
    'token',
    'organizationId',
    'elektrawebHotelId',
    'login',
    'fullName',
    'hotelBaseUrl',
    'enabled',
  ]);
  if (!data.token) {
    $('session').textContent = 'Not logged in';
    return;
  }
  $('session').innerHTML = `
    <div><strong>${data.fullName || data.login}</strong> (${data.login})</div>
    <div>Hotel URL: <code>${data.hotelBaseUrl || '—'}</code></div>
    <div>ERA org: <code>${data.organizationId || '—'}</code></div>
    <div>Elektraweb HOTELID: <code>${data.elektrawebHotelId || '—'}</code></div>
    <div>Capture: ${data.enabled ? 'ON' : 'OFF'} (toggle in popup)</div>
  `;
  if (data.hotelBaseUrl) $('hotelBaseUrl').value = data.hotelBaseUrl;
  if (data.login) $('login').value = data.login;
}

$('btnLogin').addEventListener('click', async () => {
  const hotelBaseUrl = $('hotelBaseUrl').value.trim().replace(/\/$/, '');
  const login = $('login').value.trim();
  const password = $('password').value;
  $('msg').innerHTML = '';
  if (!hotelBaseUrl || !login || !password) {
    $('msg').innerHTML = '<p class="err">Fill URL, login and password.</p>';
    return;
  }
  try {
    const res = await fetch(`${hotelBaseUrl}/api/integrations/elektraweb-bridge/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, password }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      $('msg').innerHTML = `<p class="err">${json.error || 'Login failed (' + res.status + ')'}</p>`;
      return;
    }
    await chrome.storage.local.set({
      hotelBaseUrl,
      token: json.token,
      organizationId: json.organizationId,
      elektrawebHotelId: String(json.elektrawebHotelId),
      login: json.user?.login || login,
      fullName: json.user?.fullName || '',
      enabled: true,
      lastError: null,
    });
    $('password').value = '';
    $('msg').innerHTML =
      '<p class="ok">Logged in. Token bound to this hotel org — open Elektraweb and work as usual.</p>';
    await refreshSessionBox();
  } catch (e) {
    $('msg').innerHTML = `<p class="err">${e instanceof Error ? e.message : String(e)}</p>`;
  }
});

$('btnLogout').addEventListener('click', async () => {
  await chrome.storage.local.remove([
    'token',
    'organizationId',
    'elektrawebHotelId',
    'login',
    'fullName',
    'lastResult',
    'lastError',
    'queue',
  ]);
  await chrome.storage.local.set({ enabled: false });
  $('msg').innerHTML = '<p class="ok">Logged out.</p>';
  await refreshSessionBox();
});

void refreshSessionBox();
