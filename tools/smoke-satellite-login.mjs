#!/usr/bin/env node
/**
 * Smoke: satellite login survives normal reload (F5).
 * Usage: node tools/smoke-satellite-login.mjs [port]
 */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const port = Number(process.argv[2] ?? "3209");
const base = `http://127.0.0.1:${port}`;

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  console.error("Install playwright in repo root: npm install -D playwright");
  process.exit(1);
}

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`page: ${e.message}`));

async function check(label, url) {
  errors.length = 0;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1500);
  const body = await page.textContent("body");
  const appError = body?.includes("Application error") ?? false;
  const ok = !appError && errors.length === 0;
  console.log(`${label}: ${ok ? "OK" : "FAIL"} (${url})`);
  if (!ok) {
    console.log("  body has Application error:", appError);
    console.log("  js errors:", errors);
  }
  return ok;
}

let ok = true;
ok &&= await check("login hard", `${base}/login`);
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
{
  const body = await page.textContent("body");
  const pass = !(body?.includes("Application error")) && errors.length === 0;
  console.log(`login reload (F5): ${pass ? "OK" : "FAIL"}`);
  if (!pass) {
    console.log("  js errors:", errors);
    ok = false;
  }
}
ok &&= await check("root redirect", `${base}/`);

await browser.close();
process.exit(ok ? 0 : 1);
