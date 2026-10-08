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
import { EraModal, EraModalFooter } from '@/components/EraModal';
import { HotelDataGrid } from '@/components/HotelDataGrid';
import { formatLaundryPieces, type LaundryLineView } from '@/lib/laundry-pieces';

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
  roomNumber?: string | null;
  createdAt?: string;
  dueAt: string | null;
  folioChargeId: string | null;
  lines?: LaundryLineView[];
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
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
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

  function pieces(tk: Ticket) {
    return formatLaundryPieces(tk.lines, { wash: t('laundryWash'), iron: t('laundryIron') }) || '—';
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

  function closeModal() {
    setOpen(false);
    setRoomId('');
    setExpress(false);
    setQty({});
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const lines = items
      .map((i) => ({
        itemId: i.id,
        washQty: qty[i.id]?.wash ?? 0,
        ironQty: qty[i.id]?.iron ?? 0,
      }))
      .filter((l) => l.washQty > 0 || l.ironQty > 0);
    if (!roomId || lines.length === 0) return;
    setBusy(true);
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
    setBusy(false);
    if (!res.ok) {
      showApiError(json, tc('failed'));
      return;
    }
    showSuccess(tc('saved'));
    closeModal();
    await load();
  }

  async function deliver(tk: Ticket) {
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
  }

  return (
    <>
      <PageHeader
        title={t('laundryTitle')}
        actions={
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setOpen(true)}>
            + {t('addLaundry')}
          </button>
        }
      />
      <HotelDataGrid<Ticket & Record<string, unknown>>
        columns={[
          { key: 'room', header: t('laundryRoom'), render: (tk) => tk.roomNumber ?? '—' },
          { key: 'guest', header: t('laundryGuest'), render: (tk) => tk.guestName },
          {
            key: 'created',
            header: t('laundryCreated'),
            render: (tk) => (tk.createdAt ? bakuDateTimeDisplay(tk.createdAt) : '—'),
          },
          { key: 'pieces', header: t('laundryPieces'), render: (tk) => pieces(tk) },
          {
            key: 'actions',
            header: tc('actions'),
            render: (tk) =>
              tk.status === 'IN_PLANT' ? (
                <span className="flex flex-wrap items-center gap-2">
                  <input
                    type="file"
                    className="max-w-[10rem] text-xs"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () =>
                        setScanByTicket((m) => ({ ...m, [tk.id]: String(reader.result ?? file.name) }));
                      reader.readAsDataURL(file);
                    }}
                  />
                  <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void deliver(tk)}>
                    {t('deliverLaundry')}
                  </button>
                </span>
              ) : (
                '—'
              ),
          },
        ]}
        rows={tickets as (Ticket & Record<string, unknown>)[]}
        rowKey={(tk) => tk.id}
        emptyMessage={t('laundryEmpty')}
      />
      <p className="mt-4 text-xs text-[#7F8C8D]">{t('laundryLegal')}</p>
      <EraModal
        open={open}
        title={t('addLaundry')}
        onClose={closeModal}
        maxWidthClass="max-w-3xl"
        footer={
          <EraModalFooter
            formId="laundry-intake"
            onCancel={closeModal}
            busy={busy}
            submitDisabled={!roomId}
            submitLabel={t('acceptLaundry')}
          />
        }
      >
        <form id="laundry-intake" onSubmit={(e) => void submit(e)} className="space-y-3">
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
          <div className="overflow-x-auto rounded border border-[#D5DADF]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-[12px] text-[#7F8C8D]">
                  <th className="px-3 py-2">{t('laundryPieces')}</th>
                  <th className="px-3 py-2">{t('laundryWash')}</th>
                  <th className="px-3 py-2">{t('laundryIron')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id} className="border-b border-[#ECF0F1]">
                    <td className="px-3 py-2">
                      {i.name}
                      <span className="ml-2 text-[12px] text-[#7F8C8D]">
                        {i.washPrice}/{i.ironPrice}
                      </span>
                    </td>
                    {(['wash', 'iron'] as const).map((k) => (
                      <td key={k} className="px-3 py-2">
                        <span className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            className="h-6 w-6 rounded border border-[#D5DADF]"
                            onClick={() => bump(i.id, k, -1)}
                          >
                            −
                          </button>
                          <span className="w-6 text-center">{qty[i.id]?.[k] ?? 0}</span>
                          <button
                            type="button"
                            className="h-6 w-6 rounded border border-[#D5DADF]"
                            onClick={() => bump(i.id, k, 1)}
                          >
                            +
                          </button>
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </form>
      </EraModal>
    </>
  );
}
