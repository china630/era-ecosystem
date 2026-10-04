'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  CARD_CONTAINER_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  PageHeader,
  showApiError,
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

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/user-logins');
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('loadError'));
        setRows([]);
        return;
      }
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
    }
  }, [tc]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
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
                    {t('empty')}
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
