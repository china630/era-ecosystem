/** Search key: upper case, hyphens and extra spaces removed. Shared with hotel MRZ. */
export function normalizeNameKey(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/</g, " ")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");
}

function damerauLevenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const d: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i += 1) d[i]![0] = i;
  for (let j = 0; j <= n; j += 1) d[0]![j] = j;
  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        best = Math.min(best, d[i - 2]![j - 2]! + 1);
      }
      d[i]![j] = best;
    }
  }
  return d[m]![n]!;
}

export function isSimilarPersonName(
  aFirst: string,
  aLast: string,
  bFirst: string,
  bLast: string,
): boolean {
  const af = normalizeNameKey(aFirst);
  const al = normalizeNameKey(aLast);
  const bf = normalizeNameKey(bFirst);
  const bl = normalizeNameKey(bLast);
  if (!af || !al || !bf || !bl) return false;
  if (af === bf && al === bl) return false;
  return damerauLevenshtein(al, bl) <= 1 && damerauLevenshtein(af, bf) <= 1;
}

function latinMetaphone(raw: string): string {
  let s = normalizeNameKey(raw);
  if (!s) return "";
  s = s
    .replace(/PH/g, "F")
    .replace(/KN/g, "N")
    .replace(/WR/g, "R")
    .replace(/ZH/g, "J")
    .replace(/SCH/g, "S")
    .replace(/CH/g, "X")
    .replace(/CK/g, "K")
    .replace(/[AEIOUY]/g, (ch, offset: number) => (offset === 0 ? ch : ""));
  let out = "";
  for (const ch of s) {
    if (out.endsWith(ch)) continue;
    out += ch;
  }
  return out.slice(0, 8);
}

export function sameMetaphoneName(
  aFirst: string,
  aLast: string,
  bFirst: string,
  bLast: string,
): boolean {
  if (isSimilarPersonName(aFirst, aLast, bFirst, bLast)) return false;
  const af = normalizeNameKey(aFirst);
  const al = normalizeNameKey(aLast);
  const bf = normalizeNameKey(bFirst);
  const bl = normalizeNameKey(bLast);
  if (!af || !al || !bf || !bl) return false;
  if (af === bf && al === bl) return false;
  return latinMetaphone(aFirst) === latinMetaphone(bFirst) && latinMetaphone(aLast) === latinMetaphone(bLast);
}

export function namesClearlyDiffer(
  aFirst: string,
  aLast: string,
  bFirst: string,
  bLast: string,
): boolean {
  const af = normalizeNameKey(aFirst);
  const al = normalizeNameKey(aLast);
  const bf = normalizeNameKey(bFirst);
  const bl = normalizeNameKey(bLast);
  if (!af || !al || !bf || !bl) return false;
  return af !== bf || al !== bl;
}
