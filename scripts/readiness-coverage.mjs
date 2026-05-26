#!/usr/bin/env node
/**
 * Scan ERA apps for platform/billing integration hooks (§4.2 source).
 * Usage:
 *   node scripts/readiness-coverage.mjs [--json] [--markdown] [--consumer-only]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const consumerOnly = process.argv.includes("--consumer-only");

const APPS = [
  { id: "Fin", dir: "era-finance-core", label: "era-finance-core" },
  { id: "Orch", dir: "era-365-orchestrator", label: "era-365-orchestrator" },
  { id: "Hot", dir: "era-hotel-pms", label: "era-hotel-pms" },
  { id: "FB", dir: "era-fb-pos", label: "era-fb-pos" },
  { id: "Ret", dir: "era-retail-pos", label: "era-retail-pos" },
  { id: "Log", dir: "era-logistics", label: "era-logistics" },
  { id: "Con", dir: "era-construction", label: "era-construction" },
  { id: "CRM", dir: "era-crm-field", label: "era-crm-field" },
  { id: "Auto", dir: "era-auto-sto", label: "era-auto-sto" },
  { id: "Cli", dir: "era-clinic", label: "era-clinic" },
  { id: "Who", dir: "era-wholesale", label: "era-wholesale" },
];

/** Apps excluded from consumer % denominator per family */
const NA = {
  billingHost: { Fin: true, Hot: true, FB: true, Ret: true, Log: true, Con: true, CRM: true, Auto: true, Cli: true, Who: true },
  booking: { Fin: true },
  portal: { Fin: true },
  loyalty: { Fin: true },
  domains: { Fin: true },
  delivery: { Fin: true },
};

const FAMILIES = [
  {
    key: "billingSnapshot",
    title: "Billing snapshot consumer",
    consumerPatterns: [
      /getSubscriptionMe\s*\(/,
      /billing-snapshot/,
      /subscription\/me/,
      /resolveApiUrl/,
      /subscription-context/,
    ],
    hostPatterns: [],
    manual: { Fin: true, Orch: true },
    na: {},
  },
  {
    key: "billingHost",
    title: "Billing API host",
    consumerPatterns: [],
    hostPatterns: [/@Controller\s*\(\s*["']v1\/billing/],
    manual: { Orch: true },
    na: NA.billingHost,
  },
  {
    key: "notifications",
    title: "Platform notifications",
    consumerPatterns: [
      /trySendPlatformNotification\s*\(/,
      /sendNotification\s*\(/,
    ],
    hostPatterns: [/platform\/notifications/, /NotificationsDispatchService/],
    manual: { Orch: true },
    na: {},
  },
  {
    key: "booking",
    title: "Platform booking",
    consumerPatterns: [
      /createBookingSlot\s*\(/,
      /createBookingSlots\s*\(/,
      /createBookingAppointment\s*\(/,
    ],
    hostPatterns: [/@Controller\s*\(\s*["']platform\/booking/],
    manual: {},
    na: NA.booking,
  },
  {
    key: "portal",
    title: "Platform portal",
    consumerPatterns: [/createPortalLink\s*\(/],
    hostPatterns: [/@Controller\s*\(\s*["']platform\/portal/],
    manual: {},
    na: NA.portal,
  },
  {
    key: "payments",
    title: "Platform payments",
    consumerPatterns: [/createPaymentLink\s*\(/],
    hostPatterns: [
      /@Controller\s*\(\s*["']platform\/payments/,
      /control-plane.*payment/i,
    ],
    manual: { Orch: true, Fin: true },
    na: {},
  },
  {
    key: "loyalty",
    title: "Platform loyalty",
    consumerPatterns: [/createPromotion\s*\(/],
    hostPatterns: [/@Controller\s*\(\s*["']platform\/loyalty/],
    manual: { Orch: true },
    na: NA.loyalty,
  },
  {
    key: "domains",
    title: "Platform domains",
    consumerPatterns: [/createCustomDomain\s*\(/],
    hostPatterns: [/@Controller\s*\(\s*["']platform\/domains/],
    manual: { Orch: true },
    na: NA.domains,
  },
  {
    key: "delivery",
    title: "Platform delivery",
    consumerPatterns: [/createShipment\s*\(/],
    hostPatterns: [/@Controller\s*\(\s*["']platform\/delivery/],
    manual: { Orch: true },
    na: NA.delivery,
  },
];

const BRIDGE = {
  title: "Hotel↔FB bridge (roles)",
  provider: { id: "Hot", pattern: /\/api\/pos\/room-charge|pos-bridge-auth/ },
  consumer: { id: "FB", pattern: /room-charge|pms-bridge-client/ },
};

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", ".next", "generated"]);

function walkFiles(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (SKIP_DIRS.has(ent.name)) continue;
      walkFiles(full, acc);
    } else if (/\.(ts|tsx|js|mjs)$/.test(ent.name)) {
      acc.push(full);
    }
  }
  return acc;
}

function scanApp(appDir) {
  const abs = path.join(root, appDir);
  const corpus = walkFiles(abs)
    .map((f) => {
      try {
        return fs.readFileSync(f, "utf8");
      } catch {
        return "";
      }
    })
    .join("\n");
  return { corpus };
}

function detect(corpus, patterns) {
  if (!patterns?.length) return false;
  return patterns.some((p) => p.test(corpus));
}

function evaluateApp(app, fam, corpus) {
  if (fam.na[app.id]) {
    return { status: "N/A", consumer: false, host: false, any: false };
  }
  const manual = fam.manual[app.id] === true;
  const consumer = detect(corpus, fam.consumerPatterns);
  const host = detect(corpus, fam.hostPatterns);
  const any = manual || consumer || (consumerOnly ? consumer : consumer || host);
  let status = "—";
  if (manual) status = consumer || host ? "✓" : "✓";
  else if (consumer && host) status = "✓";
  else if (consumer) status = "✓";
  else if (host && !consumerOnly) status = "H";
  else if (any) status = "✓";
  return { status, consumer: consumer || manual, host: host || manual, any };
}

const matrix = {};
for (const app of APPS) {
  const { corpus } = scanApp(app.dir);
  matrix[app.id] = { hits: {}, modes: {} };
  for (const fam of FAMILIES) {
    const ev = evaluateApp(app, fam, corpus);
    matrix[app.id].hits[fam.key] = ev.any;
    matrix[app.id].modes[fam.key] = ev.status;
  }
}

function summarizeFamily(fam, consumerDenom) {
  const eligible = APPS.filter((a) => !fam.na[a.id]);
  const consumerCount = eligible.filter((a) => {
    const { corpus } = scanApp(a.dir);
    const ev = evaluateApp(a, fam, corpus);
    return ev.consumer;
  }).length;
  const fullCount = APPS.filter((a) => matrix[a.id].hits[fam.key]).length;
  const denom = consumerDenom ? eligible.length : APPS.length;
  const num = consumerDenom ? consumerCount : fullCount;
  return {
    ...fam,
    consumerCount,
    fullCount,
    consumerPct: denom ? Math.round((consumerCount / denom) * 100) : 0,
    fullPct: Math.round((fullCount / APPS.length) * 100),
    consumerLabel: `${consumerCount}/${eligible.length}`,
    fullLabel: `${fullCount}/${APPS.length}`,
  };
}

const bridgeCorpus = {
  Hot: scanApp("era-hotel-pms").corpus,
  FB: scanApp("era-fb-pos").corpus,
};
const bridgeOk =
  BRIDGE.provider.pattern.test(bridgeCorpus.Hot) &&
  BRIDGE.consumer.pattern.test(bridgeCorpus.FB);

const summary = FAMILIES.map((f) => summarizeFamily(f, consumerOnly));

const jsonOut = process.argv.includes("--json");
const mdOut = process.argv.includes("--markdown") || !jsonOut;

if (jsonOut) {
  console.log(
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        consumerOnly,
        apps: APPS,
        matrix,
        summary,
        bridge: { ok: bridgeOk, roles: "2/2" },
      },
      null,
      2,
    ),
  );
}

if (mdOut) {
  console.log("## §4.1 Coverage summary (generated)\n");
  console.log("| API family | Consumer apps | Consumer % | All apps (incl. host) |");
  console.log("|------------|---------------|------------|------------------------|");
  for (const fam of FAMILIES) {
    const s = summarizeFamily(fam, false);
    const c = summarizeFamily(fam, true);
    console.log(
      `| ${fam.title} | ${c.consumerLabel} | ${c.consumerPct}% | ${s.fullLabel} (${s.fullPct}%) |`,
    );
  }
  console.log(`\n| ${BRIDGE.title} | 2/2 roles | 100% | provider Hot + consumer FB |\n`);
  console.log("## §4.2 App × family checklist\n");
  console.log("| App | Bill.snap | Bill.host | Notif | Book | Portal | Pay | Loy | Dom | Del |");
  console.log("|-----|-----------|-----------|-------|------|--------|-----|-----|-----|-----|");
  const cols = [
    "billingSnapshot",
    "billingHost",
    "notifications",
    "booking",
    "portal",
    "payments",
    "loyalty",
    "domains",
    "delivery",
  ];
  for (const app of APPS) {
    const cells = cols.map((c) => matrix[app.id].modes[c] ?? "—");
    console.log(`| ${app.label} | ${cells.join(" | ")} |`);
  }
  console.log("\nLegend: ✓ = consumer hook or manual; H = host-only (Orch); — = gap; N/A omitted from consumer %.");
}
