'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  CARD_CONTAINER_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  DatePicker,
  EraListFilterBar,
  Field,
  PageHeader,
  showApiError,
  useDebouncedValue,
} from '@era/satellite-kit/ui';
import { bakuDateTimeDisplay } from '@era/satellite-kit/time';

type LoginRow = {
  id: string;
  login: string;
  fullName: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
};

export default function UserLoginsPage() {
  const t = useTranslations('logins');
  const tc = useTranslations('common');
  const [rows, setRows] = useState<LoginRow[]>([]);
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const debouncedQ = useDebouncedValue(q, 300);

  const filtered = Boolean(debouncedQ.trim() || from || to);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const params = new URLSearchParams();
        if (debouncedQ.trim()) params.set('q', debouncedQ.trim());
        if (from) params.set('from', from);
        if (to) params.set('to', to);
        const res = await fetch(`/api/admin/user-logins?${params}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          showApiError(data, tc('loadError'));
          setRows([]);
          return;
        }
        setRows(Array.isArray(data) ? data : []);
      } catch (e) {
        if (cancelled) return;
        showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [debouncedQ, from, to, tc]);

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <EraListFilterBar
        resetLabel={tc('filterReset')}
        onReset={() => {
          setQ('');
          setFrom('');
          setTo('');
        }}
      >
        <Field
          label={t('searchHint')}
          preset="longText"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
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
      </EraListFilterBar>
      <section className={`${CARD_CONTAINER_CLASS} p-4`}>
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('when')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('login')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('name')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('ip')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('agent')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS}>{bakuDateTimeDisplay(row.createdAt)}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{row.login}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{row.fullName}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{row.ipAddress ?? tc('dash')}</td>
                  <td className={`${DATA_TABLE_TD_CLASS} max-w-[16rem] truncate`}>
                    {row.userAgent ?? tc('dash')}
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td colSpan={5} className={`${DATA_TABLE_TD_CLASS} text-[#7F8C8D]`}>
                    {filtered ? t('emptyFiltered') : t('empty')}
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
