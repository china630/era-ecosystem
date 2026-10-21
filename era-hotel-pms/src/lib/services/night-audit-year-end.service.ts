import { getBusinessDateStatus } from '@/lib/services/business-date.service';
import {
  lastDayBlocks,
  openFirstDayOfYear,
  sealLastDayOfYear,
  yearBoundaryFlags,
} from '@/lib/services/year-boundary.service';

export type YearEndAction = 'LAST_DAY' | 'FIRST_DAY';

export async function getYearEndPreview() {
  const status = await getBusinessDateStatus();
  const iso = status.currentBusinessDate;
  const flags = await yearBoundaryFlags(iso);
  const blocks = flags.isLastDayOfYear ? await lastDayBlocks(iso) : [];
  return {
    businessDate: iso,
    wallClockDate: status.wallClockDate,
    businessDayStatus: status.businessDayStatus,
    year: Number(iso.slice(0, 4)),
    ...flags,
    enabled: true,
    blocks,
  };
}

export async function runYearEndAction(action: YearEndAction, actorUserId?: string | null) {
  try {
    const result =
      action === 'LAST_DAY'
        ? await sealLastDayOfYear(actorUserId)
        : await openFirstDayOfYear(actorUserId);
    return { ok: true as const, action, result, preview: await getYearEndPreview() };
  } catch (err) {
    const code = err instanceof Error ? err.message : 'YEAR_END_FAILED';
    const blocks = (err as { blocks?: unknown }).blocks;
    return {
      ok: false as const,
      code,
      action,
      blocks,
      preview: await getYearEndPreview(),
    };
  }
}
