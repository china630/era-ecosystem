'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  CatalogField,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';
import { bakuDateTimeDisplay } from '@era/satellite-kit/time';

type Item = { id: string; code: string; name: string; washPrice: number; ironPrice: number };
type Stay = {
  id: string;
  roomId: string | null;
  status: string;
  guest: { fullName: string } | null;
  room: { id: string; roomNumber: string } | null;
};
type Ticket = {
  id: string;
  status: string;
  guestName: string;
  total: number;
  folioChargeId: string | null;
  dueAt: string | null;
};

export default function HkLaundryPage() {
  const t = useTranslations('housekeeping');
  const tc = useTranslations('common');
  const [items, setItems] = useState<Item[]>([]);
  const [stays, setStays] = useState<Stay[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [roomId, setRoomId] = useState('');
  const [express, setExpress] = useState(false);
  const [expressEnabled, setExpressEnabled] = useState(false);
  const [scanByTicket, setScanByTicket] = useState<Record<string, string>>({});
  const [qty, setQty] = useState<Record<string, { wash: number; iron: number }>>({});

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
    setExpressEnabled(Boolean(json.laundryExpressEnabled));
  }, [tc]);

  useEffect(() => {
    void load();
  }, [load]);

  const assignedStays = stays.filter((s) => s.roomId && s.room?.roomNumber);
  const stay = assignedStays.find((s) => s.roomId === roomId);

  function laundryStatus(status: string) {
    if (status === 'IN_PLANT') return t('statusInPlant');
    if (status === 'POSTED') return t('statusPosted');
    if (status === 'VOIDED') return t('statusVoided');
    return status;
  }

  function bump(id: string, key: 'wash' | 'iron', delta: number) {
    setQty((q) => ({
      ...q,
      [id]: {
        wash: q[id]?.wash ?? 0,
        iron: q[id]?.iron ?? 0,
        [key]: Math.max(0, (q[id]?.[key] ?? 0) + delta),
      },
    }));
  }

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
      body: JSON.stringify({
        roomId,
        reservationId: stay?.id,
        guestName: stay?.guest?.fullName,
        express,
        lines,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      showApiError(json, tc('failed'));
      return;
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
          options={assignedStays.map((s) => ({
            value: s.roomId as string,
            label: `${s.room?.roomNumber ?? ''} · ${s.guest?.fullName ?? ''}`,
          }))}
        />
        <p className="text-sm text-[#7F8C8D]">{stay?.guest?.fullName ?? t('guestName')}</p>
        {expressEnabled ? (
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
        ) : null}
        <p className="text-sm text-[#7F8C8D]">{t('agreedQty')}</p>
      </div>
      <ul className="mb-4 space-y-3 text-sm">
        {items.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center gap-3">
            <span className="w-48">
              {i.name} ({i.washPrice}/{i.ironPrice})
            </span>
            {(['wash', 'iron'] as const).map((k) => (
              <span key={k} className="inline-flex items-center gap-1">
                <span className="w-12 text-[12px] text-[#7F8C8D]">{k === 'wash' ? t('laundryWash') : t('laundryIron')}</span>
                <button type="button" className="h-6 w-6 rounded border border-[#D5DADF]" onClick={() => bump(i.id, k, -1)}>
                  −
                </button>
                <span className="w-6 text-center">{qty[i.id]?.[k] ?? 0}</span>
                <button type="button" className="h-6 w-6 rounded border border-[#D5DADF]" onClick={() => bump(i.id, k, 1)}>
                  +
                </button>
              </span>
            ))}
          </li>
        ))}
      </ul>
      <button type="button" className={PRIMARY_BUTTON_CLASS} disabled={!roomId} onClick={() => void submit()}>
        {t('acceptLaundry')}
      </button>
      <p className="mt-4 text-xs text-[#7F8C8D]">{t('laundryLegal')}</p>
      <ul className="mt-6 text-sm">
        {tickets.map((tk) => (
          <li key={tk.id} className="mb-2 flex flex-wrap items-center gap-2">
            <span>
              {tk.guestName} · {laundryStatus(tk.status)}
              {tk.dueAt ? ` · ${t('laundryDue')} ${bakuDateTimeDisplay(tk.dueAt)}` : ''}
              {tk.folioChargeId ? ` · ${t('laundryFolio')} ${tk.folioChargeId.slice(0, 8)}` : ''}
            </span>
            {tk.status === 'IN_PLANT' ? (
              <>
                <input
                  type="file"
                  className="text-xs"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () =>
                      setScanByTicket((m) => ({ ...m, [tk.id]: String(reader.result ?? file.name) }));
                    reader.readAsDataURL(file);
                  }}
                />
                <button
                  type="button"
                  className={SECONDARY_BUTTON_CLASS}
                  onClick={async () => {
                    const key = scanByTicket[tk.id];
                    if (!key) {
                      showApiError({ error: t('returnScanRequired') }, tc('failed'));
                      return;
                    }
                    const res = await fetch('/api/housekeeping/laundry', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ deliverTicketId: tk.id, returnScanKey: key, actorRole: 'HK' }),
                    });
                    if (!res.ok) showApiError(await res.json(), tc('failed'));
                    else {
                      showSuccess(tc('saved'));
                      await load();
                    }
                  }}
                >
                  {t('deliverLaundry')}
                </button>
              </>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  );
}
