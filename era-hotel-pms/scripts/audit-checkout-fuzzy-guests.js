/**
 * Fuzzy-match CheckOut reservations (unmatched by exact name) to Guest Cards.
 * Usage: node scripts/audit-checkout-fuzzy-guests.js [ewDir]
 */
const fs = require('fs');
const path = require('path');
const X = require('xlsx');

const ew = process.argv[2] || 'D:/ERA-BACKUP/NAFTA-START/hotel';

// --- transliteration maps (AZ / RU / common Latin variants) ---
const CHAR_MAP = {
  ə: 'e',
  ı: 'i',
  i̇: 'i',
  ğ: 'g',
  ü: 'u',
  ö: 'o',
  ç: 'c',
  ş: 's',
  ä: 'a',
  ñ: 'n',
  á: 'a',
  é: 'e',
  í: 'i',
  ó: 'o',
  ú: 'u',
  ý: 'y',
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  хх: 'kh',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
  ң: 'ng',
  қ: 'q',
  ғ: 'g',
  ү: 'u',
  ұ: 'u',
  ө: 'o',
  һ: 'h',
  і: 'i',
};

function foldLatin(s) {
  let out = '';
  const lower = String(s || '').toLowerCase().normalize('NFKD');
  for (const ch of lower) {
    if (CHAR_MAP[ch] != null) out += CHAR_MAP[ch];
    else if (/[a-z0-9]/.test(ch)) out += ch;
    else if (/\s/.test(ch)) out += ' ';
    // drop combining marks / punctuation
  }
  return out.replace(/\s+/g, ' ').trim();
}

function compact(s) {
  return foldLatin(s).replace(/\s+/g, '');
}

function tokens(s) {
  return foldLatin(s)
    .split(' ')
    .filter((t) => t.length >= 2);
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

function splitGuestParts(s) {
  return String(s || '')
    .split(/\s*\/\s*/)
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => {
      const f = foldLatin(p);
      return (
        f.length >= 3 &&
        !['999 fb', 'cash folio', 'balance', 'test qonaqlar folyo'].includes(f) &&
        !f.startsWith('cancelfolio')
      );
    });
}

// Levenshtein
function lev(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const m = a.length;
  const n = b.length;
  let prev = new Array(n + 1);
  let cur = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= n; j++) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}

function ratio(a, b) {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  const d = lev(a, b);
  return 1 - d / Math.max(a.length, b.length);
}

/** token-sort: sort tokens then compare */
function tokenSortRatio(a, b) {
  const ta = tokens(a).sort().join(' ');
  const tb = tokens(b).sort().join(' ');
  return ratio(ta, tb);
}

/** token-set: Jaccard on tokens + fuzzy for leftovers */
function tokenSetScore(a, b) {
  const A = new Set(tokens(a));
  const B = new Set(tokens(b));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  const jacc = inter / (A.size + B.size - inter);
  // also reward if shorter name is prefix-covered
  const ca = compact(a);
  const cb = compact(b);
  const pref =
    ca.length >= 6 && cb.length >= 6
      ? ca.startsWith(cb.slice(0, Math.min(10, cb.length))) ||
        cb.startsWith(ca.slice(0, Math.min(10, ca.length)))
        ? 0.15
        : 0
      : 0;
  return Math.min(1, jacc * 0.85 + tokenSortRatio(a, b) * 0.15 + pref);
}

function initialsScore(a, b) {
  // "A. Surname" / "Surname A" vs full
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.length < 1 || tb.length < 1) return 0;
  const lastA = ta[ta.length - 1];
  const lastB = tb[tb.length - 1];
  if (ratio(lastA, lastB) < 0.9) return 0;
  // first token initial match
  if (ta[0][0] === tb[0][0]) return 0.75 + 0.2 * ratio(lastA, lastB);
  // first of one equals last of other already handled
  return 0.55 * ratio(lastA, lastB);
}

function nicknameStrip(s) {
  // remove honorifics / relation noise
  return foldLatin(s)
    .replace(
      /\b(bey|beyin|xanim|xanimin|xanım|xanımın|oglu|oğlu|qizi|qızı|hanim|mr|mrs|ms|dr)\b/g,
      ' '
    )
    .replace(/\s+/g, ' ')
    .trim();
}

function scorePair(resPart, guestFull) {
  const a0 = resPart;
  const b0 = guestFull;
  const a = nicknameStrip(a0);
  const b = nicknameStrip(b0);
  if (!a || !b) return { score: 0, method: 'empty' };

  const exactFold = foldLatin(a0) === foldLatin(b0) || a === b;
  if (exactFold) return { score: 1, method: 'fold-exact' };

  const c1 = compact(a);
  const c2 = compact(b);
  if (c1 && c1 === c2) return { score: 0.99, method: 'compact-exact' };

  // truncated EW names (ends mid-word) — prefix of longer
  if (c1.length >= 8 && c2.length >= 8) {
    const shorter = c1.length <= c2.length ? c1 : c2;
    const longer = c1.length > c2.length ? c1 : c2;
    if (longer.startsWith(shorter) && shorter.length / longer.length >= 0.7) {
      return { score: 0.92, method: 'prefix-truncation' };
    }
  }

  const ts = tokenSortRatio(a, b);
  const set = tokenSetScore(a, b);
  const full = ratio(c1, c2);
  const init = initialsScore(a, b);

  // token-level best: each res token vs each guest token
  const ta = tokens(a);
  const tb = tokens(b);
  let tokBest = 0;
  if (ta.length && tb.length) {
    let sum = 0;
    for (const x of ta) {
      let best = 0;
      for (const y of tb) best = Math.max(best, ratio(x, y));
      sum += best;
    }
    tokBest = sum / ta.length;
  }

  const score = Math.max(ts, set, full * 0.95, init, tokBest * 0.9);
  let method = 'fuzzy';
  if (score === ts) method = 'token-sort';
  if (score === set) method = 'token-set';
  if (Math.abs(score - full * 0.95) < 1e-9) method = 'lev-compact';
  if (score === init) method = 'initials';
  if (Math.abs(score - tokBest * 0.9) < 1e-9) method = 'token-avg';

  return { score, method, detail: { ts, set, full, init, tokBest } };
}

console.log('Loading...');
const guests = load(path.join(ew, '10-Guest-Cards.merged.xlsx'));
const reservations = load(path.join(ew, '11-Reservations.merged.xlsx'));

// Build guest index
const guestRecords = [];
for (const g of guests) {
  const id = String(g['Guest Id'] ?? '').trim();
  if (!id || id === 'NaN') continue;
  const full = [g.Name, g['Last Name']].filter(Boolean).join(' ').trim();
  const rev = [g['Last Name'], g.Name].filter(Boolean).join(' ').trim();
  guestRecords.push({
    id,
    full,
    rev,
    fold: foldLatin(full),
    compact: compact(full),
    passport: String(g['Passport No'] ?? '').trim(),
    nationalId: String(g['National Id No'] ?? '').trim(),
    phone: String(g.Phone ?? '').trim(),
  });
}

// Exact fold index for quick hits
const exactFoldIndex = new Map();
for (const g of guestRecords) {
  for (const key of [foldLatin(g.full), foldLatin(g.rev), g.compact, compact(g.rev)]) {
    if (!key) continue;
    if (!exactFoldIndex.has(key)) exactFoldIndex.set(key, []);
    exactFoldIndex.get(key).push(g);
  }
}

// First-letter buckets to limit fuzzy comparisons
const buckets = new Map();
for (const g of guestRecords) {
  const t = tokens(g.full);
  const keys = new Set();
  for (const tok of t) {
    if (tok.length >= 2) keys.add(tok.slice(0, 2));
    if (tok.length >= 3) keys.add(tok.slice(0, 3));
  }
  // also last token
  if (t.length) {
    const last = t[t.length - 1];
    keys.add(last.slice(0, 2));
    keys.add(last.slice(0, 3));
  }
  for (const k of keys) {
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(g);
  }
}

function candidatesForPart(part) {
  const f = foldLatin(part);
  const c = compact(part);
  const found = new Map();
  for (const key of [f, c, compact(nicknameStrip(part))]) {
    for (const g of exactFoldIndex.get(key) || []) found.set(g.id, g);
  }
  const t = tokens(nicknameStrip(part));
  const keys = new Set();
  for (const tok of t) {
    if (tok.length >= 2) keys.add(tok.slice(0, 2));
    if (tok.length >= 3) keys.add(tok.slice(0, 3));
  }
  if (t.length) {
    const last = t[t.length - 1];
    keys.add(last.slice(0, 2));
    keys.add(last.slice(0, 3));
  }
  for (const k of keys) {
    for (const g of buckets.get(k) || []) found.set(g.id, g);
  }
  return [...found.values()];
}

function bestMatchForPart(part) {
  // quick exact
  const f = foldLatin(part);
  const c = compact(part);
  for (const key of [f, c, compact(nicknameStrip(part))]) {
    const hits = exactFoldIndex.get(key);
    if (hits && hits.length) {
      return {
        score: key === c || key === compact(nicknameStrip(part)) ? 0.99 : 1,
        method: 'index-exact',
        guestId: hits[0].id,
        guestName: hits[0].full,
      };
    }
  }

  const cands = candidatesForPart(part);
  let best = { score: 0, method: 'none', guestId: null, guestName: null };
  for (const g of cands) {
    for (const form of [g.full, g.rev]) {
      const r = scorePair(part, form);
      if (r.score > best.score) {
        best = {
          score: r.score,
          method: r.method,
          guestId: g.id,
          guestName: g.full,
        };
      }
    }
  }
  return best;
}

// Collect CheckOut with no exact match (same definition as previous audit)
function exactMatchAny(guestName) {
  const parts = splitGuestParts(guestName);
  for (const p of parts) {
    const f = foldLatin(p);
    const c = compact(p);
    // exact Name Last / Last Name using original exact from guest cards without fold
    // Use fold index as "exact" for baseline exclusion... wait user wants fuzzy on the 307
    // that were unmatched by STRICT exact (Name+Last without fold). Rebuild strict.
  }
  return false;
}

// Rebuild STRICT exact like audit-unmatched-guests.js
function strictNorm(s) {
  return String(s || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const strictIndex = new Map();
for (const g of guests) {
  const id = String(g['Guest Id'] ?? '').trim();
  if (!id || id === 'NaN') continue;
  const full = strictNorm([g.Name, g['Last Name']].filter(Boolean).join(' '));
  const rev = strictNorm([g['Last Name'], g.Name].filter(Boolean).join(' '));
  for (const k of [full, rev]) {
    if (!k) continue;
    if (!strictIndex.has(k)) strictIndex.set(k, id);
  }
}

function strictAnyMatch(guestName) {
  const parts = String(guestName || '')
    .split(/\s*\/\s*/)
    .map(strictNorm)
    .filter((n) => n.length >= 3);
  return parts.some((p) => strictIndex.has(p));
}

const checkoutUnmatched = [];
for (const r of reservations) {
  if (String(r.State) !== 'CheckOut') continue;
  const rid = String(r['Res Id'] ?? '').trim();
  if (!rid) continue;
  if (strictAnyMatch(r['Guest Name'])) continue;
  const parts = splitGuestParts(r['Guest Name']);
  if (!parts.length) continue; // skip empty/system
  checkoutUnmatched.push(r);
}

console.log('CheckOut without strict guest match (named):', checkoutUnmatched.length);

const HIGH = 0.88;
const MED = 0.78;

const results = [];
let high = 0;
let med = 0;
let low = 0;

for (const r of checkoutUnmatched) {
  const parts = splitGuestParts(r['Guest Name']);
  const partMatches = parts.map((p) => ({ part: p, ...bestMatchForPart(p) }));
  const best = partMatches.reduce(
    (a, b) => (b.score > a.score ? b : a),
    { score: 0, method: 'none', guestId: null, guestName: null, part: null }
  );
  let band = 'none';
  if (best.score >= HIGH) {
    band = 'high';
    high++;
  } else if (best.score >= MED) {
    band = 'medium';
    med++;
  } else {
    band = 'low';
    low++;
  }
  results.push({
    resId: String(r['Res Id']),
    guest: r['Guest Name'],
    arrival: excelDate(r.Arrival),
    departure: excelDate(r.Departure),
    agency: r.Agency,
    bestScore: +best.score.toFixed(3),
    band,
    method: best.method,
    matchedGuestId: best.guestId,
    matchedGuestName: best.guestName,
    matchedPart: best.part || partMatches.find((p) => p.guestId === best.guestId)?.part,
    allParts: partMatches.map((p) => ({
      part: p.part,
      score: +p.score.toFixed(3),
      method: p.method,
      guestId: p.guestId,
      guestName: p.guestName,
    })),
  });
}

results.sort((a, b) => b.bestScore - a.bestScore);

const summary = {
  checkoutUnmatchedNamed: checkoutUnmatched.length,
  thresholds: { high: HIGH, medium: MED },
  recovered: {
    high: high,
    medium: med,
    lowOrNone: low,
    highPct: +((100 * high) / checkoutUnmatched.length).toFixed(1),
    highPlusMedium: high + med,
    highPlusMediumPct: +(((100 * (high + med)) / checkoutUnmatched.length).toFixed(1)),
    stillUnmatched: low,
  },
  methodCountsHighMed: {},
  samplesHigh: results.filter((r) => r.band === 'high').slice(0, 20),
  samplesMedium: results.filter((r) => r.band === 'medium').slice(0, 20),
  samplesStillUnmatched: results.filter((r) => r.band === 'low').slice(0, 30),
};

for (const r of results.filter((x) => x.band === 'high' || x.band === 'medium')) {
  summary.methodCountsHighMed[r.method] =
    (summary.methodCountsHighMed[r.method] || 0) + 1;
}

const outJson = path.join(ew, 'AUDIT_checkout_fuzzy_guests.json');
fs.writeFileSync(outJson, JSON.stringify({ summary, results }, null, 2));

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
  path.join(ew, 'AUDIT_checkout_fuzzy_guests.csv'),
  toCsv(results, [
    'resId',
    'band',
    'bestScore',
    'method',
    'guest',
    'matchedPart',
    'matchedGuestId',
    'matchedGuestName',
    'arrival',
    'departure',
    'agency',
  ]),
  'utf8'
);

console.log(JSON.stringify(summary, null, 2));
console.log('\nWrote', outJson);
console.log('CSV', path.join(ew, 'AUDIT_checkout_fuzzy_guests.csv'));
