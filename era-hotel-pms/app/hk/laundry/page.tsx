'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Field,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';

type Item = { id: string; code: string; name: string; washPrice: number; ironPrice: number };

export default function HkLaundryPage() {
  const t = useTranslations('housekeeping');
  const tc = useTranslations('common');
  const [items, setItems] = useState<Item[]>([]);
  const [roomId, setRoomId] = useState('');
  const [reservationId, setReservationId] = useState('');
  const [guestName, setGuestName] = useState('');
  const [express, setExpress] = useState(false);
  const [qty, setQty] = useState<Record<string, { wash: number; iron: number }>>({});

  const load = useCallback(async () => {
    const res = await fetch('/api/housekeeping/laundry');
    const json = await res.json();
    if (!res.ok) {
      showApiError(json, tc('loadError'));
      return;
    }
    setItems(json.items ?? []);
  }, [tc]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit() {
    const lines = items
      .map((i) => ({
        itemId: i.id,
        washQty: qty[i.id]?.wash ?? 0,
        ironQty: qty[i.id]?.iron ?? 0,
      }))
      .filter((l) => l.washQty > 0 || l.ironQty > 0);
    const res = await fetch('/api/housekeeping/laundry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, reservationId: reservationId || undefined, guestName, express, lines }),
    });
    const json = await res.json();
    if (!res.ok) {
      showApiError(json, tc('failed'));
      return;
    }
    if (json.id) {
      const post = await fetch('/api/housekeeping/laundry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postTicketId: json.id }),
      });
      if (!post.ok) {
        showApiError(await post.json(), tc('failed'));
        return;
      }
    }
    showSuccess(tc('saved'));
  }

  return (
    <>
      <PageHeader title={t('laundryTitle')} />
      <div className="mb-4 grid max-w-lg gap-2">
        <Field label={t('roomSelect')} preset="shortText" value={roomId} onChange={(e) => setRoomId(e.target.value)} />
        <Field label="Reservation ID" preset="code" value={reservationId} onChange={(e) => setReservationId(e.target.value)} />
        <Field label={t('guestName')} preset="longText" value={guestName} onChange={(e) => setGuestName(e.target.value)} />
        <label className="text-sm">
          <input type="checkbox" checked={express} onChange={(e) => setExpress(e.target.checked)} /> {t('express')}
        </label>
      </div>
      <ul className="mb-4 space-y-2 text-sm">
        {items.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center gap-2">
            <span className="w-48">
              {i.name} ({i.washPrice}/{i.ironPrice})
            </span>
            <span>W</span>
            <button type="button" onClick={() => setQty((q) => ({ ...q, [i.id]: { wash: Math.max(0, (q[i.id]?.wash ?? 0) - 1), iron: q[i.id]?.iron ?? 0 } }))}>
              -
            </button>
            {qty[i.id]?.wash ?? 0}
            <button type="button" onClick={() => setQty((q) => ({ ...q, [i.id]: { wash: (q[i.id]?.wash ?? 0) + 1, iron: q[i.id]?.iron ?? 0 } }))}>
              +
            </button>
            <span>I</span>
            <button type="button" onClick={() => setQty((q) => ({ ...q, [i.id]: { iron: Math.max(0, (q[i.id]?.iron ?? 0) - 1), wash: q[i.id]?.wash ?? 0 } }))}>
              -
            </button>
            {qty[i.id]?.iron ?? 0}
            <button type="button" onClick={() => setQty((q) => ({ ...q, [i.id]: { iron: (q[i.id]?.iron ?? 0) + 1, wash: q[i.id]?.wash ?? 0 } }))}>
              +
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void submit()}>
        {t('postLaundry')}
      </button>
    </>
  );
}
