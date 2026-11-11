/**
 * GET parity, one request at a time. Stop if a server or the database dies.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const nextBase = process.env.FNB_NEXT_URL ?? "http://127.0.0.1:23202";
const nestBase = process.env.FNB_NEST_URL ?? "http://127.0.0.1:13202";
const nil = "00000000-0000-0000-0000-000000000000";
const pauseMs = Number(process.env.FNB_COMPARE_PAUSE_MS ?? 800);
const timeoutMs = Number(process.env.FNB_COMPARE_TIMEOUT_MS ?? 45000);
const progressFile = path.join(os.tmpdir(), "era-fnb-compare-nest-get.json");
const sameFile = path.join(os.tmpdir(), "era-fnb-compare-same.json");

const root = path.join(import.meta.dirname, "..");
const files = [
  ...fs.readdirSync(path.join(root, "nest", "generated")).map((name) => path.join(root, "nest", "generated", name)),
  path.join(root, "nest", "kit-routes.ts"),
];
const paths = new Map();
for (const file of files) {
  if (!file.endsWith(".ts")) continue;
  const text = fs.readFileSync(file, "utf8");
  for (const match of text.matchAll(/http\.get\(\s*"([^"]+)"/g)) {
    const original = match[1];
    paths.set(original.replace(/:[A-Za-z0-9_]+/g, nil), original);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function hit(base, pathname) {
  const res = await fetch(base + pathname, { signal: AbortSignal.timeout(timeoutMs) });
  const text = await res.text();
  return { status: res.status, text };
}

function loadProgress() {
  try {
    const parsed = JSON.parse(fs.readFileSync(progressFile, "utf8"));
    return new Set(Array.isArray(parsed.done) ? parsed.done : []);
  } catch {
    return new Set();
  }
}

function saveProgress(done, same) {
  fs.writeFileSync(progressFile, JSON.stringify({ done: [...done], same }));
  fs.writeFileSync(sameFile, JSON.stringify(same));
}

function databaseDown(text) {
  return /Can't reach database|closed the connection|ECONNREFUSED|too many clients|database system is starting|the database system is shutting down/i.test(
    text,
  );
}

const diffs = [];
let sameCount = 0;
const done = loadProgress();
const same = [];
try {
  const prior = JSON.parse(fs.readFileSync(sameFile, "utf8"));
  if (Array.isArray(prior)) same.push(...prior);
} catch {
  /* first run */
}
const list = [...paths.keys()].sort().filter((pathname) => !done.has(pathname));
console.log(`left=${list.length} pauseMs=${pauseMs} timeoutMs=${timeoutMs}`);
for (const pathname of list) {
  let a;
  let b;
  try {
    a = await hit(nextBase, pathname);
    if (databaseDown(a.text)) {
      console.log(`STOP ${pathname} database down on Next`);
      saveProgress(done, same);
      process.exit(2);
    }
    await sleep(pauseMs);
    b = await hit(nestBase, pathname);
    if (databaseDown(b.text)) {
      console.log(`STOP ${pathname} database down on Nest`);
      saveProgress(done, same);
      process.exit(2);
    }
    await sleep(pauseMs);
  } catch (err) {
    console.log(`STOP ${pathname} ${err instanceof Error ? err.message : err}`);
    saveProgress(done, same);
    process.exit(2);
  }
  done.add(pathname);
  if (a.status === b.status && a.text === b.text) {
    sameCount += 1;
    same.push(paths.get(pathname));
    console.log(`SAME ${a.status} ${pathname}`);
  } else {
    diffs.push(pathname);
    console.log(`DIFF next=${a.status} nest=${b.status} ${pathname}`);
    console.log(" next", a.text.slice(0, 140).replace(/\s+/g, " "));
    console.log(" nest", b.text.slice(0, 140).replace(/\s+/g, " "));
  }
  saveProgress(done, same);
}
console.log(`done same=${sameCount} diff=${diffs.length} total=${list.length}`);
process.exit(diffs.length ? 1 : 0);
