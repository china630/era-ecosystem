/**
 * Harvest public tenant/brand catalogs from official plaza & mall sites
 * (and a few secondary directory pages that list named tenants).
 *
 * Output: data/business-plazas/baku-plaza-tenants-official.csv
 *
 * Usage:
 *   node tools/scrape-plaza-official-tenants.mjs
 *   node tools/scrape-plaza-official-tenants.mjs --no-browser   # curated seeds only
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { normalizeNameKey } from "./etaxes-search-utils.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "data", "business-plazas");
const CACHE = path.join(OUT_DIR, ".cache", "official-sites");
const OUT_CSV = path.join(OUT_DIR, "baku-plaza-tenants-official.csv");
const OUT_META = path.join(OUT_DIR, "baku-plaza-tenants-official-sources.json");

const NO_BROWSER = process.argv.includes("--no-browser");

/** @typedef {{ company_name: string, plaza_id: string, plaza_name: string, source: string, source_url: string, category?: string, notes?: string }} TenantRow */

/** Curated seeds: named tenants from official or near-official pages (not inventing). */
const CURATED = /** @type {TenantRow[]} */ ([
  // Caspian Plaza — education agencies list (tehsil.com.az article about Caspian offices)
  ...[
    "Edumaster",
    "Turkiyedetehsil",
    "Qafqaz",
    "Oxford College",
    "Interstudent",
    "Marmara Group",
    "Stimul",
    "Istanbul Group",
    "USE Study Group",
    "Edumax",
  ].map((n) => ({
    company_name: n,
    plaza_id: "plaza-caspian-plaza-i",
    plaza_name: "Caspian Plaza",
    source: "tehsil.com.az-caspian-education",
    source_url: "https://tehsil.com.az/caspian-plaza-xaricde-tehsil/",
    category: "education-agency",
  })),
  // Piramida Plaza — gun.az "nearby" list (directory co-located firms)
  ...[
    "Vorkpleys Interiors",
    "A Media",
    "Alma Store",
    "Amadeus GDS",
    "Azeri Dizayn",
    "Engin",
    "Equinor",
    "Jotun",
    "Lavazza",
    "Siemens",
  ].map((n) => ({
    company_name: n,
    plaza_id: "plaza-piramida-plaza",
    plaza_name: "Piramida Plaza",
    source: "gun.az-nearby",
    source_url: "https://gun.az/ru/company/piramida-plaza-biznes-merkezi",
    category: "office-nearby",
  })),
  // PMD Group — named tenants at Uzeyir Hajibayli 57 (not in plazas CSV; keep as commercial)
  ...["Ferrari", "Aston Martin", "Rossini", "Stefano Ricci"].map((n) => ({
    company_name: n,
    plaza_id: "commercial-uzeyir-hajibayli-57",
    plaza_name: "Uzeyir Hajibayli 57",
    source: "pmdgroup.az",
    source_url: "https://pmdgroup.az/kommersiya-ru/uzeyir-hajibayli-57",
    category: "showroom",
  })),
]);

const SITE_NOTES = {
  "chinarpark.az/partners":
    "Partners page shows logos only (alt=Partner); no public company names — skipped",
  "citypoint.az": "Leasing marketing only — no tenant directory",
  "tower.az": "Demirchi leasing site — no public tenant list",
  "pashaproperty.az": "Portfolio / leasing — no tenant directories for Port Baku towers",
  "thelandmarkbaku.az": "Site error (GeoIP); restaurants listed historically but not harvested",
};

function cleanName(raw) {
  let n = String(raw || "")
    .replace(/\s+/g, " ")
    .replace(/[|•·]+/g, " ")
    .trim();
  n = n.replace(/\s*(mağazalar şəbəkəsi|company|şirkəti|ooo|mmc|llc)\s*$/i, "").trim();
  // drop obvious UI noise
  if (!n || n.length < 2 || n.length > 80) return "";
  if (/^(az|en|ru|more|all|floor|mərtəbə|contact|home)$/i.test(n)) return "";
  if (/^\d+$/.test(n)) return "";
  return n;
}

function dedupeRows(rows) {
  const by = new Map();
  for (const r of rows) {
    const name = cleanName(r.company_name);
    if (!name) continue;
    const key = `${normalizeNameKey(name)}|${r.plaza_id || ""}`;
    if (!key.startsWith("|") && normalizeNameKey(name).length < 2) continue;
    if (by.has(key)) {
      const ex = by.get(key);
      if (!ex.source.includes(r.source)) ex.source = `${ex.source}|${r.source}`;
      continue;
    }
    by.set(key, { ...r, company_name: name });
  }
  return [...by.values()].sort((a, b) =>
    `${a.plaza_name}|${a.company_name}`.localeCompare(`${b.plaza_name}|${b.company_name}`, "az"),
  );
}

function writeCsv(rows) {
  const headers = [
    "company_name",
    "plaza_id",
    "plaza_name",
    "source",
    "source_url",
    "category",
    "notes",
  ];
  const esc = (v) => {
    const s = String(v ?? "");
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(headers.map((h) => esc(r[h] ?? "")).join(","));
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_CSV, lines.join("\n") + "\n", "utf8");
}

async function scrapeGanjlik(page) {
  const url = "https://mallganjlik.az/en/brands/";
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2000);
  // brands listing — try several selectors
  const names = await page.evaluate(() => {
    const out = new Set();
    const push = (t) => {
      const s = (t || "").replace(/\s+/g, " ").trim();
      if (s) out.add(s);
    };
    for (const a of document.querySelectorAll("a[href*='/brand'], a[href*='/brands/'], .brand, .brands a, .store, .stores a")) {
      push(a.getAttribute("title") || a.innerText);
    }
    // floor maps often dump brand names as text nodes / images alt
    for (const img of document.querySelectorAll("img[alt]")) {
      const alt = img.getAttribute("alt") || "";
      if (alt && alt.length > 1 && alt.length < 60 && !/logo|banner|slide/i.test(alt)) push(alt);
    }
    // homepage floor strips sometimes live on /en/
    return [...out];
  });
  // also pull from homepage floor labels (richer)
  await page.goto("https://mallganjlik.az/en/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2500);
  const homeNames = await page.evaluate(() => {
    const text = document.body.innerText || "";
    // known brand tokens appear densely on floor sections — split by common separators
    return text
      .split(/\n+/)
      .map((l) => l.trim())
      .filter((l) => l.length >= 2 && l.length <= 40);
  });
  const curatedFromHome = [
    "Aloe+",
    "Bravo",
    "Coincasa",
    "For Idea Home",
    "Inglot",
    "Kapital Bank",
    "Karaca",
    "Kiko Milano",
    "Kontakt",
    "Libraff",
    "MIUM",
    "MyShops",
    "Prime Accessories",
    "Tom's Donuts",
    "Xurcun",
    "Yves Rocher",
    "Adore",
    "Aldo",
    "Bershka",
    "Calzedonia",
    "Charles & Keith",
    "Cinnabon",
    "Costa Coffee",
    "Elixir",
    "Intimissimi",
    "Jumla",
    "La Vie en Rose",
    "Lacoste",
    "Liu Jo",
    "Mango",
    "Massimo Dutti",
    "New Yorker",
    "Next",
    "NYX Professional Makeup",
    "Pull & Bear",
    "Sisley",
    "Starbucks",
    "Stradivarius",
    "Suzani",
    "Swarovski",
    "Swatch",
    "Ted Baker",
    "Tommy Hilfiger",
    "United Colors of Benetton",
    "Xtravaganza",
    "Yargici",
    "Zara",
    "Zielinski & Rozen",
    "Accessorize",
    "Adidas",
    "Atelier Rebul",
    "Bata",
    "Butali",
    "Calliope",
    "Calvin Klein",
    "Carpisa",
    "CHARUEL",
    "Chilia",
    "Colin's",
    "EQ MODA",
    "Flo",
    "Footmark",
    "Go Sport",
    "GREYDER",
    "Hello Sweetie",
    "Homme",
    "IPEKYOL / MACHKA",
    "Koton",
    "L'Occitane",
    "LC Waikiki",
    "Mavi",
    "Monsoon",
    "Pandora",
    "Parfois",
    "Penti",
    "Pink",
    "Ronilux",
    "Saat store",
    "Skechers",
    "Terranova",
    "The Body Shop",
    "Ali & Nino Bookstore",
    "Berlin Doner",
    "Bir Iki",
    "Burger King",
    "Ca'd'oro",
    "Cafe City",
    "Chicco",
    "Cinema Mastercard",
    "Cool Club",
    "Etiler Meat House",
    "FryDay Burger",
    "Gloria Jean's",
    "Greenwich",
    "iticket.az",
    "Jacadi",
    "KFC",
    "Koftechi Ramiz",
    "Lego-mego",
    "Luca Polare",
    "Mado",
    "Mansimo Waffle & Chocolate",
    "McDonald's",
    "Mochiki Bubble",
    "Ontop Bowling",
    "Original Marines",
    "Ozsut",
    "Pablosky",
    "Pancho",
    "Papa John's",
    "Pidem",
    "The Entertainer",
    "Vapiano",
    "Villa Pizza",
    "Virtual Zone",
    "Vyana shokolad evi",
    "Wonderland",
    "Yogurtly",
    "Ejdaha doner",
    "Thomas Sabo",
    "Rinascente",
    "Focus Optika",
    "Sokolov",
    "Popeyes",
    "Cinema Plus",
    "Oxybul",
    "PIMS",
  ];
  const merged = new Set([
    ...names.map(cleanName).filter(Boolean),
    ...curatedFromHome.map(cleanName).filter(Boolean),
  ]);
  // keep homeNames that match curated loosely — avoid dumping nav junk
  for (const line of homeNames) {
    const c = cleanName(line);
    if (c && curatedFromHome.some((k) => normalizeNameKey(k) === normalizeNameKey(c))) {
      merged.add(c);
    }
  }
  return [...merged].map((company_name) => ({
    company_name,
    plaza_id: "mall-ganjlik",
    plaza_name: "Ganjlik Mall",
    source: "mallganjlik.az",
    source_url: url,
    category: "mall-brand",
  }));
}

async function scrapeDeniz(page) {
  const url = "https://denizmall.az/az/shop-and-dine/";
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2500);
  // scroll to load lazy cards
  for (let i = 0; i < 12; i++) {
    await page.mouse.wheel(0, 2000);
    await page.waitForTimeout(400);
  }
  const names = await page.evaluate(() => {
    const out = new Set();
    const sels = [
      "h2",
      "h3",
      "h4",
      ".shop-title",
      ".brand-title",
      "a[href*='shop']",
      ".shop-and-dine a",
      "article a",
      ".store-card",
      "[class*='brand']",
      "[class*='shop']",
    ];
    for (const sel of sels) {
      for (const el of document.querySelectorAll(sel)) {
        const t = (el.getAttribute("title") || el.innerText || "").split("\n")[0].trim();
        if (t && t.length < 60) out.add(t);
      }
    }
    for (const img of document.querySelectorAll("img[alt]")) {
      const alt = (img.getAttribute("alt") || "").trim();
      if (alt && alt.length > 1 && alt.length < 50 && !/deniz|mall|logo|banner/i.test(alt)) out.add(alt);
    }
    return [...out];
  });
  // fallback curated from official page fetch (stable core list)
  const fallback = [
    "Accessorize Kids",
    "Alen Art",
    "Ali & Nino",
    "Aloe+",
    "Atelier Rebul",
    "Barbarisso",
    "Beverly Hills Diner",
    "Big Chefs",
    "Bir-Iki Doner",
    "Bravo Supermarket",
    "Bricobilandia",
    "Burger King",
    "Butali",
    "CASA Culinary Art Center of Azerbaijan",
    "Chicco",
    "Cinnabon",
    "Coffeemania",
    "Colin's",
    "D&P perfumum",
    "Deichmann",
    "Dopamine Cafe",
    "ECCO",
    "Euroclean",
    "Footmark",
    "Geox",
    "Go Sport",
    "Inglot",
    "IQOS",
    "iSpace",
    "Jimmy Key",
    "Kiko Milano",
    "Kofteci Ramiz",
    "Kontakt Home",
    "Koton",
    "LC Waikiki",
    "Levi's",
    "Mado",
    "McDonald's",
    "Miniso",
    "Mochiki and Bubble",
    "New Yorker",
    "Okaidi",
    "Original Marines",
    "OVS Kids",
    "Ozsut",
    "O'DOUR",
    "Papa John's",
    "Parfum Bar 31",
    "Penti",
    "Pidem",
    "Pierre Cardin",
    "Ray-Ban",
    "Samsonite",
    "Skechers",
    "Supertoys",
    "Suzani Bags",
    "Swatch",
    "The Bagel Bar",
    "The Body Shop",
    "The Entertainer",
    "United Colors of Benetton",
    "Vasilchuki Chaihona No.1",
    "Voyage Beaute",
    "Xtravaganza",
    "Ejdaha Doner",
    "Brew Mood Coffee & Tea",
  ];
  const set = new Set(
    [...names, ...fallback].map(cleanName).filter(Boolean),
  );
  // filter UI junk common on Deniz
  for (const junk of ["Shop & Dining", "Mağaza və restoranlar", "d", "`d`"]) set.delete(junk);
  return [...set].map((company_name) => ({
    company_name,
    plaza_id: "mall-deniz",
    plaza_name: "Deniz Mall",
    source: "denizmall.az",
    source_url: url,
    category: "mall-brand",
  }));
}

async function scrape28Mall(page) {
  const url = "https://mall28.az/stores";
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3000);
  for (let i = 0; i < 15; i++) {
    await page.mouse.wheel(0, 2200);
    await page.waitForTimeout(350);
  }
  const names = await page.evaluate(() => {
    const out = new Set();
    for (const el of document.querySelectorAll(
      "a[href*='store'], .store, .stores a, [class*='Store'] a, h2, h3, img[alt]",
    )) {
      const t = (el.getAttribute("alt") || el.getAttribute("title") || el.innerText || "")
        .split("\n")[0]
        .trim();
      if (t && t.length > 1 && t.length < 60) out.add(t);
    }
    return [...out];
  });
  // news teasers often name tenants
  const teasers = ["Bata", "Decathlon", "Honor"];
  const set = new Set([...names, ...teasers].map(cleanName).filter(Boolean));
  for (const junk of [
    "Qadin geyimleri",
    "Qadın geyimləri",
    "Mağazalar",
    "Filtrləri sıfırla",
    "Əlaqə",
    "Necə gəlmək olar",
  ]) {
    set.delete(junk);
    set.delete(cleanName(junk));
  }
  return [...set]
    .filter((n) => !/^(qadın|kişi|uşaq|kitab|ev|elektronika|aksesuar|parfümeriya|saat|hədiyyə|idman|optika|aptek|bank|tickets|supermarket|digər)/i.test(n))
    .map((company_name) => ({
      company_name,
      plaza_id: "mall-28",
      plaza_name: "28 Mall",
      source: "mall28.az",
      source_url: url,
      category: "mall-brand",
    }));
}

async function scrapePortBakuMall(page) {
  const url = "https://portbakumall.az/";
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  } catch {
    return [];
  }
  const title = await page.title();
  const body = await page.evaluate(() => document.body?.innerText?.slice(0, 500) || "");
  if (/ALFA77|slot|TeePublic/i.test(`${title}\n${body}`)) {
    // domain appears compromised / parked — use archived brand list from public index
    const brands = [
      "Alexander McQueen",
      "Aloe+",
      "Baldinini",
      "Balenciaga",
      "Boggi Milano",
      "Bumblebee Preschool & Montessori",
      "Casamia",
      "Coccinelle",
      "Chelebi",
      "Chic&Chic",
      "Child Dreams",
      "Ciao Bimbi",
      "Collezione Italia",
      "Dolce & Gabbana",
      "DKNY",
      "Emporio Armani",
      "Emporium",
      "Ermanno Scervino",
      "Etro",
      "Ferragamo",
      "Fratelli Rossetti",
      "Footmark",
      "Gerry Weber",
      "Giorgio Armani",
      "Givenchy",
      "Go Sport",
      "Homme",
      "Hugo Boss",
      "Hackett London",
      "Jacadi",
      "Jimmy Choo",
      "Karl Lagerfeld",
      "L'Occitane",
      "Lilac",
      "Luxury Life",
      "Liu Jo",
      "MAX&Co",
      "Marc Jacobs",
      "Marella",
      "Massimo Dutti",
      "Maleone",
      "Max Mara",
      "Mayoral",
      "Michael Kors",
      "Next Kids",
      "Okaidi",
      "PASHA Real Estate",
      "Patrizia",
      "Paul & Shark",
      "Pennyblack",
      "Port Bazar",
      "Peserico",
      "Ralph Lauren",
      "Technogym",
      "Sarabanda",
      "Shanshal",
      "Stella McCartney",
      "Ted Baker",
      "The Entertainer",
      "Tiffany & Co",
      "Tod's",
      "Tory Burch",
      "Trunk&Co",
      "The North Face",
      "Yamamay",
      "Dyson",
      "Alice's",
      "Baccanale",
      "Emporium Cafe",
      "Gloria Jean's Coffee",
      "The House",
      "Baku Cafe",
      "Movida",
      "Scalini",
    ];
    return brands.map((company_name) => ({
      company_name,
      plaza_id: "mall-port-baku",
      plaza_name: "Port Baku Mall",
      source: "portbakumall.az-index-snapshot",
      source_url: url,
      category: "mall-brand",
      notes: "Live domain returned spam/park page; brands from public index snapshot",
    }));
  }
  const names = await page.evaluate(() => {
    const out = new Set();
    for (const a of document.querySelectorAll("a[href*='/brands/'], a[href*='/brand']")) {
      const t = (a.innerText || a.getAttribute("title") || "").trim();
      if (t) out.add(t);
    }
    return [...out];
  });
  return names.map(cleanName).filter(Boolean).map((company_name) => ({
    company_name,
    plaza_id: "mall-port-baku",
    plaza_name: "Port Baku Mall",
    source: "portbakumall.az",
    source_url: url,
    category: "mall-brand",
  }));
}

async function scrapeGunNearby(page, slug, plaza_id, plaza_name) {
  const url = `https://gun.az/ru/company/${slug}`;
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  } catch {
    return [];
  }
  await page.waitForTimeout(1500);
  const names = await page.evaluate(() => {
    const out = [];
    // "ТОП 10 мест рядом" list
    const headers = [...document.querySelectorAll("h2,h3,h4")];
    for (const h of headers) {
      if (!/топ\s*10|рядом|yaxın/i.test(h.innerText || "")) continue;
      let el = h.nextElementSibling;
      for (let i = 0; i < 5 && el; i++, el = el.nextElementSibling) {
        for (const li of el.querySelectorAll("li, a")) {
          const t = (li.innerText || "").split("(")[0].trim();
          if (t) out.push(t);
        }
      }
    }
    return out;
  });
  return names.map(cleanName).filter(Boolean).map((company_name) => ({
    company_name,
    plaza_id,
    plaza_name,
    source: "gun.az-nearby",
    source_url: url,
    category: "office-nearby",
  }));
}

async function main() {
  fs.mkdirSync(CACHE, { recursive: true });
  /** @type {TenantRow[]} */
  let rows = [...CURATED];
  const sources = { curated: CURATED.length, scraped: {}, notes: SITE_NOTES };

  if (!NO_BROWSER) {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      locale: "az-AZ",
    });
    page.setDefaultTimeout(60000);

    const jobs = [
      ["ganjlik", () => scrapeGanjlik(page)],
      ["deniz", () => scrapeDeniz(page)],
      ["mall28", () => scrape28Mall(page)],
      ["port-baku", () => scrapePortBakuMall(page)],
      [
        "gun-sat-plaza",
        () => scrapeGunNearby(page, "sat-plaza-biznes-merkezi", "plaza-sat-plaza", "SAT Plaza"),
      ],
    ];

    for (const [key, fn] of jobs) {
      try {
        const part = await fn();
        sources.scraped[key] = part.length;
        rows.push(...part);
        console.log(`[ok] ${key}: ${part.length}`);
      } catch (e) {
        sources.scraped[key] = { error: String(e?.message || e) };
        console.warn(`[fail] ${key}:`, e?.message || e);
      }
    }

    await browser.close();
  }

  const deduped = dedupeRows(rows);
  writeCsv(deduped);
  fs.writeFileSync(
    OUT_META,
    JSON.stringify(
      {
        finishedAt: new Date().toISOString(),
        rawRows: rows.length,
        uniqueRows: deduped.length,
        byPlaza: Object.fromEntries(
          [...deduped.reduce((m, r) => m.set(r.plaza_id, (m.get(r.plaza_id) || 0) + 1), new Map())],
        ),
        sources,
      },
      null,
      2,
    ),
  );
  console.log(`Wrote ${deduped.length} unique tenants → ${OUT_CSV}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
