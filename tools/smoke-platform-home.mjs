#!/usr/bin/env node
/** Smoke: platform home pages load without client crash. */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const targets = [
  { name: "orchestrator", url: "http://127.0.0.1:3000/login" },
  { name: "finance", url: "http://127.0.0.1:3100/" },
];

const browser = await chromium.launch();
let ok = true;

for (const { name, url } of targets) {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2000);
  const body = (await page.textContent("body")) ?? "";
  const pass =
    !body.includes("Application error") &&
    !body.includes("Something went wrong") &&
    !errors.some((e) => e.includes("process is not defined"));
  console.log(`${name}: ${pass ? "OK" : "FAIL"} (${url})`);
  if (!pass) {
    console.log("  errors:", errors);
    console.log("  body snippet:", body.slice(0, 200));
    ok = false;
  }
  await page.close();
}

await browser.close();
process.exit(ok ? 0 : 1);
