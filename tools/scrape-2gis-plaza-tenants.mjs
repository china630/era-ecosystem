/**
 * Scrape 2GIS search results for organizations near each plaza (cached).
 * Merge into baku-plaza-tenants-DRAFT.csv via collect script re-run or standalone append.
 *
 *   node tools/scrape-2gis-plaza-tenants.mjs
 *   node tools/scrape-2gis-plaza-tenants.mjs --limit 10
 */

import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const ROOT = path.resolve(import.meta.dirname, "..");
const DATA = path.join(ROOT, "data", "business-plazas");
const PLAZAS_CSV = path.join(DATA, "baku-business-plazas.csv");
const CACHE_DIR = path.join(DATA, ".cache", "2gis-tenants");
const OUT_JSON = path.join(CACHE_DIR, "_all-2gis-tenants.json");

const args = process.argv.slice(2);
const limitIdx = args.indexOf("--limit");
const LIMIT = limitIdx >= 0 ? Number(args[limitIdx + 1]) : 0;

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

function slugify(text) {
  return (text || "x")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 48);
}

async function scrapePlaza(page, plaza) {
  const cacheFile = path.join(CACHE_DIR, `${plaza.id}.json`);
  if (fs.existsSync(cacheFile)) {
    return JSON.parse(fs.readFileSync(cacheFile, "utf8"));
  }

  const query = `${plaza.canonical_name} Bakı`;
  const url = `https://2gis.az/baku/search/${encodeURIComponent(query)}`;
  let items = [];
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(3000);
    items = await page.evaluate(() => {
      const links = [...document.querySelectorAll('a[href*="/firm/"]')];
      const seen = new Set();
      const out = [];
      for (const a of links) {
        const name = (a.textContent || "").trim();
        const href = a.getAttribute("href") || "";
        if (!name || name.length < 2 || seen.has(name)) continue;
        seen.add(name);
        out.push({ name, href });
        if (out.length >= 50) break;
      }
      return out;
    });
  } catch (e) {
    items = [{ error: String(e.message || e) }];
  }

  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(cacheFile, JSON.stringify(items, null, 2), "utf8");
  return items;
}

async function main() {
  const plazas = readCsv(PLAZAS_CSV).filter((p) => (p.address || "").trim());
  let targets = plazas;
  if (LIMIT > 0) targets = targets.slice(0, LIMIT);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ locale: "az-AZ" });
  const all = [];

  for (let i = 0; i < targets.length; i++) {
    const plaza = targets[i];
    process.stdout.write(`[${i + 1}/${targets.length}] ${plaza.canonical_name} ... `);
    const items = await scrapePlaza(page, plaza);
    const firms = items.filter((x) => x.name && !x.error);
    console.log(`${firms.length} firm link(s)`);
    for (const firm of firms) {
      all.push({
        plaza_id: plaza.id,
        plaza_name: plaza.canonical_name,
        company_name: firm.name,
        website: firm.href,
        address: plaza.address,
      });
    }
    if (i < targets.length - 1) await page.waitForTimeout(1500);
  }

  await browser.close();
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(OUT_JSON, JSON.stringify(all, null, 2), "utf8");
  console.log(`\nCached ${all.length} 2GIS firm rows → ${OUT_JSON}`);
  console.log("Re-run: python tools/collect_baku_plaza_tenants.py --merge-2gis");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
