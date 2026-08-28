/**
 * Attach to Chrome --remote-debugging-port=9222 and log Elektraweb XHR
 * (redacted). Output: _spa_listen.txt (gitignored via _*.txt).
 */
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");

const CDP = "http://127.0.0.1:9222";
const OUT = path.join(__dirname, "_spa_listen.txt");
const EW_RE = /elektraweb\.com/i;
const WRITE_RE = /insert|update|delete|save|upsert|execute|posting|foliotrans/i;

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
        } catch (e) {
          reject(e);
        }
      });
    }).on("error", reject);
  });
}

function redact(value, depth = 0) {
  if (value == null || depth > 8) return value;
  if (Array.isArray(value)) return value.slice(0, 5).map((x) => redact(x, depth + 1));
  if (typeof value !== "object") return value;
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    const lk = String(k).toLowerCase();
    if (
      /token|password|cookie|authorization|passport|nationalid|phone|email|fullname|guestname|^name$|lname|fname|login/.test(
        lk,
      )
    ) {
      if (typeof v === "string") out[k] = v ? `[redacted:${v.length}]` : "";
      else out[k] = "[redacted]";
    } else {
      out[k] = redact(v, depth + 1);
    }
  }
  return out;
}

function parseJsonMaybe(text) {
  if (!text || typeof text !== "string") return null;
  const t = text.trim();
  if (!t.startsWith("{") && !t.startsWith("[")) return null;
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

function objectFromUrl(url) {
  try {
    const p = new URL(url).pathname;
    const m = p.match(/\/(Select|Insert|Update|Delete|Execute|Save)\/([^/?#]+)/i);
    return m ? { verb: m[1], object: m[2] } : { verb: null, object: null };
  } catch {
    return { verb: null, object: null };
  }
}

function line(obj) {
  const s = JSON.stringify(obj);
  fs.appendFileSync(OUT, s + "\n", "utf8");
  const flag =
    WRITE_RE.test(String(obj.path || "")) ||
    WRITE_RE.test(String(obj.action || "")) ||
    WRITE_RE.test(String(obj.verb || ""))
      ? "WRITE"
      : "XHR";
  process.stdout.write(
    `${flag}\t${obj.method || ""}\t${obj.status || ""}\t${obj.verb || ""}/${obj.object || ""}\t${obj.action || ""}\t${(obj.path || "").slice(0, 80)}\n`,
  );
}

async function main() {
  const version = await getJson(`${CDP}/json/version`);
  const ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  let id = 0;
  const pending = new Map();
  const sessions = new Map();
  const reqMeta = new Map();

  function send(method, params, sessionId) {
    id += 1;
    const msgId = id;
    const payload = { id: msgId, method, params };
    if (sessionId) payload.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      pending.set(msgId, { resolve, reject });
      ws.send(JSON.stringify(payload));
    });
  }

  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data.toString());
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
      return;
    }
    void onEvent(msg);
  });
  ws.addEventListener("close", () => {
    process.stderr.write("CDP websocket closed\n");
  });

  async function enableNetwork(sessionId, url) {
    if (sessions.has(sessionId)) return;
    sessions.set(sessionId, url || "");
    await send("Network.enable", { maxPostDataSize: 2_000_000 }, sessionId);
    process.stdout.write(`ATTACH\t${(url || "").slice(0, 120)}\n`);
  }

  async function onEvent(msg) {
    const { method, params, sessionId } = msg;
    if (method === "Target.attachedToTarget") {
      const t = params.targetInfo || {};
      const url = t.url || "";
      if (t.type === "page" && EW_RE.test(url)) {
        await enableNetwork(params.sessionId, url);
      }
      return;
    }
    if (method === "Target.targetInfoChanged") {
      const t = params.targetInfo || {};
      if (t.type === "page" && EW_RE.test(t.url || "") && sessionId) {
        await enableNetwork(sessionId, t.url);
      }
      return;
    }
    if (method === "Network.requestWillBeSent") {
      const req = params.request || {};
      const url = req.url || "";
      if (!EW_RE.test(url)) return;
      const parsed = parseJsonMaybe(req.postData);
      const pathInfo = objectFromUrl(url);
      reqMeta.set(params.requestId, {
        url,
        method: req.method,
        post: parsed,
        pathInfo,
        sessionId,
      });
      return;
    }
    if (method === "Network.loadingFinished") {
      const meta = reqMeta.get(params.requestId);
      if (!meta) return;
      reqMeta.delete(params.requestId);
      let bodyText = "";
      try {
        const body = await send(
          "Network.getResponseBody",
          { requestId: params.requestId },
          meta.sessionId,
        );
        bodyText = body.base64Encoded
          ? Buffer.from(body.body || "", "base64").toString("utf8")
          : body.body || "";
      } catch {
        bodyText = "";
      }
      const resp = parseJsonMaybe(bodyText);
      const post = meta.post || {};
      const rec = {
        at: new Date().toISOString(),
        method: meta.method,
        path: (() => {
          try {
            return new URL(meta.url).pathname;
          } catch {
            return meta.url;
          }
        })(),
        host: (() => {
          try {
            return new URL(meta.url).host;
          } catch {
            return "";
          }
        })(),
        verb: meta.pathInfo.verb,
        object: meta.pathInfo.object || post.Object || null,
        action: post.Action || null,
        post: redact(post),
        responseKeys: resp && !Array.isArray(resp) ? Object.keys(resp).slice(0, 20) : null,
        resultSet0Count:
          resp && Array.isArray(resp.ResultSets) && Array.isArray(resp.ResultSets[0])
            ? resp.ResultSets[0].length
            : null,
        resultSet0Keys:
          resp &&
          Array.isArray(resp.ResultSets) &&
          Array.isArray(resp.ResultSets[0]) &&
          resp.ResultSets[0][0] &&
          typeof resp.ResultSets[0][0] === "object"
            ? Object.keys(resp.ResultSets[0][0]).slice(0, 40)
            : null,
      };
      line(rec);
    }
  }

  await send("Target.setDiscoverTargets", { discover: true });
  await send("Target.setAutoAttach", {
    autoAttach: true,
    waitForDebuggerOnStart: false,
    flatten: true,
  });

  const targets = await getJson(`${CDP}/json/list`);
  for (const t of targets || []) {
    if (t.type === "page" && EW_RE.test(t.url || "") && t.webSocketDebuggerUrl) {
      process.stdout.write(`SEE\t${(t.title || "").slice(0, 40)}\t${(t.url || "").slice(0, 100)}\n`);
    }
  }

  fs.writeFileSync(OUT, "", "utf8");
  process.stdout.write(`LISTEN\tout=${OUT}\n`);
  process.stdout.write("Ready. Work in Elektraweb (reservation → check-in → SPA extras).\n");
}

main().catch((err) => {
  process.stderr.write(String(err) + "\n");
  process.exit(1);
});
