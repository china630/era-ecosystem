import { getBusinessDateStatus } from '@/lib/services/business-date.service';

export type YearEndAction = 'LAST_DAY' | 'FIRST_DAY';

export async function getYearEndPreview() {
  const status = await getBusinessDateStatus();
  const iso = status.currentBusinessDate;
  const [, month, day] = iso.split('-').map(Number);
  const isLastDayOfYear = month === 12 && day === 31;
  const isFirstDayOfYear = month === 1 && day === 1;
  const year = Number(iso.slice(0, 4));

  return {
    businessDate: iso,
    wallClockDate: status.wallClockDate,
    businessDayStatus: status.businessDayStatus,
    year,
    isLastDayOfYear,
    isFirstDayOfYear,
    enabled: false,
    note:
      'Year-end posting is staged (ADR hotel-year-end-calendar). Live close/open requires Finance calendar sign-off + yearEndPostingEnabled.',
  };
}

export async function runYearEndAction(action: YearEndAction) {
  const preview = await getYearEndPreview();
  return {
    ok: false as const,
    code: 'YEAR_END_NOT_ENABLED' as const,
    action,
    preview,
    message:
      action === 'LAST_DAY'
        ? 'Last day of year close is not enabled yet (menu + preview only).'
        : 'First day of year open is not enabled yet (menu + preview only).',
  };
}
