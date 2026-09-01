"use strict";

/**
 * Collect Res Id → Guest Id while you scroll Elektraweb FO lists.
 *
 * 1) Chrome with remote debugging:
 *    chrome.exe --remote-debugging-port=9222
 *    (or separate profile: --user-data-dir=%TEMP%\\chrome-ew-debug)
 * 2) Log in to app.elektraweb.com, open Front Office reservation grids.
 * 3) Run:
 *    node era-hotel-pms/scripts/collect-ew-res-guest-ids-cdp.cjs
 * 4) Scroll / paginate Reserved, In-house, Check-out until counts stop growing.
 * 5) Ctrl+C — writes res-guest-ids.json for enrich-reservations-guest-id.ts --api-map
 *
 * Output (gitignored): era-hotel-pms/doc/nafta/bridge-har/res-guest-ids-live.json
 */
const fs = require("fs");
const http = require("http");
const path = require("path");

const CDP = process.env.EW_CDP_URL || "http://127.0.0.1:9222";
const OUT =
  process.env.EW_RES_GUEST_OUT ||
  path.join(__dirname, "..", "doc", "nafta", "bridge-har", "res-guest-ids-live.json");
const EW_RE = /elektraweb\.com/i;

/** @type {Map<string, string>} */
const pairs = new Map();
let lastSave = 0;
let totalRows = 0;

function getJson(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", reject);
  });
}

function guestId(row) {
  const a = String(row.RESGUESTID ?? row.CONTACTGUESTID ?? row.GUESTID ?? "").trim();
  return a && a !== "0" ? a : "";
}

function resId(row) {
  return String(row.RESID ?? row.ID ?? "").trim();
}

function ingestBody(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return 0;
  }
  const sets = data?.ResultSets;
  if (!Array.isArray(sets)) return 0;
  let added = 0;
  for (const set of sets) {
    if (!Array.isArray(set)) continue;
    for (const row of set) {
      if (!row || typeof row !== "object") continue;
      const rid = resId(row);
      const gid = guestId(row);
      if (!rid || !gid) continue;
      totalRows += 1;
      if (pairs.get(rid) !== gid) {
        pairs.set(rid, gid);
        added += 1;
      }
    }
  }
  return added;
}

function save(force) {
  const now = Date.now();
  if (!force && now - lastSave < 2000) return;
  lastSave = now;
  const obj = Object.fromEntries([...pairs.entries()].sort((a, b) => Number(a[0]) - Number(b[0])));
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(obj, null, 2)}\n`, "utf8");
}

function onShutdown() {
  save(true);
  process.stdout.write(`\nSaved ${pairs.size} unique Res→Guest pairs → ${OUT}\n`);
  process.stdout.write(
    `Use: npx tsx scripts/enrich-reservations-guest-id.ts ... --api-map ${OUT}\n`,
  );
  process.exit(0);
}

process.on("SIGINT", onShutdown);
process.on("SIGTERM", onShutdown);

async function main() {
  let version;
  try {
    version = await getJson(`${CDP}/json/version`);
  } catch (err) {
    process.stderr.write(
      "Cannot connect to Chrome CDP on " +
        CDP +
        "\n\nStart Chrome like:\n" +
        '  chrome.exe --remote-debugging-port=9222 --user-data-dir="%TEMP%\\chrome-ew-debug"\n' +
        "Then log in to Elektraweb and re-run this script.\n\n" +
        String(err) +
        "\n",
    );
    process.exit(2);
  }

  if (fs.existsSync(OUT)) {
    try {
      const prev = JSON.parse(fs.readFileSync(OUT, "utf8"));
      for (const [k, v] of Object.entries(prev)) {
        if (k && v) pairs.set(String(k), String(v));
      }
      process.stdout.write(`Resumed ${pairs.size} pairs from ${OUT}\n`);
    } catch {
      /* fresh */
    }
  }

  const ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  let id = 0;
  /** @type {Map<number, { resolve: Function, reject: Function }>} */
  const pending = new Map();
  /** @type {Map<string, boolean>} */
  const sessions = new Map();
  /** @type {Map<string, { sessionId: string, url: string }>} */
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

  async function enableNetwork(sessionId, url) {
    if (sessions.has(sessionId)) return;
    sessions.set(sessionId, true);
    await send("Network.enable", { maxPostDataSize: 4_000_000 }, sessionId);
    process.stdout.write(`ATTACH ${(url || "").slice(0, 100)}\n`);
  }

  async function onEvent(msg) {
    const { method, params, sessionId } = msg;
    if (method === "Target.attachedToTarget") {
      const t = params.targetInfo || {};
      if (t.type === "page" && EW_RE.test(t.url || "")) {
        await enableNetwork(params.sessionId, t.url);
      }
      return;
    }
    if (method === "Network.requestWillBeSent") {
      const url = params.request?.url || "";
      if (!EW_RE.test(url)) return;
      reqMeta.set(params.requestId, { sessionId, url });
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
        return;
      }
      const added = ingestBody(bodyText);
      if (added > 0) {
        save(false);
        process.stdout.write(
          `+${added} new  total unique=${pairs.size}  (rows seen=${totalRows})\n`,
        );
      }
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
    if (t.type === "page" && EW_RE.test(t.url || "")) {
      process.stdout.write(`TAB ${(t.title || "").slice(0, 50)}  ${(t.url || "").slice(0, 80)}\n`);
    }
  }

  process.stdout.write("\n");
  process.stdout.write("=== LISTENING on Chrome CDP " + CDP + " ===\n");
  process.stdout.write("Open Elektraweb Front Office and scroll ALL reservation lists:\n");
  process.stdout.write("  - Reserved / future\n");
  process.stdout.write("  - In-house\n");
  process.stdout.write("  - Check-out (change date filter if needed)\n");
  process.stdout.write("Paginate until the counter stops growing. Then Ctrl+C here.\n");
  process.stdout.write("Output: " + OUT + "\n\n");
}

main().catch((err) => {
  process.stderr.write(String(err) + "\n");
  process.exit(1);
});
