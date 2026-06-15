/**
 * Merge WebOnly / Nafta clinic Randevular daily Excel exports into one file.
 * Dedupe key: appointmentDate + time + patient name + procedure + room.
 *
 * Usage:
 *   node scripts/merge-randevular.js <inputDir> [outputPath] [--delete-sources]
 */
const fs = require('fs');
const path = require('path');
const X = require('xlsx');

const args = process.argv.slice(2);
const deleteSources = args.includes('--delete-sources');
const positional = args.filter((a) => !a.startsWith('--'));
const inputDir = positional[0] ?? 'c:/Users/ASUS G752VT/Downloads/WO RV';
const outputPath =
  positional[1] ??
  path.join(inputDir, 'Randevular.merged.2026-02-17_to_latest.xlsx');

if (!fs.existsSync(inputDir)) {
  console.error('Directory not found:', inputDir);
  process.exit(1);
}

function norm(s) {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function dateFromFilename(filename) {
  const m = filename.match(/(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function formatTime(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'number' && value < 1) {
    const t = X.SSF.parse_date_code(value);
    if (t) return `${String(t.H).padStart(2, '0')}:${String(t.M).padStart(2, '0')}`;
  }
  return String(value).trim();
}

function dedupeKey(row) {
  return [
    row.AppointmentDate,
    formatTime(row.Saat),
    norm(row['Ad Soyad']),
    norm(row.Prosedur),
    norm(row.Otaq),
  ].join('|');
}

const files = fs
  .readdirSync(inputDir)
  .filter((f) => /^Randevular/i.test(f) && f.endsWith('.xlsx') && !f.includes('.merged.'))
  .sort()
  .map((f) => path.join(inputDir, f));

if (!files.length) {
  console.error('No Randevular*.xlsx files in', inputDir);
  process.exit(1);
}

let sheetName = null;
const headers = ['AppointmentDate'];
const headerSet = new Set(headers);
const byKey = new Map();
let totalRows = 0;
let skippedTest = 0;

for (const filePath of files) {
  const appointmentDate = dateFromFilename(path.basename(filePath));
  if (!appointmentDate) {
    console.warn('Skip (no date in name):', path.basename(filePath));
    continue;
  }

  const wb = X.readFile(filePath);
  const sn = wb.SheetNames[0];
  if (!sheetName) sheetName = sn;
  const rows = X.utils.sheet_to_json(wb.Sheets[sn], { defval: null });
  totalRows += rows.length;

  for (const row of rows) {
    const name = String(row['Ad Soyad'] ?? '').trim();
    if (!name) continue;
    if (/test\s*testov/i.test(name)) {
      skippedTest++;
      continue;
    }

    for (const key of Object.keys(row)) {
      if (!headerSet.has(key)) {
        headerSet.add(key);
        headers.push(key);
      }
    }

    const enriched = { AppointmentDate: appointmentDate, ...row };
    const key = dedupeKey(enriched);
    byKey.set(key, enriched);
  }
}

const merged = [...byKey.values()].sort((a, b) => {
  const d = a.AppointmentDate.localeCompare(b.AppointmentDate);
  if (d !== 0) return d;
  const ta = formatTime(a.Saat);
  const tb = formatTime(b.Saat);
  if (ta !== tb) return ta.localeCompare(tb);
  return norm(a['Ad Soyad']).localeCompare(norm(b['Ad Soyad']));
});

const outHeaders = ['AppointmentDate', ...headers.filter((h) => h !== 'AppointmentDate')];
const outWs = X.utils.json_to_sheet(merged, { header: outHeaders });
const outWb = X.utils.book_new();
X.utils.book_append_sheet(outWb, outWs, 'Randevular merged');
X.writeFile(outWb, outputPath);

const dates = [...new Set(merged.map((r) => r.AppointmentDate))].sort();
const summary = {
  inputFiles: files.length,
  totalRawRows: totalRows,
  skippedTestRows: skippedTest,
  uniqueAppointments: merged.length,
  duplicatesRemoved: totalRows - skippedTest - merged.length,
  dateMin: dates[0],
  dateMax: dates[dates.length - 1],
  uniqueDays: dates.length,
  outputPath,
};
const summaryPath = outputPath.replace(/\.xlsx$/i, '.summary.json');
fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

console.log('Input files:', files.length);
console.log('Raw rows:', totalRows);
console.log('Skipped Test Testov:', skippedTest);
console.log('Unique appointments:', merged.length);
console.log('Duplicates removed:', summary.duplicatesRemoved);
console.log('Date range:', summary.dateMin, '->', summary.dateMax, '| days:', summary.uniqueDays);
console.log('Written:', outputPath);
console.log('Summary:', summaryPath);

if (deleteSources) {
  let deleted = 0;
  for (const filePath of files) {
    fs.unlinkSync(filePath);
    deleted++;
  }
  console.log('Deleted source files:', deleted);
}
