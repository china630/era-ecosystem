"use strict";

/**
 * Shared READY xlsx writer. Large books split into p01, p02, … so the wizard
 * can POST one chunk per request (Next/Traefik FormData limit).
 */

const fs = require("fs");
const path = require("path");

/** Rows per chunk. ~5k keeps multipart well under 10 MB and avoids import timeouts. */
const CHUNK_ROWS = 5000;

function writeSheet(XLSX, outFile, headers, rows) {
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const aoa = [headers, ...rows.map((r) => headers.map((h) => (r[h] == null ? "" : r[h])))];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "import");
  XLSX.writeFile(wb, outFile);
  return aoa.length - 1;
}

function splitName(outFile) {
  const dir = path.dirname(outFile);
  const ext = path.extname(outFile);
  const stem = path.basename(outFile, ext);
  return { dir, ext, stem };
}

function chunkPath(outFile, part) {
  const { dir, ext, stem } = splitName(outFile);
  return path.join(dir, `${stem}-p${String(part).padStart(2, "0")}${ext}`);
}

function listChunkFiles(outFile) {
  const { dir, ext, stem } = splitName(outFile);
  if (!fs.existsSync(dir)) return [];
  const re = new RegExp(`^${stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-p\\d{2}\\${ext}$`, "i");
  return fs
    .readdirSync(dir)
    .filter((n) => re.test(n))
    .map((n) => path.join(dir, n))
    .sort();
}

function removeStaleChunks(outFile) {
  for (const f of listChunkFiles(outFile)) {
    fs.unlinkSync(f);
  }
}

/**
 * Write one book, or `stem-p01.xlsx` … when `rows.length > chunkRows`.
 * Removes leftover chunks from a previous bake. Returns total data rows.
 */
function writeSheetChunks(XLSX, outFile, headers, rows, chunkRows = CHUNK_ROWS) {
  removeStaleChunks(outFile);
  if (rows.length <= chunkRows) {
    if (fs.existsSync(outFile) === false) {
      /* keep going */
    }
    return writeSheet(XLSX, outFile, headers, rows);
  }
  if (fs.existsSync(outFile)) fs.unlinkSync(outFile);
  let part = 1;
  for (let i = 0; i < rows.length; i += chunkRows) {
    writeSheet(XLSX, chunkPath(outFile, part), headers, rows.slice(i, i + chunkRows));
    part += 1;
  }
  return rows.length;
}

function wizardBookPresent(readyDir, bookName) {
  if (fs.existsSync(path.join(readyDir, bookName))) return true;
  const ext = path.extname(bookName);
  const stem = path.basename(bookName, ext);
  return fs.existsSync(path.join(readyDir, `${stem}-p01${ext}`));
}

module.exports = {
  CHUNK_ROWS,
  writeSheet,
  writeSheetChunks,
  chunkPath,
  listChunkFiles,
  removeStaleChunks,
  wizardBookPresent,
};
