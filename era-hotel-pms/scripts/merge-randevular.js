/**
 * Merge WebOnly / Nafta clinic Randevular daily Excel exports into one file.
 * Dedupe key: appointmentDate + time + patient name + procedure + room.
 *
 * Also seeds from an existing Randevular.merged*.xlsx (already has AppointmentDate).
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
const inputDir = positional[0] ?? 'c:/Users/ASUS G752VT/Downloads/WO';
const outputPath =
  positional[1] ?? path.join(inputDir, 'Randevular.merged.xlsx');

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
  if (typeof value === 'number' && value >= 1) {
    // excel datetime serial — take time portion
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

function filledCount(row) {
  return Object.values(row).filter((v) => v != null && String(v).trim() !== '').length;
}

/** Daily chunks: Randevular_YYYY-MM-DD.xlsx (not merged). */
function listDailyChunks(dir) {
  return fs
    .readdirSync(dir)
    .filter(
      (f) =>
        /^Randevular_/i.test(f) &&
        f.endsWith('.xlsx') &&
        !/\.merged\./i.test(f)
    )
    .sort()
    .map((f) => path.join(dir, f));
}

/** Previous merged seed(s). */
function listMergedSeeds(dir, outAbs) {
  return fs
    .readdirSync(dir)
    .filter((f) => /^Randevular\.merged/i.test(f) && f.endsWith('.xlsx'))
    .sort()
    .map((f) => path.join(dir, f))
    .filter((p) => path.resolve(p) !== path.resolve(outAbs) || fs.existsSync(p));
}

function ingestRows(rows, appointmentDate, byKey, headerSet, headers, stats) {
  let added = 0;
  let updated = 0;
  let skipped = 0;
  for (const row of rows) {
    const name = String(row['Ad Soyad'] ?? '').trim();
    if (!name) {
      skipped++;
      continue;
    }
    if (/test\s*testov/i.test(name)) {
      stats.skippedTest++;
      skipped++;
      continue;
    }

    for (const key of Object.keys(row)) {
      if (key === 'AppointmentDate') continue;
      if (!headerSet.has(key)) {
        headerSet.add(key);
        headers.push(key);
      }
    }

    const date =
      appointmentDate ||
      String(row.AppointmentDate ?? '').trim() ||
      null;
    if (!date) {
      skipped++;
      continue;
    }

    const enriched = { ...row, AppointmentDate: date, Saat: formatTime(row.Saat) || row.Saat };
    const key = dedupeKey(enriched);
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, enriched);
      added++;
    } else if (filledCount(enriched) >= filledCount(prev)) {
      byKey.set(key, enriched);
      updated++;
    } else {
      skipped++;
    }
  }
  return { added, updated, skipped };
}

const outAbs = path.resolve(outputPath);
const seeds = listMergedSeeds(inputDir, outAbs);
const dailies = listDailyChunks(inputDir);

if (!seeds.length && !dailies.length) {
  console.error('No Randevular sources in', inputDir);
  process.exit(1);
}

const headers = [];
const headerSet = new Set();
const byKey = new Map();
const stats = { skippedTest: 0, totalRaw: 0 };
const perFile = [];

// 1) Seeds first (older baseline)
for (const filePath of seeds) {
  console.log('SEED', path.basename(filePath));
  const wb = X.readFile(filePath, { cellDates: false });
  const rows = X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
    defval: null,
    raw: true,
  });
  stats.totalRaw += rows.length;
  const r = ingestRows(rows, null, byKey, headerSet, headers, stats);
  perFile.push({ file: path.basename(filePath), rows: rows.length, ...r, kind: 'seed' });
  console.log('  +', r.added, '~', r.updated, '=', r.skipped);
}

// 2) Daily chunks (overwrite same key if richer)
for (const filePath of dailies) {
  const appointmentDate = dateFromFilename(path.basename(filePath));
  if (!appointmentDate) {
    console.warn('Skip (no date in name):', path.basename(filePath));
    continue;
  }
  console.log('DAY ', appointmentDate, path.basename(filePath));
  const wb = X.readFile(filePath, { cellDates: false });
  const rows = X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
    defval: null,
    raw: true,
  });
  stats.totalRaw += rows.length;
  const r = ingestRows(rows, appointmentDate, byKey, headerSet, headers, stats);
  perFile.push({
    file: path.basename(filePath),
    rows: rows.length,
    ...r,
    kind: 'daily',
    appointmentDate,
  });
  console.log('  +', r.added, '~', r.updated, '=', r.skipped);
}

const merged = [...byKey.values()].sort((a, b) => {
  const d = String(a.AppointmentDate).localeCompare(String(b.AppointmentDate));
  if (d !== 0) return d;
  const ta = formatTime(a.Saat);
  const tb = formatTime(b.Saat);
  if (ta !== tb) return ta.localeCompare(tb);
  return norm(a['Ad Soyad']).localeCompare(norm(b['Ad Soyad']));
});

const outHeaders = [
  'AppointmentDate',
  ...headers.filter((h) => h !== 'AppointmentDate'),
];
const tmp = outAbs + '.tmp.xlsx';
const outWs = X.utils.json_to_sheet(merged, { header: outHeaders });
const outWb = X.utils.book_new();
X.utils.book_append_sheet(outWb, outWs, 'Randevular merged');
X.writeFile(outWb, tmp);

// Verify read-back
const checkWb = X.readFile(tmp, { cellDates: false });
const checkRows = X.utils.sheet_to_json(checkWb.Sheets[checkWb.SheetNames[0]], {
  defval: null,
  raw: true,
});
if (checkRows.length !== merged.length) {
  console.error('VERIFY FAIL:', checkRows.length, '!=', merged.length);
  process.exit(1);
}
if (merged.length < 1000) {
  console.error('VERIFY FAIL: suspiciously few rows', merged.length);
  process.exit(1);
}
fs.renameSync(tmp, outAbs);

const dates = [...new Set(merged.map((r) => r.AppointmentDate))].sort();
// gap report (missing calendar days between min and max)
const gaps = [];
if (dates.length) {
  const toDate = (s) => {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  };
  let cur = toDate(dates[0]);
  const end = toDate(dates[dates.length - 1]);
  const have = new Set(dates);
  while (cur <= end) {
    const iso = cur.toISOString().slice(0, 10);
    if (!have.has(iso)) {
      const start = iso;
      while (cur <= end && !have.has(cur.toISOString().slice(0, 10))) {
        cur = new Date(cur.getTime() + 86400000);
      }
      const lastMissing = new Date(cur.getTime() - 86400000).toISOString().slice(0, 10);
      gaps.push({ from: start, to: lastMissing });
      continue;
    }
    cur = new Date(cur.getTime() + 86400000);
  }
}

const summary = {
  seeds: seeds.map((f) => path.basename(f)),
  dailyFiles: dailies.length,
  perFile,
  totalRawRows: stats.totalRaw,
  skippedTestRows: stats.skippedTest,
  uniqueAppointments: merged.length,
  dateMin: dates[0] ?? null,
  dateMax: dates[dates.length - 1] ?? null,
  uniqueDays: dates.length,
  calendarGaps: gaps,
  outputPath: outAbs,
  fileSizeBytes: fs.statSync(outAbs).size,
  verifiedReadBack: checkRows.length,
};
const summaryPath = outAbs.replace(/\.xlsx$/i, '.summary.json');
fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8');

console.log('\n=== RANDEVULAR MERGE OK ===');
console.log('Raw rows:', stats.totalRaw);
console.log('Unique appointments:', merged.length);
console.log('Date range:', summary.dateMin, '->', summary.dateMax, '| days:', summary.uniqueDays);
console.log('Calendar gaps:', gaps.length ? gaps : '(none)');
console.log('Size bytes:', summary.fileSizeBytes);
console.log('Written:', outAbs);
console.log('Summary:', summaryPath);

if (deleteSources) {
  let deleted = 0;
  for (const filePath of dailies) {
    fs.unlinkSync(filePath);
    deleted++;
  }
  console.log('Deleted daily source files:', deleted);
  console.log('(Kept merged output; previous seed overwritten if same path)');
}
