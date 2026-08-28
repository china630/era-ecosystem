"use strict";

/**
 * Dump Nafta WebOnly Front Office guest cards (passports).
 *
 * Source UI: https://nafta-admin.webonly.io/en/dashboard/frontoffice/guestcard
 * Source API: https://nafta-frontoffice.webonly.io  GET /api/GuestCard
 *
 * Needs a logged-in admin token (localStorage accessToken on nafta-admin):
 *
 *   $env:WO_BEARER = "<accessToken>"
 *   node era-hotel-pms/scripts/dump-webonly-fo-guest-cards.cjs
 *
 * Writes PII under D:\ERA-BACKUP\… — never commit the dump.
 */

const fs = require("fs");
const https = require("https");
const path = require("path");
const { URL } = require("url");

const FO_BASE = process.env.WO_FO_API || "https://nafta-frontoffice.webonly.io";
const ADMIN_BASE = process.env.WO_ADMIN_API || "https://nafta-admin.webonly.io";
const DEFAULT_OUT = path.join("D:", "ERA-BACKUP", "NAFTA-START", "hotel", "dump");
const OUT_DIR = path.resolve(process.env.WO_FO_DUMP_DIR || DEFAULT_OUT);

const BEARER = (process.env.WO_BEARER || process.env.WO_TOKEN || "").trim();
const COOKIE = (process.env.WO_COOKIE || "").trim();

const agent = new https.Agent({ keepAlive: true, maxSockets: 6 });

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
          resolve({ status: res.statusCode || 0, headers: res.headers, body: buf });
        });
      },
    );
    req.on("error", reject);
    req.setTimeout(120_000, () => req.destroy(new Error(`timeout ${url}`)));
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

function filled(v) {
  return v != null && String(v).trim() !== "";
}

async function main() {
  if (!BEARER && !COOKIE) {
    process.stderr.write(
      "Need WO_BEARER (nafta-admin localStorage accessToken) or WO_COOKIE.\n" +
        "Open https://nafta-admin.webonly.io/en/dashboard/frontoffice/guestcard then copy the token.\n",
    );
    process.exit(2);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const get = await request(`${FO_BASE}/api/GuestCard`);
  let rows = unwrap(get.body);
  let source = "GET /api/GuestCard";
  if (get.status !== 200 || !Array.isArray(rows) || rows.length === 0) {
    const post = await request(`${FO_BASE}/api/GuestCard/search-list`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const posted = unwrap(post.body);
    if (post.status === 200 && Array.isArray(posted) && posted.length) {
      rows = posted;
      source = "POST /api/GuestCard/search-list";
    } else if (get.status !== 200) {
      process.stderr.write(`GuestCard HTTP ${get.status} ${get.body.toString("utf8").slice(0, 400)}\n`);
      process.exit(1);
    }
  }

  if (!Array.isArray(rows)) rows = [];

  const withPassport = rows.filter((r) => filled(r && r.passport)).length;
  const withDob = rows.filter((r) => filled(r && r.birthDate)).length;
  const withPhone = rows.filter((r) => filled(r && r.phone)).length;
  const withName = rows.filter((r) => filled(r && r.name) && filled(r && r.surname)).length;

  const summary = {
    sourceUi: `${ADMIN_BASE}/en/dashboard/frontoffice/guestcard`,
    sourceApi: FO_BASE,
    fetchedAt: new Date().toISOString(),
    endpoint: source,
    httpStatus: get.status,
    count: rows.length,
    withPassport,
    withDob,
    withPhone,
    withName,
    outDir: OUT_DIR,
  };

  fs.writeFileSync(path.join(OUT_DIR, "guest-cards.json"), `${JSON.stringify(rows, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(OUT_DIR, "guest-cards.summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  process.stdout.write(
    `FO guests ${rows.length} passport=${withPassport} dob=${withDob} phone=${withPhone} name=${withName} → ${OUT_DIR}\n`,
  );
}

main().catch((err) => {
  process.stderr.write(String(err && err.stack ? err.stack : err) + "\n");
  process.exit(1);
});
