import { normalizeNameKey } from '@/lib/mrz/names';

/** Known given-name pairs (Latin MRZ ↔ Cyrillic card). */
const GIVEN_PAIRS: Array<[string, string]> = [
  ['JEAN', 'ЖАН'],
  ['JEANPAUL', 'ЖАНПОЛЬ'],
  ['JEANPIERRE', 'ЖАНПЬЕР'],
  ['ALEXANDER', 'АЛЕКСАНДР'],
  ['ALEXANDRA', 'АЛЕКСАНДРА'],
  ['MICHAEL', 'МИХАИЛ'],
  ['NICHOLAS', 'НИКОЛАЙ'],
  ['GEORGE', 'ГЕОРГИЙ'],
  ['HELEN', 'ЕЛЕНА'],
  ['HELENA', 'ЕЛЕНА'],
  ['JOSEPH', 'ИОСИФ'],
  ['JOHN', 'ДЖОН'],
  ['MARY', 'МАРИЯ'],
  ['MARIA', 'МАРИЯ'],
  ['ANNA', 'АННА'],
  ['PAUL', 'ПОЛЬ'],
  ['PIERRE', 'ПЬЕР'],
  ['CATHERINE', 'ЕКАТЕРИНА'],
  ['ELIZABETH', 'ЕЛИЗАВЕТА'],
];

const CYR_TO_LAT: Record<string, string> = {
  А: 'A',
  Б: 'B',
  В: 'V',
  Г: 'G',
  Д: 'D',
  Е: 'E',
  Ё: 'E',
  Ж: 'ZH',
  З: 'Z',
  И: 'I',
  Й: 'Y',
  К: 'K',
  Л: 'L',
  М: 'M',
  Н: 'N',
  О: 'O',
  П: 'P',
  Р: 'R',
  С: 'S',
  Т: 'T',
  У: 'U',
  Ф: 'F',
  Х: 'KH',
  Ц: 'TS',
  Ч: 'CH',
  Ш: 'SH',
  Щ: 'SHCH',
  Ъ: '',
  Ы: 'Y',
  Ь: '',
  Э: 'E',
  Ю: 'YU',
  Я: 'YA',
  Ә: 'A',
  Ө: 'O',
  Ү: 'U',
  Ғ: 'G',
  Қ: 'Q',
  Һ: 'H',
  Ң: 'NG',
  І: 'I',
};

/** Cyrillic (and mixed) → Latin passport-style key for matching. */
export function cyrillicToLatinKey(raw: string): string {
  let out = '';
  const upper = raw.toUpperCase().replace(/Ё/g, 'Е');
  for (const ch of upper) {
    if (CYR_TO_LAT[ch] !== undefined) out += CYR_TO_LAT[ch];
    else if (/[A-Z0-9]/.test(ch)) out += ch;
  }
  return normalizeNameKey(out);
}

function latinVariants(raw: string): string[] {
  // Cyrillic is stripped by normalizeNameKey — transliterate first.
  const fromCyr = cyrillicToLatinKey(raw);
  const key = normalizeNameKey(raw) || fromCyr;
  if (!key) return [];
  const set = new Set<string>([key]);
  if (fromCyr) set.add(fromCyr);
  for (const [lat, cyrForm] of GIVEN_PAIRS) {
    const pairCyr = cyrillicToLatinKey(cyrForm);
    if (key === lat || fromCyr === lat || key === pairCyr || fromCyr === pairCyr) {
      set.add(lat);
      if (pairCyr) set.add(pairCyr);
    }
  }
  return [...set].filter(Boolean);
}

/** True when first+last match after folding, transliteration, or known ICAO pairs. */
export function namesMatchWithTranslit(
  aFirst: string,
  aLast: string,
  bFirst: string,
  bLast: string,
): boolean {
  const aFirsts = latinVariants(aFirst);
  const aLasts = latinVariants(aLast);
  const bFirsts = latinVariants(bFirst);
  const bLasts = latinVariants(bLast);
  if (!aFirsts.length || !aLasts.length || !bFirsts.length || !bLasts.length) return false;
  const firstHit = aFirsts.some((a) => bFirsts.includes(a));
  const lastHit = aLasts.some((a) => bLasts.includes(a));
  return firstHit && lastHit;
}

export function normalizeMrzNameField(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9<]/g, '')
    .replace(/<+$/g, '');
}
