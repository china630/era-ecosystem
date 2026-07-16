/**
 * Audit Nafta EW merged exports: Reservations ↔ Guest Cards ↔ Folio.
 * Usage: node scripts/audit-reservation-guest-folio.js [ewDir]
 */
const fs = require('fs');
const path = require('path');
const X = require('xlsx');

const ew = process.argv[2] || 'C:/Users/ASUS G752VT/Downloads/EW';

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

function normName(s) {
  return String(s || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const SKIP_NAMES = new Set([
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
    .filter((n) => n.length >= 3 && !SKIP_NAMES.has(n) && !n.startsWith('cancelfolio'));
}

function load(fp) {
  const wb = X.readFile(fp, { cellDates: false });
  return X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null, raw: true });
}

function folioIndex(rows) {
  const byRes = new Map();
  let noRes = 0;
  let lines = 0;
  for (const row of rows) {
    const tid = String(row.Id ?? '').trim();
    if (!tid || tid === '0' || tid === 'NaN') continue;
    lines++;
    const rid = String(row['Res Id'] ?? '').trim();
    if (!rid || rid === '0' || rid === 'NaN') {
      noRes++;
      continue;
    }
    let agg = byRes.get(rid);
    if (!agg) {
      agg = { lines: 0, amount: 0, guests: new Set(), dateMin: null, dateMax: null };
      byRes.set(rid, agg);
    }
    agg.lines++;
    const amt = Number(row['Local Amount'] ?? row['Currency Amount'] ?? 0);
    if (!Number.isNaN(amt)) agg.amount += amt;
    const gn = String(row['Guest Name'] ?? '').trim();
    if (gn) agg.guests.add(gn);
    const d = excelDate(row.Date);
    if (d) {
      if (!agg.dateMin || d < agg.dateMin) agg.dateMin = d;
      if (!agg.dateMax || d > agg.dateMax) agg.dateMax = d;
    }
  }
  return { byRes, noRes, lines };
}

console.log('Loading from', ew);
const reservations = load(path.join(ew, 'Reservations.merged.xlsx'));
const guests = load(path.join(ew, 'Guest Cards.merged.xlsx'));
const folioHotel = load(path.join(ew, 'Folio Transactions.merged.xlsx'));
const folioFnb = load(path.join(ew, 'FnB Transactions.merged.xlsx'));

const guestsById = new Map();
const guestNameToIds = new Map();
for (const g of guests) {
  const id = String(g['Guest Id'] ?? '').trim();
  if (!id || id === 'NaN') continue;
  guestsById.set(id, g);
  const full = normName([g.Name, g['Last Name']].filter(Boolean).join(' '));
  const rev = normName([g['Last Name'], g.Name].filter(Boolean).join(' '));
  for (const key of [full, rev]) {
    if (!key) continue;
    if (!guestNameToIds.has(key)) guestNameToIds.set(key, new Set());
    guestNameToIds.get(key).add(id);
  }
}

const resById = new Map();
const resStates = {};
for (const r of reservations) {
  const id = String(r['Res Id'] ?? '').trim();
  if (!id || id === '0' || id === 'NaN') continue;
  resById.set(id, r);
  const st = String(r.State || 'UNKNOWN');
  resStates[st] = (resStates[st] || 0) + 1;
}

const hotel = folioIndex(folioHotel);
const fnb = folioIndex(folioFnb);

function matchReservationToGuests(res) {
  const parts = splitGuestNames(res['Guest Name']);
  const matched = new Set();
  for (const p of parts) {
    const ids = guestNameToIds.get(p);
    if (ids) for (const id of ids) matched.add(id);
  }
  return { parts, matchedIds: [...matched] };
}

let resWithGuestCard = 0;
let resWithFolioHotel = 0;
let resWithFolioFnb = 0;
let resWithAnyFolio = 0;
let resOrphanNoFolio = 0;
const orphanResSamples = [];
const resGuestMatchSamples = [];
const byStateCoverage = {};

for (const [rid, res] of resById) {
  const st = String(res.State || 'UNKNOWN');
  if (!byStateCoverage[st]) {
    byStateCoverage[st] = { n: 0, withGuest: 0, withHotelFolio: 0, withAnyFolio: 0 };
  }
  byStateCoverage[st].n++;

  const gm = matchReservationToGuests(res);
  const hasGuest = gm.matchedIds.length > 0;
  const hasHotel = hotel.byRes.has(rid);
  const hasFnb = fnb.byRes.has(rid);
  const hasAny = hasHotel || hasFnb;

  if (hasGuest) {
    resWithGuestCard++;
    byStateCoverage[st].withGuest++;
  }
  if (hasHotel) {
    resWithFolioHotel++;
    byStateCoverage[st].withHotelFolio++;
  }
  if (hasFnb) resWithFolioFnb++;
  if (hasAny) {
    resWithAnyFolio++;
    byStateCoverage[st].withAnyFolio++;
  }

  if (!hasAny && (st === 'CheckOut' || st === 'InHouse')) {
    resOrphanNoFolio++;
    if (orphanResSamples.length < 20) {
      orphanResSamples.push({
        resId: rid,
        state: st,
        guest: res['Guest Name'],
        arrival: excelDate(res.Arrival) || res.Arrival,
        departure: excelDate(res.Departure) || res.Departure,
        guestMatched: hasGuest,
      });
    }
  }
  if (hasGuest && resGuestMatchSamples.length < 5) {
    resGuestMatchSamples.push({
      resId: rid,
      guest: res['Guest Name'],
      matchedGuestIds: gm.matchedIds,
    });
  }
}

let hotelFolioOrphanRes = 0;
let fnbFolioOrphanRes = 0;
const hotelOrphanSamples = [];
for (const rid of hotel.byRes.keys()) {
  if (!resById.has(rid)) {
    hotelFolioOrphanRes++;
    if (hotelOrphanSamples.length < 10) {
      const a = hotel.byRes.get(rid);
      hotelOrphanSamples.push({
        resId: rid,
        lines: a.lines,
        guests: [...a.guests].slice(0, 2),
        dateMin: a.dateMin,
        dateMax: a.dateMax,
      });
    }
  }
}
for (const rid of fnb.byRes.keys()) {
  if (!resById.has(rid)) fnbFolioOrphanRes++;
}

const folioGuestNames = new Set();
for (const row of folioHotel) {
  for (const p of splitGuestNames(row['Guest Name'])) folioGuestNames.add(p);
}
let folioNamesMatched = 0;
for (const n of folioGuestNames) {
  if (guestNameToIds.has(n)) folioNamesMatched++;
}

const report = {
  generatedAt: new Date().toISOString(),
  files: {
    reservations: 'Reservations.merged.xlsx',
    guests: 'Guest Cards.merged.xlsx',
    folioHotel: 'Folio Transactions.merged.xlsx',
    folioFnb: 'FnB Transactions.merged.xlsx',
  },
  counts: {
    reservations: resById.size,
    reservationStates: resStates,
    guests: guestsById.size,
    folioHotelLines: hotel.lines,
    folioHotelUniqueResIds: hotel.byRes.size,
    folioHotelLinesWithoutResId: hotel.noRes,
    folioFnbLines: fnb.lines,
    folioFnbUniqueResIds: fnb.byRes.size,
    folioFnbLinesWithoutResId: fnb.noRes,
  },
  linkage: {
    reservationsWithExactGuestCardNameMatch: resWithGuestCard,
    reservationsWithExactGuestCardNameMatchPct: +(
      (100 * resWithGuestCard) /
      resById.size
    ).toFixed(1),
    reservationsWithHotelFolio: resWithFolioHotel,
    reservationsWithHotelFolioPct: +((100 * resWithFolioHotel) / resById.size).toFixed(1),
    reservationsWithFnbFolio: resWithFolioFnb,
    reservationsWithAnyFolio: resWithAnyFolio,
    reservationsWithAnyFolioPct: +((100 * resWithAnyFolio) / resById.size).toFixed(1),
    checkoutOrInHouseWithoutAnyFolio: resOrphanNoFolio,
    hotelFolioResIdsMissingInReservations: hotelFolioOrphanRes,
    hotelFolioResIdsMissingPct: +(
      (100 * hotelFolioOrphanRes) /
      Math.max(1, hotel.byRes.size)
    ).toFixed(1),
    fnbFolioResIdsMissingInReservations: fnbFolioOrphanRes,
    folioHotelDistinctGuestNameParts: folioGuestNames.size,
    folioHotelGuestNamePartsMatchedToGuestCards: folioNamesMatched,
    folioHotelGuestNameMatchPct: +(
      (100 * folioNamesMatched) /
      Math.max(1, folioGuestNames.size)
    ).toFixed(1),
  },
  coverageByReservationState: byStateCoverage,
  samples: {
    checkoutInHouseWithoutFolio: orphanResSamples,
    hotelFolioWithoutReservation: hotelOrphanSamples,
    reservationGuestCardMatches: resGuestMatchSamples,
  },
  notes: [
    'FOCP Reservations export has Guest Name only (no Guest Id). Guest match = exact normalized Name+LastName against split parts of Guest Name.',
    'Multi-guest strings (A / B / C) match if ANY part hits a guest card.',
    'Name spelling variance lowers guest match rate; Res Id is the strong key for reservation↔folio.',
    'FnB house ledger often uses 999 FB / CASH FOLIO — weak reservation identity by design.',
  ],
};

const out = path.join(ew, 'AUDIT_reservation_guest_folio.json');
fs.writeFileSync(out, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ counts: report.counts, linkage: report.linkage }, null, 2));
console.log('\nCoverage by state:');
for (const [st, c] of Object.entries(byStateCoverage).sort((a, b) => b[1].n - a[1].n)) {
  console.log(
    `  ${st}: n=${c.n} guest=${c.withGuest} (${((100 * c.withGuest) / c.n).toFixed(0)}%) hotelFolio=${c.withHotelFolio} (${((100 * c.withHotelFolio) / c.n).toFixed(0)}%) anyFolio=${c.withAnyFolio} (${((100 * c.withAnyFolio) / c.n).toFixed(0)}%)`
  );
}
console.log('\nWrote', out);
