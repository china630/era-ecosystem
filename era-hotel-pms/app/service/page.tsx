'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  CARD_CONTAINER_CLASS,
  EraListFilterBar,
  useDebouncedValue,
  Field,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';

type ServiceRow = {
  id: string;
  title: string;
  status: string;
  priority: string;
  source: string;
  category: string | null;
  room: { roomNumber: string } | null;
  location: string | null;
};

export default function ServicePage() {
  const t = useTranslations('service');
  const tc = useTranslations('common');
  const [rows, setRows] = useState<ServiceRow[]>([]);
  const [title, setTitle] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const debouncedQ = useDebouncedValue(q, 300);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/service/requests');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showApiError(data, tc('loadError'));
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

  async function createRequest() {
    if (!title.trim()) return;
    setBusy(true);
    try {
      const res = await fetch('/api/service/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          location: roomNumber ? `Room ${roomNumber}` : undefined,
          source: 'STAFF',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showApiError(data, tc('failed'));
        return;
      }
      setTitle('');
      setRoomNumber('');
      await load();
      showSuccess(t('created'));
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('failed') });
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(id: string, status: 'IN_PROGRESS' | 'DONE') {
    try {
      const res = await fetch(`/api/service/requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showApiError(data, tc('failed'));
        return;
      }
      await load();
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('failed') });
    }
  }

  const filtered = useMemo(() => {
    const q = debouncedQ.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      `${r.title} ${r.room?.roomNumber ?? ''} ${r.status} ${r.source}`.toLowerCase().includes(q),
    );
  }, [rows, debouncedQ]);

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <EraListFilterBar
        resetLabel={tc('filterReset')}
        onReset={() => setQ('')}
      >
        <Field
          label={tc('search')}
          preset="longText"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </EraListFilterBar>
      <section className={`${CARD_CONTAINER_CLASS} p-4`}>
        <div className="mb-4 flex flex-wrap gap-2">
          <Field
            label={t('requestTitle')}
            preset="longText"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Field
            label={t('room')}
            preset="shortText"
            value={roomNumber}
            onChange={(e) => setRoomNumber(e.target.value)}
          />
          <button type="button" className={PRIMARY_BUTTON_CLASS} disabled={busy} onClick={() => void createRequest()}>
            {t('add')}
          </button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th>{t('colTitle')}</th>
              <th>{t('colRoom')}</th>
              <th>{t('colStatus')}</th>
              <th>{t('colSource')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="py-2">{r.title}</td>
                <td>{r.room?.roomNumber ?? r.location ?? '—'}</td>
                <td>{r.status}</td>
                <td>{r.source}</td>
                <td className="py-2 space-x-1">
                  {r.status === 'OPEN' ? (
                    <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void setStatus(r.id, 'IN_PROGRESS')}>
                      {t('start')}
                    </button>
                  ) : null}
                  {r.status !== 'DONE' ? (
                    <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void setStatus(r.id, 'DONE')}>
                      {t('done')}
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
