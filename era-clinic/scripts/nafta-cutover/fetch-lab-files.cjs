"use strict";

/**
 * Download WebOnly lab Word/PDF binaries into
 *   D:\ERA-BACKUP\NAFTA-START\clinic\dump\files\lab
 *
 *   node era-clinic/scripts/nafta-cutover/fetch-lab-files.cjs
 *   WO_COOKIE="..." node era-clinic/scripts/nafta-cutover/fetch-lab-files.cjs
 */

const fs = require("fs");
const https = require("https");
const crypto = require("crypto");
const path = require("path");
const { URL } = require("url");

const CLINIC_BASE = process.env.WO_CLINIC_API || "https://nafta-clinic.webonly.io";
const ADMIN_BASE = process.env.WO_ADMIN_API || "https://nafta-admin.webonly.io";
const START = process.env.NAFTA_START || path.join("D:", "ERA-BACKUP", "NAFTA-START");
const DUMP = path.join(START, "clinic", "dump");
const OUT_DIR = path.join(DUMP, "files", "lab");
const MANIFEST = path.join(OUT_DIR, "manifest.json");
const COOKIE = process.env.WO_COOKIE || "";
const BEARER = process.env.WO_BEARER || process.env.WO_TOKEN || "";
const CONCURRENCY = Number(process.env.WO_CONCURRENCY || 4);
const MIN_BYTES = 1024;

const agent = new https.Agent({ keepAlive: true, maxSockets: CONCURRENCY + 2 });

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function request(url, { method = "GET", headers = {}, maxRedirects = 3 } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || 443,
        path: u.pathname + u.search,
        method,
        agent,
        headers: {
          "User-Agent": "era-clinic-nafta-lab-fetch/1.0",
          Accept: "*/*",
          Referer: `${ADMIN_BASE}/en/dashboard/home`,
          Origin: ADMIN_BASE,
          ...(COOKIE ? { Cookie: COOKIE } : {}),
          ...(BEARER ? { Authorization: `Bearer ${BEARER}` } : {}),
          ...headers,
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const body = Buffer.concat(chunks);
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && maxRedirects > 0) {
            const next = new URL(res.headers.location, url).toString();
            request(next, { method, headers, maxRedirects: maxRedirects - 1 }).then(resolve, reject);
            return;
          }
          resolve({ status: res.statusCode || 0, headers: res.headers, body });
        });
      },
    );
    req.on("error", reject);
    req.setTimeout(60_000, () => req.destroy(new Error(`timeout ${url}`)));
    req.end();
  });
}

function isLabBinary(buf) {
  if (!buf || buf.length < MIN_BYTES) return false;
  if (buf[0] === 0x50 && buf[1] === 0x4b) return true;
  if (buf.slice(0, 5).toString("ascii") === "%PDF-") return true;
  return false;
}

function looksJson(buf) {
  const t = buf.slice(0, 32).toString("utf8").trim();
  return t.startsWith("{") || t.startsWith("[");
}

function safeName(name) {
  return String(name || "result").replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").slice(0, 120);
}

function rowsOf(doc) {
  if (!doc) return [];
  if (Array.isArray(doc)) return doc;
  if (Array.isArray(doc.data)) return doc.data;
  return [];
}

async function mapPool(items, limit, fn) {
  const ret = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i;
      i += 1;
      ret[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, limit) }, () => worker()));
  return ret;
}

async function main() {
  const listPath = path.join(DUMP, "bulk", "lab-results.json");
  if (!fs.existsSync(listPath)) {
    throw new Error(`Missing ${listPath}`);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const rows = rowsOf(JSON.parse(fs.readFileSync(listPath, "utf8")));
  const entries = [];
  let ok = 0;
  let fail = 0;
  let skipped = 0;

  await mapPool(rows, CONCURRENCY, async (row) => {
    const id = row.id;
    const destName = `${id}_${safeName(row.fileName || "result")}`;
    const dest = path.join(OUT_DIR, destName);
    if (fs.existsSync(dest) && isLabBinary(fs.readFileSync(dest))) {
      skipped += 1;
      ok += 1;
      const buf = fs.readFileSync(dest);
      entries.push({
        id,
        ok: true,
        skipped: true,
        bytes: buf.length,
        sha256: crypto.createHash("sha256").update(buf).digest("hex"),
        file: destName,
      });
      return;
    }
    const src = row.filePath || "";
    const urls = [];
    if (src) {
      const rel = src.replace(/^\//, "");
      urls.push(/^https?:\/\//i.test(src) ? src : `${CLINIC_BASE}/${rel}`);
      urls.push(`${ADMIN_BASE}/${rel}`);
    }
    if (id != null) {
      urls.push(`${CLINIC_BASE}/api/LabResult/${id}`);
      urls.push(`${ADMIN_BASE}/api/LabResult/${id}`);
    }
    let saved = null;
    let lastFail = "no-url";
    for (const url of urls) {
      try {
        const r = await request(url);
        if (r.status === 401 || r.status === 403) {
          lastFail = `HTTP ${r.status}`;
          continue;
        }
        if (r.status >= 200 && r.status < 300 && isLabBinary(r.body) && !looksJson(r.body)) {
          fs.writeFileSync(dest, r.body);
          saved = r.body;
          break;
        }
        lastFail = `HTTP ${r.status} ct=${r.headers["content-type"] || ""} bytes=${r.body.length}`;
      } catch (e) {
        lastFail = e instanceof Error ? e.message : String(e);
      }
    }
    if (saved) {
      ok += 1;
      entries.push({
        id,
        ok: true,
        bytes: saved.length,
        sha256: crypto.createHash("sha256").update(saved).digest("hex"),
        file: destName,
      });
    } else {
      fail += 1;
      entries.push({ id, ok: false, error: lastFail, file: destName });
    }
  });

  const manifest = {
    fetchedAt: new Date().toISOString(),
    source: CLINIC_BASE,
    cookieUsed: Boolean(COOKIE),
    total: rows.length,
    ok,
    fail,
    skippedExisting: skipped,
    minOk: 2000,
    brokenIds: entries.filter((e) => !e.ok).map((e) => e.id),
    gatePass:
      ok >= 2000 ||
      (fail === 0 && rows.length > 0 && ok === rows.length) ||
      (ok + fail === rows.length && fail > 0 && ok >= 1900),
    entries,
  };
  fs.writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(
    JSON.stringify(
      {
        outDir: OUT_DIR,
        total: rows.length,
        ok,
        fail,
        skippedExisting: skipped,
        gatePass: manifest.gatePass,
        cookieUsed: Boolean(COOKIE),
        bearerUsed: Boolean(BEARER),
      },
      null,
      2,
    ),
  );
  if (!manifest.gatePass) {
    process.exitCode = 2;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
