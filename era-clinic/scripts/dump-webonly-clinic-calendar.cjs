/**
 * Dump Nafta WebOnly clinic procedure calendar (dashboard /clinic/clinic).
 *
 * Source UI: https://nafta-admin.webonly.io/en/dashboard/clinic/clinic
 * Source API: GET https://nafta-clinic.webonly.io/api/Reservations
 *             GET https://nafta-clinic.webonly.io/api/Reservations/range?from=&to=
 *
 * Writes PII locally. Default: same cutover folder as patient-card dump.
 *
 *   node era-clinic/scripts/dump-webonly-clinic-calendar.cjs
 *   node era-clinic/scripts/dump-webonly-clinic-calendar.cjs --from 2026-02-01 --to 2026-09-01
 */

const fs = require("fs");
const https = require("https");
const path = require("path");
const { URL } = require("url");

const CLINIC_BASE = process.env.WO_CLINIC_API || "https://nafta-clinic.webonly.io";
const TODAY = new Date().toISOString().slice(0, 10);
const DEFAULT_OUT = path.join(
  "D:",
  "ERA-BACKUP",
  "NAFTA-START",
  "clinic",
  "dump",
  "calendar",
);

const args = process.argv.slice(2);
function flag(name, fallback) {
  const i = args.indexOf(name);
  if (i === -1) return fallback;
  const next = args[i + 1];
  if (!next || next.startsWith("--")) return true;
  return next;
}

const OUT_DIR = path.resolve(String(flag("--out", process.env.WO_CALENDAR_DUMP_DIR || DEFAULT_OUT)));
const FROM = String(flag("--from", "2026-02-01"));
const TO = String(flag("--to", addDays(TODAY, 21)));

const agent = new https.Agent({ keepAlive: true, maxSockets: 6 });

function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function request(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || 443,
        path: u.pathname + u.search,
        method: "GET",
        agent,
        headers: {
          "User-Agent": "era-clinic-webonly-cutover-dump/1.0",
          Accept: "application/json",
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () =>
          resolve({ status: res.statusCode || 0, body: Buffer.concat(chunks) }),
        );
      },
    );
    req.on("error", reject);
    req.setTimeout(180_000, () => req.destroy(new Error(`timeout ${url}`)));
    req.end();
  });
}

async function requestRetry(url, tries = 4) {
  let last;
  for (let i = 0; i < tries; i += 1) {
    try {
      const r = await request(url);
      if (r.status === 429 || r.status >= 500) {
        last = new Error(`HTTP ${r.status} ${url}`);
        await new Promise((ok) => setTimeout(ok, 400 * 2 ** i));
        continue;
      }
      return r;
    } catch (e) {
      last = e;
      await new Promise((ok) => setTimeout(ok, 400 * 2 ** i));
    }
  }
  throw last;
}

function unwrap(body) {
  if (!body || !body.length) return [];
  const j = JSON.parse(body.toString("utf8"));
  if (Array.isArray(j)) return j;
  if (j && Array.isArray(j.data)) return j.data;
  if (j && j.data) return [j.data];
  return [];
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function rowDate(row) {
  const raw = row?.date || row?.startTime || "";
  return String(raw).slice(0, 10);
}

function summarize(rows) {
  const byDate = new Map();
  const byMonth = new Map();
  const byStatus = new Map();
  let min = null;
  let max = null;
  for (const row of rows) {
    const d = rowDate(row);
    if (!d) continue;
    if (!min || d < min) min = d;
    if (!max || d > max) max = d;
    byDate.set(d, (byDate.get(d) || 0) + 1);
    const month = d.slice(0, 7);
    byMonth.set(month, (byMonth.get(month) || 0) + 1);
    const st = String(row.status ?? (row.isCompleted ? "completed" : "open"));
    byStatus.set(st, (byStatus.get(st) || 0) + 1);
  }
  return {
    count: rows.length,
    minDate: min,
    maxDate: max,
    days: byDate.size,
    byMonth: Object.fromEntries([...byMonth.entries()].sort()),
    byStatus: Object.fromEntries([...byStatus.entries()].sort()),
    byDate: Object.fromEntries([...byDate.entries()].sort()),
  };
}

async function fetchJson(ep) {
  const url = CLINIC_BASE + ep;
  process.stdout.write(`GET ${ep} ... `);
  const r = await requestRetry(url);
  const data = unwrap(r.body);
  console.log(`${r.status} count=${data.length} bytes=${r.body.length}`);
  return { status: r.status, data, bytes: r.body.length };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`out ${OUT_DIR}`);
  console.log(`window ${FROM} .. ${TO}`);

  const all = await fetchJson("/api/Reservations");
  const ranged = await fetchJson(`/api/Reservations/range?from=${FROM}&to=${TO}`);
  const shifts = await fetchJson("/api/Shift/get-all");
  const rooms = await fetchJson("/api/Rooms");

  writeJson(path.join(OUT_DIR, "reservations-all.json"), {
    endpoint: "/api/Reservations",
    fetchedAt: new Date().toISOString(),
    httpStatus: all.status,
    count: all.data.length,
    data: all.data,
  });
  writeJson(path.join(OUT_DIR, "reservations-range.json"), {
    endpoint: `/api/Reservations/range?from=${FROM}&to=${TO}`,
    fetchedAt: new Date().toISOString(),
    httpStatus: ranged.status,
    count: ranged.data.length,
    data: ranged.data,
  });
  writeJson(path.join(OUT_DIR, "shifts.json"), {
    endpoint: "/api/Shift/get-all",
    fetchedAt: new Date().toISOString(),
    httpStatus: shifts.status,
    count: shifts.data.length,
    data: shifts.data,
  });
  writeJson(path.join(OUT_DIR, "rooms.json"), {
    endpoint: "/api/Rooms",
    fetchedAt: new Date().toISOString(),
    httpStatus: rooms.status,
    count: rooms.data.length,
    data: rooms.data,
  });

  const merged = new Map();
  for (const row of [...all.data, ...ranged.data]) {
    if (row && row.id != null) merged.set(row.id, row);
  }
  const unique = [...merged.values()].sort((a, b) => {
    const da = rowDate(a);
    const db = rowDate(b);
    if (da !== db) return da.localeCompare(db);
    return String(a.startTime || "").localeCompare(String(b.startTime || ""));
  });

  const inWindow = unique.filter((row) => {
    const d = rowDate(row);
    return d && d >= FROM && d <= TO;
  });

  const byDateDir = path.join(OUT_DIR, "by-date");
  fs.mkdirSync(byDateDir, { recursive: true });
  const grouped = new Map();
  for (const row of inWindow) {
    const d = rowDate(row);
    if (!grouped.has(d)) grouped.set(d, []);
    grouped.get(d).push(row);
  }
  for (const [d, rows] of grouped) {
    writeJson(path.join(byDateDir, `${d}.json`), {
      date: d,
      count: rows.length,
      data: rows,
    });
  }

  const summary = {
    sourceUi: "https://nafta-admin.webonly.io/en/dashboard/clinic/clinic",
    sourceApi: CLINIC_BASE,
    fetchedAt: new Date().toISOString(),
    outDir: OUT_DIR,
    window: { from: FROM, to: TO },
    all: summarize(all.data),
    range: summarize(ranged.data),
    unique: summarize(unique),
    inWindow: summarize(inWindow),
    dayFiles: grouped.size,
    shifts: shifts.data.length,
    rooms: rooms.data.length,
  };
  writeJson(path.join(OUT_DIR, "summary.json"), summary);
  const publicSummary = {
    ...summary,
    all: { ...summary.all, byDate: undefined },
    range: { ...summary.range, byDate: undefined },
    unique: { ...summary.unique, byDate: undefined },
    inWindow: { ...summary.inWindow, byDate: undefined },
  };
  console.log(JSON.stringify(publicSummary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
