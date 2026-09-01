/**
 * Stamp Elektraweb Guest Id onto FOCP reservation rows (Excel has Guest Name only).
 *
 *   npx tsx scripts/enrich-reservations-guest-id.ts [guestCards.xlsx] [reservations.xlsx] [out.xlsx]
 *
 * Optional overlay from live/API dump (Res Id → Guest Id):
 *   --api-map D:/ERA-BACKUP/.../res-guest-ids.json
 *
 * Writes summary JSON next to output (.guest-id-enrich.summary.json).
 */
import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import {
  buildGuestExternalRefLookup,
  resolveGuestExternalRefFromName,
} from '../src/lib/import/resolve-reservation-guest';

function parseArgs() {
  const args = process.argv.slice(2);
  const apiIdx = args.indexOf('--api-map');
  let apiMapPath: string | null = null;
  if (apiIdx >= 0) {
    apiMapPath = args[apiIdx + 1] ?? null;
    args.splice(apiIdx, apiMapPath ? 2 : 1);
  }
  const guestPath =
    args[0] ?? path.join('D:', 'ERA-BACKUP', 'NAFTA-START', 'hotel', '10-Guest-Cards.xlsx');
  const resPath =
    args[1] ?? path.join('D:', 'ERA-BACKUP', 'NAFTA-START', 'hotel', '11-Reservations.xlsx');
  const outPath = args[2] ?? resPath;
  return { guestPath, resPath, outPath, apiMapPath };
}

function readSheet(filePath: string): { sheetName: string; rows: Record<string, unknown>[] } {
  const wb = XLSX.read(fs.readFileSync(filePath), { type: 'buffer', cellDates: true });
  const sheetName = wb.SheetNames[0] ?? 'Sheet1';
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName], {
    defval: null,
  });
  return { sheetName, rows };
}

function loadApiMap(filePath: string): Map<string, string> {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>;
  const map = new Map<string, string>();
  for (const [resId, guestId] of Object.entries(raw)) {
    const g = String(guestId ?? '').trim();
    if (resId && g) map.set(String(resId).trim(), g);
  }
  return map;
}

function main() {
  const { guestPath, resPath, outPath, apiMapPath } = parseArgs();
  if (!fs.existsSync(guestPath)) throw new Error(`Missing guest cards: ${guestPath}`);
  if (!fs.existsSync(resPath)) throw new Error(`Missing reservations: ${resPath}`);

  const guestBook = readSheet(guestPath);
  const resBook = readSheet(resPath);
  const apiMap = apiMapPath && fs.existsSync(apiMapPath) ? loadApiMap(apiMapPath) : new Map();

  const guestRows = guestBook.rows
    .map((row) => {
      const externalRef = String(row['Guest Id'] ?? row.Id ?? '').trim();
      if (!externalRef || externalRef === 'NaN') return null;
      const nameField = String(row.Name ?? row['First Name'] ?? '').trim();
      const lastName = String(row['Last Name'] ?? row.Surname ?? '').trim();
      const nameParts = nameField.split(/\s+/).filter(Boolean);
      return {
        externalRef,
        fullName: [nameField, lastName].filter(Boolean).join(' '),
        ewRawName: nameField || null,
        firstName: nameParts[0] ?? null,
        middleName: nameParts.length > 1 ? nameParts.slice(1).join(' ') : null,
        lastName: lastName || null,
      };
    })
    .filter(Boolean) as Array<{
    externalRef: string;
    fullName: string;
    firstName: string | null;
    middleName: string | null;
    lastName: string | null;
  }>;

  const lookup = buildGuestExternalRefLookup(guestRows);

  let fromApi = 0;
  let fromName = 0;
  let alreadyHad = 0;
  let unmatched = 0;
  let ambiguous = 0;
  const unmatchedSamples: Array<{ resId: string; guestName: string }> = [];

  for (const row of resBook.rows) {
    const resId = String(row['Res Id'] ?? '').trim();
    const existing = String(row['Guest Id'] ?? row.GuestId ?? '').trim();
    if (existing && existing !== 'NaN') {
      alreadyHad += 1;
      continue;
    }

    const apiGuest = resId ? apiMap.get(resId) : undefined;
    if (apiGuest) {
      row['Guest Id'] = apiGuest;
      fromApi += 1;
      continue;
    }

    const guestName = String(row['Guest Name'] ?? '').trim();
    const matched = resolveGuestExternalRefFromName(guestName, lookup);
    if (matched) {
      row['Guest Id'] = matched;
      fromName += 1;
      continue;
    }

    if (!guestName) {
      unmatched += 1;
      continue;
    }

    const parts = guestName.split(/\s*\/\s*/).map((p) => p.trim()).filter(Boolean);
    const hits = new Set<string>();
    for (const part of parts.length ? parts : [guestName]) {
      const m = resolveGuestExternalRefFromName(part, lookup);
      if (m) hits.add(m);
    }
    if (hits.size > 1) ambiguous += 1;
    else {
      unmatched += 1;
      if (unmatchedSamples.length < 25) unmatchedSamples.push({ resId, guestName });
    }
  }

  const headers = new Set<string>();
  for (const row of resBook.rows) {
    for (const k of Object.keys(row)) headers.add(k);
  }
  if (!headers.has('Guest Id')) headers.add('Guest Id');
  const headerList = [...headers];
  if (headerList.includes('Guest Id')) {
    headerList.splice(headerList.indexOf('Guest Id'), 1);
    headerList.splice(headerList.indexOf('Guest Name') + 1, 0, 'Guest Id');
  }

  const outWs = XLSX.utils.json_to_sheet(resBook.rows, { header: headerList });
  const outWb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(outWb, outWs, resBook.sheetName);
  XLSX.writeFile(outWb, outPath);

  const summary = {
    guestCards: guestRows.length,
    reservations: resBook.rows.length,
    alreadyHadGuestId: alreadyHad,
    stampedFromApiMap: fromApi,
    stampedFromName: fromName,
    unmatched,
    ambiguous,
    apiMapPath,
    outPath,
    unmatchedSamples,
  };
  const summaryPath = outPath.replace(/\.xlsx$/i, '.guest-id-enrich.summary.json');
  fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify(summary, null, 2));
  console.log('Written:', outPath);
  console.log('Summary:', summaryPath);
}

main();
