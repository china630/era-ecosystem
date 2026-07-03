/**
 * Retry e-taxes lookup for rows with match_status=no_tax_match using alternate
 * search tokens (deriveSearchQueries). Updates azerbaijan-legal-entities.csv in place.
 *
 * Usage:
 *   node tools/retry-etaxes-no-match.mjs
 *   node tools/retry-etaxes-no-match.mjs --limit 50
 *   node tools/retry-etaxes-no-match.mjs --dry-run
 */

import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { deriveSearchQueries, donorMatchesTaxpayer } from "./etaxes-search-utils.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "data", "legal-entities");
const CACHE_DIR = path.join(OUT_DIR, ".cache", "etaxes-search");
const OUT_CSV = path.join(OUT_DIR, "azerbaijan-legal-entities.csv");

const ETAXES_PAGE = "https://new.e-taxes.gov.az/etaxes/services/legal-entity-info";
const FIND_URL =
  "https://new.e-taxes.gov.az/api/po/authless/public/v1/authless/findTaxpayer";

const args = process.argv.slice(2);
const limitIdx = args.indexOf("--limit");
const LIMIT = limitIdx >= 0 ? Number(args[limitIdx + 1]) : 0;
const sectorIdx = args.indexOf("--sector");
const SECTOR_FILTER = sectorIdx >= 0 ? args[sectorIdx + 1] : "";
const donorIdx = args.indexOf("--donor-id");
const DONOR_ID_FILTER = donorIdx >= 0 ? args[donorIdx + 1] : "";
const DRY_RUN = args.includes("--dry-run");
const HEADFUL = args.includes("--headful");
const MIN_DELAY_MS = Number(process.env.ETAXES_DELAY_MS ?? 2500);
const MAX_DELAY_MS = Number(process.env.ETAXES_MAX_DELAY_MS ?? 4500);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const randDelay = () =>
  sleep(MIN_DELAY_MS + Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS)));

function parseCsv(text) {
  const rows = [];
  let i = 0;
  const len = text.length;
  const readField = () => {
    let field = "";
    if (text[i] === '"') {
      i++;
      while (i < len) {
        if (text[i] === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i += 2;
          } else {
            i++;
            break;
          }
        } else {
          field += text[i++];
        }
      }
      if (text[i] === ",") i++;
      return field;
    }
    while (i < len && text[i] !== "," && text[i] !== "\n" && text[i] !== "\r") {
      field += text[i++];
    }
    if (text[i] === ",") i++;
    return field;
  };
  const headers = [];
  while (i < len && text[i] !== "\n" && text[i] !== "\r") {
    headers.push(readField());
  }
  while (text[i] === "\n" || text[i] === "\r") i++;
  while (i < len) {
    const row = {};
    for (let h = 0; h < headers.length; h++) {
      row[headers[h]] = i < len ? readField() : "";
    }
    rows.push(row);
    while (i < len && (text[i] === "\n" || text[i] === "\r")) i++;
  }
  return { headers, rows };
}

function csvEscape(v) {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function pickLocale(obj, key = "az") {
  if (!obj || typeof obj !== "object") return "";
  const v = obj[key] ?? obj.az ?? obj.ru ?? obj.en;
  return typeof v === "string" ? v : "";
}

function flattenTaxpayer(tp, searchQuery) {
  const lts = tp.legalTaxpayerStatus ?? {};
  const lf = lts.legalForm?.name ?? {};
  const ts = lts.taxpayerStatus?.name ?? {};
  const ta = tp.taxAuthority?.name ?? lts.taxAuthority?.name ?? {};
  return {
    search_query: searchQuery,
    tax_name: tp.name ?? "",
    voen: tp.tin ?? "",
    tax_type: tp.type ?? "",
    tax_debt: tp.debt ?? "",
    tax_active: tp.active ?? "",
    tax_vat_payer: tp.vatPayer ?? "",
    tax_risky_payer: tp.riskyPayer ?? "",
    tax_sanctions: Array.isArray(tp.sanctions) ? tp.sanctions.join(" | ") : "",
    tax_organization_name: tp.taxOrganizationName ?? "",
    tax_organization_type: tp.organizationType ?? "",
    tax_amount_azn: tp.amountAzn ?? "",
    tax_foreign_amount: tp.foreignAmount ?? "",
    tax_foreign_currency: tp.foreignCurrency ?? "",
    tax_legal_address: lts.legalAddress ?? "",
    tax_legitimate: lts.legitimate ?? "",
    tax_legal_form_code: lts.legalForm?.code ?? "",
    tax_legal_form: pickLocale(lf),
    tax_charter_capital: lts.charterCapital ?? "",
    tax_financial_year_start: lts.financialYearStart ?? "",
    tax_financial_year_end: lts.financialYearEnd ?? "",
    tax_voen_registered_at: lts.voenRegisteredAt ?? "",
    tax_state_registered_at: lts.stateRegisteredAt ?? "",
    tax_extract_date: lts.extractDate ?? "",
    tax_status_code: lts.taxpayerStatus?.code ?? "",
    tax_status: pickLocale(ts),
    tax_authority_code: tp.taxAuthority?.code ?? lts.taxAuthority?.code ?? "",
    tax_authority: pickLocale(ta),
    tax_legal_debt: lts.debt ?? "",
    tax_tasks_obligations: lts.tasksAndObligations ?? "",
    tax_raw_json: JSON.stringify(tp),
    match_status: "tax_matched",
    donor_sectors: "",
    donor_ids: "",
    donor_search_names: "",
    donor_names: "",
    donor_legal_names: "",
    donor_cities: "",
    donor_addresses: "",
    donor_phones: "",
    donor_emails: "",
    donor_websites: "",
    donor_voens: "",
    donor_categories: "",
    donor_extra_json: "",
  };
}

function mergeDonorFields(target, donorRow) {
  const append = (key, val) => {
    if (!val) return;
    const cur = target[key];
    if (!cur) target[key] = val;
    else if (!cur.split(" | ").includes(val)) target[key] = `${cur} | ${val}`;
  };
  for (const key of [
    "donor_sectors",
    "donor_ids",
    "donor_search_names",
    "donor_names",
    "donor_legal_names",
    "donor_cities",
    "donor_addresses",
    "donor_phones",
    "donor_emails",
    "donor_websites",
    "donor_voens",
    "donor_categories",
    "donor_extra_json",
  ]) {
    append(key, donorRow[key]);
  }
}

async function ensureSession(page) {
  await page.goto(ETAXES_PAGE, { waitUntil: "networkidle", timeout: 90_000 });
  await page.waitForTimeout(1500);
}

async function searchLegalEntities(page, query) {
  const cacheFile = path.join(
    CACHE_DIR,
    `name_${query.toLowerCase().replace(/[^a-z0-9ƏəİıÖöÜüÇçŞşĞğ_-]/gi, "_")}.json`,
  );
  if (fs.existsSync(cacheFile)) {
    return JSON.parse(fs.readFileSync(cacheFile, "utf8"));
  }

  const result = await page.evaluate(
    async ({ url, name }) => {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          name,
          type: "legalEntity",
          serviceCode: "checkLegalName",
          isStateRegistry: true,
        }),
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
    { url: FIND_URL, name: query },
  );

  const taxpayers = result.status === 200 ? (result.json?.taxpayers ?? []) : [];
  const payload = { query, taxpayers, error: result.status !== 200 ? `HTTP ${result.status}` : "" };
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(cacheFile, JSON.stringify(payload, null, 2), "utf8");
  return payload;
}

function altQueriesForRow(row) {
  const tried = new Set(
    String(row.search_query || "")
      .split("|")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
  const names = [
    row.donor_search_names,
    row.donor_names,
    row.donor_legal_names,
  ]
    .flatMap((s) => String(s || "").split(" | "))
    .map((s) => s.trim())
    .filter(Boolean);

  const out = [];
  const seen = new Set();
  for (const name of names) {
    for (const q of deriveSearchQueries(name)) {
      const k = q.toLowerCase();
      if (tried.has(k) || seen.has(k)) continue;
      seen.add(k);
      out.push(q);
    }
  }
  return out;
}

async function main() {
  const { headers, rows } = parseCsv(fs.readFileSync(OUT_CSV, "utf8"));
  let unmatched = rows.filter((r) => r.match_status === "no_tax_match");
  if (SECTOR_FILTER) {
    unmatched = unmatched.filter((r) =>
      String(r.donor_sectors || "").split(" | ").includes(SECTOR_FILTER),
    );
    console.log(`sector filter "${SECTOR_FILTER}": ${unmatched.length} rows`);
  }
  if (DONOR_ID_FILTER) {
    unmatched = unmatched.filter((r) =>
      String(r.donor_ids || "").split(" | ").includes(DONOR_ID_FILTER),
    );
    console.log(`donor filter "${DONOR_ID_FILTER}": ${unmatched.length} rows`);
  }
  console.log(`no_tax_match rows: ${unmatched.length}`);
  if (LIMIT > 0) unmatched = unmatched.slice(0, LIMIT);

  const byVoen = new Map();
  for (const row of rows) {
    if (row.voen && row.match_status === "tax_matched") {
      byVoen.set(row.voen, row);
    }
  }

  const browser = await chromium.launch({
    headless: !HEADFUL,
    args: ["--disable-blink-features=AutomationControlled"],
  });
  const page = await browser.newPage({
    locale: "az-AZ",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  });
  await ensureSession(page);

  let resolved = 0;
  let stillUnmatched = 0;
  const toRemove = new Set();

  for (let i = 0; i < unmatched.length; i++) {
    const row = unmatched[i];
    const alts = altQueriesForRow(row);
    const label = (row.donor_names || row.donor_search_names || "").slice(0, 50);
    process.stdout.write(`[${i + 1}/${unmatched.length}] ${label} (${alts.length} alts) ... `);

    if (!alts.length) {
      console.log("skip (no new queries)");
      stillUnmatched++;
      continue;
    }

    let linked = false;
    for (const q of alts) {
      if (DRY_RUN) {
        console.log(`dry-run would try: ${q}`);
        linked = true;
        break;
      }
      try {
        const { taxpayers } = await searchLegalEntities(page, q);
        const donorName = row.donor_search_names || row.donor_names || "";
        const donorLegal = row.donor_legal_names || donorName;
        for (const tp of taxpayers) {
          if (!donorMatchesTaxpayer(donorName, donorLegal, tp.name)) continue;
          const voen = tp.tin;
          if (!voen) continue;
          let target = byVoen.get(voen);
          if (!target) {
            target = flattenTaxpayer(tp, q);
            byVoen.set(voen, target);
            rows.push(target);
          } else {
            if (!target.search_query.includes(q)) {
              target.search_query = target.search_query
                ? `${target.search_query} | ${q}`
                : q;
            }
          }
          mergeDonorFields(target, row);
          target.match_status = "tax_matched";
          toRemove.add(row);
          linked = true;
          resolved++;
          console.log(`OK voen=${voen} via "${q}"`);
          break;
        }
      } catch (e) {
        console.log(`ERR ${e.message}`);
      }
      if (linked) break;
      await randDelay();
    }

    if (!linked) {
      console.log("still unmatched");
      stillUnmatched++;
    }
  }

  await browser.close();

  if (!DRY_RUN) {
    const finalRows = rows.filter((r) => !toRemove.has(r));
    for (const row of finalRows) {
      if (!row.match_status) row.match_status = row.voen ? "tax_matched" : "donor_only";
    }
    finalRows.sort((a, b) =>
      (a.tax_name || a.donor_names || "").localeCompare(b.tax_name || b.donor_names || "", "az"),
    );
    const csv = [
      headers.join(","),
      ...finalRows.map((r) => headers.map((h) => csvEscape(r[h])).join(",")),
    ].join("\n");
    fs.writeFileSync(OUT_CSV, csv, "utf8");
  }

  console.log(`\nResolved: ${resolved}, still unmatched in batch: ${stillUnmatched}`);
  if (!DRY_RUN && resolved) {
    console.log(`Updated ${OUT_CSV}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
