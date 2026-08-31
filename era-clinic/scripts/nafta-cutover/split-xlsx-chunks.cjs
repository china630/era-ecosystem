"use strict";

/**
 * Split an existing READY workbook into p01, p02, … chunks for the import wizard.
 *
 *   node era-clinic/scripts/nafta-cutover/split-xlsx-chunks.cjs --in D:\ERA-BACKUP\NAFTA-ERA-READY\clinic\26-Slots.xlsx
 *   node era-clinic/scripts/nafta-cutover/split-xlsx-chunks.cjs --in …\26-Slots.xlsx --rows 5000 --replace
 */

const fs = require("fs");
const path = require("path");
const { CHUNK_ROWS, writeSheet, chunkPath, removeStaleChunks } = require("./xlsx-write.cjs");

function loadXlsx() {
  const candidates = [
    path.join(__dirname, "../../node_modules/xlsx"),
    path.join(__dirname, "../../../era-hotel-pms/node_modules/xlsx"),
    "xlsx",
  ];
  for (const c of candidates) {
    try {
      return require(c);
    } catch {
      /* next */
    }
  }
  throw new Error("xlsx package not found");
}

function arg(name, fallback) {
  const argv = process.argv.slice(2);
  const eq = argv.find((a) => a.startsWith(`${name}=`));
  if (eq) return eq.slice(name.length + 1);
  const i = argv.indexOf(name);
  if (i >= 0) return argv[i + 1];
  return fallback;
}

function main() {
  const inFile = arg("--in");
  if (!inFile) {
    console.error("Usage: node split-xlsx-chunks.cjs --in <file.xlsx> [--rows 5000] [--replace]");
    process.exit(1);
  }
  const abs = path.resolve(inFile);
  if (!fs.existsSync(abs)) {
    console.error("Missing file:", abs);
    process.exit(1);
  }
  const chunkRows = Number(arg("--rows", String(CHUNK_ROWS))) || CHUNK_ROWS;
  const replace = process.argv.includes("--replace");
  const XLSX = loadXlsx();
  const wb = XLSX.readFile(abs, { cellDates: true });
  const sheetName = wb.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: "", raw: false });
  if (rows.length === 0) {
    console.error("No data rows");
    process.exit(1);
  }
  const headers = Object.keys(rows[0]);
  removeStaleChunks(abs);
  if (rows.length <= chunkRows) {
    console.log(JSON.stringify({ inFile: abs, rows: rows.length, files: 1, skipped: "already under chunk size" }));
    return;
  }
  const written = [];
  let part = 1;
  for (let i = 0; i < rows.length; i += chunkRows) {
    const dest = chunkPath(abs, part);
    const n = writeSheet(XLSX, dest, headers, rows.slice(i, i + chunkRows));
    written.push({ file: dest, rows: n });
    part += 1;
  }
  if (replace) {
    const bak = `${abs}.full.bak`;
    fs.renameSync(abs, bak);
  }
  console.log(
    JSON.stringify(
      {
        inFile: abs,
        rows: rows.length,
        chunkRows,
        files: written.length,
        written: written.map((w) => path.basename(w.file)),
        replaced: replace,
      },
      null,
      2,
    ),
  );
}

main();
