'use client';

import { useTranslations } from 'next-intl';

export type HkMarkCode = 'DIRTY' | 'PICKUP' | 'CLEAN' | 'INSPECTED';

const PILL: Record<HkMarkCode, string> = {
  DIRTY: 'bg-[#29B6F6] text-white',
  PICKUP: 'bg-[#29B6F6] text-white',
  CLEAN: 'bg-[#43A047] text-white',
  INSPECTED: 'bg-[#2E7D32] text-white',
};

export function normalizeHkMark(raw: string | null | undefined): HkMarkCode | null {
  const value = (raw ?? '').toUpperCase();
  if (value === 'DIRTY' || value === 'PICKUP' || value === 'CLEAN' || value === 'INSPECTED') {
    return value;
  }
  if (value === 'AVAILABLE' || value === 'OCCUPIED') return 'CLEAN';
  return null;
}

export function hkMarkClass(raw: string | null | undefined): string {
  const code = normalizeHkMark(raw);
  return code ? PILL[code] : 'bg-[#ECEFF1] text-[#34495E]';
}

export function HkStatusMark({ status }: { status?: string | null }) {
  const t = useTranslations('housekeeping.hkCond');
  const code = normalizeHkMark(status);
  if (!code) return <span className="text-[#7F8C8D]">—</span>;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold leading-none ${PILL[code]}`}
    >
      {t(code)}
    </span>
  );
}

/** Narrow plan/rack strip. Same colors as the pill, no second palette. */
export function HkStatusBar({ status }: { status?: string | null }) {
  const t = useTranslations('housekeeping.hkCond');
  const code = normalizeHkMark(status);
  return (
    <span
      className={`inline-block h-7 w-2.5 shrink-0 rounded-sm ${code ? PILL[code] : 'bg-[#ECEFF1]'}`}
      title={code ? t(code) : undefined}
      aria-hidden
    />
  );
}
