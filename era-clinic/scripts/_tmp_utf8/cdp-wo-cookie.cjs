"use strict";
const http = require("http");

function requestJson(url, method = "GET") {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        try {
          resolve(JSON.parse(text));
        } catch (err) {
          reject(new Error(text.slice(0, 300)));
        }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

function getJson(url) {
  return requestJson(url, "GET");
}

async function main() {
  const targets = await getJson("http://127.0.0.1:9222/json/list");
  const page =
    (targets || []).find((t) => t.type === "page" && /webonly/i.test(t.url || "") && !/\/login/i.test(t.url || "")) ||
    (targets || []).find((t) => t.type === "page" && /webonly/i.test(t.url || "")) ||
    (targets || []).find((t) => t.type === "page" && t.webSocketDebuggerUrl);
  if (!page?.webSocketDebuggerUrl) {
    process.stderr.write("no page targets\n");
    process.exit(2);
  }
  process.stderr.write(`tab ${page.url}\n`);
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  let id = 0;
  function call(method, params) {
    id += 1;
    const msgId = id;
    return new Promise((resolve, reject) => {
      function onMsg(ev) {
        const data = JSON.parse(ev.data.toString());
        if (data.id === msgId) {
          ws.removeEventListener("message", onMsg);
          if (data.error) reject(new Error(JSON.stringify(data.error)));
          else resolve(data.result);
        }
      }
      ws.addEventListener("message", onMsg);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }
  await call("Network.enable");
  let cookies = [];
  try {
    const all = await call("Network.getCookies");
    cookies = all.cookies || [];
  } catch {
    cookies = [];
  }
  const storageKeys = await call("Runtime.evaluate", {
    expression:
      "JSON.stringify({ls:Object.keys(localStorage), ss:Object.keys(sessionStorage), cookieLen:(document.cookie||'').length})",
    returnByValue: true,
  });
  process.stderr.write(`storage ${storageKeys?.result?.value}\n`);
  const tokenEv = await call("Runtime.evaluate", {
    expression: "localStorage.getItem('accessToken') || ''",
    returnByValue: true,
  });
  const token = String(tokenEv?.result?.value || "").trim();
  process.stderr.write(`token_len ${token.length}\n`);
  if (!token) {
    process.stderr.write("no accessToken in localStorage\n");
    process.exit(2);
  }
  process.stdout.write(token);
  ws.close();
}

main().catch((e) => {
  process.stderr.write(String(e) + "\n");
  process.exit(1);
});
