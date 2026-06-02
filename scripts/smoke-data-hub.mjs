#!/usr/bin/env node
/**
 * Smoke ERA Data Hub — health, FX, calendar.
 * Usage:
 *   node scripts/smoke-data-hub.mjs
 *   DATA_HUB_URL=http://127.0.0.1:4200 DATA_HUB_API_KEY=dev-data-hub-key node scripts/smoke-data-hub.mjs
 */
const base = (process.env.DATA_HUB_URL ?? "http://127.0.0.1:4200").replace(/\/$/, "");
const apiKey = process.env.DATA_HUB_API_KEY ?? "dev-data-hub-key";
const serviceToken = process.env.DATA_HUB_SERVICE_TOKEN ?? "";

const headers = serviceToken
  ? { Authorization: `Bearer ${serviceToken}` }
  : { "X-Api-Key": apiKey };

async function get(path, label) {
  const url = `${base}${path}`;
  const res = await fetch(url, { headers });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  if (!res.ok) {
    console.error(`FAIL ${label}: ${res.status}`, body);
    process.exitCode = 1;
    return null;
  }
  console.log(`OK ${label}: ${res.status}`);
  return body;
}

async function main() {
  console.log(`Smoke data-hub @ ${base}\n`);
  await get("/healthz", "healthz");
  await get("/registry/v1/fx/rates?symbols=USD,EUR", "fx/rates");
  const today = new Date().toISOString().slice(0, 10);
  await get(`/registry/v1/calendar/az/is-working-day?date=${today}`, "calendar/is-working-day");
  if (process.exitCode) {
    process.exit(process.exitCode);
  }
  console.log("\nAll smoke checks passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
