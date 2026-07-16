/**
 * Scrape 2GIS organizations inside Baku business plazas — no paid API.
 *
 * Key discovery: after opening a plaza firm card, tenants live at
 *   https://2gis.az/baku/firm/{id}/tab/inside   ("Binada")
 *
 * Also must dismiss the "update your browser" interstitial that blocks headless Chromium.
 *
 * Usage:
 *   node tools/scrape-2gis-plaza-tenants.mjs
 *   node tools/scrape-2gis-plaza-tenants.mjs --limit 5
 *   node tools/scrape-2gis-plaza-tenants.mjs --force --plaza plaza-port-baku-north
 *   node tools/scrape-2gis-plaza-tenants.mjs --headful
 */

import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const ROOT = path.resolve(import.meta.dirname, "..");
const DATA = path.join(ROOT, "data", "business-plazas");
const PLAZAS_CSV = path.join(DATA, "baku-business-plazas.csv");
const CACHE_DIR = path.join(DATA, ".cache", "2gis-tenants");
const OUT_JSON = path.join(CACHE_DIR, "_all-2gis-tenants.json");
const OUT_CSV = path.join(DATA, "baku-plaza-tenants-2gis.csv");

const args = process.argv.slice(2);
const limitIdx = args.indexOf("--limit");
const LIMIT = limitIdx >= 0 ? Number(args[limitIdx + 1]) : 0;
const plazaIdx = args.indexOf("--plaza");
const PLAZA_FILTER = plazaIdx >= 0 ? args[plazaIdx + 1] : "";
const FORCE = args.includes("--force");
const HEADFUL = args.includes("--headful");

const UI_NOISE =
  /^(Əlaqə|Məlumat|Binada|Rəylər|Fotoşəkil|Android|iOS|Открыть|Open|Показать|Show|Карта|Map|Marşrut|Axtarış|Dostlar|Bələdçi|Контакты|Инфо|Отзывы|Фото|Yadda|Göndərmək)/i;

function readCsv(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const lines = text.split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const vals = parseCsvLine(line);
    const row = {};
    headers.forEach((h, i) => {
      row[h] = vals[i] ?? "";
    });
    return row;
  });
}

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') inQ = false;
      else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}

function csvEscape(v) {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function isTenantName(name) {
  const n = String(name || "").trim();
  if (!n || n.length < 2) return false;
  if (UI_NOISE.test(n)) return false;
  if (/küçəsi|döngə|проспект|улица/i.test(n) && !/\b(mmc|bank|otel|hotel|klinik)/i.test(n)) {
    return false;
  }
  return true;
}

async function dismissBrowserNudge(page) {
  const skip = page.getByText(/Skip the browser update|Пропустить|Keç|открыть 2GIS|open 2GIS/i);
  if (await skip.count()) {
    await skip.first().click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1500);
  }
}

async function scrollResults(page, times = 20) {
  await page.evaluate(async (n) => {
    const candidates = [
      ...document.querySelectorAll('[class*="scroll"], [class*="list"], aside, main'),
    ];
    const el =
      candidates.find((e) => e.scrollHeight > e.clientHeight + 40) ||
      document.scrollingElement ||
      document.body;
    for (let i = 0; i < n; i++) {
      el.scrollBy?.(0, 900);
      window.scrollBy(0, 900);
      await new Promise((r) => setTimeout(r, 300));
    }
  }, times);
}

async function collectFirmLinks(page) {
  const raw = await page.evaluate(() => {
    const out = [];
    const seen = new Set();
    for (const a of document.querySelectorAll('a[href*="/firm/"]')) {
      const href = a.getAttribute("href") || "";
      const m = href.match(/\/firm\/(\d+)/);
      if (!m) continue;
      const id = m[1];
      const name = (a.textContent || "").trim().replace(/\s+/g, " ");
      if (!name || seen.has(id)) continue;
      seen.add(id);
      out.push({ name, href: `https://2gis.az/baku/firm/${id}`, firm_id: id });
    }
    return out;
  });
  return raw.filter((f) => isTenantName(f.name));
}

async function findPlazaFirmId(page, plaza) {
  const url = `https://2gis.az/baku/search/${encodeURIComponent(plaza.canonical_name)}`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await dismissBrowserNudge(page);
  await page.waitForTimeout(4000);

  return page.evaluate((plazaName) => {
    const norm = (s) =>
      String(s || "")
        .toLowerCase()
        .replace(/[^a-z0-9а-яёəıöüçşğ]+/gi, "");
    const pn = norm(plazaName);
    const out = [];
    for (const a of document.querySelectorAll('a[href*="/firm/"]')) {
      const href = a.getAttribute("href") || "";
      const m = href.match(/\/firm\/(\d+)/);
      if (!m) continue;
      const name = (a.textContent || "").trim().replace(/\s+/g, " ");
      if (!name) continue;
      const nn = norm(name);
      let score = 1;
      if (nn.includes(pn.slice(0, Math.min(10, pn.length)))) score = 3;
      if (/biznes|plaza|tower|mərkəz|center|mall/i.test(name)) score += 1;
      out.push({ id: m[1], name, score });
    }
    out.sort((a, b) => b.score - a.score);
    return out[0] || null;
  }, plaza.canonical_name);
}

async function scrapeInsideBuilding(page, plazaFirmId) {
  await page.goto(`https://2gis.az/baku/firm/${plazaFirmId}/tab/inside`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await dismissBrowserNudge(page);
  await page.waitForTimeout(3500);

  const showAll = page
    .locator("a, button")
    .filter({ hasText: /показать все|hamısını|show all|bütün|daha çox|ещё|все/i });
  if (await showAll.count()) {
    await showAll.first().click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(2000);
  }

  await scrollResults(page, 30);
  return (await collectFirmLinks(page)).filter((f) => f.firm_id !== String(plazaFirmId));
}

async function scrapePlaza(page, plaza) {
  const cacheFile = path.join(CACHE_DIR, `${plaza.id}.json`);
  if (fs.existsSync(cacheFile) && !FORCE) {
    return JSON.parse(fs.readFileSync(cacheFile, "utf8"));
  }

  let firms = [];
  let method = "";
  let plazaFirmId = "";
  let query = plaza.canonical_name;

  const found = await findPlazaFirmId(page, plaza);
  if (found?.id) {
    plazaFirmId = found.id;
    firms = await scrapeInsideBuilding(page, found.id);
    method = "tab-inside";
    query = `firm/${found.id}/tab/inside`;
  }

  if (firms.length < 2) {
    await page.goto(`https://2gis.az/baku/search/${encodeURIComponent(plaza.canonical_name)}`, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await dismissBrowserNudge(page);
    await page.waitForTimeout(3000);
    await scrollResults(page, 10);
    const searchFirms = (await collectFirmLinks(page)).filter(
      (f) => f.firm_id !== plazaFirmId,
    );
    if (searchFirms.length > firms.length) {
      firms = searchFirms;
      method = method ? `${method}+search` : "search-results";
    }
  }

  const payload = {
    plaza_id: plaza.id,
    plaza_name: plaza.canonical_name,
    plaza_firm_id: plazaFirmId,
    query,
    method,
    scraped_at: new Date().toISOString(),
    firms,
  };
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(cacheFile, JSON.stringify(payload, null, 2), "utf8");
  return payload;
}

async function main() {
  let plazas = readCsv(PLAZAS_CSV).filter((p) => (p.canonical_name || "").trim());
  if (PLAZA_FILTER) plazas = plazas.filter((p) => p.id === PLAZA_FILTER);
  if (LIMIT > 0) plazas = plazas.slice(0, LIMIT);

  const browser = await chromium.launch({
    headless: !HEADFUL,
    args: ["--disable-blink-features=AutomationControlled"],
  });
  const context = await browser.newContext({
    locale: "az-AZ",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  await page.goto("https://2gis.az/baku", { waitUntil: "domcontentloaded", timeout: 60000 }).catch(async () => {
    console.log("Warm-up timeout — retry once...");
    await page.waitForTimeout(2000);
    await page.goto("https://2gis.az/baku", { waitUntil: "domcontentloaded", timeout: 90000 });
  });
  await dismissBrowserNudge(page);
  await page.waitForTimeout(1500);

  const all = [];
  for (let i = 0; i < plazas.length; i++) {
    const plaza = plazas[i];
    process.stdout.write(`[${i + 1}/${plazas.length}] ${plaza.canonical_name} ... `);
    try {
      const result = await scrapePlaza(page, plaza);
      const firms = result.firms || [];
      console.log(`${firms.length} tenant(s) [${result.method || "cache"}]`);
      for (const firm of firms) {
        all.push({
          plaza_id: plaza.id,
          plaza_name: plaza.canonical_name,
          company_name: firm.name,
          firm_id: firm.firm_id || "",
          website: firm.href || "",
          address: plaza.address || "",
          source: "2gis-binada",
        });
      }
    } catch (e) {
      console.log(`ERROR ${e.message}`);
    }
    if (i < plazas.length - 1) await page.waitForTimeout(1200 + Math.floor(Math.random() * 800));
  }

  await browser.close();

  const seen = new Set();
  const deduped = [];
  for (const row of all) {
    const key = row.firm_id
      ? `${row.plaza_id}|${row.firm_id}`
      : `${row.plaza_id}|${row.company_name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(row);
  }

  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(OUT_JSON, JSON.stringify(deduped, null, 2), "utf8");
  const header = ["plaza_id", "plaza_name", "company_name", "firm_id", "website", "address", "source"];
  fs.writeFileSync(
    OUT_CSV,
    [header.join(","), ...deduped.map((r) => header.map((h) => csvEscape(r[h])).join(","))].join("\n") +
      "\n",
    "utf8",
  );

  console.log(`\nCached ${deduped.length} unique tenant rows`);
  console.log(`  CSV → ${OUT_CSV}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
