/**
 * GET parity, one request at a time.
 * Next compiles a route on first hit; firing both sides together, or continuing
 * after the dev server dies, is what freezes the machine.
 * Pause between calls. On a connection failure, stop and keep progress.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const nextBase = process.env.CLINIC_NEXT_URL ?? "http://127.0.0.1:3223";
const nestBase = process.env.CLINIC_NEST_URL ?? "http://127.0.0.1:4203";
const cookie =
  process.env.CLINIC_COMPARE_COOKIE ||
  (process.env.CLINIC_COMPARE_COOKIE_FILE
    ? fs.readFileSync(process.env.CLINIC_COMPARE_COOKIE_FILE, "utf8").trim()
    : "");
const nil = "00000000-0000-0000-0000-000000000000";
const pauseMs = Number(process.env.CLINIC_COMPARE_PAUSE_MS ?? 1200);
const timeoutMs = Number(process.env.CLINIC_COMPARE_TIMEOUT_MS ?? 60000);
const progressFile = path.join(os.tmpdir(), "era-clinic-compare-nest-get.json");

const dir = path.join(import.meta.dirname, "..", "nest", "generated");
const paths = new Set();
for (const name of fs.readdirSync(dir)) {
  if (!name.endsWith(".ts") || name === "register.ts") continue;
  const text = fs.readFileSync(path.join(dir, name), "utf8");
  for (const match of text.matchAll(/http\.get\(\s*"([^"]+)"/g)) {
    paths.add(match[1].replace(/:[A-Za-z0-9_]+/g, nil));
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function hit(base, pathname) {
  const res = await fetch(base + pathname, {
    headers: cookie ? { cookie } : {},
    signal: AbortSignal.timeout(timeoutMs),
  });
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

function saveProgress(done) {
  fs.writeFileSync(progressFile, JSON.stringify({ done: [...done] }));
}

function databaseDown(text) {
  return /Can't reach database|closed the connection|ECONNREFUSED|too many clients|database system is starting|the database system is shutting down/i.test(
    text,
  );
}

const diffs = [];
let same = 0;
const done = loadProgress();
const only = new Set(
  (process.env.CLINIC_COMPARE_ONLY ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean),
);
const list = [...paths]
  .sort()
  .filter((pathname) => !done.has(pathname))
  .filter((pathname) => only.size === 0 || only.has(pathname));
console.log(`resume skipped=${done.size} left=${list.length} pauseMs=${pauseMs} timeoutMs=${timeoutMs}`);
for (const pathname of list) {
  let a;
  let b;
  try {
    a = await hit(nextBase, pathname);
    if (databaseDown(a.text)) {
      console.log(`STOP ${pathname} database down on Next; not calling Nest`);
      saveProgress(done);
      process.exit(2);
    }
    await sleep(pauseMs);
    b = await hit(nestBase, pathname);
    if (databaseDown(b.text)) {
      console.log(`STOP ${pathname} database down on Nest; not continuing`);
      saveProgress(done);
      process.exit(2);
    }
    await sleep(pauseMs);
  } catch (err) {
    console.log(`STOP ${pathname} ${err instanceof Error ? err.message : err}`);
    console.log("server unreachable; not continuing");
    saveProgress(done);
    process.exit(2);
  }
  if (a.status === b.status && a.text === b.text) {
    same += 1;
    done.add(pathname);
    saveProgress(done);
    console.log(`SAME ${a.status} ${pathname}`);
  } else {
    diffs.push(pathname);
    done.add(pathname);
    saveProgress(done);
    console.log(`DIFF next=${a.status} nest=${b.status} ${pathname}`);
    console.log(" next", a.text.slice(0, 160).replace(/\s+/g, " "));
    console.log(" nest", b.text.slice(0, 160).replace(/\s+/g, " "));
  }
}
console.log(`done same=${same} diff=${diffs.length} total=${list.length}`);
process.exit(diffs.length ? 1 : 0);
