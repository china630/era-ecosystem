/** Playwright session + cached e-taxes findTaxpayer calls. DVX returns at most 50 taxpayers per query. */

import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import {
  cacheFileSlug,
  toEtaxesSearchQuery,
} from "./etaxes-search-utils.mjs";

export const ETAXES_PAGE =
  "https://new.e-taxes.gov.az/etaxes/services/legal-entity-info";
export const FIND_URL =
  "https://new.e-taxes.gov.az/api/po/authless/public/v1/authless/findTaxpayer";

export async function launchBrowser(headful = false) {
  const browser = await chromium.launch({
    headless: !headful,
    args: ["--disable-blink-features=AutomationControlled"],
  });
  const context = await browser.newContext({
    locale: "az-AZ",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();
  await refreshEtaxesPage(page);
  return { browser, page };
}

export async function refreshEtaxesPage(page) {
  await page.goto(ETAXES_PAGE, { waitUntil: "networkidle", timeout: 90_000 });
  await page.waitForTimeout(1500);
}

function cacheFileForQuery(cacheDir, query) {
  return path.join(cacheDir, `name_${cacheFileSlug(query)}.json`);
}

function cacheFileForVoen(cacheDir, voen) {
  return path.join(cacheDir, `voen_${voen}.json`);
}

/** Re-query 404 entries that used wrong case (lower/ASCII I vs Azerbaijani İ). */
function shouldRetryCached404(cached, rawQuery) {
  if (!cached?.error || !/404/.test(String(cached.error))) return false;
  const apiQ = toEtaxesSearchQuery(rawQuery);
  if (cached.api_query === apiQ) return false;
  return cached.query !== apiQ;
}

async function postFind(page, body, timeoutMs = 60_000) {
  const evaluatePromise = page.evaluate(
    async ({ url, body }) => {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      let json = null;
      try {
        json = JSON.parse(text);
      } catch {
        json = { error: text.slice(0, 500), taxpayers: [] };
      }
      return { status: res.status, json };
    },
    { url: FIND_URL, body },
  );

  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("ETAXES_TIMEOUT")), timeoutMs);
  });

  try {
    return await Promise.race([evaluatePromise, timeoutPromise]);
  } finally {
    clearTimeout(timer);
  }
}

export async function searchLegalEntities(page, query, cacheDir) {
  const cacheFile = cacheFileForQuery(cacheDir, query);
  const apiName = toEtaxesSearchQuery(query);

  if (fs.existsSync(cacheFile)) {
    const cached = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
    if (!shouldRetryCached404(cached, query)) {
      return { query, taxpayers: cached.taxpayers ?? [], error: cached.error };
    }
    fs.unlinkSync(cacheFile);
  }

  const result = await postFind(page, {
    name: apiName,
    type: "legalEntity",
    serviceCode: "checkLegalName",
    isStateRegistry: true,
  });

  if (result.status !== 200) {
    const payload = {
      query,
      api_query: apiName,
      taxpayers: [],
      error: `HTTP ${result.status}`,
    };
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(cacheFile, JSON.stringify(payload, null, 2), "utf8");
    return payload;
  }

  const payload = { query, api_query: apiName, taxpayers: result.json?.taxpayers ?? [] };
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(cacheFile, JSON.stringify(payload, null, 2), "utf8");
  return payload;
}

export async function searchByVoen(page, voen, cacheDir) {
  const cacheFile = cacheFileForVoen(cacheDir, voen);
  if (fs.existsSync(cacheFile)) {
    const cached = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
    return { query: voen, taxpayers: cached.taxpayers ?? [], error: cached.error };
  }

  const result = await postFind(page, {
    tin: voen,
    type: "legalEntity",
    serviceCode: "checkLegalName",
    isStateRegistry: true,
  });

  if (result.status !== 200) {
    const payload = { query: voen, taxpayers: [], error: `HTTP ${result.status}` };
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(cacheFile, JSON.stringify(payload, null, 2), "utf8");
    return payload;
  }

  const payload = { query: voen, taxpayers: result.json?.taxpayers ?? [] };
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(cacheFile, JSON.stringify(payload, null, 2), "utf8");
  return payload;
}
