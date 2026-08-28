/**
 * Patch Nafta 01-procedures.xlsx SSOT for Aug-2026 cabinet reality.
 *
 * Electro LOCATION pool is couches 7, 8, 10–13 (not 14). FIFO treats 12/13 as
 * 2-pad as well; do not hold them for `4 lü`. Four-pad is a capability filter
 * to 12/13 when free — not a second #25 SKU (canon §9).
 *
 *   node era-clinic/scripts/nafta-cutover/patch-procedures-ssot.cjs
 */
"use strict";

const fs = require("fs");
const path = require("path");

const XLSX = require(path.join(__dirname, "../../../era-hotel-pms/node_modules/xlsx"));
const SSOT = path.join("D:", "ERA-BACKUP", "NAFTA-START", "clinic", "reports", "01-procedures.xlsx");
const DESKTOP = path.join(process.env.USERPROFILE || "", "Desktop", "Nafta-procedures-cabinets.xlsx");

/** 2-pad LOCATION pool: BTL 4000 7∥8 and 10∥11 plus 12/13 (also 4-pad capable). */
const ELECTRO_CABS =
  "Kabina 7; Kabina 8; Kabina 10; Kabina 11; Kabina 12; Kabina 13";

function main() {
  const wb = XLSX.readFile(SSOT);
  let rows = XLSX.utils.sheet_to_json(wb.Sheets.procedures, { defval: "" });

  rows = rows.filter((r) => !/amplipuls\s*\/\s*elektro/i.test(String(r.nameAz || "")));

  const amp = rows.find((r) => /^amplipuls$/i.test(String(r.nameAz || "").trim()));
  const elek = rows.find((r) => /^elektroforez$/i.test(String(r.nameAz || "").trim()));
  const mergedGap = amp?.gap ?? elek?.gap ?? 5;
  const mergedDur = amp?.durationMin ?? elek?.durationMin ?? 10;

  if (!amp) {
    rows.push({
      nameAz: "Amplipuls",
      nameRu: "Амплипульс",
      durationMin: mergedDur,
      gap: mergedGap,
      cabinets: ELECTRO_CABS,
    });
  } else {
    amp.cabinets = ELECTRO_CABS;
    amp.cabinetsCount = ELECTRO_CABS.split(";").length;
  }

  if (!elek) {
    rows.push({
      nameAz: "Elektroforez",
      nameRu: "Elektroforez",
      durationMin: mergedDur,
      gap: mergedGap,
      cabinets: ELECTRO_CABS,
    });
  } else {
    elek.cabinets = ELECTRO_CABS;
    elek.cabinetsCount = ELECTRO_CABS.split(";").length;
  }

  const vak = rows.find((r) => /^vakum/i.test(String(r.nameAz || "")));
  if (vak) {
    vak.cabinets = "Kabina 1";
    vak.cabinetsCount = 1;
  }

  rows.sort((a, b) =>
    String(a.nameAz || "").localeCompare(String(b.nameAz || ""), "az", { numeric: true }),
  );
  rows = rows.map((r, i) => {
    const cabinets = String(r.cabinets || "");
    const listed = cabinets.split(/;\s*/).filter(Boolean);
    return {
      ...r,
      n: i + 1,
      cabinetsCount: listed.length,
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows, {
    header: ["n", "nameAz", "nameRu", "durationMin", "gap", "cabinetsCount", "cabinets"],
  });
  const outWb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(outWb, ws, "procedures");
  if (wb.Sheets.readme) {
    XLSX.utils.book_append_sheet(outWb, wb.Sheets.readme, "readme");
  }
  XLSX.writeFile(outWb, SSOT);
  fs.copyFileSync(SSOT, DESKTOP);

  console.log(
    JSON.stringify(
      {
        out: SSOT,
        desktop: DESKTOP,
        rows: rows.length,
        electroCabinets: ELECTRO_CABS.split(";").length,
        vakum: vak?.cabinets,
      },
      null,
      2,
    ),
  );
}

main();
