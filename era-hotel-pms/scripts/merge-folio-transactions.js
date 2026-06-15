/**
 * Merge Elektraweb Folio Transactions export chunks (1000-row limit).
 * Dedupe by transaction Id. Writes merged xlsx + JSON summary.
 *
 * Usage:
 *   node scripts/merge-folio-transactions.js <inputDir> [outputPath]
 */
const fs = require('fs');
const path = require('path');
const X = require('xlsx');

const inputDir = process.argv[2];
const outputPath =
  process.argv[3] ??
  (inputDir
    ? path.join(inputDir, 'Folio Transactions.merged.xlsx')
    : path.join(process.cwd(), 'Folio Transactions.merged.xlsx'));

if (!inputDir || !fs.existsSync(inputDir)) {
  console.error('Usage: node merge-folio-transactions.js <inputDir> [outputPath]');
  process.exit(1);
}

function filledCount(row) {
  return Object.values(row).filter((v) => v != null && String(v).trim() !== '').length;
}

function excelDate(v) {
  if (typeof v !== 'number' || v < 1000) return null;
  const d = X.SSF.parse_date_code(v);
  if (!d || d.y < 1901) return null;
  return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
}

const files = fs
  .readdirSync(inputDir)
  .filter((f) => f.toLowerCase().endsWith('.xlsx') && !f.includes('.merged.'))
  .sort()
  .map((f) => path.join(inputDir, f));

if (!files.length) {
  console.error('No .xlsx files in', inputDir);
  process.exit(1);
}

let sheetName = null;
const headers = [];
const headerSet = new Set();
const byId = new Map();
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
    const id = String(row.Id ?? '').trim();
    if (!id) continue;
    const prev = byId.get(id);
    if (!prev || filledCount(row) >= filledCount(prev)) {
      byId.set(id, row);
    }
  }
}

const merged = [...byId.values()].sort((a, b) => {
  const da = excelDate(a.Date);
  const db = excelDate(b.Date);
  if (da && db && da !== db) return da.localeCompare(db);
  const ia = Number(a.Id);
  const ib = Number(b.Id);
  if (!Number.isNaN(ia) && !Number.isNaN(ib)) return ia - ib;
  return String(a.Id).localeCompare(String(b.Id));
});

const outWs = X.utils.json_to_sheet(merged, { header: headers });
const outWb = X.utils.book_new();
X.utils.book_append_sheet(outWb, outWs, sheetName ?? 'Folio merged');
X.writeFile(outWb, outputPath);

const dates = merged.map((r) => excelDate(r.Date)).filter(Boolean).sort();
const dateSet = new Set(dates);
const byDay = {};
for (const d of dates) byDay[d] = (byDay[d] || 0) + 1;

const summary = {
  inputFiles: files.length,
  totalRawRows: totalRows,
  uniqueIds: merged.length,
  duplicatesRemoved: totalRows - merged.length,
  dateMin: dates[0] ?? null,
  dateMax: dates[dates.length - 1] ?? null,
  uniqueDays: dateSet.size,
  expectedRows: null,
  outputPath,
};

const summaryPath = outputPath.replace(/\.xlsx$/i, '.summary.json');
fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

console.log('Input files:', files.length);
files.forEach((f) => console.log(' -', path.basename(f)));
console.log('Total raw rows:', totalRows);
console.log('Unique Folio Id:', merged.length);
console.log('Duplicates removed:', totalRows - merged.length);
console.log('Date range:', summary.dateMin, '->', summary.dateMax, '| days:', summary.uniqueDays);
console.log('Written:', outputPath);
console.log('Summary:', summaryPath);
