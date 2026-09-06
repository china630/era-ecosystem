/** Display helpers for room-plan bars and hover marker. */

export function formatPlanDate(iso: string | Date): string {
  const key =
    typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}/.test(iso)
      ? iso.slice(0, 10)
      : new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Baku' }).format(
          iso instanceof Date ? iso : new Date(iso),
        );
  const [y, m, d] = key.split('-');
  if (!y || !m || !d) return key;
  return `${d}.${m}.${y}`;
}

export function childrenTotal(
  c11: number | null | undefined,
  c5: number | null | undefined,
  c1: number | null | undefined,
): number {
  return (c11 ?? 0) + (c5 ?? 0) + (c1 ?? 0);
}

/** EW-style `1+0` (adults + children). */
export function formatPax(
  adults: number | null | undefined,
  c11?: number | null,
  c5?: number | null,
  c1?: number | null,
): string {
  return `${adults ?? 0}+${childrenTotal(c11, c5, c1)}`;
}

export function formatPlanBarNames(
  primary: string,
  partyNames: string[] = [],
  roommateNames: string[] = [],
): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of [primary, ...partyNames, ...roommateNames]) {
    const t = raw.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out.join(' / ');
}

/** Guest folio debt for the arrow-nose badge; null when settled. */
export function formatPlanDebtBadge(balance: number | null | undefined): string | null {
  if (balance == null || !Number.isFinite(balance) || balance <= 0.01) return null;
  if (balance >= 10) return String(Math.round(balance));
  return balance.toFixed(1);
}

export function planHeaderParts(
  ymd: string,
  locale: string,
): { day: string; weekday: string } {
  const [y, m, d] = ymd.split('-');
  const day = String(Number(d) || d);
  const dt = new Date(`${ymd}T08:00:00.000Z`);
  const weekday = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    timeZone: 'Asia/Baku',
  }).format(Number.isNaN(dt.getTime()) ? new Date() : dt);
  return { day, weekday };
}

export function hoverMarkerLabel(roomNumber: string, dateIso: string): string {
  return `${roomNumber} · ${formatPlanDate(dateIso)}`;
}
