"use strict";

/**
 * Extract Res Id → Guest Id (RESGUESTID / CONTACTGUESTID) from Elektraweb HAR captures.
 *
 *   node era-hotel-pms/scripts/extract-res-guest-ids-from-har.cjs path/to/file.har [out.json]
 *
 * Pass out.json to enrich-reservations-guest-id.ts --api-map
 */
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const harPath = process.argv[2];
const outPath =
  process.argv[3] ??
  harPath.replace(/\.har$/i, ".res-guest-ids.json");

if (!harPath || !fs.existsSync(harPath)) {
  process.stderr.write("Usage: node extract-res-guest-ids-from-har.cjs <file.har> [out.json]\n");
  process.exit(2);
}

function decodeText(content) {
  const t = content?.text;
  if (t == null) return null;
  if (content.encoding === "base64") {
    return Buffer.from(t, "base64").toString("utf8");
  }
  return t;
}

function guestId(row) {
  const a = String(row.RESGUESTID ?? row.CONTACTGUESTID ?? row.GUESTID ?? "").trim();
  return a && a !== "0" ? a : "";
}

const har = JSON.parse(fs.readFileSync(harPath, "utf8"));
const map = new Map();
let rows = 0;

for (const entry of har.log?.entries ?? []) {
  const url = entry.request?.url ?? "";
  const p = URL.parse(url)?.pathname ?? "";
  if (!/\/Execute\/|\/Select\//i.test(p)) continue;
  const body = decodeText(entry.response?.content);
  if (!body) continue;
  let data;
  try {
    data = JSON.parse(body);
  } catch {
    continue;
  }
  const sets = data?.ResultSets;
  if (!Array.isArray(sets)) continue;
  for (const set of sets) {
    if (!Array.isArray(set)) continue;
    for (const row of set) {
      if (!row || typeof row !== "object") continue;
      const resId = String(row.RESID ?? row.ID ?? "").trim();
      const gid = guestId(row);
      if (!resId || !gid) continue;
      rows += 1;
      map.set(resId, gid);
    }
  }
}

const out = Object.fromEntries([...map.entries()].sort((a, b) => Number(a[0]) - Number(b[0])));
fs.writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`, "utf8");
process.stdout.write(`unique Res→Guest pairs: ${map.size} (raw rows ${rows})\nWritten: ${outPath}\n`);
