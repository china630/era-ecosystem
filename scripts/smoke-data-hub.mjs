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
  const fxRates = await get("/registry/v1/fx/rates?symbols=USD,EUR", "fx/rates");
  const today = new Date().toISOString().slice(0, 10);
  await get(`/registry/v1/fx/rates?date=${today}&symbols=USD,EUR`, "fx/rates-dated");
  await get(
    `/registry/v1/fx/convert?from=USD&to=AZN&amount=100&date=${today}`,
    "fx/convert",
  );
  if (fxRates?.rates?.length) {
    const sample = fxRates.rates[0];
    console.log(
      `  sample: ${sample.currencyCode}=${sample.rate} status=${sample.status ?? "n/a"} date=${sample.rateDate ?? today}`,
    );
  }
  await get(`/registry/v1/calendar/az/is-working-day?date=${today}`, "calendar/is-working-day");
  await get(`/registry/v1/calendar/az/day?date=${today}`, "calendar/day");
  await get(
    `/registry/v1/calendar/az/days?from=${today.slice(0, 4)}-01-01&to=${today.slice(0, 4)}-01-07`,
    "calendar/days-bulk",
  );
  await get(
    `/registry/v1/calendar/az/add-business-days?date=${today}&n=3`,
    "calendar/add-business-days",
  );
  // transferred_working sample (2026-01-17)
  await get("/registry/v1/calendar/az/day?date=2026-01-17", "calendar/transferred-working");
  await get("/registry/v1/banks", "banks");
  await get("/registry/v1/uom", "uom");
  await get("/registry/v1/geo/countries", "geo/countries");
  await get(`/registry/v1/tax-rates?type=VAT&date=${today}`, "tax-rates");
  await get("/registry/v1/chart-of-accounts?profile=commercial", "chart-of-accounts");
  await get("/registry/v1/iban/validate?iban=AZ21NABZ01350100000000001951", "iban/validate");
  if (process.exitCode) {
    process.exit(process.exitCode);
  }
  console.log("\nAll smoke checks passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
