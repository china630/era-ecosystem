/**
 * Merge Elektraweb Folio Transactions export chunks (1000-row limit).
 * Dedupe by transaction Id. Optionally split hotel folio vs FnB house-ledger.
 *
 * Usage (single folder — legacy):
 *   node scripts/merge-folio-transactions.js <inputDir> [outputPath]
 *
 * Usage (Nafta EW pack — multi-root + hotel/FnB split):
 *   node scripts/merge-folio-transactions.js --ew "C:/Users/.../Downloads/EW"
 *
 * EW mode writes into <ewDir>:
 *   Folio Transactions.merged.xlsx + .summary.json
 *   FnB Transactions.merged.xlsx + .summary.json
 */
const fs = require('fs');
const path = require('path');
const X = require('xlsx');

const MERGED_NAME_RE = /\.merged\./i;
const EXCLUDE_NAMES = new Set([
  'folios.xlsx',
  'profolio transactions.xlsx',
  'folio transactions.merged.xlsx',
  'fnb transactions.merged.xlsx',
]);

function filledCount(row) {
  return Object.values(row).filter((v) => v != null && String(v).trim() !== '').length;
}

function excelDate(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number' && v >= 1000 && v < 80000) {
    const d = X.SSF.parse_date_code(v);
    if (!d || d.y < 1901 || d.y > 2100) return null;
    return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const y = v.getFullYear();
    const m = v.getMonth() + 1;
    const day = v.getDate();
    if (y < 1901 || y > 2100) return null;
    return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  if (typeof v === 'string') {
    const m = v.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[0];
  }
  return null;
}

/** House / walk-in FnB ledger — not guest hotel folio. */
function isFnbHouseLedger(row) {
  const guest = String(row['Guest Name'] ?? '')
    .trim()
    .toUpperCase();
  const agency = String(row['Agency'] ?? '')
    .trim()
    .toUpperCase();
  const dept = String(row['Department'] ?? '')
    .trim()
    .toUpperCase();

  if (guest.includes('999') && guest.includes('FB')) return true;
  if (['999 FB', 'FB999', '999FB'].includes(guest)) return true;

  const fnbDept =
    dept === 'XUDMANİ KAFE' ||
    dept === 'XUDMANI KAFE' ||
    dept === 'NAFTANI RESTAURANT' ||
    dept === 'DİSCO BAR' ||
    dept === 'DISCO BAR' ||
    dept.startsWith('F&B');

  // Walk-in cash restaurant / system cash folio without guest stay
  if (guest === 'CASH FOLIO' && (fnbDept || agency.includes('RESTORAN') || agency.includes('RESTAURANT'))) {
    return true;
  }
  if ((agency.includes('RESTORAN') || agency.includes('RESTAURANT')) && (!row['Res Id'] || Number(row['Res Id']) === 0)) {
    return true;
  }

  return false;
}

function listXlsxInDir(dir) {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.xlsx') && !MERGED_NAME_RE.test(f))
    .filter((f) => !EXCLUDE_NAMES.has(f.toLowerCase()))
    .sort()
    .map((f) => path.join(dir, f));
}

function collectEwSources(ewDir) {
  const files = [];
  const seen = new Set();
  const add = (p) => {
    const ap = path.resolve(p);
    if (seen.has(ap) || !fs.existsSync(ap)) return;
    const base = path.basename(ap).toLowerCase();
    if (EXCLUDE_NAMES.has(base) || MERGED_NAME_RE.test(base)) return;
    if (!base.endsWith('.xlsx')) return;
    seen.add(ap);
    files.push(ap);
  };

  for (const p of listXlsxInDir(path.join(ewDir, 'Folio 2024'))) add(p);
  for (const p of listXlsxInDir(path.join(ewDir, 'Folio 2025'))) add(p);
  add(path.join(ewDir, 'Folio 2025.xlsx'));
  add(path.join(ewDir, 'Folio 2026 01 jan - 14 jun.xlsx'));

  for (const f of fs.readdirSync(ewDir).sort()) {
    if (!f.toLowerCase().endsWith('.xlsx')) continue;
    if (f.startsWith('Folio Transactions.') || /^Folio Transactions/i.test(f)) {
      add(path.join(ewDir, f));
    }
  }

  return files;
}

function collectDirSources(inputDir) {
  return listXlsxInDir(inputDir);
}

function mergeFiles(files) {
  let sheetName = null;
  const headers = [];
  const headerSet = new Set();
  const byId = new Map();
  let totalRows = 0;
  const perFile = [];

  for (const filePath of files) {
    const wb = X.readFile(filePath, { cellDates: false });
    const sn = wb.SheetNames[0];
    if (!sheetName) sheetName = sn;
    const rows = X.utils.sheet_to_json(wb.Sheets[sn], { defval: null, raw: true });
    totalRows += rows.length;
    let added = 0;
    let updated = 0;
    let skipped = 0;

    for (const row of rows) {
      for (const key of Object.keys(row)) {
        if (!headerSet.has(key)) {
          headerSet.add(key);
          headers.push(key);
        }
      }
      const id = String(row.Id ?? '').trim();
      if (!id || id === 'NaN' || id === 'null' || id === 'undefined') {
        skipped++;
        continue;
      }
      const prev = byId.get(id);
      if (!prev) {
        byId.set(id, row);
        added++;
      } else if (filledCount(row) >= filledCount(prev)) {
        byId.set(id, row);
        updated++;
      } else {
        skipped++;
      }
    }
    perFile.push({
      file: path.basename(filePath),
      rows: rows.length,
      added,
      updated,
      skipped,
    });
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

  return { merged, byId, headers, sheetName, totalRows, perFile };
}

function gapsFromDates(sortedUniqueDays) {
  const gaps = [];
  for (let i = 0; i < sortedUniqueDays.length - 1; i++) {
    const a = Date.parse(sortedUniqueDays[i] + 'T00:00:00Z');
    const b = Date.parse(sortedUniqueDays[i + 1] + 'T00:00:00Z');
    const delta = Math.round((b - a) / 86400000);
    if (delta > 1) {
      const gs = new Date(a + 86400000).toISOString().slice(0, 10);
      const ge = new Date(b - 86400000).toISOString().slice(0, 10);
      gaps.push({ from: gs, to: ge, days: delta - 1 });
    }
  }
  return gaps;
}

function monthlyCounts(rows) {
  const m = {};
  for (const r of rows) {
    const d = excelDate(r.Date);
    if (!d) continue;
    const k = d.slice(0, 7);
    m[k] = (m[k] || 0) + 1;
  }
  return m;
}

function buildSummary(rows, meta) {
  const dates = rows.map((r) => excelDate(r.Date)).filter(Boolean).sort();
  const dateSet = [...new Set(dates)].sort();
  const byDay = {};
  for (const d of dates) byDay[d] = (byDay[d] || 0) + 1;
  const gaps = gapsFromDates(dateSet);
  return {
    ...meta,
    uniqueIds: rows.length,
    dateMin: dateSet[0] ?? null,
    dateMax: dateSet[dateSet.length - 1] ?? null,
    uniqueDays: dateSet.size,
    monthly: monthlyCounts(rows),
    gapsGte3: gaps.filter((g) => g.days >= 3),
    gapCount: gaps.length,
    gapJun15to20Closed:
      !gaps.some(
        (g) =>
          g.from <= '2026-06-15' &&
          g.to >= '2026-06-20' &&
          g.days >= 3
      ) &&
      dateSet.includes('2026-06-15') &&
      dateSet.includes('2026-06-20'),
  };
}

function writeMerged(rows, headers, sheetName, outputPath, summaryExtra) {
  const outWs = X.utils.json_to_sheet(rows, { header: headers });
  const outWb = X.utils.book_new();
  X.utils.book_append_sheet(outWb, outWs, (sheetName || 'Folio merged').slice(0, 31));
  X.writeFile(outWb, outputPath);
  const summary = buildSummary(rows, summaryExtra);
  summary.outputPath = outputPath;
  const summaryPath = outputPath.replace(/\.xlsx$/i, '.summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  return { summary, summaryPath };
}

function parseArgs(argv) {
  const args = argv.slice(2);
  if (args[0] === '--ew') {
    return { mode: 'ew', ewDir: args[1], hotelOut: args[2], fnbOut: args[3] };
  }
  if (args[0] === '--files') {
    const files = [];
    let hotelOut;
    let fnbOut;
    for (let i = 1; i < args.length; i += 1) {
      if (args[i] === '--out') {
        hotelOut = args[i + 1];
        i += 1;
      } else if (args[i] === '--fnb-out') {
        fnbOut = args[i + 1];
        i += 1;
      } else {
        files.push(args[i]);
      }
    }
    return { mode: 'files', files, hotelOut, fnbOut };
  }
  return { mode: 'dir', inputDir: args[0], outputPath: args[1] };
}

function runSplitMerge(files, hotelOut, fnbOut) {
  if (!files.length) {
    console.error('No Folio Transaction sources');
    process.exit(1);
  }
  console.log('Folio sources:', files.length);
  for (const f of files) console.log(' -', path.basename(f));

  const { merged, headers, sheetName, totalRows, perFile } = mergeFiles(files);
  const hotel = [];
  const fnb = [];
  for (const row of merged) {
    if (isFnbHouseLedger(row)) fnb.push(row);
    else hotel.push(row);
  }

  const hotelRes = writeMerged(hotel, headers, sheetName, hotelOut, {
    stream: 'hotel',
    inputFiles: files.length,
    totalRawRows: totalRows,
    duplicatesRemoved: totalRows - merged.length,
    uniqueBeforeSplit: merged.length,
    perFile,
  });
  const fnbRes = writeMerged(fnb, headers, sheetName, fnbOut, {
    stream: 'fnb',
    inputFiles: files.length,
    totalRawRows: totalRows,
    uniqueBeforeSplit: merged.length,
    splitRule:
      'Guest Name 999 FB / FB999; CASH FOLIO + F&B dept; RESTORAN agency without Res Id',
  });

  console.log('\n=== MERGE + SPLIT DONE ===');
  console.log('Raw rows:', totalRows);
  console.log('Unique Id:', merged.length);
  console.log('Hotel folio:', hotel.length, '->', hotelOut);
  console.log('FnB house:', fnb.length, '->', fnbOut);
  console.log('Hotel date:', hotelRes.summary.dateMin, '->', hotelRes.summary.dateMax);
  console.log('FnB date:', fnbRes.summary.dateMin, '->', fnbRes.summary.dateMax);
  console.log('Hotel gaps >=3d:', hotelRes.summary.gapsGte3.length);
  for (const g of hotelRes.summary.gapsGte3) {
    console.log(`  GAP ${g.from} — ${g.to} (${g.days}d)`);
  }
  console.log('Jun 15–20 closed (hotel days present):', hotelRes.summary.gapJun15to20Closed);
  console.log('Summaries:', hotelRes.summaryPath, fnbRes.summaryPath);
  return { hotelRes, fnbRes, merged, hotel, fnb, perFile };
}

function main() {
  const opts = parseArgs(process.argv);

  if (opts.mode === 'files') {
    const missing = (opts.files || []).filter((f) => !fs.existsSync(f));
    if (missing.length) {
      console.error('Missing folio files:\n', missing.join('\n'));
      process.exit(1);
    }
    runSplitMerge(
      opts.files,
      opts.hotelOut || path.join(process.cwd(), 'Folio Transactions.merged.xlsx'),
      opts.fnbOut || path.join(process.cwd(), 'FnB Transactions.merged.xlsx'),
    );
    return;
  }

  if (opts.mode === 'ew') {
    const ewDir = opts.ewDir;
    if (!ewDir || !fs.existsSync(ewDir)) {
      console.error('Usage: node merge-folio-transactions.js --ew <ewDir>');
      process.exit(1);
    }
    const files = collectEwSources(ewDir);
    runSplitMerge(
      files,
      opts.hotelOut || path.join(ewDir, 'Folio Transactions.merged.xlsx'),
      opts.fnbOut || path.join(ewDir, 'FnB Transactions.merged.xlsx'),
    );
    return;
  }

  // Legacy single-directory mode
  const inputDir = opts.inputDir;
  const outputPath =
    opts.outputPath ??
    (inputDir
      ? path.join(inputDir, 'Folio Transactions.merged.xlsx')
      : path.join(process.cwd(), 'Folio Transactions.merged.xlsx'));

  if (!inputDir || !fs.existsSync(inputDir)) {
    console.error(
      'Usage:\n  node merge-folio-transactions.js <inputDir> [outputPath]\n  node merge-folio-transactions.js --ew <ewDir>'
    );
    process.exit(1);
  }

  const files = collectDirSources(inputDir);
  if (!files.length) {
    console.error('No .xlsx files in', inputDir);
    process.exit(1);
  }

  const { merged, headers, sheetName, totalRows } = mergeFiles(files);
  const { summary, summaryPath } = writeMerged(merged, headers, sheetName, outputPath, {
    stream: 'all',
    inputFiles: files.length,
    totalRawRows: totalRows,
    duplicatesRemoved: totalRows - merged.length,
  });

  console.log('Input files:', files.length);
  files.forEach((f) => console.log(' -', path.basename(f)));
  console.log('Total raw rows:', totalRows);
  console.log('Unique Folio Id:', merged.length);
  console.log('Duplicates removed:', totalRows - merged.length);
  console.log('Date range:', summary.dateMin, '->', summary.dateMax, '| days:', summary.uniqueDays);
  console.log('Written:', outputPath);
  console.log('Summary:', summaryPath);
}

main();
