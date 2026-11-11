/**
 * Anonymous GET parity for one satellite. One request, pause, the other side.
 * Deletes route.ts only for paths that already matched. Stops if a server or the database dies.
 *
 * COMPARE_APP, COMPARE_NEXT, COMPARE_NEST, COMPARE_TAG
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
const pauseMs = Number(process.env.COMPARE_PAUSE_MS ?? 800);
const timeoutMs = Number(process.env.COMPARE_TIMEOUT_MS ?? 45000);
const progressFile = path.join(os.tmpdir(), `era-${tag}-compare-nest-get.json`);
const logFile = path.join(os.tmpdir(), `era-${tag}-compare-nest-get.log`);
function log(line) {
  fs.appendFileSync(logFile, `${line}\n`);
  console.log(line);
}
const root = path.resolve(app);

const paths = new Map();
function add(original) {
  paths.set(original.replace(/:[A-Za-z0-9_]+/g, nil), original);
}
const nestDir = path.join(root, "nest");
for (const name of fs.readdirSync(path.join(nestDir, "generated"))) {
  if (!name.endsWith(".ts")) continue;
  const text = fs.readFileSync(path.join(nestDir, "generated", name), "utf8");
  for (const match of text.matchAll(/http\.get\(\s*"([^"]+)"/g)) add(match[1]);
}
const kit = path.join(nestDir, "kit-routes.ts");
if (fs.existsSync(kit)) {
  const text = fs.readFileSync(kit, "utf8");
  for (const match of text.matchAll(/mount\(\s*http,\s*"get",\s*"([^"]+)"/g)) add(match[1]);
}
const proxies = path.join(nestDir, "engine-proxies.ts");
if (fs.existsSync(proxies)) {
  const text = fs.readFileSync(proxies, "utf8");
  for (const match of text.matchAll(/enginePrefix:\s*"([^"]+)"/g)) add(`/api/${match[1]}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function hit(base, pathname) {
  const res = await fetch(base + pathname, { signal: AbortSignal.timeout(timeoutMs) });
  return { status: res.status, text: await res.text() };
}

function databaseDown(text) {
  return /Can't reach database|closed the connection|ECONNREFUSED|too many clients|database system is starting|the database system is shutting down/i.test(
    text,
  );
}

function loadProgress() {
  try {
    return JSON.parse(fs.readFileSync(progressFile, "utf8"));
  } catch {
    return { done: [], same: [] };
  }
}

function saveProgress(done, same) {
  fs.writeFileSync(progressFile, JSON.stringify({ done: [...done], same }));
}

function deleteSame(same) {
  let removed = 0;
  for (const original of same) {
    const rel = original.replace(/^\/api\//, "").replace(/:([A-Za-z0-9_]+)/g, "[$1]");
    const file = path.join(root, "app", "api", rel, "route.ts");
    const catchAll = path.join(root, "app", "api", rel, "[[...path]]", "route.ts");
    const target = fs.existsSync(file) ? file : fs.existsSync(catchAll) ? catchAll : "";
    if (!target) continue;
    fs.unlinkSync(target);
    removed += 1;
  }
  log(`removed=${removed}`);
}

const prior = loadProgress();
const done = new Set(prior.done ?? []);
const same = [...(prior.same ?? [])];
const list = [...paths.keys()].sort().filter((pathname) => !done.has(pathname));
log(`${tag} left=${list.length} pauseMs=${pauseMs}`);
const diffs = [];
for (const pathname of list) {
  let a;
  let b;
  try {
    a = await hit(nextBase, pathname);
    if (databaseDown(a.text)) {
      log(`STOP ${pathname} database down on Next`);
      saveProgress(done, same);
      deleteSame(same);
      process.exit(2);
    }
    await sleep(pauseMs);
    b = await hit(nestBase, pathname);
    if (databaseDown(b.text)) {
      log(`STOP ${pathname} database down on Nest`);
      saveProgress(done, same);
      deleteSame(same);
      process.exit(2);
    }
    await sleep(pauseMs);
  } catch (err) {
    log(`STOP ${pathname} ${err instanceof Error ? err.message : err}`);
    saveProgress(done, same);
    deleteSame(same);
    process.exit(2);
  }
  done.add(pathname);
  if (a.status === b.status && a.text === b.text) {
    same.push(paths.get(pathname));
    log(`SAME ${a.status} ${pathname}`);
  } else {
    diffs.push(pathname);
    log(`DIFF next=${a.status} nest=${b.status} ${pathname}`);
    log(" next", a.text.slice(0, 140).replace(/\s+/g, " "));
    log(" nest", b.text.slice(0, 140).replace(/\s+/g, " "));
  }
  saveProgress(done, same);
}
deleteSame(same);
log(`done same=${same.length} diff=${diffs.length} total=${list.length}`);
process.exit(diffs.length ? 1 : 0);
