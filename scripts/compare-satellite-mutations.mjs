/**
 * Unauthenticated mutation parity. No body, so a closed route must 401 before the handler.
 * Public prefixes are skipped: an empty call there can run the handler.
 * A route.ts is removed only when every exported method is registered on Nest and matches.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const app = process.env.COMPARE_APP;
const nextBase = process.env.COMPARE_NEXT;
const nestBase = process.env.COMPARE_NEST;
const tag = process.env.COMPARE_TAG ?? app;
if (!app || !nextBase || !nestBase) {
  console.error("COMPARE_APP, COMPARE_NEXT, and COMPARE_NEST are required");
  process.exit(2);
}

const nil = "00000000-0000-0000-0000-000000000000";
const pauseMs = Number(process.env.COMPARE_PAUSE_MS ?? 300);
const timeoutMs = Number(process.env.COMPARE_TIMEOUT_MS ?? 20000);
const root = path.resolve(app);
const logFile = path.join(os.tmpdir(), `era-${tag}-mutations.log`);

const extraPublic = {
  "era-fnb-pos": ["/api/integration/settlement-confirmed", "/api/public/menu", "/api/auth/pin", "/api/auth/terminal"],
  "era-retail-pos": ["/api/integration/settlement-confirmed", "/api/integration/prescription-queue"],
  "era-bank-dbo": [],
};
const defaults = [
  "/api/auth/login",
  "/api/auth/sso/exchange",
  "/api/auth/agency-sso/exchange",
  "/api/health",
  "/api/events/dispatch",
  "/api/locale",
  "/api/internal",
  "/api/integration/staff-provision",
];
const publicApi = tag === "dbo" || app.endsWith("era-bank-dbo")
  ? ["/api/health", "/api/auth"]
  : [...defaults, ...(extraPublic[app] ?? extraPublic[path.basename(root)] ?? [])];

function log(line) {
  fs.appendFileSync(logFile, `${line}\n`);
  console.log(line);
}

function isPublic(pathname) {
  return publicApi.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

const nestMethods = new Set();
const nestDir = path.join(root, "nest");
for (const name of fs.readdirSync(path.join(nestDir, "generated"))) {
  if (!name.endsWith(".ts")) continue;
  const text = fs.readFileSync(path.join(nestDir, "generated", name), "utf8");
  for (const match of text.matchAll(/http\.(get|post|put|patch|delete)\(\s*"([^"]+)"/g)) {
    nestMethods.add(`${match[1].toUpperCase()} ${match[2]}`);
  }
}
const kit = path.join(nestDir, "kit-routes.ts");
if (fs.existsSync(kit)) {
  const text = fs.readFileSync(kit, "utf8");
  for (const match of text.matchAll(/mount\(\s*http,\s*"(get|post)",\s*"([^"]+)"/g)) {
    nestMethods.add(`${match[1].toUpperCase()} ${match[2]}`);
  }
}

function walk(dir, out) {
walkDir(dir, out);
}
function walkDir(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkDir(full, out);
    else if (entry.name === "route.ts") out.push(full);
  }
}

const routes = [];
walk(path.join(root, "app", "api"), routes);

function routePath(file) {
  const rel = path.relative(path.join(root, "app", "api"), path.dirname(file)).replace(/\\/g, "/");
  const original = `/api/${rel}`.replace(/\[([^\]]+)\]/g, ":$1");
  const called = original.replace(/:[A-Za-z0-9_]+/g, nil);
  return { original, called };
}

function methodsOf(file) {
  const text = fs.readFileSync(file, "utf8");
  const found = new Set();
  for (const match of text.matchAll(/export async function (GET|POST|PUT|PATCH|DELETE)/g)) found.add(match[1]);
  for (const match of text.matchAll(/export const \{\s*([^}]+)\s*\}/g)) {
    for (const name of match[1].split(",")) {
      const method = name.trim();
      if (/^(GET|POST|PUT|PATCH|DELETE)$/.test(method)) found.add(method);
    }
  }
  return [...found];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function hit(base, method, pathname) {
  const res = await fetch(base + pathname, { method, signal: AbortSignal.timeout(timeoutMs) });
  return { status: res.status, text: await res.text() };
}

let removed = 0;
let skipped = 0;
const diffs = [];
for (const file of routes.sort()) {
  const { original, called } = routePath(file);
  const methods = methodsOf(file).filter((method) => method !== "GET");
  if (methods.length === 0) continue;
  if (isPublic(original)) {
    skipped += 1;
    log(`SKIP public ${original}`);
    continue;
  }
  const missing = methods.filter((method) => !nestMethods.has(`${method} ${original}`));
  if (missing.length) {
    diffs.push(original);
    log(`KEEP nest missing ${missing.join(",")} ${original}`);
    continue;
  }
  let same = true;
  for (const method of methods) {
    let a;
    let b;
    try {
      a = await hit(nextBase, method, called);
      await sleep(pauseMs);
      b = await hit(nestBase, method, called);
      await sleep(pauseMs);
    } catch (err) {
      log(`STOP ${method} ${called} ${err instanceof Error ? err.message : err}`);
      process.exit(2);
    }
    if (a.status !== b.status || a.text !== b.text) {
      same = false;
      diffs.push(original);
      log(`DIFF ${method} next=${a.status} nest=${b.status} ${called}`);
      log(" next " + a.text.slice(0, 120).replace(/\s+/g, " "));
      log(" nest " + b.text.slice(0, 120).replace(/\s+/g, " "));
      break;
    }
    log(`SAME ${a.status} ${method} ${called}`);
  }
  if (same) {
    fs.unlinkSync(file);
    removed += 1;
  }
}
log(`done removed=${removed} skipped=${skipped} diff=${diffs.length}`);
process.exit(diffs.length ? 1 : 0);
