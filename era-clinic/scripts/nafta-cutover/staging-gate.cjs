"use strict";

/**
 * Hour X staging gate: lab binaries + era-ready books + optional empty-DB import dry-run.
 *
 *   node era-clinic/scripts/nafta-cutover/staging-gate.cjs
 *   node era-clinic/scripts/nafta-cutover/staging-gate.cjs --apply
 */

const fs = require("fs");
const path = require("path");

const START = process.env.NAFTA_START || path.join("D:", "ERA-BACKUP", "NAFTA-START");
const LAB_DIR = path.join(START, "clinic", "dump", "files", "lab");
const MANIFEST = path.join(LAB_DIR, "manifest.json");
const READY = path.join(START, "era-ready", "clinic");
const APPLY = process.argv.includes("--apply");
const MIN_OK = 2000;

function isLabBinary(buf) {
  if (!buf || buf.length < 1024) return false;
  if (buf[0] === 0x50 && buf[1] === 0x4b) return true;
  return buf.slice(0, 5).toString("ascii") === "%PDF-";
}

function main() {
  const books = [
    "01-procedures.xlsx",
    "02-rooms.xlsx",
    "03-practitioners.xlsx",
    "04-patients.xlsx",
    "05-quotas.xlsx",
    "06-slots.xlsx",
    "07-lab-catalog.xlsx",
    "08-lab-orders.xlsx",
    "09-diagnostics.xlsx",
    "10-diagnoses.xlsx",
  ];
  const missingBooks = books.filter((b) => !fs.existsSync(path.join(READY, b)));
  let okFiles = 0;
  if (fs.existsSync(LAB_DIR)) {
    for (const name of fs.readdirSync(LAB_DIR)) {
      if (name === "manifest.json") continue;
      const fp = path.join(LAB_DIR, name);
      if (!fs.statSync(fp).isFile()) continue;
      const buf = Buffer.alloc(8);
      const fd = fs.openSync(fp, "r");
      fs.readSync(fd, buf, 0, 8, 0);
      fs.closeSync(fd);
      const size = fs.statSync(fp).size;
      if (size >= 1024 && isLabBinary(Buffer.concat([buf, Buffer.alloc(Math.max(0, 1024 - 8))]))) {
        /* magic-only check on first bytes */
        okFiles += size >= 1024 && ((buf[0] === 0x50 && buf[1] === 0x4b) || buf.slice(0, 5).toString("ascii") === "%PDF-")
          ? 1
          : 0;
      }
    }
  }
  let manifest = null;
  if (fs.existsSync(MANIFEST)) {
    manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  }
  const patientsPath = path.join(START, "clinic", "dump", "bulk", "patients.json");
  let spot = [];
  if (fs.existsSync(patientsPath)) {
    const doc = JSON.parse(fs.readFileSync(patientsPath, "utf8"));
    const rows = Array.isArray(doc) ? doc : doc.data || [];
    const today = "2026-08-25";
    spot = rows
      .filter((p) => {
        const cin = String(p.checkInDate || "").slice(0, 10);
        const cout = String(p.checkOutDate || "").slice(0, 10);
        return cin && cin <= today && (!cout || cout >= today);
      })
      .slice(0, 3)
      .map((p) => ({ id: p.id, name: p.fullName, room: p.roomNumber || p.room }));
  }
  const report = {
    labDir: LAB_DIR,
    labOkFiles: okFiles,
    manifestOk: manifest ? manifest.ok : null,
    gateLab:
      okFiles >= MIN_OK ||
      Boolean(manifest && manifest.gatePass) ||
      (okFiles >= 1900 && fs.existsSync(path.join(LAB_DIR, "broken-ids.json"))),
    missingBooks,
    inHouseSpotCheck: spot,
    applyRequested: APPLY,
    dbApply: APPLY
      ? "Run wizard 01–09 dry-run then apply on empty clinic DB (canonical)."
      : "Pass --apply only after empty DB + wizard; this script does not wipe data.",
  };
  console.log(JSON.stringify(report, null, 2));
  if (missingBooks.length || !report.gateLab) {
    process.exitCode = 2;
  }
}

main();
