/**
 * List reservations / folio hotel rows whose guest names do not match Guest Cards.
 * Usage: node scripts/audit-unmatched-guests.js [ewDir]
 */
const fs = require('fs');
const path = require('path');
const X = require('xlsx');

const ew = process.argv[2] || 'D:/ERA-BACKUP/NAFTA-START/hotel';

function normName(s) {
  return String(s || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const SKIP = new Set([
  '999 fb',
  'cash folio',
  'balance',
  'test qonaqlar folyo',
  'cancelfolio',
]);

function splitGuestNames(s) {
  return String(s || '')
    .split(/\s*\/\s*/)
    .map(normName)
    .filter(Boolean)
    .filter((n) => n.length >= 3 && !SKIP.has(n) && !n.startsWith('cancelfolio'));
}

function load(fp) {
  const wb = X.readFile(fp, { cellDates: false });
  return X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null, raw: true });
}

function excelDate(v) {
  if (typeof v === 'number' && v >= 1000 && v < 80000) {
    const d = X.SSF.parse_date_code(v);
    if (!d || d.y < 1901) return null;
    return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  return null;
}

const guests = load(path.join(ew, '10-Guest-Cards.merged.xlsx'));
const reservations = load(path.join(ew, '11-Reservations.merged.xlsx'));
const folioHotel = load(path.join(ew, '12-Folio-Transactions.merged.xlsx'));

const guestNameToIds = new Map();
for (const g of guests) {
  const id = String(g['Guest Id'] ?? '').trim();
  if (!id || id === 'NaN') continue;
  const full = normName([g.Name, g['Last Name']].filter(Boolean).join(' '));
  const rev = normName([g['Last Name'], g.Name].filter(Boolean).join(' '));
  for (const key of [full, rev]) {
    if (!key) continue;
    if (!guestNameToIds.has(key)) guestNameToIds.set(key, new Set());
    guestNameToIds.get(key).add(id);
  }
}

function matchParts(guestName) {
  const parts = splitGuestNames(guestName);
  const matched = [];
  const unmatched = [];
  for (const p of parts) {
    if (guestNameToIds.has(p)) matched.push(p);
    else unmatched.push(p);
  }
  return {
    parts,
    matched,
    unmatched,
    any: matched.length > 0,
    all: parts.length > 0 && unmatched.length === 0,
  };
}

const resNoMatch = [];
const resPartial = [];
const resEmpty = [];
const byState = {};

for (const r of reservations) {
  const rid = String(r['Res Id'] ?? '').trim();
  if (!rid || rid === '0') continue;
  const st = String(r.State || 'UNKNOWN');
  if (!byState[st]) {
    byState[st] = { n: 0, noMatch: 0, partial: 0, full: 0, emptyName: 0 };
  }
  byState[st].n++;
  const m = matchParts(r['Guest Name']);
  const row = {
    resId: rid,
    state: st,
    guest: r['Guest Name'],
    arrival: excelDate(r.Arrival),
    departure: excelDate(r.Departure),
    parts: m.parts,
    matched: m.matched,
    unmatched: m.unmatched,
  };
  if (m.parts.length === 0) {
    byState[st].emptyName++;
    resEmpty.push(row);
  } else if (!m.any) {
    byState[st].noMatch++;
    resNoMatch.push(row);
  } else if (!m.all) {
    byState[st].partial++;
    resPartial.push(row);
  } else {
    byState[st].full++;
  }
}

const folioNameStats = new Map();
for (const row of folioHotel) {
  const gn = String(row['Guest Name'] ?? '').trim();
  if (!gn) continue;
  const rid = String(row['Res Id'] ?? '').trim();
  let s = folioNameStats.get(gn);
  if (!s) {
    const m = matchParts(gn);
    s = {
      lines: 0,
      resIds: new Set(),
      any: m.any,
      all: m.all,
      parts: m.parts,
      unmatched: m.unmatched,
      matched: m.matched,
    };
    folioNameStats.set(gn, s);
  }
  s.lines++;
  if (rid && rid !== '0') s.resIds.add(rid);
}

const folioNoMatch = [...folioNameStats.entries()]
  .filter(([, s]) => s.parts.length > 0 && !s.any)
  .sort((a, b) => b[1].lines - a[1].lines);

const folioPartial = [...folioNameStats.entries()]
  .filter(([, s]) => s.any && !s.all)
  .sort((a, b) => b[1].lines - a[1].lines);

const folioEmptyParts = [...folioNameStats.entries()].filter(
  ([, s]) => s.parts.length === 0
);

const out = {
  method:
    'Exact normalized Name+LastName (and reverse) vs split parts of Guest Name (A / B / C). No Guest Id on FOCP/Folio exports.',
  guestsIndexed: guestNameToIds.size,
  reservations: {
    total: byState && Object.values(byState).reduce((a, s) => a + s.n, 0),
    noGuestCardMatch: resNoMatch.length,
    emptyOrSystemName: resEmpty.length,
    partialMultiGuest: resPartial.length,
    fullMatch: Object.values(byState).reduce((a, s) => a + s.full, 0),
    byState,
  },
  folioHotel: {
    distinctGuestNameStrings: folioNameStats.size,
    nameStringsWithNoMatch: folioNoMatch.length,
    nameStringsPartial: folioPartial.length,
    nameStringsSystemOrEmptyParts: folioEmptyParts.length,
    linesBehindNoMatchNames: folioNoMatch.reduce((a, [, s]) => a + s.lines, 0),
    topNoMatchNames: folioNoMatch.slice(0, 40).map(([name, s]) => ({
      guestName: name,
      lines: s.lines,
      distinctResIds: s.resIds.size,
      unmatchedParts: s.unmatched,
    })),
  },
  sampleReservationsNoMatch: resNoMatch.slice(0, 40),
  sampleReservationsPartial: resPartial.slice(0, 20),
  sampleReservationsEmptyName: resEmpty.slice(0, 15),
};

const outPath = path.join(ew, 'AUDIT_unmatched_guests.json');
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));

// Also write CSVs for easy browsing
function toCsv(rows, cols) {
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /["\n,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(',')]
    .concat(rows.map((r) => cols.map((c) => esc(r[c])).join(',')))
    .join('\n');
}

fs.writeFileSync(
  path.join(ew, 'AUDIT_reservations_unmatched_guests.csv'),
  toCsv(
    resNoMatch.map((r) => ({
      resId: r.resId,
      state: r.state,
      arrival: r.arrival,
      departure: r.departure,
      guest: r.guest,
      unmatchedParts: (r.unmatched || []).join(' | '),
    })),
    ['resId', 'state', 'arrival', 'departure', 'guest', 'unmatchedParts']
  ),
  'utf8'
);

fs.writeFileSync(
  path.join(ew, 'AUDIT_folio_unmatched_guest_names.csv'),
  toCsv(
    folioNoMatch.map(([name, s]) => ({
      guestName: name,
      lines: s.lines,
      distinctResIds: s.resIds.size,
      unmatchedParts: s.unmatched.join(' | '),
      sampleResIds: [...s.resIds].slice(0, 5).join(' '),
    })),
    ['guestName', 'lines', 'distinctResIds', 'unmatchedParts', 'sampleResIds']
  ),
  'utf8'
);

console.log(
  JSON.stringify(
    {
      reservations: out.reservations,
      folioHotel: {
        distinctGuestNameStrings: out.folioHotel.distinctGuestNameStrings,
        nameStringsWithNoMatch: out.folioHotel.nameStringsWithNoMatch,
        nameStringsPartial: out.folioHotel.nameStringsPartial,
        linesBehindNoMatchNames: out.folioHotel.linesBehindNoMatchNames,
        topNoMatchNames: out.folioHotel.topNoMatchNames.slice(0, 12),
      },
      sampleReservationsNoMatch: out.sampleReservationsNoMatch.slice(0, 10),
    },
    null,
    2
  )
);
console.log('\nWrote', outPath);
console.log('CSV:', path.join(ew, 'AUDIT_reservations_unmatched_guests.csv'));
console.log('CSV:', path.join(ew, 'AUDIT_folio_unmatched_guest_names.csv'));
