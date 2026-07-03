#!/usr/bin/env node
/**
 * Generate ecosystem-wide readiness HTML report (cores + satellites).
 *
 * Sources:
 *   - DELIVERY markdown files under each app's doc folder
 *   - docs/COVERAGE_MATRIX.md (honest Doc/API/UI/actor status)
 *   - docs/MODULES_CATALOG.md (module catalog + MVP backlog)
 *   - scripts/readiness-coverage.mjs (code-level platform hooks)
 *
 * Usage:
 *   node scripts/generate-ecosystem-readiness-report.mjs
 *   node scripts/generate-ecosystem-readiness-report.mjs --json
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outHtml = path.join(root, "docs", "ecosystem-readiness-report.html");
const jsonOnly = process.argv.includes("--json");

const APP_META = {
  "era-orchestrator": { layer: "core", label: "Orchestrator", order: 1 },
  "era-finance-core": { layer: "core", label: "Finance ERP", order: 2 },
  "era-data-hub": { layer: "core", label: "Data Hub", order: 3 },
  "era-bank-core": { layer: "banking", label: "Bank Core (CBS)", order: 4 },
  "era-bank": { layer: "banking", label: "Bank Ops", order: 5 },
  "era-bank-dbo": { layer: "banking", label: "Bank DBO", order: 6 },
  "era-hotel-pms": { layer: "satellite", label: "Hotel PMS", order: 10 },
  "era-fnb-pos": { layer: "satellite", label: "F&B POS", order: 11 },
  "era-retail-pos": { layer: "satellite", label: "Retail POS", order: 12 },
  "era-clinic": { layer: "satellite", label: "Clinic", order: 13 },
  "era-logistics": { layer: "satellite", label: "Logistics", order: 14 },
  "era-construction": { layer: "satellite", label: "Construction", order: 15 },
  "era-crm": { layer: "satellite", label: "CRM", order: 16 },
  "era-auto-service": { layer: "satellite", label: "Auto Service", order: 17 },
  "era-wholesale": { layer: "satellite", label: "Wholesale", order: 18 },
};

const STATUS_ORDER = ["SHIPPED", "DONE", "LIVE", "MVP", "GA", "HEADLESS", "API", "PARTIAL", "STUB", "BLOCKED", "PLANNED", "DEFERRED", "OPEN"];

/**
 * Curated production-pilot backlog — max ROI across cores + satellites.
 * Edit here when COVERAGE / pilot priorities shift; regen HTML after changes.
 */
const TOP_PRIORITIES = [
  {
    rank: 1,
    id: "ROI-01",
    title: "Prod NBC / e-qaimə fiscal driver (`@era/fiscal`)",
    apps: ["era-finance-core", "era-hotel-pms", "era-fnb-pos", "era-retail-pos", "era-clinic", "era-auto-service"],
    category: "fiscal",
    impact: "critical",
    effort: "L",
    status: "STUB",
    coverageIds: "FIN-03 · HOT-04 · FNB-02 · CLI-24 · Ret M9",
    action: [
      "Ship prod NBC/Cybernet adapter + certification",
      "Set `ERA_FISCAL_PROVIDER` per outlet",
      "Single `@era/fiscal` package for all B2C satellites",
    ],
    unlocks: [
      "Legal AZ fiscal issuance at hotel folio",
      "FB / retail POS pay + receipt",
      "Clinic cashier + auto STO",
      "Removes #1 compliance blocker across B2C",
    ],
  },
  {
    rank: 2,
    id: "ROI-02",
    title: "Live e-taxes.gov.az VÖEN fallback (Data Hub)",
    apps: [
      "era-data-hub",
      "era-orchestrator",
      "era-finance-core",
      "era-crm",
      "era-construction",
      "era-auto-service",
      "era-wholesale",
      "era-hotel-pms",
    ],
    category: "data",
    impact: "critical",
    effort: "L",
    status: "BLOCKED",
    coverageIds: "FC-DH-006-ETAXES · IND-VOEN-01",
    action: [
      "Complete etaxes-voen-unblock-checklist ADR",
      "Wire hub live VÖEN fallback behind validate-key",
      "Enable on all `VoenLookupField` consumers",
    ],
    unlocks: [
      "Counterparty VÖEN validation in Finance",
      "Lead / supplier / agency VÖEN in CRM, Con, Auto, Wholesale, Hotel",
      "No manual tax-registry copy-paste",
    ],
  },
  {
    rank: 3,
    id: "ROI-03",
    title: "Production SMS / email (Notifications Pack)",
    apps: ["era-orchestrator", "era-hotel-pms"],
    category: "vendor",
    impact: "high",
    effort: "M",
    status: "STUB",
    coverageIds: "ORCH-04 · HOT-03",
    action: [
      "Prod Twilio/SendGrid (or AZ SMS provider) credentials",
      "Route `/platform/notifications/v1/send` off mock",
      "Hotel guest notify (H-BL-06) on prod provider",
    ],
    unlocks: [
      "Guest transactional messaging",
      "OTP and marketing hooks",
      "Platform Notifications Pack — production, not demo",
    ],
  },
  {
    rank: 4,
    id: "ROI-04",
    title: "Nafta BAR rates Excel import",
    apps: ["era-hotel-pms"],
    category: "integration",
    impact: "high",
    effort: "M",
    status: "BLOCKED",
    coverageIds: "HOT-02",
    action: [
      "Obtain Nafta Excel export file spec from property",
      "Finish BAR import wizard parser (UI partial)",
      "UAT import on staging with real export sample",
    ],
    unlocks: [
      "Nafta hotel pilot rate onboarding",
      "No manual BAR re-keying",
    ],
  },
  {
    rank: 5,
    id: "ROI-05",
    title: "SatAdmin modal CRUD parity (reference entities)",
    apps: [
      "era-fnb-pos",
      "era-retail-pos",
      "era-logistics",
      "era-construction",
      "era-crm",
      "era-auto-service",
      "era-wholesale",
    ],
    category: "ui",
    impact: "high",
    effort: "L",
    status: "PARTIAL",
    coverageIds: "LOCAL_UAT §5 · FNB-03",
    action: [
      "Per UI_PLAYBOOK_SATELLITES: list + modal CRUD per master entity",
      "Cover create / edit / delete (not read-only tables)",
      "Flip DELIVERY `[~]` → `[x]` per satellite",
    ],
    unlocks: [
      "Honest SatAdmin SHIPPED actor column",
      "Admin ops without curl",
      "Parity across FB, Ret, Log, Con, CRM, Auto, Wholesale",
    ],
  },
  {
    rank: 6,
    id: "ROI-06",
    title: "CP Workforce hire → satellite ops login (E2E UAT)",
    apps: [
      "era-orchestrator",
      "era-finance-core",
      "era-clinic",
      "era-hotel-pms",
      "era-fnb-pos",
      "era-retail-pos",
      "era-logistics",
      "era-construction",
      "era-crm",
      "era-auto-service",
      "era-wholesale",
    ],
    category: "integration",
    impact: "high",
    effort: "M",
    status: "SHIPPED",
    coverageIds: "CP-WF-HIRE-01 · CLI-WF-01",
    action: [
      "UAT-SMOKE: Workspace hire wizard per org",
      "`STAFF_PROVISIONED` → local login each vertical",
      "Matrix: clinic doctor, hotel reception, FB waiter, etc.",
    ],
    unlocks: [
      "Single HR entry via control plane",
      "No shadow local user provisioning",
      "Payroll mirror in Finance stays consistent",
    ],
  },
  {
    rank: 7,
    id: "ROI-07",
    title: "Bank CBS certification track (live rails, FMN, pentest)",
    apps: ["era-bank-core", "era-bank", "era-bank-dbo"],
    category: "compliance",
    impact: "critical",
    effort: "L",
    status: "BLOCKED",
    coverageIds: "BANK-SANC-LIVE · CERTIFICATION-TRACK",
    action: [
      "Parallel track: era-bank/doc/CERTIFICATION-TRACK.md",
      "Live payment rails (not stub)",
      "AML FMN ingest + external pentest",
    ],
    unlocks: [
      "Licensed banking pilot beyond teller UX GA",
      "Regulator-ready CBS path",
      "DBO channel on live infrastructure",
    ],
  },
  {
    rank: 8,
    id: "ROI-08",
    title: "Data Hub prod cutover (FX · calendar · reference)",
    apps: ["era-data-hub", "era-finance-core", "era-bank-core", "era-logistics", "era-hotel-pms", "era-clinic"],
    category: "data",
    impact: "high",
    effort: "M",
    status: "SHIPPED",
    coverageIds: "DH-FX-01 · FC-DH-* · HT-CAL-01 · CL-CAL-01 · LG-REF-01",
    action: [
      "Prod `ERA_DATA_HUB_DATA_SOURCE=hub`",
      "Enable `ERA_DATA_HUB_ENABLED=true` on consumers",
      "Retire stale on-prem snapshots",
      "Monitor hub SLO / CBAR ingest",
    ],
    unlocks: [
      "Single SoT for CBAR FX rates",
      "Production calendar for HR / hotel BAR / clinic scheduling",
      "HS codes and tariffs in sync across Finance, Bank, logistics",
    ],
  },
  {
    rank: 9,
    id: "ROI-09",
    title: "Clinic HL7 LIS production adapter",
    apps: ["era-clinic"],
    category: "vendor",
    impact: "medium",
    effort: "L",
    status: "STUB",
    coverageIds: "CLI-23",
    action: [
      "Vendor HL7 endpoint contract + mapping",
      "Order / result lifecycle in LIS service",
      "Keep CSV stub as fallback until cert",
    ],
    unlocks: [
      "Sanatorium lab loop without manual import",
      "Clinical pilot credibility",
    ],
  },
  {
    rank: 10,
    id: "ROI-10",
    title: "Headless payroll chains — UI smoke (timesheet → CP → Finance)",
    apps: ["era-construction", "era-logistics", "era-fnb-pos", "era-orchestrator", "era-finance-core"],
    category: "integration",
    impact: "high",
    effort: "M",
    status: "HEADLESS",
    coverageIds: "CN-CAL-02 · FB-CAL-01 · FIN-HR-ABS",
    action: [
      "Document UAT path per satellite (Con timesheet, FB labor clock)",
      "CP approve absence / timesheet in Workspace",
      "Verify Finance payroll mirror updates (no curl)",
      "Finance HR UI: read-only + banner → Workspace",
    ],
    unlocks: [
      "Construction / logistics labor → payroll chain proven",
      "FB labor → Finance HR without local calendar",
      "Closes Plan A/B/C ops gap for workforce",
    ],
  },
];

function metaFor(app) {
  return APP_META[app] ?? { layer: "other", label: app, order: 99 };
}

function inferPriority(section, text = "") {
  const hay = `${section} ${text}`;
  const p = hay.match(/\bP([0-4])\b/i);
  if (p) return `P${p[1]}`;
  const stage = hay.match(/Stage\s+(\d+)/i);
  if (stage) return `Stage ${stage[1]}`;
  const ver = hay.match(/\bv([0-9]+\.[0-9]+(?:\+)?)\b/i);
  if (ver) return `v${ver[1].replace(/^v/i, "")}`;
  if (/deferred|backlog|planned|stretch/i.test(hay)) return "Backlog";
  if (/gate|must|mvp/i.test(hay)) return "MVP";
  return "—";
}

function normalizeModuleStatus(raw) {
  const s = raw.replace(/\*\*/g, "").trim().toUpperCase();
  if (s === "DONE" || s === "LIVE" || s === "GA") return "SHIPPED";
  if (s === "MVP") return "MVP";
  if (s === "PLANNED" || s === "PROPOSED") return "PLANNED";
  if (s === "DEFERRED") return "DEFERRED";
  if (s === "STUB") return "STUB";
  return s || "—";
}

function deliveryTagToStatus(tag) {
  if (tag === "x") return "SHIPPED";
  if (tag === "~") return "API";
  if (tag === "s") return "STUB";
  if (tag === "h") return "HEADLESS";
  return "OPEN";
}

function walkDeliveryFiles() {
  const acc = [];
  function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (ent.name === "node_modules" || ent.name === ".git") continue;
        walk(full);
      } else if (/^DELIVERY.*\.md$/i.test(ent.name) && full.includes(`${path.sep}doc${path.sep}`)) {
        acc.push(full);
      }
    }
  }
  walk(root);
  return acc.sort();
}

function parseDeliveryFiles() {
  const items = [];
  for (const file of walkDeliveryFiles()) {
    const rel = path.relative(root, file).replace(/\\/g, "/");
    const app = rel.split("/")[0];
    const text = fs.readFileSync(file, "utf8");
    let section = "General";
    for (const line of text.split(/\r?\n/)) {
      const h2 = line.match(/^##\s+(.+)/);
      if (h2) {
        section = h2[1].trim();
        continue;
      }
      const h3 = line.match(/^###\s+(.+)/);
      if (h3) {
        section = h3[1].trim();
        continue;
      }
      const cb = line.match(/^-\s+\[([x~sh ])\]\s+(.+)/i);
      if (!cb) continue;
      const tag = cb[1].toLowerCase();
      const title = cb[2].replace(/<!--.*?-->/g, "").trim();
      const idMatch = title.match(/^([A-Z]{2,}(?:-[A-Z0-9]+)+)\b/);
      items.push({
        id: idMatch?.[1] ?? `${app}-${items.filter((i) => i.app === app).length + 1}`,
        source: "delivery",
        app,
        layer: metaFor(app).layer,
        group: section,
        title,
        priority: inferPriority(section, title),
        status: deliveryTagToStatus(tag),
        deliveryTag: `[${tag === " " ? " " : tag}]`,
        blocker: "",
        actors: "",
        file: rel,
      });
    }
  }
  return items;
}

function parseMarkdownTables(text, sectionApp) {
  const lines = text.split(/\r?\n/);
  const rows = [];
  let currentApp = sectionApp ?? "";
  let currentSection = "";

  for (const line of lines) {
    const sec = line.match(/^##\s+(.+)/);
    if (sec) {
      currentSection = sec[1].trim();
      const appMatch = currentSection.match(/^(era-[a-z0-9-]+)/i);
      if (appMatch) currentApp = appMatch[1].toLowerCase();
      continue;
    }
    if (!line.startsWith("|") || line.includes("---")) continue;
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((c) => c.replace(/\*\*/g, "").trim());
    if (cells.length < 2) continue;
    if (/^ID$/i.test(cells[0]) || /^Module$/i.test(cells[0]) || /^P$/i.test(cells[0])) continue;

    rows.push({ cells, currentApp, currentSection });
  }
  return rows;
}

function parseCoverageMatrix() {
  const file = path.join(root, "docs", "COVERAGE_MATRIX.md");
  const text = fs.readFileSync(file, "utf8");
  const tableRows = parseMarkdownTables(text);
  const items = [];
  const skipSections = /status taxonomy|actor columns|changelog|regeneration/i;

  for (const { cells, currentApp, currentSection } of tableRows) {
    if (skipSections.test(currentSection)) continue;

    const id = cells[0];
    if (!/^[A-Z]{2,}[-A-Z0-9]*/.test(id)) continue;
    if (/^(SHIPPED|API|STUB|HEADLESS|BLOCKED|PLANNED|PARTIAL|DONE|LIVE|MVP|GA|N\/A)$/i.test(id)) continue;

    const headerGuess = currentSection.toLowerCase();
    let app = currentApp;
    if (!app || app === "") {
      if (id.startsWith("CLI") || id.startsWith("CP-WF")) app = "era-clinic";
      else if (id.startsWith("HOT")) app = "era-hotel-pms";
      else if (id.startsWith("FNB") || id.startsWith("FB-")) app = "era-fnb-pos";
      else if (id.startsWith("FIN") || id.startsWith("FC-")) app = "era-finance-core";
      else if (id.startsWith("DH-") || id.startsWith("FC-DH")) app = "era-data-hub";
      else if (id.startsWith("BK-") || id.startsWith("BANK")) app = "era-bank";
      else if (id.startsWith("ORCH")) app = "era-orchestrator";
      else if (id.startsWith("CRM")) app = "era-crm";
      else if (id.startsWith("LG-")) app = "era-logistics";
      else if (id.startsWith("CN-")) app = "era-construction";
      else if (id.startsWith("WS-")) app = "era-wholesale";
      else if (id.startsWith("AS-")) app = "era-auto-service";
      else if (id.startsWith("HT-")) app = "era-hotel-pms";
      else if (id.startsWith("CL-")) app = "era-clinic";
      else if (headerGuess.includes("hotel")) app = "era-hotel-pms";
      else if (headerGuess.includes("finance")) app = "era-finance-core";
      else if (headerGuess.includes("orchestrator")) app = "era-orchestrator";
      else if (headerGuess.includes("clinic")) app = "era-clinic";
      else if (headerGuess.includes("crm")) app = "era-crm";
      else app = "cross-cutting";
    }

    const statusIdx = cells.findIndex((c) =>
      /^(SHIPPED|API|STUB|HEADLESS|BLOCKED|PLANNED|PARTIAL|LIVE|MVP|GA|DONE)$/i.test(c),
    );
    const status = statusIdx >= 0 ? cells[statusIdx].toUpperCase() : "—";
    const blocker = cells[cells.length - 1] ?? "";
    const title = cells[1] ?? id;
    const actors = cells
      .slice(2, statusIdx >= 0 ? statusIdx : cells.length)
      .filter((c) => c === "Y" || c.startsWith("Y "))
      .join(", ");

    items.push({
      id,
      source: "coverage",
      app,
      layer: app === "cross-cutting" ? "platform" : metaFor(app).layer,
      group: currentSection,
      title,
      priority: inferPriority(currentSection, id),
      status: status === "DONE" ? "SHIPPED" : status,
      deliveryTag: "",
      blocker: blocker === "—" ? "" : blocker,
      actors,
      file: "docs/COVERAGE_MATRIX.md",
    });
  }
  return items;
}

function parseModulesCatalog() {
  const file = path.join(root, "docs", "MODULES_CATALOG.md");
  const text = fs.readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);
  const items = [];
  let currentApp = "";
  let inMvpBacklog = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.match(/^## MVP backlog/i)) inMvpBacklog = true;
    if (line.match(/^## /) && !line.match(/^## MVP backlog/i)) inMvpBacklog = false;

    const sec = line.match(/^##\s+(era-[a-z0-9-]+)/i);
    if (sec) {
      currentApp = sec[1].toLowerCase();
      inMvpBacklog = false;
      continue;
    }

    if (!line.startsWith("|") || line.includes("---")) continue;
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((c) => c.replace(/\*\*/g, "").trim());
    if (cells.length < 3) continue;
    if (/^(Module|P|App|Feature)/i.test(cells[0])) continue;

    if (inMvpBacklog) {
      const [p, app, mod, status, work] = cells;
      if (!app?.startsWith("era-")) continue;
      items.push({
        id: `MVP-${p}-${mod}`.replace(/\s+/g, "-"),
        source: "mvp-backlog",
        app,
        layer: metaFor(app).layer,
        group: "MVP backlog (priority)",
        title: work || mod,
        priority: p?.trim() || "—",
        status: normalizeModuleStatus(status),
        deliveryTag: "",
        blocker: "",
        actors: "",
        file: "docs/MODULES_CATALOG.md",
      });
      continue;
    }

    if (!currentApp) continue;
    const statusIdx = cells.findIndex((c) =>
      /^(DONE|MVP|PLANNED|DEFERRED|STUB|LIVE|GA|PROPOSED|SHIPPED)$/i.test(c),
    );
    if (statusIdx < 0) continue;

    const id = cells[0];
    const title = cells[1] ?? id;
    const status = normalizeModuleStatus(cells[statusIdx]);

    items.push({
      id: id.length > 40 ? `${currentApp}-${i}` : id,
      source: "modules",
      app: currentApp,
      layer: metaFor(currentApp).layer,
      group: "Module catalog",
      title,
      priority: inferPriority(cells[2] ?? "", title),
      status,
      deliveryTag: "",
      blocker: cells[cells.length - 1] === status ? "" : (cells[cells.length - 1] ?? ""),
      actors: "",
      file: "docs/MODULES_CATALOG.md",
    });
  }
  return items;
}

function parseDeliverySummary() {
  const deliveryJson = execSync("node scripts/delivery-readiness.mjs --json", { cwd: root, encoding: "utf8" });
  const strictJson = execSync("node scripts/readiness-strict-delivery.mjs --json", { cwd: root, encoding: "utf8" });
  const delivery = JSON.parse(deliveryJson);
  const strict = JSON.parse(strictJson);
  const byApp = {};
  for (const r of delivery.rows) {
    const s = strict.rows.find((x) => x.app === r.app);
    byApp[r.app] = {
      deliveryPct: r.pct,
      strictPct: s?.pct ?? r.pct,
      done: r.done,
      open: r.open,
      shipped: s?.shipped ?? r.done,
      apiOnly: s?.apiOnly ?? 0,
      stub: s?.stub ?? 0,
      headless: s?.headless ?? 0,
      file: r.file,
    };
  }
  const totalDone = delivery.rows.reduce((a, r) => a + r.done, 0);
  const totalAll = delivery.rows.reduce((a, r) => a + r.total, 0);
  const totalShipped = strict.rows.reduce((a, r) => a + r.shipped, 0);
  const totalStrictDenom = strict.rows.reduce((a, r) => a + r.denominator, 0);
  return {
    generatedAt: delivery.generatedAt,
    aggregateDeliveryPct: totalAll ? Math.round((totalDone / totalAll) * 100) : 0,
    aggregateStrictPct: totalStrictDenom ? Math.round((totalShipped / totalStrictDenom) * 100) : 0,
    totalItems: totalAll,
    byApp,
  };
}

function parseIntegrationCoverage() {
  try {
    const raw = execSync("node scripts/readiness-coverage.mjs --json --consumer-only", {
      cwd: root,
      encoding: "utf8",
    });
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function buildReport() {
  const deliveryItems = parseDeliveryFiles();
  const coverageItems = parseCoverageMatrix();
  const moduleItems = parseModulesCatalog();
  const summary = parseDeliverySummary();
  const integration = parseIntegrationCoverage();

  const allItems = [...deliveryItems, ...coverageItems, ...moduleItems];

  const statusCounts = {};
  for (const item of allItems) {
    const k = item.status || "—";
    statusCounts[k] = (statusCounts[k] ?? 0) + 1;
  }

  const apps = [...new Set(allItems.map((i) => i.app))].sort(
    (a, b) => (metaFor(a).order ?? 99) - (metaFor(b).order ?? 99),
  );

  return {
    generatedAt: new Date().toISOString(),
    summary,
    integration,
    topPriorities: TOP_PRIORITIES.map((p) => ({
      ...p,
      layers: [...new Set(p.apps.map((a) => metaFor(a).layer))],
    })),
    statusCounts,
    apps: apps.map((a) => ({ id: a, ...metaFor(a) })),
    items: allItems,
    counts: {
      delivery: deliveryItems.length,
      coverage: coverageItems.length,
      modules: moduleItems.length,
      total: allItems.length,
    },
  };
}

function pctClass(pct) {
  if (pct >= 90) return "good";
  if (pct >= 70) return "mid";
  return "low";
}

function statusClass(status) {
  const s = (status || "").toUpperCase();
  if (["SHIPPED", "DONE", "LIVE", "GA"].includes(s)) return "shipped";
  if (s === "MVP") return "mvp";
  if (s === "API" || s === "PARTIAL") return "api";
  if (s === "STUB") return "stub";
  if (s === "HEADLESS") return "headless";
  if (["BLOCKED", "OPEN", "PLANNED", "DEFERRED"].includes(s)) return "blocked";
  return "neutral";
}

function renderHtml(report) {
  const dataJson = JSON.stringify(report).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>ERA — Ecosystem Readiness Report</title>
  <style>
    :root {
      --blue: #2980b9;
      --bg: #0b1220;
      --card: rgba(255,255,255,0.06);
      --text: rgba(255,255,255,0.92);
      --muted: rgba(255,255,255,0.65);
      --border: rgba(255,255,255,0.10);
      --good: #2ecc71;
      --mid: #f39c12;
      --low: #e74c3c;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
      color: var(--text);
      background: radial-gradient(1200px 700px at 15% 0%, rgba(41,128,185,0.25), transparent 55%), var(--bg);
      min-height: 100vh;
    }
    .wrap { max-width: 1440px; margin: 0 auto; padding: 24px; }
    h1 { font-size: 1.35rem; margin: 0 0 4px; }
    .sub { color: var(--muted); font-size: 0.9rem; margin-bottom: 20px; }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 20px; }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 14px 16px;
    }
    .card .label { font-size: 0.75rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
    .card .value { font-size: 1.6rem; font-weight: 700; margin-top: 4px; }
    .card .value.good { color: var(--good); }
    .card .value.mid { color: var(--mid); }
    .card .value.low { color: var(--low); }
    .filters {
      display: flex; flex-wrap: wrap; gap: 10px; align-items: end;
      background: var(--card); border: 1px solid var(--border); border-radius: 14px;
      padding: 14px 16px; margin-bottom: 16px;
    }
    .filters label { display: flex; flex-direction: column; gap: 4px; font-size: 0.75rem; color: var(--muted); }
    .filters select, .filters input {
      background: rgba(0,0,0,0.35); border: 1px solid var(--border); color: var(--text);
      border-radius: 8px; padding: 7px 10px; min-width: 140px; font-size: 0.85rem;
    }
    .filters input[type=search] { min-width: 220px; }
    .btn {
      background: var(--blue); color: #fff; border: none; border-radius: 8px;
      padding: 8px 14px; cursor: pointer; font-size: 0.85rem;
    }
    .btn.secondary { background: transparent; border: 1px solid var(--border); color: var(--muted); }
    table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
    th, td { padding: 8px 10px; border-bottom: 1px solid var(--border); text-align: left; vertical-align: top; }
    th { color: var(--muted); font-weight: 600; position: sticky; top: 0; background: #0f1728; z-index: 1; }
    .table-wrap {
      background: var(--card); border: 1px solid var(--border); border-radius: 14px;
      overflow: auto; max-height: 68vh;
    }
    .badge {
      display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 0.72rem; font-weight: 600;
    }
    .badge.shipped { background: rgba(46,204,113,0.2); color: #6ee7a0; }
    .badge.mvp { background: rgba(52,152,219,0.2); color: #7ec8f0; }
    .badge.api { background: rgba(241,196,15,0.15); color: #f7dc6f; }
    .badge.stub { background: rgba(155,89,182,0.2); color: #d7bde2; }
    .badge.headless { background: rgba(127,140,141,0.25); color: #bdc3c7; }
    .badge.blocked { background: rgba(231,76,60,0.2); color: #f5b7b1; }
    .badge.neutral { background: rgba(255,255,255,0.08); color: var(--muted); }
    .layer { font-size: 0.72rem; color: var(--muted); }
    .app-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px; margin-bottom: 20px; }
    .app-card h3 { margin: 0 0 8px; font-size: 0.95rem; }
    .bar { height: 6px; background: rgba(255,255,255,0.08); border-radius: 4px; overflow: hidden; margin-top: 6px; }
    .bar > span { display: block; height: 100%; background: var(--good); border-radius: 4px; }
    .meta { font-size: 0.72rem; color: var(--muted); }
    .integration { margin-bottom: 20px; }
    .integration table { font-size: 0.8rem; }
    h2 { font-size: 1.05rem; margin: 28px 0 12px; }
    .top10 { margin-bottom: 24px; }
    .top10 .filters { margin-bottom: 12px; }
    .rank { font-weight: 700; color: var(--blue); font-size: 0.9rem; }
    .impact-critical { color: #f5b7b1; }
    .impact-high { color: #f7dc6f; }
    .impact-medium { color: var(--muted); }
    .tag-apps { font-size: 0.72rem; color: var(--muted); margin-top: 4px; }
    .cell-lines { line-height: 1.5; vertical-align: top; }
    .cell-lines .line { display: block; padding: 1px 0; }
    footer { margin-top: 24px; color: var(--muted); font-size: 0.75rem; }
    a { color: #5dade2; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>ERA Ecosystem — Readiness Report</h1>
    <p class="sub" id="subtitle">Generated …</p>

    <div class="cards" id="summary-cards"></div>
    <div class="app-cards" id="app-cards"></div>

    <div class="integration card" id="integration-panel" hidden>
      <div class="label" style="margin-bottom:8px">Platform integration hooks (code scan)</div>
      <div class="table-wrap" style="max-height:none"><table id="integration-table"></table></div>
    </div>

    <section class="top10">
      <h2>Top-10 — production pilot ROI (all cores &amp; satellites)</h2>
      <p class="meta" style="margin-bottom:12px">Curated backlog; filter by app or category to see what matters for your pilot slice.</p>
      <div class="filters">
        <label>Application
          <select id="t-app"><option value="">All apps</option></select>
        </label>
        <label>Category
          <select id="t-category">
            <option value="">All categories</option>
            <option value="fiscal">Fiscal / compliance AZ</option>
            <option value="data">Data Hub / reference</option>
            <option value="vendor">External vendor</option>
            <option value="ui">Admin UI parity</option>
            <option value="integration">Integration / E2E</option>
            <option value="compliance">Banking compliance</option>
          </select>
        </label>
        <label>Impact
          <select id="t-impact">
            <option value="">All impacts</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
          </select>
        </label>
        <button class="btn secondary" type="button" id="t-reset">Reset</button>
      </div>
      <p class="meta" id="top10-count"></p>
      <div class="table-wrap" style="max-height:none">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>ID</th>
              <th>Item</th>
              <th>Apps</th>
              <th>Category</th>
              <th>Impact</th>
              <th>Effort</th>
              <th>Now</th>
              <th>Action</th>
              <th>Unlocks</th>
            </tr>
          </thead>
          <tbody id="top10-body"></tbody>
        </table>
      </div>
    </section>

    <h2>Full traceability matrix</h2>
    <div class="filters">
      <label>Search
        <input type="search" id="f-search" placeholder="module, ID, capability…" />
      </label>
      <label>Application
        <select id="f-app"><option value="">All apps</option></select>
      </label>
      <label>Layer
        <select id="f-layer">
          <option value="">All layers</option>
          <option value="core">Core</option>
          <option value="satellite">Satellite</option>
          <option value="banking">Banking</option>
          <option value="platform">Platform / cross-cutting</option>
        </select>
      </label>
      <label>Source
        <select id="f-source">
          <option value="">All sources</option>
          <option value="delivery">DELIVERY checkboxes</option>
          <option value="coverage">COVERAGE_MATRIX</option>
          <option value="modules">MODULES_CATALOG</option>
          <option value="mvp-backlog">MVP backlog</option>
        </select>
      </label>
      <label>Status
        <select id="f-status"><option value="">All statuses</option></select>
      </label>
      <label>Priority
        <select id="f-priority"><option value="">All priorities</option></select>
      </label>
      <button class="btn secondary" type="button" id="btn-reset">Reset filters</button>
    </div>

    <p class="meta" id="row-count"></p>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>App</th>
            <th>Layer</th>
            <th>Source</th>
            <th>Group</th>
            <th>Capability / module</th>
            <th>Priority</th>
            <th>Status</th>
            <th>Tag</th>
            <th>Blocker / notes</th>
          </tr>
        </thead>
        <tbody id="tbody"></tbody>
      </table>
    </div>

    <footer>
      Regenerate: <code>npm run report:ecosystem-readiness</code> ·
      Sources: DELIVERY*.md, COVERAGE_MATRIX.md, MODULES_CATALOG.md, readiness-coverage.mjs ·
      DELIVERY % ≠ honest SHIPPED — see <a href="COVERAGE_MATRIX.md">COVERAGE_MATRIX</a>
    </footer>
  </div>
  <script>
    const REPORT = ${dataJson};

    function badgeClass(status) {
      const s = (status || '').toUpperCase();
      if (['SHIPPED','DONE','LIVE','GA'].includes(s)) return 'shipped';
      if (s === 'MVP') return 'mvp';
      if (s === 'API' || s === 'PARTIAL') return 'api';
      if (s === 'STUB') return 'stub';
      if (s === 'HEADLESS') return 'headless';
      if (['BLOCKED','OPEN','PLANNED','DEFERRED'].includes(s)) return 'blocked';
      return 'neutral';
    }

    function pctClass(pct) {
      if (pct >= 90) return 'good';
      if (pct >= 70) return 'mid';
      return 'low';
    }

    function appLabel(id) {
      const a = REPORT.apps.find(x => x.id === id);
      return a ? a.label : id;
    }

    function renderSummary() {
      const s = REPORT.summary;
      document.getElementById('subtitle').textContent =
        'Generated ' + new Date(REPORT.generatedAt).toLocaleString('ru-RU') +
        ' · ' + REPORT.counts.total + ' tracked rows · ' + REPORT.apps.length + ' applications';

      const cards = [
        { label: 'DELIVERY aggregate', value: s.aggregateDeliveryPct + '%', cls: pctClass(s.aggregateDeliveryPct) },
        { label: 'Strict SHIPPED', value: s.aggregateStrictPct + '%', cls: pctClass(s.aggregateStrictPct) },
        { label: 'DELIVERY items', value: REPORT.counts.delivery, cls: '' },
        { label: 'Coverage rows', value: REPORT.counts.coverage, cls: '' },
        { label: 'Open / blocked', value: (REPORT.statusCounts.OPEN || 0) + (REPORT.statusCounts.BLOCKED || 0) + (REPORT.statusCounts.PLANNED || 0), cls: 'mid' },
        { label: 'STUB / API-only', value: (REPORT.statusCounts.STUB || 0) + (REPORT.statusCounts.API || 0), cls: 'mid' },
      ];
      document.getElementById('summary-cards').innerHTML = cards.map(c =>
        '<div class="card"><div class="label">' + c.label + '</div><div class="value ' + c.cls + '">' + c.value + '</div></div>'
      ).join('');

      const appHtml = Object.entries(s.byApp).sort((a,b) => {
        const oa = REPORT.apps.find(x => x.id === a[0])?.order ?? 99;
        const ob = REPORT.apps.find(x => x.id === b[0])?.order ?? 99;
        return oa - ob;
      }).map(([app, st]) => {
        const strict = st.strictPct;
        const extra = st.apiOnly || st.stub || st.headless
          ? '<div class="meta">[~]' + st.apiOnly + ' [s]' + st.stub + ' [h]' + st.headless + '</div>' : '';
        return '<div class="card app-card"><h3>' + appLabel(app) + '</h3>' +
          '<div class="meta">' + st.shipped + '/' + (st.shipped + st.open) + ' strict · ' + st.done + ' engineering</div>' +
          '<div class="bar"><span style="width:' + strict + '%"></span></div>' +
          '<div class="meta" style="margin-top:4px">Strict ' + strict + '%</div>' + extra + '</div>';
      }).join('');
      document.getElementById('app-cards').innerHTML = appHtml;
    }

    function renderIntegration() {
      const ig = REPORT.integration;
      if (!ig?.summary) return;
      document.getElementById('integration-panel').hidden = false;
      const rows = ig.summary.map(f => {
        const c = ig.summary.find ? f : f;
        return '<tr><td>' + f.title + '</td><td>' + f.consumerLabel + '</td><td>' + f.consumerPct + '%</td><td>' + f.fullLabel + ' (' + f.fullPct + '%)</td></tr>';
      }).join('');
      document.getElementById('integration-table').innerHTML =
        '<thead><tr><th>API family</th><th>Consumer apps</th><th>Consumer %</th><th>All apps</th></tr></thead><tbody>' + rows + '</tbody>';
    }

    function fillSelect(id, values) {
      const el = document.getElementById(id);
      const sorted = [...values].sort((a,b) => {
        const pa = a === '—' ? 'zzz' : a;
        const pb = b === '—' ? 'zzz' : b;
        return pa.localeCompare(pb);
      });
      for (const v of sorted) {
        const o = document.createElement('option');
        o.value = v; o.textContent = v;
        el.appendChild(o);
      }
    }

    function getFilters() {
      return {
        search: document.getElementById('f-search').value.trim().toLowerCase(),
        app: document.getElementById('f-app').value,
        layer: document.getElementById('f-layer').value,
        source: document.getElementById('f-source').value,
        status: document.getElementById('f-status').value,
        priority: document.getElementById('f-priority').value,
      };
    }

    function renderTable() {
      const f = getFilters();
      const rows = REPORT.items.filter(item => {
        if (f.app && item.app !== f.app) return false;
        if (f.layer && item.layer !== f.layer) return false;
        if (f.source && item.source !== f.source) return false;
        if (f.status && item.status !== f.status) return false;
        if (f.priority && item.priority !== f.priority) return false;
        if (f.search) {
          const hay = [item.id, item.title, item.group, item.app, item.blocker, item.actors].join(' ').toLowerCase();
          if (!hay.includes(f.search)) return false;
        }
        return true;
      });

      document.getElementById('row-count').textContent = 'Showing ' + rows.length + ' of ' + REPORT.items.length + ' rows';

      document.getElementById('tbody').innerHTML = rows.map(item => {
        const bc = badgeClass(item.status);
        return '<tr>' +
          '<td><code>' + item.id + '</code></td>' +
          '<td>' + appLabel(item.app) + '</td>' +
          '<td><span class="layer">' + item.layer + '</span></td>' +
          '<td>' + item.source + '</td>' +
          '<td class="meta">' + item.group + '</td>' +
          '<td>' + item.title + '</td>' +
          '<td>' + item.priority + '</td>' +
          '<td><span class="badge ' + bc + '">' + item.status + '</span></td>' +
          '<td>' + (item.deliveryTag || '—') + '</td>' +
          '<td class="meta">' + (item.blocker || item.actors || '—') + '</td>' +
          '</tr>';
      }).join('');
    }

    function linesHtml(items, labelFn) {
      const list = Array.isArray(items) ? items : (items ? [items] : []);
      if (!list.length) return '—';
      return list.map(item => {
        const text = labelFn ? labelFn(item) : String(item);
        return '<span class="line">' + text + '</span>';
      }).join('');
    }

    function renderTop10() {
      const app = document.getElementById('t-app').value;
      const category = document.getElementById('t-category').value;
      const impact = document.getElementById('t-impact').value;
      const rows = REPORT.topPriorities.filter(p => {
        if (app && !p.apps.includes(app)) return false;
        if (category && p.category !== category) return false;
        if (impact && p.impact !== impact) return false;
        return true;
      });
      document.getElementById('top10-count').textContent =
        'Showing ' + rows.length + ' of ' + REPORT.topPriorities.length + ' priorities';
      document.getElementById('top10-body').innerHTML = rows.map(p => {
        const apps = linesHtml(p.apps, a => appLabel(a));
        const ic = 'impact-' + p.impact;
        const bc = badgeClass(p.status);
        return '<tr>' +
          '<td class="rank">' + p.rank + '</td>' +
          '<td><code>' + p.id + '</code></td>' +
          '<td><strong>' + p.title + '</strong><div class="tag-apps">' + p.coverageIds + '</div></td>' +
          '<td class="meta cell-lines">' + apps + '</td>' +
          '<td>' + p.category + '</td>' +
          '<td class="' + ic + '">' + p.impact + '</td>' +
          '<td>' + p.effort + '</td>' +
          '<td><span class="badge ' + bc + '">' + p.status + '</span></td>' +
          '<td class="cell-lines">' + linesHtml(p.action) + '</td>' +
          '<td class="meta cell-lines">' + linesHtml(p.unlocks) + '</td>' +
          '</tr>';
      }).join('');
    }

    function initTop10() {
      const sel = document.getElementById('t-app');
      const appsInTop = [...new Set(REPORT.topPriorities.flatMap(p => p.apps))].sort((a,b) => {
        return (REPORT.apps.find(x => x.id === a)?.order ?? 99) - (REPORT.apps.find(x => x.id === b)?.order ?? 99);
      });
      for (const id of appsInTop) {
        const o = document.createElement('option');
        o.value = id; o.textContent = appLabel(id);
        sel.appendChild(o);
      }
      ['t-app','t-category','t-impact'].forEach(id => {
        document.getElementById(id).addEventListener('change', renderTop10);
      });
      document.getElementById('t-reset').addEventListener('click', () => {
        ['t-app','t-category','t-impact'].forEach(id => { document.getElementById(id).value = ''; });
        renderTop10();
      });
      renderTop10();
    }

    function init() {
      renderSummary();
      renderIntegration();
      initTop10();
      const appSel = document.getElementById('f-app');
      for (const a of REPORT.apps) {
        const o = document.createElement('option');
        o.value = a.id; o.textContent = a.label;
        appSel.appendChild(o);
      }
      fillSelect('f-status', Object.keys(REPORT.statusCounts));
      fillSelect('f-priority', [...new Set(REPORT.items.map(i => i.priority))]);
      ['f-search','f-app','f-layer','f-source','f-status','f-priority'].forEach(id => {
        document.getElementById(id).addEventListener('input', renderTable);
        document.getElementById(id).addEventListener('change', renderTable);
      });
      document.getElementById('btn-reset').addEventListener('click', () => {
        document.getElementById('f-search').value = '';
        ['f-app','f-layer','f-source','f-status','f-priority'].forEach(id => {
          document.getElementById(id).value = '';
        });
        renderTable();
      });
      renderTable();
    }
    init();
  </script>
</body>
</html>`;
}

const report = buildReport();

if (jsonOnly) {
  console.log(JSON.stringify(report, null, 2));
} else {
  fs.writeFileSync(outHtml, renderHtml(report), "utf8");
  console.log(`Wrote ${path.relative(root, outHtml)}`);
  console.log(`  ${report.counts.total} rows (${report.counts.delivery} delivery + ${report.counts.coverage} coverage + ${report.counts.modules} modules)`);
  console.log(`  DELIVERY ${report.summary.aggregateDeliveryPct}% · strict SHIPPED ${report.summary.aggregateStrictPct}%`);
}
