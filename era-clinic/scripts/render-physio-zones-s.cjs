/**
 * Render physio S-zone draft catalog to Markdown + CSV.
 *
 *   node scripts/render-physio-zones-s.cjs
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "prisma/seed-data/nafta/physio-zones-s.json");
const MD = path.join(ROOT, "doc/physio-zone-s-catalog.md");
const CSV = path.join(ROOT, "prisma/seed-data/nafta/physio-zones-s.csv");

function csvEscape(s) {
  const t = String(s ?? "");
  if (/[",\n\r]/.test(t)) return `"${t.replace(/"/g, '""')}"`;
  return t;
}

function main() {
  const cat = JSON.parse(fs.readFileSync(SRC, "utf8"));
  const zones = cat.zones || [];

  const md = [];
  md.push("# Physio / sanatorium site catalog (S) — zone table");
  md.push("");
  md.push("**Canon (wins on conflict):** [physio-site-canon.md](./physio-site-canon.md) · **ADR:** [clinic-physio-site-catalog.md](../../docs/adr/clinic-physio-site-catalog.md)");
  md.push("");
  md.push("**Status:** seed draft. Runtime SoR is the clinic lookup after W1, not this file.");
  md.push("");
  md.push("Doctor picks **S**. **A** (FMA/TA) is pre-bound. Sock/glove are **aliases of foot/hand**, not a separate cut field. `növbəli` / Amplipuls I–V / `4 lü` plates / MHz are order fields.");
  md.push("");
  md.push("Sources: Minzdrav USSR **817/1987**; **Shcherbak** collar+panty; hydro fill. 817 is repealed in RF (2023) but still the CIS spa vocabulary.");
  md.push("");
  md.push(`Counts: **${zones.length}** S codes. 817 §15 and §18 share sites with §14 and §17 — not extra codes.`);
  md.push("");
  md.push("Data: `prisma/seed-data/nafta/physio-zones-s.json` (seed only). Unmatched WO: [physio-zone-s-coverage.md](./physio-zone-s-coverage.md).");
  md.push("");
  if (cat.closedDecisions && cat.closedDecisions.length) {
    md.push("## Closed catalog rules");
    md.push("");
    for (const d of cat.closedDecisions) {
      md.push(`- **${d.id}:** ${d.decision} ${d.why}`);
    }
    md.push("");
  }
  md.push("## S zones");
  md.push("");
  md.push("| Code | Kind | 817 | Laterality | AZ (draft) | RU | LA | Coarse | WO aliases |");
  md.push("|------|------|----:|:----------:|------------|----|----|--------|------------|");
  for (const z of zones) {
    const aliases = (z.woAliases || []).join("; ").replace(/\|/g, "/");
    md.push(
      `| \`${z.code}\` | ${z.kind} | ${z.prikaz817 ?? "—"} | ${z.laterality ? "yes" : "—"} | ${z.titleAz} | ${z.titleRu} | *${z.titleLa}* | ${(z.coarse || []).join(", ")} | ${aliases} |`,
    );
  }
  md.push("");
  md.push("## A underlay (FMA/TA hints)");
  md.push("");
  md.push("| S | Anatomy | TA | FMA id |");
  md.push("|---|---------|----|--------|");
  for (const z of zones) {
    for (const a of z.anatomy || []) {
      md.push(`| \`${z.code}\` | ${a.fmaLabel} | *${a.ta}* | ${a.fmaId || "TBD BioPortal"} |`);
    }
  }
  md.push("");
  md.push("FMA ids are lookup hints — confirm before seed. Not SNOMED.");
  md.push("");
  md.push("## Not zones (stay on the order)");
  md.push("");
  md.push("| Code | Meaning | WO text |");
  md.push("|------|---------|---------|");
  for (const x of cat.orderFieldsNotZones || []) {
    md.push(`| \`${x.code}\` | ${x.meaning} | ${(x.wo || []).join(", ")} |`);
  }
  md.push("");
  if (cat.naftaResourceSketch) {
    const r = cat.naftaResourceSketch;
    md.push("## Resource occupancy (planning, not schema)");
    md.push("");
    md.push(`Status: **${r.status}**. Electro rooms: ${(r.electroRooms || []).join(", ")}. US rooms: ${(r.usRooms || []).join(", ")}. Not in ERA: ${(r.notInEra || []).join(", ")}.`);
    md.push("");
    if (Array.isArray(r.units) && r.units.length) {
      md.push("| Unit | Model | Rooms | Outputs | Paws/out | 2-pad | 4-pad | Parallel |");
      md.push("|------|-------|-------|---------|----------|-------|-------|----------|");
      for (const u of r.units) {
        const two = u.twoPad === false ? "no" : "yes";
        md.push(
          `| \`${u.id}\` | ${u.model} | ${(u.rooms || []).join(", ")} | ${u.outputs} | ${u.pawsPerOutput} | ${two} | ${u.fourPad ? "yes" : "no"} | ${u.parallel} |`,
        );
      }
      md.push("");
      for (const u of r.units) {
        if (u.wiring) md.push(`- **${u.model}** (${(u.rooms || []).join("+")}): ${u.wiring}`);
      }
      md.push("");
    }
    if (r.electrodeRouting) {
      const er = r.electrodeRouting;
      md.push(
        `2-pad rooms: ${(er.twoPadRooms || []).join(", ")}. 4-pad capability: ${(er.fourPadOnlyRooms || []).join(", ")}.`,
      );
      md.push("");
      if (er.placement) {
        md.push(er.placement);
        md.push("");
      }
      if (er.note) {
        md.push(er.note);
        md.push("");
      }
    }
    if (r.staff) {
      md.push(r.staff);
      md.push("");
    }
    if (r.devicesNote) {
      md.push(r.devicesNote);
      md.push("");
    }
    if (r.occupancy) {
      md.push(r.occupancy);
      md.push("");
    }
    if (r.procedureTypes) {
      md.push(r.procedureTypes);
      md.push("");
    }
    if (r.cutoverExcel) {
      md.push(r.cutoverExcel);
      md.push("");
    }
  }

  md.push("## Multi-site WO lines");
  md.push("");
  md.push("Match S **after** stripping order-field tokens. One WO string → several S chips:");
  md.push("");
  md.push("| WO (normalized) | S chips | Flags |");
  md.push("|-----------------|---------|-------|");
  for (const row of cat.compositeMaps || []) {
    md.push(`| ${row.wo} | ${(row.chips || []).map((c) => `\`${c}\``).join(" + ")} | ${(row.flags || []).join(", ") || "—"} |`);
  }
  md.push("");

  fs.writeFileSync(MD, md.join("\n"), "utf8");

  const cols = [
    "code",
    "kind",
    "prikaz817",
    "laterality",
    "titleAz",
    "titleRu",
    "titleEn",
    "titleLa",
    "coarse",
    "ta",
    "fmaLabels",
    "woAliases",
    "boundary",
  ];
  const lines = [cols.join(",")];
  for (const z of zones) {
    const row = {
      code: z.code,
      kind: z.kind,
      prikaz817: z.prikaz817 ?? "",
      laterality: z.laterality ? "1" : "0",
      titleAz: z.titleAz,
      titleRu: z.titleRu,
      titleEn: z.titleEn,
      titleLa: z.titleLa,
      coarse: (z.coarse || []).join("|"),
      ta: (z.anatomy || []).map((a) => a.ta).join("|"),
      fmaLabels: (z.anatomy || []).map((a) => a.fmaLabel).join("|"),
      woAliases: (z.woAliases || []).join("|"),
      boundary: z.boundary,
    };
    lines.push(cols.map((c) => csvEscape(row[c])).join(","));
  }
  fs.writeFileSync(CSV, lines.join("\n"), "utf8");
  console.log(JSON.stringify({ md: MD, csv: CSV, zones: zones.length }, null, 2));
}

main();
