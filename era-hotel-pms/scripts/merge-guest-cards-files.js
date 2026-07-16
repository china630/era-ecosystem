/**
 * Merge explicit Guest Cards chunk paths → Guest Cards.merged.xlsx
 * Usage:
 *   node scripts/merge-guest-cards-files.js --out <out.xlsx> <chunk1.xlsx> [chunk2...]
 *   node scripts/merge-guest-cards-files.js --dir <dir> --out <out.xlsx>
 */
const fs = require('fs');
const path = require('path');
const X = require('xlsx');

function filledCount(row) {
  return Object.values(row).filter((v) => v != null && String(v).trim() !== '').length;
}

function parseArgs(argv) {
  const args = argv.slice(2);
  let out = null;
  let dir = null;
  const files = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--out') {
      out = args[++i];
    } else if (args[i] === '--dir') {
      dir = args[++i];
    } else if (args[i].endsWith('.xlsx')) {
      files.push(args[i]);
    }
  }
  if (dir) {
    for (const f of fs.readdirSync(dir).sort()) {
      if (
        f.toLowerCase().endsWith('.xlsx') &&
        f.startsWith('Guest Cards') &&
        !f.includes('.merged.')
      ) {
        files.push(path.join(dir, f));
      }
    }
  }
  return { out, files: [...new Set(files.map((f) => path.resolve(f)))] };
}

function main() {
  const { out, files } = parseArgs(process.argv);
  if (!out || !files.length) {
    console.error(
      'Usage: node merge-guest-cards-files.js --out <out.xlsx> <chunk.xlsx>...\n' +
        '   or: node merge-guest-cards-files.js --dir <dir> --out <out.xlsx>'
    );
    process.exit(1);
  }

  for (const f of files) {
    if (!fs.existsSync(f)) {
      console.error('Missing:', f);
      process.exit(1);
    }
  }

  let sheetName = null;
  const headers = [];
  const headerSet = new Set();
  const byGuestId = new Map();
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
      const guestId = String(row['Guest Id'] ?? '').trim();
      if (!guestId || guestId === 'NaN' || guestId === 'null') {
        skipped++;
        continue;
      }
      const prev = byGuestId.get(guestId);
      if (!prev) {
        byGuestId.set(guestId, row);
        added++;
      } else if (filledCount(row) >= filledCount(prev)) {
        byGuestId.set(guestId, row);
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
    console.log(
      path.basename(filePath),
      'rows',
      rows.length,
      '+',
      added,
      '~',
      updated,
      '=',
      skipped
    );
  }

  const merged = [...byGuestId.values()].sort((a, b) => {
    const ai = Number(a['Guest Id']);
    const bi = Number(b['Guest Id']);
    if (!Number.isNaN(ai) && !Number.isNaN(bi)) return ai - bi;
    return String(a['Guest Id']).localeCompare(String(b['Guest Id']));
  });
  merged.forEach((r, i) => {
    r['#'] = String(i + 1);
  });

  const outAbs = path.resolve(out);
  const tmp = outAbs + '.tmp.xlsx';
  const outWs = X.utils.json_to_sheet(merged, { header: headers });
  const outWb = X.utils.book_new();
  X.utils.book_append_sheet(outWb, outWs, (sheetName || 'Guest cards').slice(0, 31));
  X.writeFile(outWb, tmp);

  // Verify tmp before replace
  const checkWb = X.readFile(tmp, { cellDates: false });
  const checkRows = X.utils.sheet_to_json(checkWb.Sheets[checkWb.SheetNames[0]], {
    defval: null,
    raw: true,
  });
  const checkIds = new Set();
  for (const r of checkRows) {
    const id = String(r['Guest Id'] ?? '').trim();
    if (id && id !== 'NaN') checkIds.add(id);
  }

  if (checkIds.size !== merged.length) {
    console.error(
      'VERIFY FAIL: written unique',
      checkIds.size,
      '!= merged',
      merged.length
    );
    process.exit(1);
  }
  if (checkIds.size < 100) {
    console.error('VERIFY FAIL: suspiciously few guests', checkIds.size);
    process.exit(1);
  }

  fs.renameSync(tmp, outAbs);

  const summary = {
    sources: files.map((f) => path.basename(f)),
    perFile,
    totalRawRows: totalRows,
    uniqueGuestIds: merged.length,
    verifiedReadBack: checkIds.size,
    outputPath: outAbs,
    fileSizeBytes: fs.statSync(outAbs).size,
  };
  const summaryPath = outAbs.replace(/\.xlsx$/i, '.summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8');

  console.log('\n=== GUEST MERGE OK ===');
  console.log('Raw rows:', totalRows);
  console.log('Unique Guest Id:', merged.length);
  console.log('Verified read-back:', checkIds.size);
  console.log('Size bytes:', summary.fileSizeBytes);
  console.log('Written:', outAbs);
  console.log('Summary:', summaryPath);
}

main();
