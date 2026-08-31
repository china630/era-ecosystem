"use strict";

/**
 * One-shot: rename/move NAFTA-ERA-READY + numbered START files to pack-layout.cjs.
 *
 *   node era-clinic/scripts/nafta-cutover/apply-pack-layout.cjs
 */

const fs = require("fs");
const path = require("path");

const READY = process.env.NAFTA_READY || path.join("D:", "ERA-BACKUP", "NAFTA-ERA-READY");
const START = process.env.NAFTA_START || path.join("D:", "ERA-BACKUP", "NAFTA-START");

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function moveFile(src, dest) {
  if (!fs.existsSync(src)) {
    console.log("skip missing", src);
    return false;
  }
  ensureDir(path.dirname(dest));
  if (path.resolve(src) === path.resolve(dest)) {
    console.log("same", dest);
    return true;
  }
  if (fs.existsSync(dest)) fs.unlinkSync(dest);
  fs.renameSync(src, dest);
  console.log("mv", src, "->", dest);
  return true;
}

function copyFile(src, dest) {
  if (!fs.existsSync(src)) {
    console.log("skip missing copy", src);
    return false;
  }
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
  console.log("cp", src, "->", dest);
  return true;
}

function rmFile(p) {
  if (fs.existsSync(p) && fs.statSync(p).isFile()) {
    fs.unlinkSync(p);
    console.log("rm", p);
  }
}

function rmDirIfEmpty(p) {
  if (!fs.existsSync(p)) return;
  const names = fs.readdirSync(p).filter((n) => n !== "." && n !== "..");
  if (!names.length) {
    fs.rmdirSync(p);
    console.log("rmdir", p);
  }
}

/** Stage via READY/_layout_tmp to avoid number collisions. */
function stageMoves(root, pairs) {
  const stage = path.join(root, "_layout_tmp");
  if (fs.existsSync(stage)) fs.rmSync(stage, { recursive: true, force: true });
  ensureDir(stage);
  const staged = [];
  for (const [fromRel, toRel] of pairs) {
    const src = path.join(root, fromRel);
    if (!fs.existsSync(src)) {
      console.log("skip missing", src);
      continue;
    }
    const tmp = path.join(stage, toRel);
    ensureDir(path.dirname(tmp));
    fs.renameSync(src, tmp);
    staged.push(toRel);
    console.log("stage", fromRel, "->", toRel);
  }
  for (const toRel of staged) {
    const tmp = path.join(stage, toRel);
    const dest = path.join(root, toRel);
    ensureDir(path.dirname(dest));
    if (fs.existsSync(dest)) fs.unlinkSync(dest);
    fs.renameSync(tmp, dest);
  }
  fs.rmSync(stage, { recursive: true, force: true });
}

function main() {
  const readyPairs = [
    ["hr/org-structure.xlsx", "hr/01-Org-Structure.xlsx"],
    ["hr/37-Employees.xlsx", "hr/02-Employees.xlsx"],
    ["hotel/01-Revenue-Codes.xlsx", "hotel/03-Revenue-Codes.xlsx"],
    ["hotel/02-Bed-Types.xlsx", "hotel/04-Bed-Types.xlsx"],
    ["hotel/03-Room-Views.xlsx", "hotel/05-Room-Views.xlsx"],
    ["hotel/04-Room-Types.xlsx", "hotel/06-Room-Types.xlsx"],
    ["hotel/06-Rate-Codes.xlsx", "hotel/07-Rate-Codes.xlsx"],
    ["hotel/05-Rooms.xlsx", "hotel/08-Rooms.xlsx"],
    ["hotel/07-Travel-Agencies.xlsx", "hotel/09-Travel-Agencies.xlsx"],
    ["hotel/10-Guest-Cards.merged.xlsx", "hotel/10-Guest-Cards.xlsx"],
    ["hotel/11-Reservations.merged.xlsx", "hotel/11-Reservations.xlsx"],
    ["hotel/19-Agency-Statement.xlsx", "hotel/15-Agency-Statement.xlsx"],
    ["hotel/08-Product-Cards.xlsx", "fnb/31-Product-Cards.xlsx"],
    ["hotel/08-Product-Group-List.xlsx", "fnb/30-Product-Group-List.xlsx"],
    ["hotel/09-Stock-Cards.xlsx", "retail/33-Stock-Cards.xlsx"],
    ["hotel/16-FnB-Transactions.merged.xlsx", "fnb/32-FnB-Transactions.xlsx"],
    ["clinic/25-Treatments.xlsx", "clinic/19-Treatments.xlsx"],
    ["clinic/26-Rooms.xlsx", "clinic/20-Clinic-Rooms.xlsx"],
    ["clinic/40-Procedure-Requirements.xlsx", "clinic/21-Procedure-Requirements.xlsx"],
    ["clinic/27-Doctors.xlsx", "clinic/22-Doctors.xlsx"],
    ["clinic/21-patients.xlsx", "clinic/24-Patients.xlsx"],
    ["clinic/38-quotas.xlsx", "clinic/25-Quotas.xlsx"],
    ["clinic/23-slots.xlsx", "clinic/26-Slots.xlsx"],
    ["clinic/24-lab-orders.xlsx", "clinic/27-Lab-Orders.xlsx"],
    ["clinic/39-lab-results.xlsx", "clinic/28-Lab-Results.xlsx"],
    ["clinic/31-Diagnostics.xlsx", "clinic/29-Diagnostics.xlsx"],
    ["1c/44-1C-Counterparties.xlsx", "1c/38-1C-Counterparties.xlsx"],
    ["1c/50-1C-Fixed-Assets.xlsx", "1c/44-1C-Fixed-Assets.xlsx"],
  ];
  stageMoves(READY, readyPairs);

  const folioSrc = path.join(READY, "hotel", "folio-upload");
  const folioDest = path.join(READY, "hotel", "13-folio-parts");
  ensureDir(folioDest);
  if (fs.existsSync(folioSrc)) {
    for (const name of fs.readdirSync(folioSrc)) {
      const m = name.match(/^12-Folio-Transactions\.hotel-(p\d+|slim)\.xlsx$/i);
      if (m) {
        const destName = m[1].toLowerCase() === "slim" ? "13-Folio-slim.xlsx" : `13-Folio-${m[1].toLowerCase()}.xlsx`;
        moveFile(path.join(folioSrc, name), path.join(folioDest, destName));
      }
    }
    rmFile(path.join(folioSrc, "README.json"));
    rmDirIfEmpty(folioSrc);
  }

  const hotelXlsx = path.join(READY, "hotel", "12-Folio-Transactions.hotel.xlsx");
  const startHotelFiltered = path.join(START, "hotel", "13-Folio-Transactions.hotel.xlsx");
  if (fs.existsSync(hotelXlsx)) {
    copyFile(hotelXlsx, startHotelFiltered);
    rmFile(hotelXlsx);
  }
  rmFile(path.join(READY, "hotel", "12-Folio-Transactions.hotel.summary.json"));
  rmFile(path.join(READY, "hotel", "12-Folio-Transactions.merged.xlsx"));
  rmFile(path.join(READY, "hotel", "10-Guest-Cards.merged.summary.json"));
  rmFile(path.join(READY, "hotel", "14-BAR-Derived-2026.csv"));
  rmFile(path.join(READY, "hotel", "14-BAR-Derived-2026.md"));
  rmFile(path.join(READY, "hotel", "13-Package-Prices-2026.csv"));
  rmFile(path.join(READY, "hotel", "17-ProFolio-Transactions.xlsx"));
  rmFile(path.join(READY, "hotel", "18-Contract-Details.xlsx"));
  rmFile(path.join(READY, "hotel", "20-DO-NOT-IMPORT-Chart-of-Accounts.xlsx"));
  rmFile(path.join(READY, "clinic", "29-Analyses.xlsx"));
  rmFile(path.join(READY, "clinic", "32-Diagnoses.xlsx"));
  rmFile(path.join(READY, "clinic", "18-Hizmet-Extras.xlsx"));
  rmFile(path.join(READY, "1c", "53-1C-Procedure-Consumables.docx"));
  const refDir = path.join(READY, "clinic", "ref");
  if (fs.existsSync(refDir)) {
    for (const n of fs.readdirSync(refDir)) rmFile(path.join(refDir, n));
    rmDirIfEmpty(refDir);
  }
  for (const n of fs.readdirSync(path.join(READY, "hotel"))) {
    if (n.startsWith("~$")) rmFile(path.join(READY, "hotel", n));
  }

  ensureDir(path.join(START, "fnb"));
  ensureDir(path.join(START, "retail"));
  ensureDir(path.join(START, "hotel", "_not-ready"));

  const startPairs = [
    ["hr/37-Employees.xlsx", "hr/02-Employees.xlsx"],
    ["hotel/01-Revenue-Codes.xlsx", "hotel/03-Revenue-Codes.xlsx"],
    ["hotel/02-Bed-Types.xlsx", "hotel/04-Bed-Types.xlsx"],
    ["hotel/03-Room-Views.xlsx", "hotel/05-Room-Views.xlsx"],
    ["hotel/04-Room-Types.xlsx", "hotel/06-Room-Types.xlsx"],
    ["hotel/06-Rate-Codes.xlsx", "hotel/07-Rate-Codes.xlsx"],
    ["hotel/05-Rooms.xlsx", "hotel/08-Rooms.xlsx"],
    ["hotel/07-Travel-Agencies.xlsx", "hotel/09-Travel-Agencies.xlsx"],
    ["hotel/10-Guest-Cards.merged.xlsx", "hotel/10-Guest-Cards.xlsx"],
    ["hotel/11-Reservations.merged.xlsx", "hotel/11-Reservations.xlsx"],
    ["hotel/12-Folio-Transactions.merged.xlsx", "hotel/13-Folio-Transactions.merged.xlsx"],
    ["hotel/13-Package-Prices-2026.csv", "hotel/14-Package-Prices-2026.csv"],
    ["hotel/19-Agency-Statement.xlsx", "hotel/15-Agency-Statement.xlsx"],
    ["hotel/08-Product-Cards.xlsx", "fnb/31-Product-Cards.xlsx"],
    ["hotel/08-Product-Group-List.xlsx", "fnb/30-Product-Group-List.xlsx"],
    ["hotel/09-Stock-Cards.xlsx", "retail/33-Stock-Cards.xlsx"],
    ["hotel/16-FnB-Transactions.merged.xlsx", "fnb/32-FnB-Transactions.xlsx"],
    ["1c/44-1C-Counterparties.xlsx", "1c/38-1C-Counterparties.xlsx"],
    ["1c/50-1C-Fixed-Assets.xlsx", "1c/44-1C-Fixed-Assets.xlsx"],
    ["1c/53-1C-Procedure-Consumables.docx", "1c/47-1C-Procedure-Consumables.docx"],
  ];
  stageMoves(START, startPairs);

  const notReady = [
    ["hotel/14-BAR-Derived-2026.csv", "hotel/_not-ready/BAR-Derived-2026.csv"],
    ["hotel/14-BAR-Derived-2026.md", "hotel/_not-ready/BAR-Derived-2026.md"],
    ["hotel/17-ProFolio-Transactions.xlsx", "hotel/_not-ready/17-ProFolio-Transactions.xlsx"],
    ["hotel/18-Contract-Details.xlsx", "hotel/_not-ready/18-Contract-Details.xlsx"],
    ["hotel/20-DO-NOT-IMPORT-Chart-of-Accounts.xlsx", "hotel/_not-ready/20-DO-NOT-IMPORT-Chart-of-Accounts.xlsx"],
    ["hotel/15-Hizmet-Tanimlari.xlsx", "hotel/_not-ready/15-Hizmet-Tanimlari.source.xlsx"],
    ["hotel/15-Hizmet-Tanimlari.2026-08-21.source.xlsx", "hotel/_not-ready/15-Hizmet-Tanimlari.source.xlsx"],
    ["hotel/10-Guest-Cards.merged.summary.json", "hotel/_not-ready/10-Guest-Cards.summary.json"],
  ];
  for (const [fromRel, toRel] of notReady) {
    moveFile(path.join(START, fromRel), path.join(START, toRel));
  }

  const mirror = path.join(START, "clinic", "reports", "era-import");
  if (fs.existsSync(mirror)) {
    const mirrorPairs = [
      ["25-Treatments.xlsx", "19-Treatments.xlsx"],
      ["26-Rooms.xlsx", "20-Clinic-Rooms.xlsx"],
      ["40-Procedure-Requirements.xlsx", "21-Procedure-Requirements.xlsx"],
      ["27-Doctors.xlsx", "22-Doctors.xlsx"],
    ];
    stageMoves(mirror, mirrorPairs);
  }

  console.log("layout apply done");
}

main();
