/** Soft priority then numeric room# — sheet API, PDF, and unit tests. */
export function compareFloorSheetRows(
  a: {
    jobDuty?: string | null;
    vip?: string | boolean | null;
    neededByAt?: string | Date | null;
    hkCondition?: string | null;
    roomNumber?: string | number | null;
  },
  b: {
    jobDuty?: string | null;
    vip?: string | boolean | null;
    neededByAt?: string | Date | null;
    hkCondition?: string | null;
    roomNumber?: string | number | null;
  },
): number {
  const rank = (duty: string) =>
    duty === 'DEPARTURE' ? 0 : duty === 'DEEP' ? 1 : duty === 'LINEN' ? 2 : duty === 'ARRIVAL_PREP' ? 3 : 4;
  if (a.jobDuty === 'DEPARTURE' && b.jobDuty !== 'DEPARTURE') return -1;
  if (b.jobDuty === 'DEPARTURE' && a.jobDuty !== 'DEPARTURE') return 1;
  const vip = Number(Boolean(b.vip)) - Number(Boolean(a.vip));
  if (vip !== 0) return vip;
  const na = a.neededByAt ? new Date(a.neededByAt).getTime() : Number.POSITIVE_INFINITY;
  const nb = b.neededByAt ? new Date(b.neededByAt).getTime() : Number.POSITIVE_INFINITY;
  if (na !== nb) return na - nb;
  const dirty = Number(b.hkCondition === 'DIRTY') - Number(a.hkCondition === 'DIRTY');
  if (dirty !== 0) return dirty;
  const byDuty = rank(String(a.jobDuty ?? '')) - rank(String(b.jobDuty ?? ''));
  if (byDuty !== 0) return byDuty;
  return String(a.roomNumber ?? '').localeCompare(String(b.roomNumber ?? ''), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}
