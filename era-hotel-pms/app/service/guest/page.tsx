'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { PRIMARY_BUTTON_CLASS } from '@era/satellite-kit/ui';

export default function ServiceGuestPage() {
  const t = useTranslations('serviceGuest');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/service/guest-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          roomNumber: roomNumber.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setTitle('');
      setDescription('');
      setMsg(t('thanks'));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-semibold mb-2">{t('title')}</h1>
      <p className="text-sm text-gray-600 mb-4">{t('hint')}</p>
      <div className="space-y-3">
        <input
          className="w-full rounded border px-3 py-2"
          placeholder={t('issue')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className="w-full rounded border px-3 py-2"
          placeholder={t('details')}
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <input
          className="w-full rounded border px-3 py-2"
          placeholder={t('room')}
          value={roomNumber}
          onChange={(e) => setRoomNumber(e.target.value)}
        />
        <button type="button" className={PRIMARY_BUTTON_CLASS} disabled={busy} onClick={() => void submit()}>
          {t('send')}
        </button>
        {msg ? <p className="text-sm text-green-700">{msg}</p> : null}
      </div>
    </main>
  );
}
