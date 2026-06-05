'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { PageHeader, PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from '@era/satellite-kit/ui';
import AppShell, { PageSection, StatusMessage } from '@/components/layout/AppShell';

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
  const [rows, setRows] = useState<ServiceRow[]>([]);
  const [title, setTitle] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/service/requests');
    if (!res.ok) {
      setMsg('Failed to load');
      return;
    }
    setRows(await res.json());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createRequest() {
    if (!title.trim()) return;
    setBusy(true);
    setMsg(null);
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
      if (!res.ok) throw new Error(await res.text());
      setTitle('');
      setRoomNumber('');
      await load();
      setMsg(t('created'));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(id: string, status: 'IN_PROGRESS' | 'DONE') {
    await fetch(`/api/service/requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    await load();
  }

  return (
    <AppShell>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <PageSection>
        <div className="mb-4 flex flex-wrap gap-2">
          <input
            className="rounded border px-2 py-1 text-sm"
            placeholder={t('requestTitle')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <input
            className="rounded border px-2 py-1 text-sm w-28"
            placeholder={t('room')}
            value={roomNumber}
            onChange={(e) => setRoomNumber(e.target.value)}
          />
          <button type="button" className={PRIMARY_BUTTON_CLASS} disabled={busy} onClick={() => void createRequest()}>
            {t('add')}
          </button>
        </div>
        {msg ? <StatusMessage>{msg}</StatusMessage> : null}
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
            {rows.map((r) => (
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
      </PageSection>
    </AppShell>
  );
}
