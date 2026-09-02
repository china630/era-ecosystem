/**
 * MAIN-world hook: capture Elektraweb /Select/* JSON responses.
 * Posts to content script via window.postMessage (era-ew-bridge).
 */
(function () {
  if (window.__eraEwBridgeMain) return;
  window.__eraEwBridgeMain = true;

  const SELECT_RE = /\/Select\/(QA_|QG_|Q_|HOTEL_)/i;
  const ALLOWED = [
    'QA_HOTEL_RESERVATION_RESERVATION',
    'QA_HOTEL_RESERVATION',
    'QA_HOTEL_RESERVATION_CHECKOUT',
    'QA_EASYPMS_RESDETAIL',
    'QA_EASYPMS_NOTES',
    'QA_HOTEL_RES_GUEST',
    'QG_HOTEL_GUEST_SIMPLE',
    'QA_HOTEL_GUEST_RECORD',
    'Q_HOTELFOLIOACTION',
    'HOTEL_FOLIOTRANS',
  ];

  function objectFromUrl(url) {
    try {
      const path = new URL(url, location.href).pathname;
      const m = path.match(/\/Select\/([^/?#]+)/i);
      return m ? m[1] : null;
    } catch {
      return null;
    }
  }

  function entityHint(objectName) {
    if (!objectName) return 'unknown';
    if (/GUEST/i.test(objectName)) return 'guest';
    if (/FOLIO|FOLIOTRANS|FOLIOACTION/i.test(objectName)) return 'folio';
    if (/RESERVATION|RESDETAIL|RES_|NOTES/i.test(objectName)) return 'reservation';
    return 'unknown';
  }

  function captureToken(url, postText) {
    if (!url || !/elektraweb\.com/i.test(String(url))) return;
    if (typeof postText !== 'string' || postText[0] !== '{') return;
    try {
      const body = JSON.parse(postText);
      if (!body || typeof body.LoginToken !== 'string' || !body.LoginToken) return;
      let apiHost = '';
      try {
        apiHost = new URL(url, location.href).host;
      } catch {
        apiHost = '';
      }
      window.postMessage(
        {
          source: 'era-ew-bridge',
          type: 'elektraweb-token',
          payload: { apiHost, hasToken: true, loginToken: body.LoginToken },
        },
        '*',
      );
    } catch {
      /* ignore */
    }
  }

  function emit(sourceUrl, method, raw) {
    if (!SELECT_RE.test(sourceUrl)) return;
    const objectName = objectFromUrl(sourceUrl);
    if (objectName && !ALLOWED.includes(objectName)) return;
    window.postMessage(
      {
        source: 'era-ew-bridge',
        type: 'elektraweb-select',
        payload: {
          capturedAt: new Date().toISOString(),
          sourceUrl,
          pageUrl: location.href,
          method,
          entityHint: entityHint(objectName),
          elektrawebAppVersion: document.title || undefined,
          raw,
        },
      },
      '*',
    );
  }

  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    try {
      const req = args[0];
      const url = typeof req === 'string' ? req : req?.url;
      const init = args[1] || {};
      if (typeof init.body === 'string') captureToken(String(url || ''), init.body);
    } catch {
      /* ignore */
    }
    const res = await origFetch.apply(this, args);
    try {
      const req = args[0];
      const url = typeof req === 'string' ? req : req?.url;
      const method =
        (typeof req === 'object' && req?.method) ||
        (args[1] && args[1].method) ||
        'GET';
      if (url && SELECT_RE.test(String(url))) {
        const clone = res.clone();
        clone
          .json()
          .then((raw) => emit(String(url), String(method).toUpperCase(), raw))
          .catch(() => {});
      }
    } catch {
      /* ignore */
    }
    return res;
  };

  const OrigXHR = window.XMLHttpRequest;
  function PatchedXHR() {
    const xhr = new OrigXHR();
    let url = '';
    let method = 'GET';
    const open = xhr.open;
    xhr.open = function (m, u, ...rest) {
      method = String(m || 'GET').toUpperCase();
      url = String(u || '');
      return open.call(xhr, m, u, ...rest);
    };
    const send = xhr.send;
    xhr.send = function (body) {
      if (typeof body === 'string') captureToken(url, body);
      return send.call(xhr, body);
    };
    xhr.addEventListener('load', function () {
      if (!SELECT_RE.test(url)) return;
      try {
        const raw = JSON.parse(xhr.responseText);
        emit(url, method, raw);
      } catch {
        /* ignore */
      }
    });
    return xhr;
  }
  PatchedXHR.prototype = OrigXHR.prototype;
  window.XMLHttpRequest = PatchedXHR;
})();
