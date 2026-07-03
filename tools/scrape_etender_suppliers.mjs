/**
 * Collect unique government procurement suppliers from etender.gov.az contracts API.
 *
 * Output:
 *   data/government-procurement/azerbaijan-etender-suppliers.csv
 *   data/government-procurement/.etender-checkpoint.json (resume state)
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "data", "government-procurement");
const OUT_CSV = path.join(OUT_DIR, "azerbaijan-etender-suppliers.csv");
const CHECKPOINT = path.join(OUT_DIR, ".etender-checkpoint.json");
const API = "https://etender.gov.az/api/contracts";
const PAGE_SIZE = Number(process.env.ETENDER_PAGE_SIZE ?? 15);
const MAX_PAGES = Number(process.env.ETENDER_MAX_PAGES ?? 0); // 0 = all
const DELAY_MS = Number(process.env.ETENDER_DELAY_MS ?? 200);
const START_PAGE = Number(process.env.ETENDER_START_PAGE ?? 0);
const RETRIES = Number(process.env.ETENDER_RETRIES ?? 5);
const FETCH_TIMEOUT_MS = Number(process.env.ETENDER_TIMEOUT_MS ?? 60000);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function isAzVoen(v) {
  return /^\d{10}$/.test(String(v ?? "").trim());
}

function csvEscape(v) {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function serializeMap(byVoen) {
  return Object.fromEntries(
    [...byVoen.entries()].map(([voen, rec]) => [
      voen,
      {
        ...rec,
        tender_types: [...rec.tender_types],
        buyer_examples: [...rec.buyer_examples],
      },
    ]),
  );
}

function deserializeMap(obj) {
  const byVoen = new Map();
  for (const [voen, rec] of Object.entries(obj ?? {})) {
    byVoen.set(voen, {
      ...rec,
      tender_types: new Set(rec.tender_types ?? []),
      buyer_examples: new Set(rec.buyer_examples ?? []),
    });
  }
  return byVoen;
}

function ingestItem(byVoen, item) {
  const voen = String(item.supplierOrganizationVoen ?? "").trim();
  if (!isAzVoen(voen)) return;
  const name = item.supplierOrganizationName ?? "";
  const rec = byVoen.get(voen) ?? {
    voen,
    supplier_name: name,
    contract_count: 0,
    total_amount_azn: 0,
    last_contract_date: "",
    tender_types: new Set(),
    buyer_examples: new Set(),
  };
  rec.contract_count += 1;
  rec.total_amount_azn += Number(item.amount) || 0;
  const d = item.contractDate || item.issueDate || "";
  if (d && (!rec.last_contract_date || d > rec.last_contract_date)) {
    rec.last_contract_date = d.slice(0, 10);
  }
  if (item.tenderType) rec.tender_types.add(item.tenderType);
  if (item.buyerOrganizationName && rec.buyer_examples.size < 5) {
    rec.buyer_examples.add(item.buyerOrganizationName);
  }
  if (name && name.length > (rec.supplier_name?.length ?? 0)) rec.supplier_name = name;
  byVoen.set(voen, rec);
}

function writeCsv(byVoen) {
  const rows = [...byVoen.values()].sort((a, b) => b.contract_count - a.contract_count);
  const header = [
    "id",
    "voen",
    "supplier_name",
    "contract_count",
    "total_amount_azn",
    "last_contract_date",
    "tender_types",
    "buyer_examples",
    "source",
  ];
  const lines = [
    header.join(","),
    ...rows.map((r, i) =>
      [
        `etender-sup-${i + 1}`,
        r.voen,
        r.supplier_name,
        r.contract_count,
        r.total_amount_azn.toFixed(2),
        r.last_contract_date,
        [...r.tender_types].join(" | "),
        [...r.buyer_examples].join(" | "),
        "etender.gov.az/api/contracts",
      ]
        .map(csvEscape)
        .join(","),
    ),
  ];
  fs.writeFileSync(OUT_CSV, lines.join("\n"), "utf8");
  return rows.length;
}

function saveCheckpoint(state) {
  fs.writeFileSync(CHECKPOINT, JSON.stringify(state, null, 2), "utf8");
}

async function fetchPage(pageNumber) {
  const url = `${API}?PageSize=${PAGE_SIZE}&PageNumber=${pageNumber}`;
  let lastErr;
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "ERA-ecosystem-data-collector/1.0" },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    } catch (e) {
      lastErr = e;
      const wait = Math.min(30_000, 1000 * 2 ** attempt);
      console.warn(`page ${pageNumber} attempt ${attempt}/${RETRIES} failed: ${e.message}; retry in ${wait}ms`);
      await sleep(wait);
    }
  }
  throw lastErr;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  let byVoen = new Map();
  let page = 1;
  let totalPages = 1;
  let totalContracts = 0;

  if (fs.existsSync(CHECKPOINT) && !START_PAGE) {
    const cp = JSON.parse(fs.readFileSync(CHECKPOINT, "utf8"));
    byVoen = deserializeMap(cp.suppliers);
    page = cp.next_page ?? 1;
    totalPages = cp.total_pages ?? 1;
    totalContracts = cp.total_contracts ?? 0;
    console.log(`Resuming from page ${page}, suppliers=${byVoen.size}`);
  } else if (START_PAGE > 0) {
    page = START_PAGE;
    if (fs.existsSync(CHECKPOINT)) {
      const cp = JSON.parse(fs.readFileSync(CHECKPOINT, "utf8"));
      byVoen = deserializeMap(cp.suppliers);
    }
    console.log(`Starting at page ${page}, suppliers=${byVoen.size}`);
  }

  while (page <= totalPages) {
    if (MAX_PAGES > 0 && page > MAX_PAGES) break;
    const data = await fetchPage(page);
    totalPages = data.totalPages ?? 1;
    totalContracts = data.totalItems ?? 0;
    if (page === 1) {
      fs.writeFileSync(
        path.join(OUT_DIR, "azerbaijan-etender-contracts-sample.json"),
        JSON.stringify(data, null, 2),
        "utf8",
      );
    }

    for (const item of data.items ?? []) ingestItem(byVoen, item);

    if (page % 25 === 0 || page === totalPages) {
      console.log(
        `page ${page}/${totalPages} contracts~${totalContracts} unique_suppliers=${byVoen.size}`,
      );
      writeCsv(byVoen);
      saveCheckpoint({
        next_page: page + 1,
        total_pages: totalPages,
        total_contracts: totalContracts,
        suppliers: serializeMap(byVoen),
        updated_at: new Date().toISOString(),
      });
    }

    page += 1;
    if (page <= totalPages) await sleep(DELAY_MS);
  }

  const count = writeCsv(byVoen);
  fs.writeFileSync(
    path.join(OUT_DIR, ".scrape-stats.json"),
    JSON.stringify(
      {
        total_contracts: totalContracts,
        pages_fetched: page - 1,
        unique_az_suppliers: count,
        finished_at: new Date().toISOString(),
      },
      null,
      2,
    ),
    "utf8",
  );
  if (fs.existsSync(CHECKPOINT)) fs.unlinkSync(CHECKPOINT);
  console.log(`Wrote ${count} suppliers -> ${OUT_CSV}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
