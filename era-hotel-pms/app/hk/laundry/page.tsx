'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  CatalogField,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';

type Item = { id: string; code: string; name: string; washPrice: number; ironPrice: number };
type Stay = {
  id: string;
  roomId: string;
  status: string;
  guest: { fullName: string };
  room: { id: string; roomNumber: string };
};
type Ticket = { id: string; status: string; guestName: string; total: number; folioChargeId: string | null };

export default function HkLaundryPage() {
  const t = useTranslations('housekeeping');
  const tc = useTranslations('common');
  const [items, setItems] = useState<Item[]>([]);
  const [stays, setStays] = useState<Stay[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [roomId, setRoomId] = useState('');
  const [express, setExpress] = useState(false);
  const [qty, setQty] = useState<Record<string, { wash: number; iron: number; guest: number; hotel: number }>>({});

  const load = useCallback(async () => {
    const res = await fetch('/api/housekeeping/laundry');
    const json = await res.json();
    if (!res.ok) {
      showApiError(json, tc('loadError'));
      return;
    }
    setItems(json.items ?? []);
    setStays(json.stays ?? []);
    setTickets(json.tickets ?? []);
  }, [tc]);

  useEffect(() => {
    void load();
  }, [load]);

  const stay = stays.find((s) => s.roomId === roomId);
  const mismatch = useMemo(
    () =>
      Object.values(qty).some((q) => (q.guest ?? 0) !== (q.hotel ?? 0) && ((q.wash ?? 0) > 0 || (q.iron ?? 0) > 0)),
    [qty],
  );

  async function submit() {
    const lines = items
      .map((i) => ({
        itemId: i.id,
        washQty: qty[i.id]?.wash ?? 0,
        ironQty: qty[i.id]?.iron ?? 0,
        guestQty: qty[i.id]?.guest ?? qty[i.id]?.wash ?? 0,
        hotelQty: qty[i.id]?.hotel ?? qty[i.id]?.iron ?? qty[i.id]?.wash ?? 0,
      }))
      .filter((l) => l.washQty > 0 || l.ironQty > 0);
    const res = await fetch('/api/housekeeping/laundry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId,
        reservationId: stay?.id,
        guestName: stay?.guest.fullName,
        express,
        lines,
      }),
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
    await load();
  }

  return (
    <>
      <PageHeader title={t('laundryTitle')} />
      <div className="mb-4 grid max-w-lg gap-2">
        <CatalogField
          kind="ENTITY_REF"
          label={t('roomSelect')}
          value={roomId}
          onChange={(v) => setRoomId(String(v))}
          options={stays.map((s) => ({
            value: s.roomId,
            label: `${s.room.roomNumber} · ${s.guest.fullName}`,
          }))}
        />
        <p className="text-sm text-[#7F8C8D]">{stay ? stay.guest.fullName : t('guestName')}</p>
        <CatalogField
          kind="CLOSED_SMALL"
          label={t('express')}
          value={express ? 'yes' : 'no'}
          onChange={(v) => setExpress(String(v) === 'yes')}
          options={[
            { value: 'no', label: t('regular') },
            { value: 'yes', label: t('express') },
          ]}
        />
        {mismatch ? <p className="text-sm text-amber-800">{t('qtyMismatch')}</p> : null}
      </div>
      <ul className="mb-4 space-y-2 text-sm">
        {items.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center gap-2">
            <span className="w-48">
              {i.name} ({i.washPrice}/{i.ironPrice})
            </span>
            {(['wash', 'iron', 'guest', 'hotel'] as const).map((k) => (
              <span key={k} className="inline-flex items-center gap-1">
                <span>{k[0]!.toUpperCase()}</span>
                <button
                  type="button"
                  onClick={() =>
                    setQty((q) => ({
                      ...q,
                      [i.id]: {
                        wash: q[i.id]?.wash ?? 0,
                        iron: q[i.id]?.iron ?? 0,
                        guest: q[i.id]?.guest ?? 0,
                        hotel: q[i.id]?.hotel ?? 0,
                        [k]: Math.max(0, (q[i.id]?.[k] ?? 0) - 1),
                      },
                    }))
                  }
                >
                  -
                </button>
                {qty[i.id]?.[k] ?? 0}
                <button
                  type="button"
                  onClick={() =>
                    setQty((q) => ({
                      ...q,
                      [i.id]: {
                        wash: q[i.id]?.wash ?? 0,
                        iron: q[i.id]?.iron ?? 0,
                        guest: q[i.id]?.guest ?? 0,
                        hotel: q[i.id]?.hotel ?? 0,
                        [k]: (q[i.id]?.[k] ?? 0) + 1,
                      },
                    }))
                  }
                >
                  +
                </button>
              </span>
            ))}
          </li>
        ))}
      </ul>
      <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void submit()}>
        {t('postLaundry')}
      </button>
      <button type="button" className={`${SECONDARY_BUTTON_CLASS} ml-2 print:hidden`} onClick={() => window.print()}>
        {t('printTicket')}
      </button>
      <p className="mt-4 hidden text-xs print:block">{t('laundryLegal')}</p>
      <ul className="mt-6 text-sm">
        {tickets.map((tk) => (
          <li key={tk.id}>
            {tk.guestName} · {tk.status} · {tk.total}
            {tk.folioChargeId ? ` · folio ${tk.folioChargeId.slice(0, 8)}` : ''}
          </li>
        ))}
      </ul>
    </>
  );
}
