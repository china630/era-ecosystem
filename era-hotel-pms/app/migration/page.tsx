'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CARD_CONTAINER_CLASS, PageHeader } from '@era/satellite-kit/ui';

type Row = {
  id: string;
  status: string;
  guestId: string;
  reservationId: string | null;
  createdAt: string;
  guest?: { fullName: string };
};

export default function MigrationQueuePage() {
  const t = useTranslations('migration');
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    const res = await fetch('/api/migration/registrations');
    if (!res.ok) {
      setError(t('loadFailed'));
      return;
    }
    const data = await res.json();
    setRows(Array.isArray(data) ? data : []);
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <div className={`${CARD_CONTAINER_CLASS} p-4 text-[13px]`}>
        {error ? <p className="text-red-600">{error}</p> : null}
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b text-left text-[#7F8C8D]">
              <th className="py-2 pr-2">{t('guest')}</th>
              <th className="py-2 pr-2">{t('status')}</th>
              <th className="py-2 pr-2">{t('reservation')}</th>
              <th className="py-2">{t('created')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-4 text-[#7F8C8D]">
                  {t('empty')}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-[#ECF0F1]">
                  <td className="py-2 pr-2">{r.guest?.fullName ?? r.guestId}</td>
                  <td className="py-2 pr-2">{r.status}</td>
                  <td className="py-2 pr-2">{r.reservationId ?? '—'}</td>
                  <td className="py-2">
                    {new Date(r.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
