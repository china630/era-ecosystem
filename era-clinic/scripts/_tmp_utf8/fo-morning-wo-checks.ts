/**
 * Lightweight FO follow-up counts from WO cards (no heavy matcher unless needed).
 *   npx tsx scripts/_tmp_utf8/fo-morning-wo-checks.ts
 */
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { normalizeCatalogName } from "../../src/lib/import/seed-catalog-match";

const require = createRequire(import.meta.url);
const { buildMatcher } = require("../nafta-cutover/nahiye-s-match.cjs") as {
  buildMatcher: (cat: unknown) => {
    match: (text: string, opts?: { procedureName?: string }) => { chips: string[]; flags: string[] };
  };
};
const { loadMergedPhysioZonesCatalog } = require("../../src/domain/physio/physio-catalog-layers.cjs") as {
  loadMergedPhysioZonesCatalog: (root: string) => unknown;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const CARDS = "D:/ERA-BACKUP/NAFTA-START/clinic/dump/cards";

const cat = loadMergedPhysioZonesCatalog(root);
const matcher = buildMatcher(cat);
const fold = (s: string) => normalizeCatalogName(s);

const dayHits: Record<string, number> = {};
const dayFiveByProc: Record<string, number> = {};
const dayTwoByProc: Record<string, number> = {};
const gunasiriByProc: Record<string, number> = {};
const infraZones: Record<string, number> = {};
const trigger: Array<{ proc: string; nahiye: string }> = [];
const isiqFlags: Record<string, number> = {};
const isiqTexts: Record<string, number> = {};
let isiqEmpty = 0;
let isiqRows = 0;
let infraRows = 0;

const files = fs.readdirSync(CARDS).filter((f) => f.endsWith(".json"));
for (const f of files) {
  let json: { slices?: { procedures?: Array<{ nahiye?: unknown; treatmentName?: string | null }> } };
  try {
    json = JSON.parse(fs.readFileSync(path.join(CARDS, f), "utf8"));
  } catch {
    continue;
  }
  const slices = json.slices?.procedures;
  if (!Array.isArray(slices)) continue;
  for (const node of slices) {
    if (!node || !Object.prototype.hasOwnProperty.call(node, "nahiye")) continue;
    const tName = String(node.treatmentName || "").trim();
    const raw = node.nahiye == null ? "" : String(node.nahiye).trim();
    const rawFold = fold(raw);
    const nameFold = fold(tName);

    const bumpDay = (label: string, re: RegExp) => {
      if (re.test(rawFold) || re.test(nameFold)) {
        dayHits[label] = (dayHits[label] || 0) + 1;
        return true;
      }
      return false;
    };
    if (bumpDay("5_gun", /\b5\s*gun\b/)) dayFiveByProc[tName] = (dayFiveByProc[tName] || 0) + 1;
    if (bumpDay("3_gun", /\b3\s*gun\b/)) {
      /* counted */
    }
    if (bumpDay("2_gun", /\b2\s*gun\b/)) dayTwoByProc[tName] = (dayTwoByProc[tName] || 0) + 1;
    if (bumpDay("gunasiri", /gunasiri|guna\s*siri|gun\s*asiri/)) {
      gunasiriByProc[tName] = (gunasiriByProc[tName] || 0) + 1;
    }

    if (/triqqer|trigger|triger|triqqezon|triqqerzon/.test(nameFold + " " + rawFold)) {
      trigger.push({ proc: tName, nahiye: raw.slice(0, 160) });
    }

    const isInfra = /infraqirmizi/.test(nameFold) || /^infra\b/.test(nameFold);
    const isSol = /sollyuks|solyuks/.test(nameFold);
    const isIsiq = /isiq\s*vann/.test(nameFold);

    if ((isInfra || isSol) && raw) {
      infraRows += 1;
      const m = matcher.match(raw, { procedureName: tName });
      for (const c of m.chips) infraZones[c] = (infraZones[c] || 0) + 1;
    }

    if (isIsiq) {
      isiqRows += 1;
      if (!raw) {
        isiqEmpty += 1;
        continue;
      }
      const m = matcher.match(raw, { procedureName: tName });
      for (const fl of m.flags) isiqFlags[fl] = (isiqFlags[fl] || 0) + 1;
      if (/naft|yag|yağ|surt|smear/i.test(raw)) isiqFlags["TEXT_NAFT_OR_OIL"] = (isiqFlags["TEXT_NAFT_OR_OIL"] || 0) + 1;
      if (/yungul|zeif|isti|intensiv|derece/.test(rawFold)) {
        isiqFlags["TEXT_INTENSITY_LIKE"] = (isiqFlags["TEXT_INTENSITY_LIKE"] || 0) + 1;
      }
      isiqTexts[raw] = (isiqTexts[raw] || 0) + 1;
    }
  }
}

const out = {
  dayHits,
  dayFiveTop: Object.entries(dayFiveByProc).sort((a, b) => b[1] - a[1]).slice(0, 15),
  dayTwoTop: Object.entries(dayTwoByProc).sort((a, b) => b[1] - a[1]).slice(0, 10),
  gunasiriTop: Object.entries(gunasiriByProc).sort((a, b) => b[1] - a[1]).slice(0, 10),
  infraRows,
  infraZones: Object.entries(infraZones).sort((a, b) => b[1] - a[1]),
  triggerCount: trigger.length,
  triggerSample: trigger.slice(0, 25),
  triggerProcNames: [...new Set(trigger.map((t) => t.proc))],
  isiqRows,
  isiqEmpty,
  isiqFlags,
  isiqTextsTop: Object.entries(isiqTexts).sort((a, b) => b[1] - a[1]).slice(0, 30),
};

const outPath = path.join(root, "scripts/_tmp_utf8/_fo-morning-wo-checks.json");
fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");
console.log(JSON.stringify(out, null, 2));
console.log("wrote", outPath);
