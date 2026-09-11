/**
 * List İnfraqırmızı (and Sollyuks) nahiye rows where matcher raised
 * SUBSTANCE_OR_ADDITIVE or EXTRA_OIL — for FO review.
 *
 *   npx tsx scripts/_tmp_utf8/dump-infra-substance-hits.ts
 */
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { normalizeCatalogName, matchProcedureToSeed } from "../../src/lib/import/seed-catalog-match";

const require = createRequire(import.meta.url);
const { buildMatcher } = require("../nafta-cutover/nahiye-s-match.cjs") as {
  buildMatcher: (cat: unknown) => {
    match: (
      text: string,
      opts?: { procedureName?: string },
    ) => { flags: string[]; chips: string[]; residue: string };
  };
};
const { loadMergedPhysioZonesCatalog } = require("../../src/domain/physio/physio-catalog-layers.cjs") as {
  loadMergedPhysioZonesCatalog: (root: string) => unknown;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const CARDS = "D:/ERA-BACKUP/NAFTA-START/clinic/dump/cards";

const procs = JSON.parse(
  fs.readFileSync(path.join(root, "prisma/seed-data/nafta/procedure-types.json"), "utf8"),
) as Array<{ code: string; name: string }>;

const TARGET = new Set(["SVC-INFRAQIRMIZI", "SVC-SOLLYUKS"]);
const FLAGS = new Set(["SUBSTANCE_OR_ADDITIVE", "EXTRA_OIL"]);

function resolveProc(treatmentName: string): { code: string; name: string } | null {
  const hit = matchProcedureToSeed(treatmentName, procs);
  if (hit) return hit;
  const norm = normalizeCatalogName(treatmentName);
  const alias: Record<string, string> = {
    infraqirmizi: "SVC-INFRAQIRMIZI",
    sollyuks: "SVC-SOLLYUKS",
    solyuks: "SVC-SOLLYUKS",
  };
  const code = alias[norm];
  if (!code) return null;
  return procs.find((p) => p.code === code) ?? null;
}

const cat = loadMergedPhysioZonesCatalog(root);
const matcher = buildMatcher(cat);

type Hit = {
  card: string;
  procedure: string;
  code: string;
  nahiye: string;
  flags: string[];
  residue: string;
};

const hits: Hit[] = [];

for (const f of fs.readdirSync(CARDS).filter((x) => x.endsWith(".json"))) {
  let json: {
    slices?: { procedures?: Array<{ nahiye?: unknown; treatmentName?: string | null }> };
  };
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
    const resolved = resolveProc(tName);
    if (!resolved || !TARGET.has(resolved.code)) continue;
    const raw = node.nahiye == null ? "" : String(node.nahiye).trim();
    if (!raw) continue;
    const m = matcher.match(raw, { procedureName: tName });
    const hitFlags = m.flags.filter((x) => FLAGS.has(x));
    if (!hitFlags.length) continue;
    hits.push({
      card: f,
      procedure: resolved.name,
      code: resolved.code,
      nahiye: raw,
      flags: hitFlags,
      residue: m.residue || "",
    });
  }
}

hits.sort((a, b) => a.procedure.localeCompare(b.procedure, "az") || a.nahiye.localeCompare(b.nahiye, "az"));

const byProc = new Map<string, Hit[]>();
for (const h of hits) {
  const list = byProc.get(h.procedure) ?? [];
  list.push(h);
  byProc.set(h.procedure, list);
}

const lines: string[] = [];
lines.push(`# İnfraqırmızı / Sollyuks — WO hits: препарат / доп. масло`);
lines.push(`Generated from ${CARDS}. Total rows: ${hits.length}.`);
lines.push("");

for (const [proc, list] of [...byProc.entries()].sort((a, b) => a[0].localeCompare(b[0], "az"))) {
  lines.push(`## ${proc} (${list.length})`);
  lines.push("");
  const uniq = new Map<string, { n: number; flags: Set<string>; sampleCard: string }>();
  for (const h of list) {
    const key = h.nahiye;
    const cur = uniq.get(key) ?? { n: 0, flags: new Set<string>(), sampleCard: h.card };
    cur.n += 1;
    for (const f of h.flags) cur.flags.add(f);
    uniq.set(key, cur);
  }
  const sorted = [...uniq.entries()].sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0], "az"));
  for (const [text, info] of sorted) {
    lines.push(`- **×${info.n}** [${[...info.flags].join("+")}] \`${text.replace(/`/g, "'")}\``);
  }
  lines.push("");
}

const outMd = path.join(root, "doc/_tmp_infra-sollyuks-substance-hits.md");
fs.writeFileSync(outMd, lines.join("\n"), "utf8");

const outJson = path.join(root, "scripts/_tmp_utf8/_infra-substance-hits.json");
fs.writeFileSync(outJson, JSON.stringify({ total: hits.length, hits }, null, 2), "utf8");

console.log("wrote", outMd);
console.log("wrote", outJson);
for (const [proc, list] of byProc) {
  console.log(proc, list.length);
}
