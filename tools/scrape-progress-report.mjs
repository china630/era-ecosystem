/**
 * Hourly scrape / enrichment progress report (% per source).
 *
 * Usage:
 *   node tools/scrape-progress-report.mjs
 *   node tools/scrape-progress-report.mjs --json
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data");
const JSON_OUT = process.argv.includes("--json");

function countCsvRows(relPath) {
  const p = path.join(DATA, relPath);
  if (!fs.existsSync(p)) return null;
  const lines = fs.readFileSync(p, "utf8").trim().split(/\r?\n/);
  return Math.max(0, lines.length - 1);
}

function pct(done, total) {
  if (!total || total <= 0) return null;
  return Math.min(100, Math.round((done / total) * 1000) / 10);
}

function findTerminalLog(commandFragment) {
  const termDir =
    process.env.CURSOR_TERMINALS_DIR ??
    path.join(process.env.USERPROFILE ?? "", ".cursor", "projects", "d-My-Projects-era-ecosystem", "terminals");
  if (!termDir || !fs.existsSync(termDir)) return null;
  let best = null;
  for (const name of fs.readdirSync(termDir)) {
    if (!name.endsWith(".txt")) continue;
    const file = path.join(termDir, name);
    const text = fs.readFileSync(file, "utf8");
    if (!text.includes(commandFragment)) continue;
    if (text.includes("exit_code:")) continue; // finished session
    const mtime = fs.statSync(file).mtimeMs;
    if (!best || mtime > best.mtime) best = { text, mtime };
  }
  return best?.text ?? null;
}

function findEnrichTerminalLog() {
  return findTerminalLog("enrich-etaxes-legal-entities.mjs");
}

function findEtenderBuyersTerminalLog() {
  return findTerminalLog("scrape_etender_buyers.mjs");
}

function parseEnrichProgress(logText) {
  const completePath = path.join(DATA, "legal-entities", ".enrich-complete.json");
  if (fs.existsSync(completePath)) {
    const done = JSON.parse(fs.readFileSync(completePath, "utf8"));
    return {
      status: "complete",
      phase: "done",
      pct: 100,
      detail: `rows=${done.output_rows ?? "?"} matched=${done.tax_matched ?? "?"}`,
    };
  }

  const lockPath = path.join(DATA, "legal-entities", ".enrich-running.lock");
  const running = fs.existsSync(lockPath);

  if (!logText && !running) {
    return { status: "idle", phase: "—", pct: null, detail: "not running" };
  }

  const text = logText ?? "";
  const primaryTotal = Number(text.match(/Primary search queries:\s*(\d+)/)?.[1] ?? 2399);

  let primaryDone = 0;
  for (const m of text.matchAll(/\[primary\s+(\d+)\/(\d+)\]/g)) {
    primaryDone = Math.max(primaryDone, Number(m[1]));
  }

  const altMatch = [...text.matchAll(/\[alt-(\d+)\s+(\d+)\/(\d+)\]/g)].pop();
  const voenMatch = [...text.matchAll(/\[voen\s+(\d+)\/(\d+)\]/g)].pop();
  const afterPrimary = text.includes("After primary:");

  if (voenMatch) {
    const done = Number(voenMatch[1]);
    const total = Number(voenMatch[2]);
    const voenPct = pct(done, total) ?? 0;
    const overall = Math.round((85 + (voenPct / 100) * 15) * 10) / 10;
    return {
      status: "running",
      phase: `voen lookups ${done}/${total}`,
      pct: overall,
      detail: `VÖEN phase ${voenPct}%`,
    };
  }

  if (altMatch || afterPrimary) {
    const done = altMatch ? Number(altMatch[2]) : 0;
    const total = altMatch ? Number(altMatch[3]) : 0;
    const altPct = total ? pct(done, total) ?? 0 : 0;
    const overall = Math.round((60 + (altPct / 100) * 25) * 10) / 10;
    const linked = text.match(/After primary: linked (\d+)\/(\d+)/);
    return {
      status: "running",
      phase: altMatch ? `alternate tokens ${done}/${total}` : "alternate rounds",
      pct: overall,
      detail: linked ? `linked ${linked[1]}/${linked[2]} after primary` : "",
    };
  }

  if (primaryDone > 0 || running) {
    const p = pct(primaryDone, primaryTotal) ?? 0;
    const overall = Math.round((p / 100) * 60 * 10) / 10;
    return {
      status: "running",
      phase: `primary queries ${primaryDone}/${primaryTotal}`,
      pct: overall,
      detail: `primary ${p}% (≈${overall}% of full enrich)`,
    };
  }

  return { status: "idle", phase: "—", pct: null, detail: "" };
}

function etenderBuyersProgress() {
  const cpPath = path.join(DATA, "government-procurement", ".etender-buyers-checkpoint.json");
  const statsPath = path.join(DATA, "government-procurement", ".etender-buyers-stats.json");
  const csvRows = countCsvRows("government-procurement/azerbaijan-etender-buyers.csv");
  const EST_TOTAL_LIST_PAGES = 893; // EventType=2, statuses 1–4 @ PageSize=50
  const terminalLog = findEtenderBuyersTerminalLog();

  let done = 0;
  let uniqueVoen = csvRows ?? 0;
  let phase = "";

  if (fs.existsSync(cpPath)) {
    const cp = JSON.parse(fs.readFileSync(cpPath, "utf8"));
    done = cp.list_pages_done ?? 0;
    uniqueVoen = cp.buyers ? Object.keys(cp.buyers).length : uniqueVoen;
    const status = EVENT_STATUS_LABEL(cp.status_idx ?? 0);
    phase = `status ${status}, page ${cp.next_page ?? "?"}/${cp.total_pages ?? "?"}`;
  }

  if (terminalLog) {
    for (const m of terminalLog.matchAll(/status (\d+) page (\d+)\/(\d+) unique_voen=(\d+)/g)) {
      const page = Number(m[2]);
      const total = Number(m[3]);
      done = Math.max(done, page);
      uniqueVoen = Math.max(uniqueVoen, Number(m[4]));
      phase = `status ${m[1]} page ${page}/${total}`;
    }
  }

  if (fs.existsSync(statsPath) && !fs.existsSync(cpPath) && !terminalLog) {
    const s = JSON.parse(fs.readFileSync(statsPath, "utf8"));
    done = s.list_pages_done ?? EST_TOTAL_LIST_PAGES;
    uniqueVoen = s.unique_az_buyers ?? uniqueVoen;
    if (done >= EST_TOTAL_LIST_PAGES * 0.95) {
      return {
        status: "complete",
        pct: 100,
        detail: `${uniqueVoen} buyers (VOEN dedup), ${done} list pages`,
      };
    }
  }

  if (done > 0 || fs.existsSync(cpPath) || terminalLog) {
    const p = pct(done, EST_TOTAL_LIST_PAGES) ?? 0;
    return {
      status: "running",
      phase: phase || `list pages ${done}/${EST_TOTAL_LIST_PAGES}`,
      pct: p,
      detail: `${uniqueVoen} unique VOEN, list ${done}/${EST_TOTAL_LIST_PAGES}`,
    };
  }

  if (csvRows != null && csvRows > 0) {
    return { status: "unknown", pct: null, detail: `${csvRows} buyers in CSV (idle)` };
  }

  return { status: "not_started", pct: 0, detail: "" };
}

function EVENT_STATUS_LABEL(idx) {
  return [1, 2, 3, 4][idx] ?? "?";
}

function etenderEtaxesWaveProgress() {
  const completePath = path.join(DATA, "legal-entities", ".etender-etaxes-wave-complete.json");
  const cpPath = path.join(DATA, "legal-entities", ".etender-etaxes-wave-checkpoint.json");
  const lockPath = path.join(DATA, "legal-entities", ".etender-etaxes-wave.lock");
  const expandedRows = countCsvRows("legal-entities/azerbaijan-companies-with-voen.csv");

  if (fs.existsSync(completePath)) {
    const done = JSON.parse(fs.readFileSync(completePath, "utf8"));
    return {
      status: "complete",
      pct: 100,
      detail: `names=${done.name_queries ?? "?"} voens=${done.voen_queries ?? "?"}; expanded CSV ${expandedRows ?? "?"} rows`,
    };
  }

  if (fs.existsSync(cpPath)) {
    const cp = JSON.parse(fs.readFileSync(cpPath, "utf8"));
    const done = cp.index ?? 0;
    const total = cp.total ?? 1;
    const p = pct(done, total);
    return {
      status: "running",
      phase: `${cp.phase} ${done}/${total}`,
      pct: p,
      detail: `cache_skipped=${cp.stats?.cache_skipped ?? 0}`,
    };
  }

  if (fs.existsSync(lockPath)) {
    return { status: "running", pct: null, phase: "starting", detail: "lock present" };
  }

  return { status: "not_started", pct: 0, detail: expandedRows != null ? `expanded CSV ${expandedRows} rows (pre-wave)` : "" };
}

function expandedRegistryProgress() {
  const statsPath = path.join(DATA, "legal-entities", ".companies-master-stats.json");
  const rows = countCsvRows("legal-entities/azerbaijan-companies-with-voen.csv");
  if (fs.existsSync(statsPath)) {
    const s = JSON.parse(fs.readFileSync(statsPath, "utf8"));
    return {
      status: "complete",
      pct: 100,
      detail: `master with_voen=${s.with_voen ?? rows ?? "?"} (cache_files=${s.cache_files ?? "?"})`,
    };
  }
  if (rows != null && rows > 0) {
    return { status: "unknown", pct: null, detail: `${rows} master rows (no stats)` };
  }
  return { status: "not_started", pct: 0, detail: "awaiting master CSV" };
}

function etenderProgress() {
  const cpPath = path.join(DATA, "government-procurement", ".etender-checkpoint.json");
  const statsPath = path.join(DATA, "government-procurement", ".scrape-stats.json");
  const csvRows = countCsvRows("government-procurement/azerbaijan-etender-suppliers.csv");

  if (fs.existsSync(statsPath)) {
    const s = JSON.parse(fs.readFileSync(statsPath, "utf8"));
    return {
      status: "complete",
      pct: 100,
      detail: `${s.unique_az_suppliers ?? csvRows ?? "?"} suppliers, ${s.pages_fetched ?? "?"} pages`,
    };
  }

  if (fs.existsSync(cpPath)) {
    const cp = JSON.parse(fs.readFileSync(cpPath, "utf8"));
    const done = Math.max(0, (cp.next_page ?? 1) - 1);
    const total = cp.total_pages ?? 7338;
    const p = pct(done, total);
    return {
      status: "running",
      pct: p,
      detail: `page ${done}/${total}, ${Object.keys(cp.suppliers ?? {}).length} suppliers`,
    };
  }

  if (csvRows != null && csvRows > 0) {
    return { status: "unknown", pct: null, detail: `${csvRows} suppliers in CSV (no checkpoint)` };
  }

  return { status: "not_started", pct: 0, detail: "" };
}

function staticDone(rows, label = "") {
  return {
    status: rows != null ? "complete" : "missing",
    pct: rows != null ? 100 : 0,
    detail: rows != null ? `${rows} rows${label ? ` — ${label}` : ""}` : "file missing",
  };
}

function buildReport() {
  const enrichLog = findEnrichTerminalLog();
  const enrich = parseEnrichProgress(enrichLog);
  const etender = etenderProgress();
  const etenderBuyers = etenderBuyersProgress();
  const etenderWave = etenderEtaxesWaveProgress();
  const expandedRegistry = expandedRegistryProgress();

  const sources = [
    {
      id: "etender",
      site: "etender.gov.az",
      task: "Procurement suppliers (contracts)",
      ...etender,
    },
    {
      id: "etender-buyers",
      site: "etender.gov.az/main/competitions",
      task: "Government buyers (VOEN dedup)",
      ...etenderBuyers,
    },
    {
      id: "etaxes",
      site: "new.e-taxes.gov.az",
      task: "Legal entities enrich (Playwright)",
      phase: enrich.phase,
      status: enrich.status,
      pct: enrich.pct,
      detail: enrich.detail,
    },
    {
      id: "etender-etaxes-wave",
      site: "new.e-taxes.gov.az",
      task: "Etender name-search wave (suppliers + buyers)",
      ...etenderWave,
    },
    {
      id: "companies-master",
      site: "cache + master merge",
      task: "Companies master CSV (with VÖEN)",
      ...expandedRegistry,
    },
    {
      id: "exhibitions",
      site: "iteca.az / bakubuild / interfood / …",
      task: "Exhibition exhibitors",
      ...staticDone(countCsvRows("exhibitions/azerbaijan-exhibition-exhibitors.csv"), "1060 unique"),
    },
    {
      id: "cbar",
      site: "cbar.az",
      task: "Insurers + BOKT",
      ...(() => {
        const ins = countCsvRows("financial-institutions/azerbaijan-insurers.csv");
        const bokt = countCsvRows("financial-institutions/azerbaijan-bokt.csv");
        const rows = ins != null && bokt != null ? ins + bokt : null;
        return staticDone(rows, `${ins ?? 0} insurers + ${bokt ?? 0} BOKT`);
      })(),
    },
    {
      id: "schools",
      site: "modern.az + edu.gov.az",
      task: "Private schools",
      ...staticDone(countCsvRows("education/azerbaijan-private-schools.csv")),
    },
    {
      id: "hotels",
      site: "TIMS / donor registries",
      task: "Hotels",
      ...staticDone(countCsvRows("hotels/azerbaijan-hotels.csv")),
    },
    {
      id: "auditors",
      site: "audit registry",
      task: "Auditors",
      ...staticDone(countCsvRows("accountants/azerbaijan-auditors.csv")),
    },
    {
      id: "medical",
      site: "medical institutions list",
      task: "Clinics / hospitals",
      ...staticDone(countCsvRows("medical-institutions/azerbaijan-medical-institutions.csv")),
    },
    {
      id: "construction",
      site: "insaat.az",
      task: "Construction companies",
      ...staticDone(countCsvRows("construction-companies/azerbaijan-construction-shops.csv")),
    },
    {
      id: "travel",
      site: "turlar.az + trippost",
      task: "Travel agencies",
      ...staticDone(countCsvRows("travel-agencies/azerbaijan-travel-agencies.csv")),
    },
    {
      id: "organizers",
      site: "manual seed",
      task: "Event organizers",
      ...staticDone(countCsvRows("event-organizers/azerbaijan-event-organizers.csv")),
    },
  ];

  const active = sources.filter((s) => s.status === "running");
  const overallPct =
    active.length === 0
      ? 100
      : Math.round(
          (sources.reduce((sum, s) => sum + (s.pct ?? (s.status === "complete" ? 100 : 0)), 0) /
            sources.length) *
            10,
        ) / 10;

  return {
    at: new Date().toISOString(),
    overall_weighted_pct: overallPct,
    sources,
  };
}

function formatReport(report) {
  const lines = [];
  lines.push(`## Scrape progress — ${report.at.replace("T", " ").slice(0, 19)} UTC`);
  lines.push("");
  lines.push(`**Сводка (среднее по источникам): ${report.overall_weighted_pct}%**`);
  lines.push("");
  lines.push("| Сайт | Задача | % | Статус | Детали |");
  lines.push("|------|--------|---|--------|--------|");
  for (const s of report.sources) {
    const p = s.pct != null ? `${s.pct}%` : "—";
    const phase = s.phase ? ` (${s.phase})` : "";
    lines.push(`| ${s.site} | ${s.task} | **${p}** | ${s.status}${phase} | ${s.detail || "—"} |`);
  }
  return lines.join("\n");
}

const report = buildReport();
if (JSON_OUT) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(formatReport(report));
}
