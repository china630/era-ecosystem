/**
 * Enrich all donor datasets with e-taxes legal-entity registry data.
 *
 * Usage:
 *   node tools/enrich-etaxes-legal-entities.mjs --force
 *   node tools/enrich-etaxes-legal-entities.mjs --limit 20
 *   node tools/enrich-etaxes-legal-entities.mjs --count-queries
 *
 * Output: data/legal-entities/azerbaijan-legal-entities.csv
 */

import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import {
  deriveSearchQueries,
  donorMatchesTaxpayer,
  normalizeNameKey,
  cacheFileSlug,
  toEtaxesSearchQuery,
} from "./etaxes-search-utils.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const DATA = path.join(ROOT, "data");
const OUT_DIR = path.join(DATA, "legal-entities");
const CACHE_DIR = path.join(OUT_DIR, ".cache", "etaxes-search");
const OUT_CSV = path.join(OUT_DIR, "azerbaijan-legal-entities.csv");
const COMPLETE_MARKER = path.join(OUT_DIR, ".enrich-complete.json");
const LOCK_FILE = path.join(OUT_DIR, ".enrich-running.lock");

const ETAXES_PAGE =
  "https://new.e-taxes.gov.az/etaxes/services/legal-entity-info";
const FIND_URL =
  "https://new.e-taxes.gov.az/api/po/authless/public/v1/authless/findTaxpayer";

const args = process.argv.slice(2);
const limitIdx = args.indexOf("--limit");
const LIMIT = limitIdx >= 0 ? Number(args[limitIdx + 1]) : 0;
const HEADFUL = args.includes("--headful");
const COUNT_ONLY = args.includes("--count-queries");
const FORCE = args.includes("--force");
const MIN_DELAY_MS = Number(process.env.ETAXES_DELAY_MS ?? 2500);
const MAX_DELAY_MS = Number(process.env.ETAXES_MAX_DELAY_MS ?? 4500);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const randDelay = () =>
  sleep(MIN_DELAY_MS + Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS)));

function acquireLock() {
  if (fs.existsSync(LOCK_FILE)) {
    try {
      const lock = JSON.parse(fs.readFileSync(LOCK_FILE, "utf8"));
      const ageMs = Date.now() - new Date(lock.startedAt).getTime();
      if (ageMs < 4 * 60 * 60 * 1000) {
        console.log(`Another enrich run active (pid ${lock.pid}, ${Math.round(ageMs / 60000)}m ago). Exit.`);
        process.exit(0);
      }
    } catch {
      /* stale lock */
    }
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(
    LOCK_FILE,
    JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }),
    "utf8",
  );
}

function releaseLock() {
  try {
    fs.unlinkSync(LOCK_FILE);
  } catch {
    /* ignore */
  }
}

// --- CSV parsing (minimal, handles quoted fields) ---
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
  return rows;
}

function readCsv(relPath) {
  const p = path.join(DATA, relPath);
  return parseCsv(fs.readFileSync(p, "utf8"));
}

function normalizeVoen(v) {
  const d = String(v ?? "").replace(/\D/g, "");
  return d.length === 10 ? d : "";
}

function appendPipe(cur, val) {
  if (!val) return cur || "";
  if (!cur) return String(val);
  const parts = cur.split(" | ");
  return parts.includes(val) ? cur : `${cur} | ${val}`;
}

function makeDonor(base) {
  const name = base.donor_search_name || base.donor_name || "";
  const queries = [];
  const seen = new Set();
  for (const raw of [name, base.donor_legal_name, base.donor_name].filter(Boolean)) {
    for (const q of deriveSearchQueries(raw)) {
      const k = q.toLowerCase();
      if (!seen.has(k)) {
        seen.add(k);
        queries.push(q);
      }
    }
  }
  return {
    ...base,
    donor_search_queries: queries,
    donor_search_query: queries[0] || "",
  };
}

/** One donor row per normalized company name; sectors/ids merged. */
function dedupeDonors(rawDonors) {
  const byKey = new Map();
  for (const d of rawDonors) {
    const key = normalizeNameKey(d.donor_search_name || d.donor_legal_name || d.donor_name);
    if (!key || key.length < 3) continue;
    if (!byKey.has(key)) {
      byKey.set(key, makeDonor({ ...d, donor_norm_key: key }));
      continue;
    }
    const ex = byKey.get(key);
    ex.donor_id = appendPipe(ex.donor_id, d.donor_id);
    ex.donor_sector = appendPipe(ex.donor_sector, d.donor_sector);
    ex.donor_search_name = appendPipe(ex.donor_search_name, d.donor_search_name);
    ex.donor_name = appendPipe(ex.donor_name, d.donor_name);
    ex.donor_legal_name = appendPipe(ex.donor_legal_name, d.donor_legal_name);
    ex.donor_city = appendPipe(ex.donor_city, d.donor_city);
    ex.donor_address = appendPipe(ex.donor_address, d.donor_address);
    ex.donor_phone = appendPipe(ex.donor_phone, d.donor_phone);
    ex.donor_email = appendPipe(ex.donor_email, d.donor_email);
    ex.donor_website = appendPipe(ex.donor_website, d.donor_website);
    ex.donor_voen = appendPipe(ex.donor_voen, d.donor_voen);
    ex.donor_category = appendPipe(ex.donor_category, d.donor_category);
    const merged = ex.donor_extra?.merged_records ?? [ex.donor_extra];
    merged.push(d.donor_extra);
    ex.donor_extra = { merged_records: merged };
    const refreshed = makeDonor(ex);
    refreshed.donor_extra = ex.donor_extra;
    byKey.set(key, refreshed);
  }
  return [...byKey.values()];
}

function safeReadCsv(relPath) {
  const p = path.join(DATA, relPath);
  if (!fs.existsSync(p)) return [];
  return readCsv(relPath);
}

// --- Load donors (all sectors) ---
function loadDonorsRaw() {
  const donors = [];
  let id = 0;

  for (const row of safeReadCsv("hotels/azerbaijan-hotels.csv")) {
    const name = row.brand_name || row.legal_name || "";
    if (!name) continue;
    donors.push({
      donor_id: row.id || `hotel-${++id}`,
      donor_sector: "hotels",
      donor_search_name: name,
      donor_name: row.brand_name || "",
      donor_legal_name: row.legal_name || "",
      donor_city: row.city || "",
      donor_address: row.address || "",
      donor_phone: row.phone || "",
      donor_email: row.email || "",
      donor_website: row.website || "",
      donor_voen: normalizeVoen(row.voen),
      donor_category: row.subcategory || "",
      donor_extra: {
        stars_grade: row.stars_grade,
        tims_status: row.tims_status,
        pms_detected: row.pms_detected,
        sources: row.sources,
      },
    });
  }

  for (const row of safeReadCsv("accountants/azerbaijan-auditors.csv")) {
    const name = row.name || "";
    if (!name) continue;
    donors.push({
      donor_id: row.id || `audit-${++id}`,
      donor_sector: "accountants",
      donor_search_name: name,
      donor_name: name,
      donor_legal_name: name,
      donor_city: row.city || "",
      donor_address: row.address || "",
      donor_phone: row.phones || "",
      donor_email: row.email || "",
      donor_website: row.website || "",
      donor_voen: "",
      donor_category: row.type || "",
      donor_extra: {
        director: row.director,
        at_license: row.at_license,
        sa_license: row.sa_license,
        auditors: row.auditors,
        segment: row.segment,
      },
    });
  }

  for (const row of safeReadCsv("legal/azerbaijan-law-firms.csv")) {
    const name = row.name || "";
    if (!name) continue;
    donors.push({
      donor_id: row.id || `law-${++id}`,
      donor_sector: "legal",
      donor_search_name: name,
      donor_name: name,
      donor_legal_name: name,
      donor_city: row.city || "",
      donor_address: row.address || "",
      donor_phone: row.phones || "",
      donor_email: row.email || "",
      donor_website: "",
      donor_voen: "",
      donor_category: row.firm_type || "law_firm",
      donor_extra: {
        director: row.director,
        community_id: row.community_id,
        lawyers_search_url: row.lawyers_search_url,
        has_cabinets: row.has_cabinets,
        source: row.source,
      },
    });
  }

  for (const row of safeReadCsv("legal/azerbaijan-consulting-firms.csv")) {
    const name = row.name || "";
    if (!name) continue;
    donors.push({
      donor_id: row.id || `consult-${++id}`,
      donor_sector: "legal",
      donor_search_name: name,
      donor_name: name,
      donor_legal_name: name,
      donor_city: row.city || "",
      donor_address: row.address || "",
      donor_phone: row.phones || "",
      donor_email: row.email || "",
      donor_website: row.website || "",
      donor_voen: normalizeVoen(row.voen),
      donor_category: row.firm_type || "consulting_firm",
      donor_extra: {
        director: row.director,
        source: row.source,
      },
    });
  }

  for (const row of safeReadCsv("legal/azerbaijan-customs-brokers.csv")) {
    const name = row.name || "";
    if (!name) continue;
    donors.push({
      donor_id: row.id || `customs-${++id}`,
      donor_sector: "legal",
      donor_search_name: name,
      donor_name: name,
      donor_legal_name: name,
      donor_city: row.city || "",
      donor_address: row.address || "",
      donor_phone: row.phones || "",
      donor_email: row.email || "",
      donor_website: "",
      donor_voen: "",
      donor_category: row.firm_type || "customs_broker",
      donor_extra: {
        registry_number: row.registry_number,
        source: row.source,
        source_url: row.source_url,
      },
    });
  }

  for (const row of safeReadCsv("medical-institutions/azerbaijan-medical-institutions.csv")) {
    const name = row.name || "";
    if (!name) continue;
    donors.push({
      donor_id: row.id || `med-${++id}`,
      donor_sector: "medical-institutions",
      donor_search_name: name,
      donor_name: name,
      donor_legal_name: name,
      donor_city: row.city || "",
      donor_address: row.address || "",
      donor_phone: row.phones || "",
      donor_email: "",
      donor_website: "",
      donor_voen: "",
      donor_category: `${row.type || ""} / ${row.segment || ""}`.trim(),
      donor_extra: {
        discount: row.discount,
        has_contact: row.has_contact,
        sub_facility_count: row.sub_facility_count,
        sources: row.sources,
      },
    });
  }

  for (const row of safeReadCsv("construction-companies/azerbaijan-construction-shops.csv")) {
    const name = row.name || "";
    if (!name) continue;
    donors.push({
      donor_id: row.id || `constr-${++id}`,
      donor_sector: "construction-companies",
      donor_search_name: name,
      donor_name: name,
      donor_legal_name: name,
      donor_city: "Bakı",
      donor_address: "",
      donor_phone: row.phone || "",
      donor_email: "",
      donor_website: row.profile_url || "",
      donor_voen: "",
      donor_category: "insaat.az",
      donor_extra: {
        profile_url: row.profile_url,
        listings_count: row.listings_count,
        description_snippet: row.description_snippet,
        source: row.source,
      },
    });
  }

  for (const row of safeReadCsv("exhibitions/azerbaijan-exhibition-exhibitors.csv")) {
    const name = row.company_name || "";
    if (!name) continue;
    donors.push({
      donor_id: row.id || `expo-${++id}`,
      donor_sector: "exhibitions",
      donor_search_name: name,
      donor_name: name,
      donor_legal_name: name,
      donor_city: "Bakı",
      donor_address: "",
      donor_phone: "",
      donor_email: "",
      donor_website: "",
      donor_voen: "",
      donor_category: row.categories || "",
      donor_extra: {
        exhibitions: row.exhibitions,
        years: row.years,
        stands: row.stands,
        appearance_count: row.appearance_count,
        extra_json: row.extra_json,
      },
    });
  }

  for (const row of safeReadCsv("travel-agencies/azerbaijan-travel-agencies.csv")) {
    const name = row.company_name || "";
    if (!name) continue;
    donors.push({
      donor_id: row.id || `travel-${++id}`,
      donor_sector: "travel-agencies",
      donor_search_name: name,
      donor_name: name,
      donor_legal_name: name,
      donor_city: row.city || "Bakı",
      donor_address: "",
      donor_phone: row.phone || "",
      donor_email: row.email || "",
      donor_website: "",
      donor_voen: "",
      donor_category: row.source || "",
      donor_extra: { source_id: row.source_id, extra_json: row.extra_json },
    });
  }

  for (const row of safeReadCsv("telecommunications/azerbaijan-telecom-operators.csv")) {
    const name = row.name || "";
    if (!name) continue;
    donors.push({
      donor_id: row.id || `telecom-${++id}`,
      donor_sector: "telecommunications",
      donor_search_name: name,
      donor_name: name,
      donor_legal_name: name,
      donor_city: "Bakı",
      donor_address: "",
      donor_phone: "",
      donor_email: "",
      donor_website: row.website || "",
      donor_voen: "",
      donor_category: row.activity_types || "",
      donor_extra: {
        list_number: row.list_number,
        entity_type: row.entity_type,
        legal_form: row.legal_form,
        is_operator: row.is_operator,
        is_internet_provider: row.is_internet_provider,
        is_host_provider: row.is_host_provider,
        source: row.source,
      },
    });
  }

  for (const row of safeReadCsv("government/azerbaijan-state-organizations.csv")) {
    if (row.entry_type && row.entry_type !== "organization") continue;
    const name = row.name || "";
    if (!name) continue;
    donors.push({
      donor_id: row.id || `gov-${++id}`,
      donor_sector: "government",
      donor_search_name: name,
      donor_name: name,
      donor_legal_name: name,
      donor_city: "Bakı",
      donor_address: "",
      donor_phone: "",
      donor_email: "",
      donor_website: "",
      donor_voen: "",
      donor_category: row.org_kind || "",
      donor_extra: {
        letter_group: row.letter_group,
        wikipedia_url: row.wikipedia_url,
        category_path: row.category_path,
        category_paths: row.category_paths,
        source: row.source,
      },
    });
  }

  for (const row of safeReadCsv("business-plazas/baku-business-plazas.csv")) {
    const name = row.canonical_name || "";
    if (!name) continue;
    donors.push({
      donor_id: row.id || `plaza-${++id}`,
      donor_sector: "business-plazas",
      donor_search_name: name,
      donor_name: name,
      donor_legal_name: name,
      donor_city: row.district ? `Bakı / ${row.district}` : "Bakı",
      donor_address: row.address || "",
      donor_phone: "",
      donor_email: "",
      donor_website: "",
      donor_voen: "",
      donor_category: row.building_type || "",
      donor_extra: {
        aliases: row.aliases,
        parent_complex: row.parent_complex,
        sources: row.sources,
        approval_status: row.approval_status,
        notes: row.notes,
      },
    });
  }

  for (const row of safeReadCsv("financial-institutions/azerbaijan-insurers.csv")) {
    const name = row.name || "";
    if (!name) continue;
    donors.push({
      donor_id: row.id || `insurer-${++id}`,
      donor_sector: "financial-institutions",
      donor_search_name: name,
      donor_name: name,
      donor_legal_name: name,
      donor_city: "Bakı",
      donor_address: row.address || "",
      donor_phone: row.phone || "",
      donor_email: row.email || "",
      donor_website: row.website || "",
      donor_voen: normalizeVoen(row.voen),
      donor_category: "insurer",
      donor_extra: {
        legal_form: row.legal_form,
        license_date: row.license_date,
        state_registered_at: row.state_registered_at,
      },
    });
  }

  for (const row of safeReadCsv("financial-institutions/azerbaijan-bokt.csv")) {
    const name = row.name || "";
    if (!name) continue;
    donors.push({
      donor_id: row.id || `bokt-${++id}`,
      donor_sector: "financial-institutions",
      donor_search_name: name,
      donor_name: name,
      donor_legal_name: name,
      donor_city: "Bakı",
      donor_address: row.address || "",
      donor_phone: row.phone || "",
      donor_email: row.email || "",
      donor_website: row.website || "",
      donor_voen: "",
      donor_category: `bokt / ${row.license_number || ""}`.trim(),
      donor_extra: {
        license_number: row.license_number,
        license_date: row.license_date,
        ceo: row.ceo,
      },
    });
  }

  for (const row of safeReadCsv("education/azerbaijan-private-schools.csv")) {
    const name = row.name || "";
    if (!name) continue;
    donors.push({
      donor_id: row.id || `school-${++id}`,
      donor_sector: "education",
      donor_search_name: name,
      donor_name: name,
      donor_legal_name: name,
      donor_city: row.city || "Bakı",
      donor_address: row.address || "",
      donor_phone: "",
      donor_email: "",
      donor_website: "",
      donor_voen: "",
      donor_category: row.institution_type || "",
      donor_extra: { source: row.source, source_url: row.source_url },
    });
  }

  for (const row of safeReadCsv("event-organizers/azerbaijan-event-organizers.csv")) {
    const name = row.name || "";
    if (!name) continue;
    donors.push({
      donor_id: row.id || `org-${++id}`,
      donor_sector: "event-organizers",
      donor_search_name: name,
      donor_name: name,
      donor_legal_name: row.legal_name || name,
      donor_city: row.city || "Bakı",
      donor_address: row.address || "",
      donor_phone: row.phone || "",
      donor_email: row.email || "",
      donor_website: row.website || "",
      donor_voen: normalizeVoen(row.voen),
      donor_category: row.organizer_type || "",
      donor_extra: { source_url: row.source_url },
    });
  }

  return donors;
}

function loadDonors() {
  const raw = loadDonorsRaw();
  return dedupeDonors(raw);
}

// --- Flatten tax API entity ---
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
  };
}

function csvEscape(v) {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function mergeDonorFields(target, donor) {
  const append = (key, val) => {
    if (!val) return;
    const cur = target[key];
    if (!cur) target[key] = val;
    else if (!cur.split(" | ").includes(val)) target[key] = `${cur} | ${val}`;
  };
  append("donor_sectors", donor.donor_sector);
  append("donor_ids", donor.donor_id);
  append("donor_search_names", donor.donor_search_name);
  append("donor_names", donor.donor_name);
  append("donor_legal_names", donor.donor_legal_name);
  append("donor_cities", donor.donor_city);
  append("donor_addresses", donor.donor_address);
  append("donor_phones", donor.donor_phone);
  append("donor_emails", donor.donor_email);
  append("donor_websites", donor.donor_website);
  append("donor_voens", donor.donor_voen);
  append("donor_categories", donor.donor_category);
  const extra = JSON.stringify(donor.donor_extra ?? {});
  append("donor_extra_json", extra);
}

async function ensureSession(page) {
  await page.goto(ETAXES_PAGE, { waitUntil: "networkidle", timeout: 90_000 });
  await page.waitForTimeout(1500);
}

async function searchLegalEntities(page, query) {
  const cacheFile = path.join(CACHE_DIR, `name_${cacheFileSlug(query)}.json`);
  const apiName = toEtaxesSearchQuery(query);

  if (fs.existsSync(cacheFile)) {
    const cached = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
    const retry =
      cached?.error &&
      /404/.test(String(cached.error)) &&
      cached.api_query !== apiName &&
      cached.query !== apiName;
    if (!retry) return cached;
    fs.unlinkSync(cacheFile);
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
    { url: FIND_URL, name: apiName },
  );

  if (result.status !== 200) {
    const payload = {
      query,
      api_query: apiName,
      taxpayers: [],
      error: `HTTP ${result.status}`,
    };
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(cacheFile, JSON.stringify(payload, null, 2), "utf8");
    return payload;
  }

  const taxpayers = result.json?.taxpayers ?? [];
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(
    cacheFile,
    JSON.stringify({ query, api_query: apiName, taxpayers }, null, 2),
    "utf8",
  );
  return { query, api_query: apiName, taxpayers };
}

async function searchByVoen(page, voen) {
  const cacheFile = path.join(CACHE_DIR, `voen_${voen}.json`);
  if (fs.existsSync(cacheFile)) {
    return JSON.parse(fs.readFileSync(cacheFile, "utf8"));
  }

  const result = await page.evaluate(
    async ({ url, tin }) => {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          tin,
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
    { url: FIND_URL, tin: voen },
  );

  if (result.status !== 200) {
    const payload = { query: voen, taxpayers: [], error: `HTTP ${result.status}` };
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(cacheFile, JSON.stringify(payload, null, 2), "utf8");
    return payload;
  }

  const taxpayers = result.json?.taxpayers ?? [];
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(cacheFile, JSON.stringify({ query: voen, taxpayers }, null, 2), "utf8");
  return { query: voen, taxpayers };
}

function ingestTaxpayers(taxpayers, searchQuery, byVoen) {
  for (const tp of taxpayers) {
    const flat = flattenTaxpayer(tp, searchQuery);
    const voen = flat.voen;
    if (!voen) continue;
    if (!byVoen.has(voen)) {
      byVoen.set(voen, {
        ...flat,
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
      });
    } else {
      const ex = byVoen.get(voen);
      if (!ex.search_query.includes(searchQuery)) {
        ex.search_query = ex.search_query ? `${ex.search_query} | ${searchQuery}` : searchQuery;
      }
    }
  }
}

function tryLinkDonor(donor, byVoen, searchResultsByQuery) {
  let linked = false;
  for (const voen of String(donor.donor_voen || "")
    .split(" | ")
    .map((v) => v.trim())
    .filter(Boolean)) {
    if (byVoen.has(voen)) {
      mergeDonorFields(byVoen.get(voen), donor);
      linked = true;
    }
  }
  for (const q of donor.donor_search_queries || []) {
    const taxpayers = searchResultsByQuery.get(q);
    if (!taxpayers) continue;
    for (const tp of taxpayers) {
      const voen = tp.tin;
      if (!voen || !byVoen.has(voen)) continue;
      if (donorMatchesTaxpayer(donor.donor_search_name, donor.donor_legal_name, tp.name)) {
        mergeDonorFields(byVoen.get(voen), donor);
        linked = true;
      }
    }
  }
  return linked;
}

async function runQueryBatch(page, queries, byVoen, searchResultsByQuery, label) {
  for (let i = 0; i < queries.length; i++) {
    const q = queries[i];
    if (searchResultsByQuery.has(q)) continue;
    process.stdout.write(`[${label} ${i + 1}/${queries.length}] ${q} ... `);
    try {
      const { taxpayers, error } = await searchLegalEntities(page, q);
      searchResultsByQuery.set(q, taxpayers);
      console.log(`${taxpayers.length} hit(s)${error ? ` [${error}]` : ""}`);
      ingestTaxpayers(taxpayers, q, byVoen);
    } catch (e) {
      console.log(`ERROR: ${e.message}`);
      searchResultsByQuery.set(q, []);
    }
    if (i < queries.length - 1) await randDelay();
  }
}

async function main() {
  if (COUNT_ONLY) {
    const raw = loadDonorsRaw();
    const donors = dedupeDonors(raw);
    const q = new Set();
    for (const d of donors) {
      for (const query of d.donor_search_queries) q.add(query);
    }
    console.log(`Donor raw records: ${raw.length}`);
    console.log(`Donor deduped: ${donors.length}`);
    console.log(`Unique search queries (all tokens): ${q.size}`);
    const primary = new Set(donors.map((d) => d.donor_search_query).filter(Boolean));
    console.log(`Unique primary queries: ${primary.size}`);
    return;
  }
  if (fs.existsSync(COMPLETE_MARKER) && !FORCE) {
    const done = JSON.parse(fs.readFileSync(COMPLETE_MARKER, "utf8"));
    console.log(`Already complete (${done.finishedAt}). Use --force to re-run.`);
    return;
  }
  if (FORCE && fs.existsSync(COMPLETE_MARKER)) {
    fs.unlinkSync(COMPLETE_MARKER);
  }
  acquireLock();
  try {
    await runEnrichment();
  } finally {
    releaseLock();
  }
}

async function runEnrichment() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const rawCount = loadDonorsRaw().length;
  const donors = loadDonors();
  console.log(`Loaded ${rawCount} raw → ${donors.length} deduped donor records.`);

  let primaryQueries = [
    ...new Set(donors.map((d) => d.donor_search_query).filter(Boolean)),
  ].sort();
  if (LIMIT > 0) primaryQueries = primaryQueries.slice(0, LIMIT);
  console.log(`Primary search queries: ${primaryQueries.length}${LIMIT ? ` (limit ${LIMIT})` : ""}.`);

  const browser = await chromium.launch({
    headless: !HEADFUL,
    args: ["--disable-blink-features=AutomationControlled"],
  });
  const context = await browser.newContext({
    locale: "az-AZ",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();
  await ensureSession(page);

  const byVoen = new Map();
  const searchResultsByQuery = new Map();

  await runQueryBatch(page, primaryQueries, byVoen, searchResultsByQuery, "primary");

  const linked = new Set();
  for (const donor of donors) {
    if (tryLinkDonor(donor, byVoen, searchResultsByQuery)) linked.add(donor.donor_norm_key);
  }
  console.log(`\nAfter primary: linked ${linked.size}/${donors.length}`);

  if (!LIMIT) {
    let round = 0;
    while (true) {
      const pending = new Set();
      for (const donor of donors) {
        if (linked.has(donor.donor_norm_key)) continue;
        for (const q of donor.donor_search_queries || []) {
          if (!searchResultsByQuery.has(q)) {
            pending.add(q);
            break;
          }
        }
      }
      if (!pending.size) break;
      round++;
      const batch = [...pending].sort();
      console.log(`\nAlternate round ${round}: ${batch.length} new queries`);
      await runQueryBatch(page, batch, byVoen, searchResultsByQuery, `alt-${round}`);
      let newLinks = 0;
      for (const donor of donors) {
        if (linked.has(donor.donor_norm_key)) continue;
        if (tryLinkDonor(donor, byVoen, searchResultsByQuery)) {
          linked.add(donor.donor_norm_key);
          newLinks++;
        }
      }
      console.log(`Round ${round}: +${newLinks} linked (total ${linked.size}/${donors.length})`);
      if (!newLinks) break;
    }
  }

  const donorVoens = [
    ...new Set(
      donors
        .flatMap((d) => String(d.donor_voen || "").split(" | "))
        .map((v) => v.trim())
        .filter(Boolean),
    ),
  ].filter((v) => !byVoen.has(v) || !byVoen.get(v).tax_name);
  if (donorVoens.length) {
    console.log(`\nVÖEN lookups: ${donorVoens.length}`);
    for (let i = 0; i < donorVoens.length; i++) {
      const voen = donorVoens[i];
      process.stdout.write(`[voen ${i + 1}/${donorVoens.length}] ${voen} ... `);
      try {
        const { taxpayers, error } = await searchByVoen(page, voen);
        console.log(`${taxpayers.length} hit(s)${error ? ` [${error}]` : ""}`);
        ingestTaxpayers(taxpayers, `voen:${voen}`, byVoen);
        for (const donor of donors) {
          if (String(donor.donor_voen || "").split(" | ").includes(voen)) {
            tryLinkDonor(donor, byVoen, searchResultsByQuery);
          }
        }
      } catch (e) {
        console.log(`ERROR: ${e.message}`);
      }
      if (i < donorVoens.length - 1) await randDelay();
    }
  }

  await browser.close();

  for (const donor of donors) {
    if (tryLinkDonor(donor, byVoen, searchResultsByQuery)) continue;
    const key = `donor-only:${donor.donor_norm_key}`;
    if (byVoen.has(key)) {
      mergeDonorFields(byVoen.get(key), donor);
      continue;
    }
    byVoen.set(key, {
      search_query: (donor.donor_search_queries || []).join(" | "),
      tax_name: "",
      voen: donor.donor_voen || "",
      tax_type: "",
      tax_debt: "",
      tax_active: "",
      tax_vat_payer: "",
      tax_risky_payer: "",
      tax_sanctions: "",
      tax_organization_name: "",
      tax_organization_type: "",
      tax_amount_azn: "",
      tax_foreign_amount: "",
      tax_foreign_currency: "",
      tax_legal_address: "",
      tax_legitimate: "",
      tax_legal_form_code: "",
      tax_legal_form: "",
      tax_charter_capital: "",
      tax_financial_year_start: "",
      tax_financial_year_end: "",
      tax_voen_registered_at: "",
      tax_state_registered_at: "",
      tax_extract_date: "",
      tax_status_code: "",
      tax_status: "",
      tax_authority_code: "",
      tax_authority: "",
      tax_legal_debt: "",
      tax_tasks_obligations: "",
      tax_raw_json: "",
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
      match_status: "no_tax_match",
    });
    mergeDonorFields(byVoen.get(key), donor);
  }

  for (const row of byVoen.values()) {
    if (!row.match_status) row.match_status = row.donor_ids ? "tax_matched" : "donor_only";
  }

  const header = [
    "match_status",
    "search_query",
    "voen",
    "tax_name",
    "tax_legal_address",
    "tax_legitimate",
    "tax_legal_form",
    "tax_charter_capital",
    "tax_voen_registered_at",
    "tax_state_registered_at",
    "tax_status",
    "tax_active",
    "tax_vat_payer",
    "tax_risky_payer",
    "tax_debt",
    "tax_authority",
    "tax_organization_type",
    "donor_sectors",
    "donor_ids",
    "donor_search_names",
    "donor_names",
    "donor_cities",
    "donor_addresses",
    "donor_phones",
    "donor_emails",
    "donor_websites",
    "donor_voens",
    "donor_categories",
    "donor_extra_json",
    "tax_extract_date",
    "tax_financial_year_start",
    "tax_financial_year_end",
    "tax_sanctions",
    "tax_raw_json",
  ];

  const rows = [...byVoen.values()]
    .filter((r) => r.donor_ids)
    .sort((a, b) =>
      (a.tax_name || a.donor_names || "").localeCompare(b.tax_name || b.donor_names || "", "az"),
    );

  const csv = [header.join(","), ...rows.map((r) => header.map((h) => csvEscape(r[h])).join(","))].join(
    "\n",
  );
  fs.writeFileSync(OUT_CSV, csv, "utf8");

  const stats = {
    donor_raw: rawCount,
    donor_deduped: donors.length,
    primary_queries: primaryQueries.length,
    output_rows: rows.length,
    tax_matched: rows.filter((r) => r.match_status === "tax_matched").length,
    no_tax_match: rows.filter((r) => r.match_status === "no_tax_match").length,
  };
  console.log("\nDone:", stats);
  console.log(`Output: ${OUT_CSV}`);
  fs.writeFileSync(
    COMPLETE_MARKER,
    JSON.stringify({ finishedAt: new Date().toISOString(), ...stats }),
    "utf8",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
