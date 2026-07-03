/**
 * Scrape travel agencies from https://trippost.az/explore/?type=turizm-sirketleri
 * via MyListing AJAX API (Playwright session for nonce + cookies).
 *
 * Output: data/travel-agencies/azerbaijan-trippost-travel.csv
 */

import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "data", "travel-agencies");
const OUT_CSV = path.join(OUT_DIR, "azerbaijan-trippost-travel.csv");
const EXPLORE_URL = "https://trippost.az/explore/?type=turizm-sirketleri";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function csvEscape(v) {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function parseListingsFromHtml(html) {
  const items = [];
  const blocks = html.match(
    /<div class="lf-item-container listing-preview type-turizm-sirketleri[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi,
  );
  if (!blocks) return items;

  for (const block of blocks) {
    const slugM = block.match(/href="https:\/\/trippost\.az\/turizm-sirketleri\/([^"/]+)\//i);
    if (!slugM) continue;
    const slug = slugM[1];
    const profileUrl = `https://trippost.az/turizm-sirketleri/${slug}/`;

    let name = "";
    const titleM = block.match(/class="case27-primary-text[^"]*"[^>]*>([^<]+)</i);
    if (titleM) name = titleM[1].trim();
    if (!name) {
      const altM = block.match(/title="([^"]+)"/i);
      name = altM ? altM[1].trim() : slug.replace(/-/g, " ");
    }
    name = name.replace(/^\d+\.\s*/, "").replace(/&amp;/g, "&").trim();

    const phoneM = block.match(/tel:([^"']+)/i) || block.match(/\((0\d{2})\)\s*([\d\s-]+)/);
    const phone = phoneM
      ? phoneM[0].startsWith("tel:")
        ? phoneM[1]
        : `(${phoneM[1]}) ${phoneM[2]}`.replace(/\s+/g, " ").trim()
      : "";

    const taglineM = block.match(/class="[^"]*listing-tagline[^"]*"[^>]*>([^<]+)</i);
    const tagline = taglineM ? taglineM[1].trim() : "";

    items.push({ name, slug, profile_url: profileUrl, phone, tagline });
  }
  return items;
}

async function captureApiTemplate(page) {
  let apiUrl = "";
  page.on("response", (res) => {
    const u = res.url();
    if (u.includes("mylisting-ajax=1") && u.includes("action=get_listings") && !apiUrl) {
      apiUrl = u;
    }
  });
  await page.goto(EXPLORE_URL, { waitUntil: "networkidle", timeout: 90_000 });
  await sleep(2500);
  if (!apiUrl) throw new Error("Could not capture trippost get_listings API URL");
  return apiUrl;
}

function pageUrlFromTemplate(template, pageNum) {
  const u = new URL(template);
  u.searchParams.set("form_data[page]", String(pageNum));
  return u.toString();
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    locale: "az-AZ",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  const apiTemplate = await captureApiTemplate(page);
  const bySlug = new Map();
  let pageNum = 0;
  let foundTotal = null;

  while (true) {
    const url = pageUrlFromTemplate(apiTemplate, pageNum);
    const json = await page.evaluate(async (fetchUrl) => {
      const res = await fetch(fetchUrl);
      return res.json();
    }, url);

    const html = json.html ?? "";
    const batch = parseListingsFromHtml(html);
    if (foundTotal == null && json.found != null) foundTotal = Number(json.found);

    let added = 0;
    for (const item of batch) {
      if (!bySlug.has(item.slug)) {
        bySlug.set(item.slug, item);
        added++;
      }
    }
    console.log(`page=${pageNum}: ${batch.length} cards, +${added} new, total ${bySlug.size}`);

    if (!batch.length || (foundTotal != null && bySlug.size >= foundTotal)) break;
    pageNum++;
    await sleep(600);
  }

  await browser.close();

  const sorted = [...bySlug.values()].sort((a, b) => a.name.localeCompare(b.name, "az"));
  const header = [
    "id",
    "name",
    "phone",
    "profile_url",
    "slug",
    "tagline",
    "source",
    "source_url",
  ];
  const lines = [
    header.join(","),
    ...sorted.map((r, i) =>
      [
        `trippost-${String(i + 1).padStart(4, "0")}`,
        csvEscape(r.name),
        csvEscape(r.phone),
        csvEscape(r.profile_url),
        csvEscape(r.slug),
        csvEscape(r.tagline),
        "trippost.az",
        csvEscape(EXPLORE_URL),
      ].join(","),
    ),
  ];
  fs.writeFileSync(OUT_CSV, lines.join("\n"), "utf8");
  console.log(`Wrote ${sorted.length} companies -> ${OUT_CSV}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
