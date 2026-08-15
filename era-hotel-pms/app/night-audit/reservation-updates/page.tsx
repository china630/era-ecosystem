'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  CARD_CONTAINER_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  DatePicker,
  EraListFilterBar,
  FieldSelect,
  PageHeader,
  SECONDARY_BUTTON_CLASS,
  showApiError,
} from '@era/satellite-kit/ui';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

type UpdateRow = {
  id: string;
  status: string;
  guestName: string;
  roomNumber: string | null;
  roomTypeCode: string;
  checkInDate: string;
  checkOutDate: string;
  updatedAt: string;
  latestAction: string | null;
  actionCount: number;
  actionKind: string;
};

type ActionFilter = 'ALL' | 'CANCEL' | 'EXTEND' | 'NOTE' | 'OTHER';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function NightAuditReservationUpdatesPage() {
  const { can } = useAuth();
  const searchParams = useSearchParams();
  const t = useTranslations('nightAudit');
  const tc = useTranslations('common');
  const [from, setFrom] = useState(todayIso);
  const [to, setTo] = useState(todayIso);
  const [action, setAction] = useState<ActionFilter>('ALL');
  const [rows, setRows] = useState<UpdateRow[]>([]);

  useEffect(() => {
    const f = searchParams.get('from');
    const t0 = searchParams.get('to');
    const a = searchParams.get('action');
    if (f) setFrom(f);
    if (t0) setTo(t0);
    if (a === 'CANCEL' || a === 'EXTEND' || a === 'NOTE' || a === 'OTHER' || a === 'ALL') {
      setAction(a);
    }
  }, [searchParams]);

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/night-audit/reservation-updates?from=${from}&to=${to}&action=${action}`,
      );
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('loadError'));
        return;
      }
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
    }
  }, [from, to, action, tc]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!can(PERMISSIONS.REPORTS_READ)) {
    return <p className="text-[13px] text-[#7F8C8D]">{tc('noPermission')}</p>;
  }

  return (
    <>
      <PageHeader
        title={t('reservationUpdatesTitle')}
        subtitle={t('reservationUpdatesSubtitle')}
      />
      <EraListFilterBar
        resetLabel={tc('filterReset')}
        onReset={() => {
          const d = todayIso();
          setFrom(d);
          setTo(d);
          setAction('ALL');
        }}
      >
        <DatePicker
          label={tc('from')}
          value={from}
          onChange={setFrom}
          placeholder={tc('datePlaceholder')}
          openCalendarLabel={tc('openCalendar')}
        />
        <DatePicker
          label={tc('to')}
          value={to}
          onChange={setTo}
          placeholder={tc('datePlaceholder')}
          openCalendarLabel={tc('openCalendar')}
        />
        <FieldSelect
          label={t('actionFilter')}
          preset="select"
          value={action}
          onChange={(e) => setAction(e.target.value as ActionFilter)}
        >
          <option value="ALL">{t('actionAll')}</option>
          <option value="CANCEL">{t('actionCancel')}</option>
          <option value="EXTEND">{t('actionExtend')}</option>
          <option value="NOTE">{t('actionNote')}</option>
          <option value="OTHER">{t('actionOther')}</option>
        </FieldSelect>
        <a
          className={SECONDARY_BUTTON_CLASS}
          href={`/api/night-audit/reservation-updates?from=${from}&to=${to}&action=${action}&format=csv`}
        >
          {t('exportCsv')}
        </a>
      </EraListFilterBar>

      <section className={`${CARD_CONTAINER_CLASS} p-0`}>
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('colUpdated')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('colGuest')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('colRoom')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('colStatus')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('colActionKind')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('colAction')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {new Date(r.updatedAt).toLocaleString()}
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>{r.guestName}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {r.roomNumber ?? r.roomTypeCode}
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>{r.status}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{r.actionKind}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {r.latestAction
                      ? `${r.latestAction}${r.actionCount > 1 ? ` (${r.actionCount})` : ''}`
                      : tc('dash')}
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    <Link
                      href={`/reservations/${r.id}`}
                      className="text-[#2980B9] hover:underline"
                    >
                      {t('openReservation')}
                    </Link>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td colSpan={7} className={`${DATA_TABLE_TD_CLASS} text-[#7F8C8D]`}>
                    {t('reservationUpdatesEmpty')}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
