#!/usr/bin/env node
/**
 * Staff session standard (ADR saas-request-tenant-and-vendor-bridges §2):
 * - no `assert<App>Entitled` helpers: the module gate lives in getSatelliteSession();
 * - each exported route handler reads the session at most once, inside `try`;
 * - module gates and the kit session never read `x-era-organization-id`;
 * - `requireHotelModule` / `requireClinicModule` always get the organization.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const APPS = [
  "era-hotel-pms",
  "era-clinic",
  "era-fnb-pos",
  "era-retail-pos",
  "era-crm",
  "era-auto-service",
  "era-construction",
  "era-wholesale",
  "era-logistics",
  "era-bank",
  "era-bank-dbo",
];

const SOURCE_DIRS = ["app", "src", "lib"];
const SKIP_DIR = new Set(["node_modules", ".next", "dist", "generated", "coverage", "prisma", "scripts"]);

/** Helpers that are the single session read for their route. */
const SESSION_READ_HELPERS = [
  "getSatelliteSession",
  "assertClinicAdminRoute",
  "assertClinicAdminRead",
  "assertClinicAdminWrite",
  "assertOpsApiPermission",
  "assertVisitExamPrintAccess",
  "assertPosBridgeOrPermission",
  "assertHotelImportAccess",
  "assertFnbImportAccess",
  "assertRetailImportAccess",
];
const READ_RE = new RegExp(`\\b(?:${SESSION_READ_HELPERS.join("|")})\\(`, "g");

const ENTITLED_RE =
  /\bassert(?:Fnb|Crm|Retail|Logistics|Wholesale|Construction|Auto|Bank|Clinic|Hotel|Dbo)Entitled\b/;
const SINGLE_ARG_GATE_RE = /\brequire(?:Hotel|Clinic)Module\(\s*(?:'[^']*'|"[^"]*"|`[^`]*`|[\w.]+)\s*\)/;
const ORG_HEADER_RE = /x-era-organization-id|ORGANIZATION_ID_HEADER/;

const GATE_FILES = [
  "packages/satellite-kit/src/auth/get-satellite-session.ts",
  "era-bank-dbo/lib/dbo-module-gate.ts",
  ...APPS.map((app) => path.posix.join(app, "src/lib")),
];

const hits = [];

function walk(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const ent of entries) {
    if (ent.name.startsWith(".")) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (!SKIP_DIR.has(ent.name)) walk(full, out);
    } else if (/\.tsx?$/.test(ent.name) && !/\.(test|spec)\.tsx?$/.test(ent.name)) {
      out.push(full);
    }
  }
  return out;
}

/** Index of the bracket closing the one at `open`; skips strings, templates, comments. */
function matchClose(src, open) {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    const n = src[i + 1];
    if (c === "/" && n === "/") {
      const nl = src.indexOf("\n", i);
      if (nl < 0) return -1;
      i = nl;
      continue;
    }
    if (c === "/" && n === "*") {
      const end = src.indexOf("*/", i + 2);
      if (end < 0) return -1;
      i = end + 1;
      continue;
    }
    if (c === '"' || c === "'") {
      for (i++; i < src.length && src[i] !== c && src[i] !== "\n"; i++) if (src[i] === "\\") i++;
      continue;
    }
    if (c === "`") {
      for (i++; i < src.length && src[i] !== "`"; i++) {
        if (src[i] === "\\") i++;
        else if (src[i] === "$" && src[i + 1] === "{") {
          const end = matchClose(src, i + 1);
          if (end < 0) return -1;
          i = end;
        }
      }
      continue;
    }
    if (c === "(" || c === "{" || c === "[") depth++;
    else if (c === ")" || c === "}" || c === "]") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function lineOf(src, index) {
  return src.slice(0, index).split("\n").length;
}

function checkRouteHandlers(rel, src) {
  const re = /^export async function (GET|POST|PUT|PATCH|DELETE)\(/gm;
  let m;
  while ((m = re.exec(src))) {
    const parenClose = matchClose(src, m.index + m[0].length - 1);
    if (parenClose < 0) continue;
    const bodyOpen = src.indexOf("{", parenClose);
    const bodyClose = bodyOpen < 0 ? -1 : matchClose(src, bodyOpen);
    if (bodyClose < 0) continue;
    const reads = [];
    READ_RE.lastIndex = 0;
    const body = src.slice(bodyOpen, bodyClose);
    let r;
    while ((r = READ_RE.exec(body))) reads.push(bodyOpen + r.index);
    if (reads.length === 0) continue;
    if (reads.length > 1) {
      hits.push(`${rel}:${lineOf(src, m.index)} ${m[1]} reads the session ${reads.length} times`);
    }
    const tries = [];
    const tryRe = /\btry\s*\{/g;
    let t;
    while ((t = tryRe.exec(body))) {
      const open = bodyOpen + t.index + t[0].length - 1;
      const close = matchClose(src, open);
      if (close > 0) tries.push([open, close]);
    }
    for (const at of reads) {
      if (!tries.some(([a, b]) => at > a && at < b)) {
        hits.push(`${rel}:${lineOf(src, at)} ${m[1]} reads the session outside try`);
      }
    }
  }
}

for (const app of APPS) {
  for (const dir of SOURCE_DIRS) {
    for (const file of walk(path.join(root, app, dir))) {
      const rel = path.relative(root, file).replace(/\\/g, "/");
      const src = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
      const lines = src.split("\n");
      lines.forEach((line, i) => {
        if (ENTITLED_RE.test(line)) hits.push(`${rel}:${i + 1} assert*Entitled is removed; the gate is in getSatelliteSession()`);
        if (SINGLE_ARG_GATE_RE.test(line)) hits.push(`${rel}:${i + 1} module gate without the session organization`);
      });
      if (/\/route\.ts$/.test(rel)) checkRouteHandlers(rel, src);
    }
  }
}

for (const entry of GATE_FILES) {
  const full = path.join(root, entry);
  const files = fs.existsSync(full) && fs.statSync(full).isDirectory()
    ? fs.readdirSync(full).filter((f) => /-module-gate\.ts$/.test(f)).map((f) => path.join(full, f))
    : [full];
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    const rel = path.relative(root, file).replace(/\\/g, "/");
    fs.readFileSync(file, "utf8").split(/\r?\n/).forEach((line, i) => {
      if (ORG_HEADER_RE.test(line)) hits.push(`${rel}:${i + 1} reads the organization header; take it from the session`);
    });
  }
}

if (hits.length) {
  console.error("FAIL: staff session standard");
  for (const h of hits) console.error(`  ${h}`);
  process.exit(1);
}
console.log("PASS: staff session standard");
