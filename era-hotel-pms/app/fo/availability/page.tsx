'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  DatePicker,
  EraListFilterBar,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  showApiError,
} from '@era/satellite-kit/ui';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';
import ReservationCardModal from '@/components/ReservationCardModal';

type DayCell = { date: string; quota: number; occupied: number; available: number; stopSell: boolean };
type TypeRow = { roomTypeId: string; roomTypeCode: string; roomTypeName: string; quota: number; days: DayCell[] };
type Matrix = { nights: string[]; rows: TypeRow[]; totals: DayCell[] };

function defaultFrom() { return new Date().toISOString().slice(0, 10); }
function defaultTo() { const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().slice(0, 10); }
function cellClass(available: number, stopSell: boolean) {
  if (stopSell || available < 0) return 'bg-rose-100 text-rose-900';
  if (available === 0) return 'bg-amber-100 text-amber-900';
  return 'bg-sky-50 text-sky-900';
}

export default function RoomTypeAvailabilityPage() {
  const { can } = useAuth();
  const t = useTranslations('roomTypeAvailability');
  const tc = useTranslations('common');
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [matrix, setMatrix] = useState<Matrix | null>(null);
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/fo/room-type-availability?from=${from}&to=${to}`);
      const data = await res.json();
      if (!res.ok) { showApiError(data, tc('loadError')); return; }
      setMatrix(data);
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
    } finally { setBusy(false); }
  }, [from, to, tc]);

  useEffect(() => { void load(); }, [load]);

  const canWrite = can(PERMISSIONS.RESERVATIONS_WRITE);
  const subtitle = useMemo(() => t('subtitle'), [t]);

  if (!can(PERMISSIONS.RESERVATIONS_READ)) {
    return <p className="text-sm text-[#7F8C8D]">{tc('accessDenied')}</p>;
  }

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={subtitle}
        actions={
          <div className="flex flex-wrap gap-2">
            <button type="button" className={SECONDARY_BUTTON_CLASS} disabled={busy} onClick={() => void load()}>
              {t('refresh')}
            </button>
            {canWrite ? (
              <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setCreateOpen(true)}>
                {t('newReservation')}
              </button>
            ) : null}
          </div>
        }
      />
      <EraListFilterBar
        className="mb-4"
        resetLabel={tc('filterReset')}
        onReset={() => {
          setFrom(defaultFrom());
          setTo(defaultTo());
        }}
      >
        <DatePicker label={t('from')} fluid value={from} onChange={(iso) => setFrom(iso)} placeholder={tc('datePlaceholder')} openCalendarLabel={tc('openCalendar')} />
        <DatePicker label={t('to')} fluid value={to} onChange={(iso) => setTo(iso)} placeholder={tc('datePlaceholder')} openCalendarLabel={tc('openCalendar')} />
      </EraListFilterBar>
      <p className="mb-3 text-[13px] text-[#7F8C8D]">{t('hint')}</p>
      <div className={DATA_TABLE_VIEWPORT_CLASS}>
        <table className={DATA_TABLE_CLASS}>
          <thead>
            <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
              <th className={DATA_TABLE_TH_LEFT_CLASS} rowSpan={2}>{t('date')}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS} colSpan={2}>{t('total')}</th>
              {(matrix?.rows ?? []).map((r) => (
                <th key={r.roomTypeId} className={DATA_TABLE_TH_LEFT_CLASS} colSpan={2}>{r.roomTypeCode}</th>
              ))}
            </tr>
            <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('avl')}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('occ')}</th>
              {(matrix?.rows ?? []).flatMap((r) => [
                <th key={`${r.roomTypeId}-a`} className={DATA_TABLE_TH_LEFT_CLASS}>{t('avl')}</th>,
                <th key={`${r.roomTypeId}-o`} className={DATA_TABLE_TH_LEFT_CLASS}>{t('occ')}</th>,
              ])}
            </tr>
          </thead>
          <tbody>
            {(matrix?.nights ?? []).map((night, i) => {
              const tot = matrix?.totals[i];
              return (
                <tr key={night} className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS}>{night}</td>
                  <td className={`${DATA_TABLE_TD_CLASS} font-mono ${cellClass(tot?.available ?? 0, tot?.stopSell ?? false)}`}>{tot?.available ?? '—'}</td>
                  <td className={`${DATA_TABLE_TD_CLASS} font-mono`}>{tot?.occupied ?? '—'}</td>
                  {(matrix?.rows ?? []).flatMap((r) => {
                    const d = r.days[i];
                    return [
                      <td key={`${r.roomTypeId}-${night}-a`} className={`${DATA_TABLE_TD_CLASS} font-mono ${cellClass(d?.available ?? 0, d?.stopSell ?? false)}`}>{d?.available ?? '—'}</td>,
                      <td key={`${r.roomTypeId}-${night}-o`} className={`${DATA_TABLE_TD_CLASS} font-mono`}>{d?.occupied ?? '—'}</td>,
                    ];
                  })}
                </tr>
              );
            })}
            {!matrix?.nights?.length ? (
              <tr className={DATA_TABLE_TR_CLASS}>
                <td className={DATA_TABLE_TD_CLASS} colSpan={3}>{busy ? tc('loading') : t('empty')}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[12px] text-[#7F8C8D]">
        {t('seeAlso')}{' '}
        <Link href="/fo/reservations" className="text-[#2980B9] underline">{t('reservationList')}</Link>
        {' · '}
        <Link href="/fo/room-plan" className="text-[#2980B9] underline">{t('roomPlan')}</Link>
        {' · '}
        <Link href="/fo/rack" className="text-[#2980B9] underline">{t('rack')}</Link>
      </p>
      <ReservationCardModal open={createOpen} onClose={() => setCreateOpen(false)} reservationId={null} />
    </>
  );
}
