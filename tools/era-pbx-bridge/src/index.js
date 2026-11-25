/**
 * era-pbx-bridge — AMI event forwarder + HTTP Originate (TZ T-I20).
 * Env: AMI_HOST, AMI_PORT, AMI_USER, AMI_SECRET, CRM_WEBHOOK_URL, BRIDGE_HMAC_SECRET,
 *      BRIDGE_HTTP_PORT (default 5039), ORIGINATE_CONTEXT, ORIGINATE_CHANNEL_TMPL, RECORDING_DIR
 */
const crypto = require("node:crypto");
const net = require("node:net");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const cfg = {
  host: process.env.AMI_HOST || "127.0.0.1",
  port: Number(process.env.AMI_PORT || 5038),
  user: process.env.AMI_USER || "era",
  secret: process.env.AMI_SECRET || "",
  webhookUrl: process.env.CRM_WEBHOOK_URL || "",
  hmac: process.env.BRIDGE_HMAC_SECRET || "",
  httpPort: Number(process.env.BRIDGE_HTTP_PORT || 5039),
  context: process.env.ORIGINATE_CONTEXT || "from-internal",
  channelTmpl: process.env.ORIGINATE_CHANNEL_TMPL || "PJSIP/{ext}",
  recordingDir: process.env.RECORDING_DIR || "",
};

function sign(body) {
  return crypto.createHmac("sha256", cfg.hmac).update(body).digest("hex");
}

function verify(body, signature) {
  if (!cfg.hmac || !signature) return false;
  const expected = sign(body);
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature).replace(/^sha256=/i, ""));
  try {
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

async function postEvent(payload) {
  if (!cfg.webhookUrl || !cfg.hmac) {
    console.warn("[era-pbx-bridge] CRM_WEBHOOK_URL / BRIDGE_HMAC_SECRET missing");
    return;
  }
  const body = JSON.stringify(payload);
  const res = await fetch(cfg.webhookUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-era-signature": sign(body),
    },
    body,
  });
  console.log("[era-pbx-bridge] forwarded", payload.kind, res.status);
}

function parseAmiBlock(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i < 0) continue;
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}

/** Dedupe ringing/ended per Linkedid within a short window. */
const recentRing = new Set();
const answeredCalls = new Set();

function mapEvent(ev) {
  const event = ev.Event;
  const callId = ev.Linkedid || ev.Uniqueid || `${Date.now()}`;

  if (event === "DialBegin") {
    if (recentRing.has(callId)) return null;
    recentRing.add(callId);
    setTimeout(() => recentRing.delete(callId), 120_000);
    return {
      kind: "call.ringing",
      callId,
      direction: "INBOUND",
      from: ev.CallerIDNum,
      to: ev.Exten || ev.DialString,
      extension: ev.CallerIDNum,
    };
  }
  if (event === "DialEnd" && String(ev.DialStatus || "").toUpperCase() === "ANSWER") {
    answeredCalls.add(callId);
    return {
      kind: "call.answered",
      callId,
      direction: "INBOUND",
      from: ev.CallerIDNum,
      to: ev.Exten,
      extension: ev.CallerIDNum,
    };
  }
  if (event === "Cdr") {
    const bill = Number(ev.BillableSeconds || ev.Duration || 0);
    const disp = String(ev.Disposition || "").toUpperCase();
    const missed =
      disp.includes("NO ANSWER") || disp.includes("BUSY") || disp.includes("FAILED") || bill === 0;
    return {
      kind: missed ? "call.missed" : "call.ended",
      callId: ev.UniqueID || callId,
      direction: "INBOUND",
      from: ev.Source || ev.CallerID,
      to: ev.Destination || ev.Dst,
      duration: bill,
      recordingUrl: ev.RecordingFile || ev.recordingfile || undefined,
      extension: ev.Source,
    };
  }
  if (event === "Hangup") {
    return null;
  }
  return null;
}

let amiSocket = null;
let amiBuf = "";
const pendingActions = new Map();
let actionSeq = 1;

function amiWrite(lines) {
  if (!amiSocket || amiSocket.destroyed) throw new Error("AMI not connected");
  amiSocket.write(lines.join("\r\n") + "\r\n\r\n");
}

function startAmi() {
  const socket = net.createConnection({ host: cfg.host, port: cfg.port }, () => {
    amiSocket = socket;
    amiWrite([
      "Action: Login",
      `Username: ${cfg.user}`,
      `Secret: ${cfg.secret}`,
      "Events: call,cdr",
    ]);
    console.log("[era-pbx-bridge] AMI connected", cfg.host, cfg.port);
  });
  amiBuf = "";
  socket.on("data", (chunk) => {
    amiBuf += chunk.toString("utf8");
    let idx;
    while ((idx = amiBuf.indexOf("\r\n\r\n")) >= 0) {
      const block = amiBuf.slice(0, idx);
      amiBuf = amiBuf.slice(idx + 4);
      const ev = parseAmiBlock(block);
      if (ev.ActionID && pendingActions.has(ev.ActionID)) {
        const { resolve } = pendingActions.get(ev.ActionID);
        pendingActions.delete(ev.ActionID);
        resolve(ev);
        continue;
      }
      const mapped = mapEvent(ev);
      if (mapped) void postEvent(mapped);
    }
  });
  socket.on("error", (err) => console.error("[era-pbx-bridge] AMI error", err.message));
  socket.on("close", () => {
    amiSocket = null;
    console.warn("[era-pbx-bridge] AMI closed; retry in 5s");
    setTimeout(startAmi, 5000);
  });
}

function amiAction(fields) {
  const actionId = `era-${actionSeq++}`;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingActions.delete(actionId);
      reject(new Error("AMI action timeout"));
    }, 15_000);
    pendingActions.set(actionId, {
      resolve: (ev) => {
        clearTimeout(timer);
        resolve(ev);
      },
    });
    try {
      amiWrite([...fields, `ActionID: ${actionId}`]);
    } catch (err) {
      clearTimeout(timer);
      pendingActions.delete(actionId);
      reject(err);
    }
  });
}

async function originate({ fromExtension, to }) {
  if (!fromExtension || !to) throw new Error("fromExtension and to required");
  const channel = cfg.channelTmpl.replace(/\{ext\}/g, String(fromExtension));
  const actionId = `orig-${Date.now()}`;
  const ev = await amiAction([
    "Action: Originate",
    `Channel: ${channel}`,
    `Context: ${cfg.context}`,
    `Exten: ${to}`,
    "Priority: 1",
    "Async: true",
    `CallerID: CRM <${fromExtension}>`,
    `ActionID: ${actionId}`,
  ]);
  const ok = String(ev.Response || "").toLowerCase() === "success";
  if (!ok) throw new Error(ev.Message || "Originate failed");
  return {
    ok: true,
    externalCallId: ev.Uniqueid || actionId,
  };
}

function startHttp() {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    if (req.method === "GET" && url.pathname === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, ami: Boolean(amiSocket && !amiSocket.destroyed) }));
      return;
    }
    if (req.method === "POST" && url.pathname === "/originate") {
      if (!amiSocket || amiSocket.destroyed || !cfg.secret) {
        res.writeHead(501, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            error: "AMI not configured or not connected (set AMI_HOST/AMI_SECRET and wait for login)",
            code: "AMI_NOT_READY",
          }),
        );
        return;
      }
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!verify(raw, req.headers["x-era-signature"])) {
        res.writeHead(401, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "signature mismatch" }));
        return;
      }
      try {
        const body = JSON.parse(raw || "{}");
        const result = await originate({
          fromExtension: body.fromExtension,
          to: body.to,
        });
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(502, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
      }
      return;
    }
    if (req.method === "GET" && url.pathname.startsWith("/recording/")) {
      const id = decodeURIComponent(url.pathname.slice("/recording/".length));
      if (!cfg.recordingDir) {
        res.writeHead(501, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "RECORDING_DIR not set", code: "RECORDING_NOT_CONFIGURED" }));
        return;
      }
      const filePath = path.join(cfg.recordingDir, path.basename(id));
      if (!fs.existsSync(filePath)) {
        res.writeHead(404);
        res.end("not found");
        return;
      }
      res.writeHead(200, { "content-type": "audio/mpeg" });
      fs.createReadStream(filePath).pipe(res);
      return;
    }
    res.writeHead(404);
    res.end("not found");
  });
  server.listen(cfg.httpPort, "0.0.0.0", () => {
    console.log(`[era-pbx-bridge] HTTP :${cfg.httpPort} (health + /originate + /recording)`);
  });
}

if (require.main === module) {
  if (process.argv[2] === "originate") {
    startAmi();
    setTimeout(() => {
      void originate({
        fromExtension: process.argv[3],
        to: process.argv[4],
      })
        .then((r) => {
          console.log(r);
          process.exit(0);
        })
        .catch((err) => {
          console.error(err);
          process.exit(1);
        });
    }, 1500);
  } else {
    startAmi();
    startHttp();
  }
}

module.exports = { postEvent, originate, mapEvent, verify, sign };