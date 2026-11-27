#!/usr/bin/env node
/**
 * Assert EN public copy getters expose the same top-level keys as AZ for TS copy modules.
 */
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.join(__dirname, "..");
const i18n = path.join(webRoot, "lib", "i18n");

function topKeys(obj) {
  return Object.keys(obj ?? {}).sort();
}

function assertSame(label, azKeys, enKeys) {
  const missing = azKeys.filter((k) => !enKeys.includes(k));
  const extra = enKeys.filter((k) => !azKeys.includes(k));
  if (missing.length || extra.length) {
    console.error(`[FAIL] ${label}`);
    if (missing.length) console.error("  missing in en:", missing);
    if (extra.length) console.error("  extra in en:", extra);
    return false;
  }
  console.log(`[ok] ${label} (${azKeys.length} keys)`);
  return true;
}

async function loadTsModule(rel) {
  const full = path.join(i18n, rel);
  return import(pathToFileURL(full).href);
}

let ok = true;

const {
  landingMarketingCopyByLocale,
} = await loadTsModule("landing-copy.ts");
ok = assertSame(
  "landing marketing",
  topKeys(landingMarketingCopyByLocale.az),
  topKeys(landingMarketingCopyByLocale.en),
) && ok;

const { getSatellitesIndexCopy } = await loadTsModule("satellite-page-copy.ts");
ok = assertSame("satellites index", topKeys(getSatellitesIndexCopy("az")), topKeys(getSatellitesIndexCopy("en"))) && ok;

const { getPricingMetersCopy } = await loadTsModule("pricing-meters-copy.ts");
ok = assertSame("pricing meters", topKeys(getPricingMetersCopy("az")), topKeys(getPricingMetersCopy("en"))) && ok;

const { getSiteNavCopy } = await loadTsModule("site-nav-copy.ts");
ok = assertSame("site nav", topKeys(getSiteNavCopy("az")), topKeys(getSiteNavCopy("en"))) && ok;

const { getPricingStorefrontUiCopy } = await loadTsModule("pricing-storefront-copy.ts");
ok = assertSame(
  "pricing storefront ui",
  topKeys(getPricingStorefrontUiCopy("az")),
  topKeys(getPricingStorefrontUiCopy("en")),
) && ok;

const messagesAz = JSON.parse(fs.readFileSync(path.join(webRoot, "messages", "az.json"), "utf8"));
const messagesEn = JSON.parse(fs.readFileSync(path.join(webRoot, "messages", "en.json"), "utf8"));
ok = assertSame("messages.site", topKeys(messagesAz.site), topKeys(messagesEn.site)) && ok;

process.exit(ok ? 0 : 1);