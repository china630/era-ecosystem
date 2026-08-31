"use strict";

/**
 * Fetch WebOnly FO reservation guest sections for clinic #24 hotelResNo.
 *
 *   $env:WO_BEARER = "<accessToken>"
 *   node era-hotel-pms/scripts/dump-webonly-fo-reservation-guests.cjs
 *
 * Writes D:\ERA-BACKUP\NAFTA-START\hotel\dump\reservation-guests.json (PII — not git).
 */

const fs = require("fs");
const https = require("https");
const path = require("path");
const { URL } = require("url");

const FO_BASE = process.env.WO_FO_API || "https://nafta-frontoffice.webonly.io";
const ADMIN_BASE = process.env.WO_ADMIN_API || "https://nafta-admin.webonly.io";
const DUMP_DIR = process.env.WO_FO_DUMP_DIR || path.join("D:", "ERA-BACKUP", "NAFTA-START", "hotel", "dump");
const CLINIC_XLSX =
  process.env.CLINIC_PATIENTS_XLSX ||
  path.join("D:", "ERA-BACKUP", "NAFTA-ERA-READY", "clinic", "24-Patients.xlsx");
const BEARER = (process.env.WO_BEARER || process.env.WO_TOKEN || "").trim();
const COOKIE = (process.env.WO_COOKIE || "").trim();
const CONCURRENCY = Number(process.env.WO_CONCURRENCY || 3);
const UNMATCHED_ONLY = process.argv.includes("--unmatched-only");
const XLSX = require(path.join(__dirname, "..", "node_modules", "xlsx"));

const agent = new https.Agent({ keepAlive: true, maxSockets: CONCURRENCY + 2 });

function request(url, { method = "GET", headers = {}, body, maxRedirects = 3 } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const payload = body ? Buffer.from(body) : undefined;
    const req = https.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || 443,
        path: u.pathname + u.search,
        method,
        agent,
        headers: {
          "User-Agent": "era-hotel-webonly-fo-dump/1.0",
          Accept: "application/json",
          Origin: ADMIN_BASE,
          Referer: `${ADMIN_BASE}/en/dashboard/frontoffice/guestcard`,
          ...(COOKIE ? { Cookie: COOKIE } : {}),
          ...(BEARER ? { Authorization: `Bearer ${BEARER}` } : {}),
          ...headers,
          ...(payload ? { "Content-Length": String(payload.length) } : {}),
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const buf = Buffer.concat(chunks);
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && maxRedirects > 0) {
            const next = new URL(res.headers.location, url).toString();
            request(next, { method, headers, body, maxRedirects: maxRedirects - 1 }).then(resolve, reject);
            return;
          }
          resolve({ status: res.statusCode || 0, body: buf });
        });
      },
    );
    req.on("error", reject);
    req.setTimeout(8_000, () => req.destroy(new Error(`timeout ${url}`)));
    if (payload) req.write(payload);
    req.end();
  });
}

function unwrap(buf) {
  if (!buf || !buf.length) return null;
  const j = JSON.parse(buf.toString("utf8"));
  if (Array.isArray(j)) return j;
  if (j && Object.prototype.hasOwnProperty.call(j, "data")) return j.data;
  return j;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function mapPool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i;
      i += 1;
      out[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, () => worker()));
  return out;
}

function clinicResIds() {
  if (UNMATCHED_ONLY) {
    const bridgePath = path.join(DUMP_DIR, "fo-patient-bridge.json");
    if (!fs.existsSync(bridgePath)) {
      throw new Error(`--unmatched-only needs ${bridgePath}`);
    }
    const bridge = JSON.parse(fs.readFileSync(bridgePath, "utf8"));
    const ids = new Set();
    for (const row of bridge) {
      if (row.how !== "none") continue;
      const id = String(row.hotelResNo || "").trim();
      if (id && id !== "0") ids.add(id);
    }
    return [...ids];
  }
  const wb = XLSX.read(fs.readFileSync(CLINIC_XLSX), { type: "buffer" });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
  const ids = new Set();
  for (const r of rows) {
    const id = String(r.hotelResNo || "").trim();
    if (id && id !== "0") ids.add(id);
  }
  return [...ids];
}

async function fetchOne(id) {
  const get = await request(`${FO_BASE}/api/ReservationCard/${encodeURIComponent(id)}`);
  if (get.status === 200) {
    const data = unwrap(get.body);
    if (data && typeof data === "object" && !Array.isArray(data.items) && (data.id || data.guestsSections)) {
      return { ok: true, via: "get-id", data };
    }
  }
  const post = await request(`${FO_BASE}/api/ReservationCard/get-guests-info-by-reservation-id`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(id),
  });
  if (post.status === 200) {
    const data = unwrap(post.body);
    if (data && typeof data === "object" && (data.guests || data.guestsSections || data.reservationId)) {
      return { ok: true, via: "guests-info", data };
    }
  }
  return {
    ok: false,
    status: get.status || post.status,
    body: (get.body || post.body).toString("utf8").slice(0, 180),
  };
}

async function main() {
  if (!BEARER && !COOKIE) {
    process.stderr.write("Need WO_BEARER or WO_COOKIE.\n");
    process.exit(2);
  }
  fs.mkdirSync(DUMP_DIR, { recursive: true });
  const ids = clinicResIds();
  const byId = {};
  process.stdout.write(`${UNMATCHED_ONLY ? "unmatched " : ""}hotelResNo unique ${ids.length}\n`);
  let ok = 0;
  let fail = 0;
  await mapPool(ids, CONCURRENCY, async (id) => {
    if (byId[id]) {
      ok += 1;
      return;
    }
    try {
      const r = await fetchOne(id);
      if (r.ok) {
        byId[id] = r.data;
        ok += 1;
      } else {
        fail += 1;
        if (fail <= 5) process.stderr.write(`fail ${id} ${r.status} ${r.body}\n`);
      }
    } catch (err) {
      fail += 1;
      if (fail <= 5) process.stderr.write(`err ${id} ${err.message}\n`);
    }
    await sleep(30);
  });
  const summary = {
    fetchedAt: new Date().toISOString(),
    requested: ids.length,
    ok,
    fail,
  };
  fs.writeFileSync(path.join(DUMP_DIR, "reservation-guests.json"), `${JSON.stringify(byId)}\n`, "utf8");
  fs.writeFileSync(
    path.join(DUMP_DIR, "reservation-guests.summary.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
    "utf8",
  );
  process.stdout.write(`wrote ${ok} reservations fail=${fail} → ${DUMP_DIR}\n`);
}

main().catch((err) => {
  process.stderr.write(String(err && err.stack ? err.stack : err) + "\n");
  process.exit(1);
});
