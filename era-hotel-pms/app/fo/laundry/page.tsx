'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  CatalogField,
  DatePicker,
  EraListFilterBar,
  Field,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
  useDebouncedValue,
} from '@era/satellite-kit/ui';
import { HotelDataGrid } from '@/components/HotelDataGrid';

type Ticket = {
  id: string;
  status: string;
  guestName: string;
  roomId: string;
  roomNumber?: string | null;
  dueAt: string | null;
  createdAt?: string;
  folioChargeId: string | null;
  total?: number | string | null;
  express?: boolean;
};

const STATUS_ALL = 'ALL';

export default function FoLaundryPage() {
  const t = useTranslations('housekeeping');
  const tc = useTranslations('common');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [scanByTicket, setScanByTicket] = useState<Record<string, string>>({});
  const [guestQ, setGuestQ] = useState('');
  const [roomQ, setRoomQ] = useState('');
  const [status, setStatus] = useState(STATUS_ALL);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const debouncedGuest = useDebouncedValue(guestQ, 300);
  const debouncedRoom = useDebouncedValue(roomQ, 300);

  const load = useCallback(async () => {
    const res = await fetch('/api/housekeeping/laundry');
    const json = await res.json();
    if (!res.ok) {
      showApiError(json, tc('loadError'));
      return;
    }
    setTickets(json.tickets ?? []);
  }, [tc]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const g = debouncedGuest.trim().toLowerCase();
    const r = debouncedRoom.trim().toLowerCase();
    return tickets.filter((tk) => {
      if (status !== STATUS_ALL && tk.status !== status) return false;
      if (g && !tk.guestName.toLowerCase().includes(g)) return false;
      const room = (tk.roomNumber ?? '').toLowerCase();
      if (r && !room.includes(r)) return false;
      const day = (tk.dueAt ?? tk.createdAt ?? '').slice(0, 10);
      if (from && day && day < from) return false;
      if (to && day && day > to) return false;
      return true;
    });
  }, [tickets, debouncedGuest, debouncedRoom, status, from, to]);

  async function deliver(tk: Ticket) {
    const key = scanByTicket[tk.id];
    if (!key) {
      showApiError({ error: t('returnScanRequired') }, tc('failed'));
      return;
    }
    const res = await fetch('/api/housekeeping/laundry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deliverTicketId: tk.id,
        returnScanKey: key,
        actorRole: 'FO',
      }),
    });
    if (!res.ok) showApiError(await res.json(), tc('failed'));
    else {
      showSuccess(tc('saved'));
      await load();
    }
  }

  return (
    <>
      <PageHeader title={t('foLaundryTitle')} />
      <p className="mb-4 max-w-3xl text-sm text-[#7F8C8D]">{t('foLaundryHint')}</p>
      <EraListFilterBar
        resetLabel={tc('filterReset')}
        onReset={() => {
          setGuestQ('');
          setRoomQ('');
          setStatus(STATUS_ALL);
          setFrom('');
          setTo('');
        }}
      >
        <Field
          label={t('laundryGuest')}
          preset="longText"
          value={guestQ}
          onChange={(e) => setGuestQ(e.target.value)}
        />
        <Field
          label={t('laundryRoom')}
          preset="longText"
          value={roomQ}
          onChange={(e) => setRoomQ(e.target.value)}
        />
        <CatalogField
          kind="CLOSED_SMALL"
          label={tc('status')}
          value={status}
          onChange={(v) => setStatus(String(v))}
          options={[
            { value: STATUS_ALL, label: tc('all') },
            { value: 'IN_PLANT', label: t('statusInPlant') },
            { value: 'POSTED', label: t('statusPosted') },
            { value: 'VOIDED', label: t('statusVoided') },
          ]}
        />
        <DatePicker
          label={tc('from')}
          value={from}
          onChange={setFrom}
          placeholder={tc('datePlaceholder')}
          openCalendarLabel={tc('openCalendar')}
        />
        <DatePicker
          label={tc('to')}
          value={to}
          onChange={setTo}
          placeholder={tc('datePlaceholder')}
          openCalendarLabel={tc('openCalendar')}
        />
      </EraListFilterBar>
      <HotelDataGrid<Ticket & Record<string, unknown>>
        columns={[
          { key: 'room', header: t('laundryRoom'), render: (tk) => tk.roomNumber ?? '—' },
          { key: 'guest', header: t('laundryGuest'), render: (tk) => tk.guestName },
          { key: 'status', header: tc('status'), render: (tk) => tk.status },
          {
            key: 'due',
            header: t('laundryDue'),
            render: (tk) => (tk.dueAt ? tk.dueAt.slice(0, 16).replace('T', ' ') : '—'),
          },
          {
            key: 'created',
            header: t('laundryCreated'),
            render: (tk) =>
              tk.createdAt ? tk.createdAt.slice(0, 16).replace('T', ' ') : '—',
          },
          {
            key: 'folio',
            header: t('laundryFolio'),
            render: (tk) => (tk.folioChargeId ? tk.folioChargeId.slice(0, 8) : '—'),
          },
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
                        setScanByTicket((m) => ({
                          ...m,
                          [tk.id]: String(reader.result ?? file.name),
                        }));
                      reader.readAsDataURL(file);
                    }}
                  />
                  <button
                    type="button"
                    className={PRIMARY_BUTTON_CLASS}
                    onClick={() => void deliver(tk)}
                  >
                    {t('deliverLaundry')}
                  </button>
                </span>
              ) : (
                '—'
              ),
          },
        ]}
        rows={filtered as (Ticket & Record<string, unknown>)[]}
        rowKey={(tk) => tk.id}
        emptyMessage={t('laundryEmpty')}
      />
    </>
  );
}
