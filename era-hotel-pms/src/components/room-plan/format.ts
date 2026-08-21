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

export function hoverMarkerLabel(roomNumber: string, dateIso: string): string {
  return `${roomNumber} · ${formatPlanDate(dateIso)}`;
}
