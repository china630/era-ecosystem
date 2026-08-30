"use strict";

/**
 * Move START/August and START/2026 into canonical _source folders, then remove the extra roots.
 *
 *   node era-hotel-pms/scripts/flatten-start-drops.cjs
 */

const fs = require("fs");
const path = require("path");

const START = process.env.NAFTA_START || "D:/ERA-BACKUP/NAFTA-START";
const READY = process.env.NAFTA_READY || "D:/ERA-BACKUP/NAFTA-ERA-READY";

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const from = path.join(src, name);
    const to = path.join(dest, name);
    const st = fs.statSync(from);
    if (st.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

function countFiles(dir) {
  if (!fs.existsSync(dir)) return 0;
  let n = 0;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) n += countFiles(p);
    else n += 1;
  }
  return n;
}

function rmDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function main() {
  const report = { moved: [], skipped: [] };

  const august = path.join(START, "August");
  const augustDest = path.join(START, "hotel", "_source", "ew-august-2026-08-30");
  if (fs.existsSync(august)) {
    copyDir(august, augustDest);
    const srcN = countFiles(august);
    const dstN = countFiles(augustDest);
    if (dstN < srcN) throw new Error(`August copy incomplete ${dstN} < ${srcN}`);
    rmDir(august);
    report.moved.push({ from: "August", to: "hotel/_source/ew-august-2026-08-30", files: dstN });
  } else {
    report.skipped.push("August");
  }

  const y2026 = path.join(START, "2026");
  if (fs.existsSync(y2026)) {
    for (const sub of ["999 FB", "Xudmani"]) {
      const from = path.join(y2026, sub);
      if (!fs.existsSync(from)) continue;
      const slug = sub === "999 FB" ? "ew-2026-999-fb" : "ew-2026-xudmani";
      const dest = path.join(START, "fnb", "_source", slug);
      copyDir(from, dest);
      const srcN = countFiles(from);
      const dstN = countFiles(dest);
      if (dstN < srcN) throw new Error(`${sub} copy incomplete ${dstN} < ${srcN}`);
      report.moved.push({ from: `2026/${sub}`, to: `fnb/_source/${slug}`, files: dstN });
    }
    rmDir(y2026);
  } else {
    report.skipped.push("2026");
  }

  const ready18 = path.join(READY, "clinic", "18-Hizmet-Extras.xlsx");
  const start18 = path.join(START, "clinic", "18-Hizmet-Extras.xlsx");
  const hizmetDest = path.join(START, "hotel", "_not-ready", "15-Hizmet-Tanimlari.source.xlsx");
  fs.mkdirSync(path.dirname(hizmetDest), { recursive: true });
  for (const leftover of [ready18, start18]) {
    if (!fs.existsSync(leftover)) continue;
    if (!fs.existsSync(hizmetDest)) fs.copyFileSync(leftover, hizmetDest);
    fs.unlinkSync(leftover);
    report.moved.push({ from: leftover, to: hizmetDest, files: 1 });
  }

  const readme = path.join(START, "hotel", "_source", "README.txt");
  fs.mkdirSync(path.dirname(readme), { recursive: true });
  fs.writeFileSync(
    readme,
    [
      "Raw Elektraweb drops (not wizard Apply).",
      "ew-august-2026-08-30 — FOCP / guests / notes / folio overlay already merged into hotel #09–#13.",
      "FnB raw 2026 cheques: START/fnb/_source/ew-2026-999-fb and ew-2026-xudmani (merged into #32 / named extras into #13).",
      "EW Hizmet Tanımları lives in START/hotel/_not-ready/ — not a clinic Apply book (no 0 AZN extra SKUs).",
      "",
    ].join("\n"),
    "utf8",
  );

  console.log(JSON.stringify(report, null, 2));
}

main();
