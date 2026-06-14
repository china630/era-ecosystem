/**
 * Merge Elektraweb Guest Cards export chunks into one deduplicated xlsx.
 * Usage: node scripts/merge-guest-cards.js [inputDir] [outputPath]
 */
const fs = require('fs');
const path = require('path');
const X = require('xlsx');

const inputDir = process.argv[2] ?? 'c:/Users/ASUS G752VT/Downloads';
const outputPath =
  process.argv[3] ??
  path.join(inputDir, 'Guest Cards.merged.2026-06-13.Nafta Sanatorium Hotel.xlsx');

const files = fs
  .readdirSync(inputDir)
  .filter((f) => f.startsWith('Guest Cards.') && f.endsWith('.xlsx') && !f.includes('.merged.'))
  .sort()
  .map((f) => path.join(inputDir, f));

if (!files.length) {
  console.error('No Guest Cards *.xlsx files in', inputDir);
  process.exit(1);
}

function filledCount(row) {
  return Object.values(row).filter((v) => v != null && String(v).trim() !== '').length;
}

function mergeRows(existing, incoming) {
  return filledCount(incoming) >= filledCount(existing) ? incoming : existing;
}

let sheetName = null;
const headers = [];
const headerSet = new Set();
const byGuestId = new Map();
let totalRows = 0;

for (const filePath of files) {
  const wb = X.readFile(filePath);
  const sn = wb.SheetNames[0];
  if (!sheetName) sheetName = sn;
  const rows = X.utils.sheet_to_json(wb.Sheets[sn], { defval: null });
  totalRows += rows.length;

  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!headerSet.has(key)) {
        headerSet.add(key);
        headers.push(key);
      }
    }
    const guestId = String(row['Guest Id'] ?? '').trim();
    if (!guestId) continue;
    const prev = byGuestId.get(guestId);
    byGuestId.set(guestId, prev ? mergeRows(prev, row) : row);
  }
}

const merged = [...byGuestId.values()].sort((a, b) => {
  const ai = Number(a['Guest Id']);
  const bi = Number(b['Guest Id']);
  if (!Number.isNaN(ai) && !Number.isNaN(bi)) return ai - bi;
  return String(a['Guest Id']).localeCompare(String(b['Guest Id']));
});

const outWs = X.utils.json_to_sheet(merged, { header: headers });
const outWb = X.utils.book_new();
X.utils.book_append_sheet(outWb, outWs, sheetName ?? 'Guest cards merged');
X.writeFile(outWb, outputPath);

console.log('Input files:', files.length);
files.forEach((f) => console.log(' -', path.basename(f)));
console.log('Total raw rows:', totalRows);
console.log('Unique Guest Id:', merged.length);
console.log('Duplicates removed:', totalRows - merged.length);
console.log('Written:', outputPath);
