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
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

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

  async function prefill(id: string) {
    setBusyId(id);
    setMessage('');
    try {
      const res = await fetch(`/api/migration/registrations/${id}/prefill`);
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? t('prefillFailed'));
        return;
      }
      setMessage(t('prefillOk'));
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function submit(id: string) {
    setBusyId(id);
    setMessage('');
    try {
      const res = await fetch(`/api/migration/${id}/submit`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? t('submitFailed'));
        return;
      }
      setMessage(t('submitOk', { status: data.data?.status ?? data.status ?? 'SUBMITTED' }));
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <div className={`${CARD_CONTAINER_CLASS} p-4 text-[13px]`}>
        {error ? <p className="text-red-600">{error}</p> : null}
        {message ? <p className="mb-2 text-emerald-700">{message}</p> : null}
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b text-left text-[#7F8C8D]">
              <th className="py-2 pr-2">{t('guest')}</th>
              <th className="py-2 pr-2">{t('status')}</th>
              <th className="py-2 pr-2">{t('reservation')}</th>
              <th className="py-2 pr-2">{t('created')}</th>
              <th className="py-2">{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-4 text-[#7F8C8D]">
                  {t('empty')}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-[#ECF0F1]">
                  <td className="py-2 pr-2">{r.guest?.fullName ?? r.guestId}</td>
                  <td className="py-2 pr-2">
                    <span className="rounded bg-[#ECF0F1] px-2 py-0.5 text-xs">{r.status}</span>
                  </td>
                  <td className="py-2 pr-2">{r.reservationId ?? '—'}</td>
                  <td className="py-2 pr-2">
                    {new Date(r.createdAt).toLocaleString()}
                  </td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded border px-2 py-1 text-xs text-[#2980B9] disabled:opacity-50"
                        disabled={busyId === r.id}
                        onClick={() => void prefill(r.id)}
                      >
                        {t('prefill')}
                      </button>
                      <button
                        type="button"
                        className="rounded bg-[#2980B9] px-2 py-1 text-xs text-white disabled:opacity-50"
                        disabled={busyId === r.id}
                        onClick={() => void submit(r.id)}
                      >
                        {t('submit')}
                      </button>
                    </div>
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
