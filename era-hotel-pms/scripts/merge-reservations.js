/**
 * Merge Elektraweb Front Office Control Panel (reservations) export chunks.
 * Dedupe by Res Id; prefer more operational State (InHouse > Reservation > CheckOut).
 *
 * Usage:
 *   node scripts/merge-reservations.js [inputDir] [outputPath]
 *   node scripts/merge-reservations.js --files file1.xlsx file2.xlsx ... --out merged.xlsx
 */
const fs = require('fs');
const path = require('path');
const X = require('xlsx');

function parseArgs() {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf('--out');
  const filesIdx = args.indexOf('--files');

  if (filesIdx >= 0) {
    const out =
      outIdx >= 0 ? args[outIdx + 1] : path.join(process.cwd(), 'Reservations.merged.xlsx');
    const filePaths = args.slice(filesIdx + 1, outIdx >= 0 ? outIdx : undefined);
    return { filePaths, outputPath: out };
  }

  const inputDir = args[0] ?? 'c:/Users/ASUS G752VT/Downloads';
  const outputPath =
    args[1] ??
    path.join(inputDir, 'Front Office Control Panel.merged.2026-06-15.Nafta Sanatorium Hotel.xlsx');

  const filePaths = fs
    .readdirSync(inputDir)
    .filter(
      (f) =>
        f.startsWith('Front Office Control Panel.') &&
        f.endsWith('.xlsx') &&
        !f.includes('.merged.'),
    )
    .sort()
    .map((f) => path.join(inputDir, f));

  return { filePaths, outputPath };
}

const STATE_RANK = {
  InHouse: 3,
  Reservation: 2,
  CheckOut: 1,
};

function filledCount(row) {
  return Object.values(row).filter((v) => v != null && String(v).trim() !== '').length;
}

function stateRank(row) {
  return STATE_RANK[String(row.State ?? '').trim()] ?? 0;
}

function isNumericRoom(row) {
  return /^\d{3,4}$/.test(String(row['Room No'] ?? '').trim());
}

function mergeRows(existing, incoming) {
  const rankDiff = stateRank(incoming) - stateRank(existing);
  if (rankDiff !== 0) return rankDiff > 0 ? incoming : existing;

  const fillDiff = filledCount(incoming) - filledCount(existing);
  if (fillDiff !== 0) return fillDiff > 0 ? incoming : existing;

  if (isNumericRoom(incoming) && !isNumericRoom(existing)) return incoming;
  if (isNumericRoom(existing) && !isNumericRoom(incoming)) return existing;

  return incoming;
}

const { filePaths, outputPath } = parseArgs();

if (!filePaths.length) {
  console.error('No reservation export files found.');
  process.exit(1);
}

let sheetName = null;
const headers = [];
const headerSet = new Set();
const byResId = new Map();
let totalRows = 0;

for (const filePath of filePaths) {
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
    const resId = String(row['Res Id'] ?? '').trim();
    if (!resId) continue;
    const prev = byResId.get(resId);
    byResId.set(resId, prev ? mergeRows(prev, row) : row);
  }
}

const merged = [...byResId.values()].sort((a, b) => {
  const ai = Number(a['Res Id']);
  const bi = Number(b['Res Id']);
  if (!Number.isNaN(ai) && !Number.isNaN(bi)) return ai - bi;
  return String(a['Res Id']).localeCompare(String(b['Res Id']));
});

const outWs = X.utils.json_to_sheet(merged, { header: headers });
const outWb = X.utils.book_new();
X.utils.book_append_sheet(outWb, outWs, sheetName ?? 'Reservations merged');
X.writeFile(outWb, outputPath);

const states = {};
let tRooms = 0;
for (const row of merged) {
  const s = String(row.State ?? '(empty)');
  states[s] = (states[s] || 0) + 1;
  if (String(row['Room No'] ?? '').startsWith('T')) tRooms++;
}

console.log('Input files:', filePaths.length);
filePaths.forEach((f) => console.log(' -', path.basename(f)));
console.log('Total raw rows:', totalRows);
console.log('Unique Res Id:', merged.length);
console.log('Duplicates removed:', totalRows - merged.length);
console.log('States:', states);
console.log('T-prefixed Room No:', tRooms);
console.log('Written:', outputPath);
