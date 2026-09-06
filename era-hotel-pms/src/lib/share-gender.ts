/** Share-pool gender snapshot. Safe for client bundles (no Prisma). */

export type ShareGender = 'M' | 'F';

export function normalizeShareGender(g: string | null | undefined): ShareGender | null {
  if (g == null) return null;
  const raw = String(g).trim();
  if (!raw) return null;
  const u = raw.toUpperCase();
  // Elektraweb Guest Cards UI: "0 - Male" / "1 - Female" (numeric codes in export/API).
  if (u === '0' || u.startsWith('0 ') || u === '2' || u.startsWith('2 ')) return 'M';
  if (u === '1' || u.startsWith('1 ')) return 'F';
  if (u === 'M' || u === 'MALE' || u === '♂' || u === 'ERKEK' || u === 'KİŞİ' || u === 'KISI') {
    return 'M';
  }
  if (u === 'F' || u === 'FEMALE' || u === '♀' || u === 'KADIN' || u === 'QADIN') return 'F';
  if (/\bMALE\b/.test(u) && !/\bFEMALE\b/.test(u)) return 'M';
  if (/\bFEMALE\b/.test(u)) return 'F';
  return null;
}
