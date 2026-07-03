/**
 * Collect unique government procurement buyers from etender.gov.az competitions.
 * Page: https://etender.gov.az/main/competitions
 *
 * List API has buyer name only; VOEN from GET /api/events/{eventId} (organizationVoen).
 * Dedup: one detail fetch per unique buyer name, output keyed by VOEN.
 *
 * Output:
 *   data/government-procurement/azerbaijan-etender-buyers.csv
 *   data/government-procurement/.etender-buyers-checkpoint.json
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "data", "government-procurement");
const OUT_CSV = path.join(OUT_DIR, "azerbaijan-etender-buyers.csv");
const CHECKPOINT = path.join(OUT_DIR, ".etender-buyers-checkpoint.json");
const LIST_API = "https://etender.gov.az/api/events";
const EVENT_TYPE = Number(process.env.ETENDER_BUYER_EVENT_TYPE ?? 2);
const EVENT_STATUSES = (process.env.ETENDER_BUYER_STATUSES ?? "1,2,3,4")
  .split(",")
  .map((s) => Number(s.trim()))
  .filter((n) => Number.isFinite(n));
const PAGE_SIZE = Number(process.env.ETENDER_BUYER_PAGE_SIZE ?? 50);
const MAX_PAGES = Number(process.env.ETENDER_BUYER_MAX_PAGES ?? 0);
const DELAY_MS = Number(process.env.ETENDER_BUYER_DELAY_MS ?? 250);
const DETAIL_DELAY_MS = Number(process.env.ETENDER_BUYER_DETAIL_DELAY_MS ?? 150);
const RETRIES = Number(process.env.ETENDER_BUYER_RETRIES ?? 5);
const FETCH_TIMEOUT_MS = Number(process.env.ETENDER_BUYER_TIMEOUT_MS ?? 60000);

const STATUS_LABEL = {
  1: "active",
  2: "awarded",
  3: "cancelled",
  4: "other",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function isAzVoen(v) {
  return /^\d{10}$/.test(String(v ?? "").trim());
}

function normalizeBuyerKey(name) {
  return String(name ?? "")
    .trim()
    .toUpperCase()
    .replace(/[""„«»]/g, '"')
    .replace(/\s+/g, " ");
}

function csvEscape(v) {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function serializeBuyers(byVoen) {
  return Object.fromEntries(
    [...byVoen.entries()].map(([voen, rec]) => [
      voen,
      {
        ...rec,
        event_statuses: [...rec.event_statuses],
        sample_event_ids: [...rec.sample_event_ids],
      },
    ]),
  );
}

function deserializeBuyers(obj) {
  const byVoen = new Map();
  for (const [voen, rec] of Object.entries(obj ?? {})) {
    byVoen.set(voen, {
      ...rec,
      event_statuses: new Set(rec.event_statuses ?? []),
      sample_event_ids: new Set(rec.sample_event_ids ?? []),
    });
  }
  return byVoen;
}

function ingestBuyer(byVoen, detail, listMeta) {
  const voen = String(detail.organizationVoen ?? "").trim();
  if (!isAzVoen(voen)) return false;

  const rec = byVoen.get(voen) ?? {
    voen,
    buyer_name: detail.organizationName ?? listMeta.buyerOrganizationName ?? "",
    address: detail.address ?? "",
    competition_count: 0,
    event_statuses: new Set(),
    sample_event_ids: new Set(),
    last_publish_date: "",
    sample_document_number: detail.documentNumber ?? "",
  };

  rec.competition_count += 1;
  if (listMeta.eventStatus) rec.event_statuses.add(STATUS_LABEL[listMeta.eventStatus] ?? String(listMeta.eventStatus));
  if (listMeta.eventId && rec.sample_event_ids.size < 5) rec.sample_event_ids.add(listMeta.eventId);

  const name = detail.organizationName ?? listMeta.buyerOrganizationName ?? "";
  if (name.length > (rec.buyer_name?.length ?? 0)) rec.buyer_name = name;
  if (detail.address && detail.address.length > (rec.address?.length ?? 0)) rec.address = detail.address;
  if (detail.documentNumber && !rec.sample_document_number) rec.sample_document_number = detail.documentNumber;

  const pub = listMeta.publishDate ?? detail.publishDate ?? "";
  if (pub && (!rec.last_publish_date || pub > rec.last_publish_date)) {
    rec.last_publish_date = String(pub).slice(0, 10);
  }

  byVoen.set(voen, rec);
  return true;
}

function writeCsv(byVoen) {
  const rows = [...byVoen.values()].sort((a, b) => b.competition_count - a.competition_count);
  const header = [
    "id",
    "voen",
    "buyer_name",
    "address",
    "competition_count",
    "event_statuses",
    "sample_event_ids",
    "last_publish_date",
    "sample_document_number",
    "source",
  ];
  const lines = [
    header.join(","),
    ...rows.map((r, i) =>
      [
        `etender-buyer-${i + 1}`,
        r.voen,
        r.buyer_name,
        r.address,
        r.competition_count,
        [...r.event_statuses].join(" | "),
        [...r.sample_event_ids].join(" | "),
        r.last_publish_date,
        r.sample_document_number,
        "etender.gov.az/main/competitions",
      ]
        .map(csvEscape)
        .join(","),
    ),
  ];
  fs.writeFileSync(OUT_CSV, lines.join("\n"), "utf8");
  return rows.length;
}

function saveCheckpoint(state) {
  fs.writeFileSync(
    CHECKPOINT,
    JSON.stringify(
      {
        ...state,
        buyers: serializeBuyers(state.buyers),
        seen_buyer_keys: [...state.seen_buyer_keys],
        name_to_voen: state.name_to_voen,
      },
      null,
      2,
    ),
    "utf8",
  );
}

async function fetchJson(url) {
  let lastErr;
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "ERA-ecosystem-data-collector/1.0" },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (res.status === 429) {
        const wait = Math.min(60_000, 2000 * 2 ** attempt);
        console.warn(`rate limit ${url}; wait ${wait}ms`);
        await sleep(wait);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    } catch (e) {
      lastErr = e;
      const wait = Math.min(30_000, 1000 * 2 ** attempt);
      console.warn(`fetch attempt ${attempt}/${RETRIES} failed: ${e.message}; retry in ${wait}ms`);
      await sleep(wait);
    }
  }
  throw lastErr;
}

async function fetchListPage(eventStatus, pageNumber) {
  const params = new URLSearchParams({
    EventType: String(EVENT_TYPE),
    EventStatus: String(eventStatus),
    PageSize: String(PAGE_SIZE),
    PageNumber: String(pageNumber),
    Keyword: "",
    buyerOrganizationName: "",
    documentNumber: "",
    publishDateFrom: "",
    publishDateTo: "",
  });
  return fetchJson(`${LIST_API}?${params}`);
}

async function fetchEventDetail(eventId) {
  return fetchJson(`${LIST_API}/${eventId}`);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  let byVoen = new Map();
  let seenBuyerKeys = new Set();
  let nameToVoen = {};
  let statusIdx = 0;
  let page = 1;
  let totalPages = 1;
  let listPagesDone = 0;

  if (fs.existsSync(CHECKPOINT)) {
    const cp = JSON.parse(fs.readFileSync(CHECKPOINT, "utf8"));
    byVoen = deserializeBuyers(cp.buyers);
    seenBuyerKeys = new Set(cp.seen_buyer_keys ?? []);
    nameToVoen = cp.name_to_voen ?? {};
    statusIdx = cp.status_idx ?? 0;
    page = cp.next_page ?? 1;
    totalPages = cp.total_pages ?? 1;
    listPagesDone = cp.list_pages_done ?? 0;
    console.log(
      `Resume status=${EVENT_STATUSES[statusIdx]} page ${page}, buyers=${byVoen.size}, seen_names=${seenBuyerKeys.size}`,
    );
  }

  while (statusIdx < EVENT_STATUSES.length) {
    const eventStatus = EVENT_STATUSES[statusIdx];

    while (page <= totalPages) {
      if (MAX_PAGES > 0 && listPagesDone >= MAX_PAGES) break;

      const data = await fetchListPage(eventStatus, page);
      totalPages = data.totalPages ?? 1;

      for (const item of data.items ?? []) {
        const eventId = item.eventId;
        const buyerName = item.buyerOrganizationName ?? "";
        const key = normalizeBuyerKey(buyerName);
        if (!key || !eventId) continue;

        if (seenBuyerKeys.has(key)) {
          const voen = nameToVoen[key];
          if (voen && byVoen.has(voen)) {
            const rec = byVoen.get(voen);
            rec.competition_count += 1;
            rec.event_statuses.add(STATUS_LABEL[eventStatus] ?? String(eventStatus));
            if (eventId && rec.sample_event_ids.size < 5) rec.sample_event_ids.add(eventId);
          }
          continue;
        }

        seenBuyerKeys.add(key);
        await sleep(DETAIL_DELAY_MS);

        try {
          const detail = await fetchEventDetail(eventId);
          const ok = ingestBuyer(byVoen, detail, {
            eventId,
            buyerOrganizationName: buyerName,
            eventStatus,
            publishDate: item.publishDate,
          });
          if (ok) nameToVoen[key] = String(detail.organizationVoen).trim();
        } catch (e) {
          console.warn(`detail ${eventId} failed: ${e.message}`);
        }
      }

      listPagesDone += 1;
      if (page % 10 === 0 || page === totalPages) {
        console.log(
          `status ${eventStatus} page ${page}/${totalPages} unique_voen=${byVoen.size} seen_names=${seenBuyerKeys.size}`,
        );
        writeCsv(byVoen);
        saveCheckpoint({
          status_idx: statusIdx,
          next_page: page + 1,
          total_pages: totalPages,
          list_pages_done: listPagesDone,
          buyers: byVoen,
          seen_buyer_keys: seenBuyerKeys,
          name_to_voen: nameToVoen,
          updated_at: new Date().toISOString(),
        });
      }

      page += 1;
      if (page <= totalPages) await sleep(DELAY_MS);
    }

    if (MAX_PAGES > 0 && listPagesDone >= MAX_PAGES) break;

    statusIdx += 1;
    page = 1;
    totalPages = 1;
  }

  const count = writeCsv(byVoen);
  fs.writeFileSync(
    path.join(OUT_DIR, ".etender-buyers-stats.json"),
    JSON.stringify(
      {
        event_type: EVENT_TYPE,
        event_statuses: EVENT_STATUSES,
        unique_az_buyers: count,
        seen_buyer_names: seenBuyerKeys.size,
        list_pages_done: listPagesDone,
        finished_at: new Date().toISOString(),
      },
      null,
      2,
    ),
    "utf8",
  );
  if (fs.existsSync(CHECKPOINT)) fs.unlinkSync(CHECKPOINT);
  console.log(`Wrote ${count} buyers -> ${OUT_CSV}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
