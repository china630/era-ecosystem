'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  CatalogField,
  Field,
  FORM_STACK_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  GHOST_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';
import { bakuDateTimeDisplay } from '@era/satellite-kit/time';
import { HotelDataGrid } from '@/components/HotelDataGrid';
import { EraModal, EraModalFooter } from '@/components/EraModal';

type Booking = {
  id: string;
  status: string;
  reservation: {
    id: string;
    guest: { fullName: string; phone: string | null };
    room: { roomNumber: string } | null;
    status: string;
  };
};

type Departure = {
  id: string;
  date: string;
  pickupAt: string;
  returnAt: string;
  agenda: string;
  meetingPoint: string;
  guideName: string | null;
  capacity: number;
  price: number | string;
  status: string;
  vehicleId: string | null;
  vehicle: { code: string; licensePlate: string; maxSeats: number } | null;
  bookings: Booking[];
};

type Stay = {
  id: string;
  guest: { fullName: string };
  room: { roomNumber: string } | null;
  status: string;
};

const addFormId = 'tour-add-guest';
const payFormId = 'tour-pay';
const editFormId = 'tour-edit-dep';
const closeFormId = 'tour-close-boarding';

export default function TourDeparturePage() {
  const t = useTranslations('tours');
  const tc = useTranslations('common');
  const { id } = useParams<{ id: string }>();
  const [dep, setDep] = useState<Departure | null>(null);
  const [stays, setStays] = useState<Stay[]>([]);
  const [vehicles, setVehicles] = useState<Array<{ id: string; code: string; licensePlate: string }>>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [payOpen, setPayOpen] = useState<string | null>(null);
  const [closeOpen, setCloseOpen] = useState(false);
  const [reservationId, setReservationId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [bankTerminalId, setBankTerminalId] = useState('');
  const [bankTerminals, setBankTerminals] = useState<Array<{ id: string; label: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [editAgenda, setEditAgenda] = useState('');
  const [editMeeting, setEditMeeting] = useState('');
  const [editGuide, setEditGuide] = useState('');
  const [editCapacity, setEditCapacity] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editVehicleId, setEditVehicleId] = useState('');

  const load = useCallback(async () => {
    const res = await fetch(`/api/tours/departures/${id}`);
    if (!res.ok) {
      showApiError(await res.json().catch(() => ({ error: res.statusText })));
      return;
    }
    const data = (await res.json()) as Departure;
    setDep(data);
    const next: Record<string, boolean> = {};
    for (const b of data.bookings) {
      if (b.status === 'RESERVED') next[b.id] = selected[b.id] ?? false;
      else if (['CHARGED', 'PAID', 'ON_CITY_LEDGER'].includes(b.status)) next[b.id] = true;
    }
    setSelected(next);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps -- don't re-select on every selected change

  useEffect(() => {
    void load();
    void fetch('/api/tours/in-house')
      .then((r) => r.json())
      .then(setStays)
      .catch(() => undefined);
    void fetch('/api/fleet/vehicles')
      .then((r) => r.json())
      .then((rows: Array<{ id: string; code: string; licensePlate: string; active: boolean }>) =>
        setVehicles(rows.filter((v) => v.active).map((v) => ({ id: v.id, code: v.code, licensePlate: v.licensePlate }))),
      )
      .catch(() => undefined);
  }, [load]);

  const liveBookings = useMemo(
    () => (dep?.bookings ?? []).filter((b) => b.status !== 'CANCELLED'),
    [dep],
  );

  function moneyLabel(status: string) {
    const map: Record<string, string> = {
      RESERVED: t('reserved'),
      CHARGED: t('charged'),
      PAID: t('paid'),
      ON_CITY_LEDGER: t('onCityLedger'),
      CANCELLED: t('statusCancelled'),
    };
    return map[status] ?? status;
  }

  function departureStatusLabel(status: string) {
    const map: Record<string, string> = {
      DRAFT: t('statusDraft'),
      OPEN: t('statusOpen'),
      CLOSED: t('statusClosed'),
      DEPARTED: t('statusDeparted'),
      CANCELLED: t('statusCancelled'),
    };
    return map[status] ?? status;
  }

  async function addGuest(e: React.FormEvent) {
    e.preventDefault();
    if (!reservationId) return;
    setBusy(true);
    const res = await fetch(`/api/tours/departures/${id}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reservationId }),
    });
    setBusy(false);
    if (!res.ok) {
      showApiError(await res.json().catch(() => ({ error: res.statusText })));
      return;
    }
    showSuccess(t('guestAdded'));
    setAddOpen(false);
    setReservationId('');
    await load();
  }

  async function openPay(bookingId: string) {
    setPaymentMethod('CASH');
    setBankTerminalId('');
    setPayOpen(bookingId);
    try {
      const res = await fetch('/api/fiscal/devices?kind=BANK_POS');
      if (!res.ok) {
        setBankTerminals([]);
        return;
      }
      const data = await res.json();
      const devices = (data.devices ?? []) as Array<{ id: string; label?: string; name?: string }>;
      setBankTerminals(
        devices.map((d) => ({ id: d.id, label: d.label || d.name || d.id })),
      );
    } catch {
      setBankTerminals([]);
    }
  }

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    if (!payOpen) return;
    if (paymentMethod === 'CARD' && bankTerminals.length > 0 && !bankTerminalId) {
      showApiError({ error: t('terminalRequired') });
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/tours/bookings/${payOpen}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentMethod,
        bankTerminalId: paymentMethod === 'CARD' ? bankTerminalId || undefined : undefined,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      showApiError(await res.json().catch(() => ({ error: res.statusText })));
      return;
    }
    showSuccess(t('paidOk'));
    setPayOpen(null);
    await load();
  }

  async function remove(bookingId: string) {
    const res = await fetch(`/api/tours/bookings/${bookingId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Tour booking cancelled' }),
    });
    if (!res.ok) {
      showApiError(await res.json().catch(() => ({ error: res.statusText })));
      return;
    }
    showSuccess(t('removed'));
    await load();
  }

  async function boardOne(bookingId: string) {
    const res = await fetch(`/api/tours/bookings/${bookingId}/board`, { method: 'POST' });
    if (!res.ok) {
      showApiError(await res.json().catch(() => ({ error: res.statusText })));
      return;
    }
    showSuccess(t('boardedOk'));
    await load();
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch(`/api/tours/departures/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agenda: editAgenda,
        meetingPoint: editMeeting,
        guideName: editGuide || null,
        capacity: Number(editCapacity),
        price: Number(editPrice),
        vehicleId: editVehicleId || null,
        status: editVehicleId ? 'OPEN' : undefined,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      showApiError(await res.json().catch(() => ({ error: res.statusText })));
      return;
    }
    showSuccess(t('saved'));
    setEditOpen(false);
    await load();
  }

  async function closeBoarding(e: React.FormEvent) {
    e.preventDefault();
    const boardedBookingIds = Object.entries(selected)
      .filter(([, on]) => on)
      .map(([bid]) => bid)
      .filter((bid) => liveBookings.some((b) => b.id === bid && b.status === 'RESERVED'));
    setBusy(true);
    const res = await fetch(`/api/tours/departures/${id}/close-boarding`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ boardedBookingIds }),
    });
    setBusy(false);
    if (!res.ok) {
      showApiError(await res.json().catch(() => ({ error: res.statusText })));
      return;
    }
    showSuccess(t('boardingClosed'));
    setCloseOpen(false);
    await load();
  }

  async function markDeparted() {
    const res = await fetch(`/api/tours/departures/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'DEPARTED' }),
    });
    if (!res.ok) {
      showApiError(await res.json().catch(() => ({ error: res.statusText })));
      return;
    }
    showSuccess(t('markDeparted'));
    await load();
  }

  if (!dep) return null;

  const reservedCount = liveBookings.filter((b) => b.status === 'RESERVED').length;

  return (
    <div className="space-y-4">
      <PageHeader
        title={dep.agenda || t('title')}
        subtitle={`${dep.date.slice(0, 10)} · ${departureStatusLabel(dep.status)} · ${liveBookings.length}/${dep.capacity}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              onClick={() => {
                setEditAgenda(dep.agenda);
                setEditMeeting(dep.meetingPoint);
                setEditGuide(dep.guideName ?? '');
                setEditCapacity(String(dep.capacity));
                setEditPrice(String(dep.price));
                setEditVehicleId(dep.vehicleId ?? '');
                setEditOpen(true);
              }}
            >
              {t('edit')}
            </button>
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setAddOpen(true)}>
              {t('addGuest')}
            </button>
            {reservedCount > 0 && dep.status !== 'DEPARTED' && dep.status !== 'CANCELLED' ? (
              <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setCloseOpen(true)}>
                {t('closeBoarding')}
              </button>
            ) : null}
            <Link href={`/tours/${id}/print`} className={SECONDARY_BUTTON_CLASS} target="_blank">
              {t('print')}
            </Link>
            {dep.status !== 'DEPARTED' && dep.status !== 'CANCELLED' ? (
              <button type="button" className={GHOST_BUTTON_CLASS} onClick={() => void markDeparted()}>
                {t('markDeparted')}
              </button>
            ) : null}
          </div>
        }
      />
      <p className="text-[13px] text-[#34495E]">
        {t('pickup')}: {bakuDateTimeDisplay(dep.pickupAt)} → {t('return')}: {bakuDateTimeDisplay(dep.returnAt)}
        {' · '}
        {t('meetingPoint')}: {dep.meetingPoint || '—'}
        {' · '}
        {t('guide')}: {dep.guideName || '—'}
        {' · '}
        {t('vehicle')}: {dep.vehicle ? `${dep.vehicle.code} ${dep.vehicle.licensePlate}` : '—'}
        {' · '}
        {t('price')}: {Number(dep.price)}
      </p>

      <HotelDataGrid<Booking & Record<string, unknown>>
        columns={[
          {
            key: 'board',
            header: t('boarded'),
            render: (b) =>
              b.status === 'RESERVED' ? (
                <input
                  type="checkbox"
                  checked={!!selected[b.id]}
                  onChange={(e) => setSelected((prev) => ({ ...prev, [b.id]: e.target.checked }))}
                  aria-label={t('boarded')}
                />
              ) : (
                <span>{['CHARGED', 'PAID', 'ON_CITY_LEDGER'].includes(b.status) ? '✓' : '—'}</span>
              ),
          },
          {
            key: 'room',
            header: t('room'),
            render: (b) => b.reservation.room?.roomNumber ?? '—',
          },
          {
            key: 'guest',
            header: tc('guest'),
            render: (b) => b.reservation.guest.fullName,
          },
          {
            key: 'money',
            header: t('moneyStatus'),
            render: (b) => moneyLabel(b.status),
          },
          {
            key: 'actions',
            header: tc('actions'),
            render: (b) => (
              <div className="flex flex-wrap gap-1">
                {b.status === 'RESERVED' ? (
                  <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void boardOne(b.id)}>
                    {t('board')}
                  </button>
                ) : null}
                {b.status === 'CHARGED' ? (
                  <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void openPay(b.id)}>
                    {t('pay')}
                  </button>
                ) : null}
                {b.status !== 'CANCELLED' ? (
                  <button type="button" className={GHOST_BUTTON_CLASS} onClick={() => void remove(b.id)}>
                    {t('remove')}
                  </button>
                ) : null}
              </div>
            ),
          },
        ]}
        rows={liveBookings}
        rowKey={(r) => r.id}
        emptyMessage={t('emptyRoster')}
      />

      <EraModal
        open={addOpen}
        title={t('addGuest')}
        onClose={() => setAddOpen(false)}
        footer={
          <EraModalFooter formId={addFormId} onCancel={() => setAddOpen(false)} busy={busy} submitLabel={t('addGuest')} />
        }
      >
        <form id={addFormId} onSubmit={addGuest} className={FORM_STACK_CLASS}>
          <CatalogField
            kind="ENTITY_REF"
            label={t('guestStay')}
            value={reservationId}
            onChange={(v) => setReservationId(String(v ?? ''))}
            options={stays.map((r) => ({
              value: r.id,
              label: `${r.room?.roomNumber ?? '—'} · ${r.guest.fullName} · ${r.status}`,
            }))}
            required
            emptyLabel={null}
          />
        </form>
      </EraModal>

      <EraModal
        open={!!payOpen}
        title={t('pay')}
        onClose={() => setPayOpen(null)}
        footer={
          <EraModalFooter formId={payFormId} onCancel={() => setPayOpen(null)} busy={busy} submitLabel={t('pay')} />
        }
      >
        <form id={payFormId} onSubmit={pay} className={FORM_STACK_CLASS}>
          <CatalogField
            kind="OPS_HOT"
            label={t('paymentMethod')}
            value={paymentMethod}
            onChange={(v) => {
              setPaymentMethod(String(v));
              setBankTerminalId('');
            }}
            options={[
              { value: 'CASH', label: t('tenderCash') },
              { value: 'CARD', label: t('tenderCard') },
              { value: 'BANK_TRANSFER', label: t('tenderBank') },
            ]}
          />
          {paymentMethod === 'CARD' && bankTerminals.length > 0 ? (
            <CatalogField
              kind="ENTITY_REF"
              label={t('bankTerminal')}
              value={bankTerminalId}
              onChange={(v) => setBankTerminalId(String(v ?? ''))}
              options={bankTerminals.map((row) => ({ value: row.id, label: row.label }))}
              required
              emptyLabel={null}
            />
          ) : null}
          <p className="text-[13px]">{t('price')}: {Number(dep.price)}</p>
        </form>
      </EraModal>

      <EraModal
        open={editOpen}
        title={t('edit')}
        onClose={() => setEditOpen(false)}
        footer={
          <EraModalFooter formId={editFormId} onCancel={() => setEditOpen(false)} busy={busy} submitLabel={t('save')} />
        }
      >
        <form id={editFormId} onSubmit={saveEdit} className={FORM_STACK_CLASS}>
          <Field label={t('agenda')} preset="longText" value={editAgenda} onChange={(e) => setEditAgenda(e.target.value)} />
          <Field
            label={t('meetingPoint')}
            preset="shortText"
            value={editMeeting}
            onChange={(e) => setEditMeeting(e.target.value)}
          />
          <Field label={t('guide')} preset="shortText" value={editGuide} onChange={(e) => setEditGuide(e.target.value)} />
          <CatalogField
            kind="ENTITY_REF"
            label={t('vehicle')}
            value={editVehicleId}
            onChange={(v) => setEditVehicleId(String(v ?? ''))}
            options={vehicles.map((v) => ({ value: v.id, label: `${v.code} ${v.licensePlate}` }))}
            emptyLabel="—"
          />
          <div className="grid grid-cols-2 gap-3">
            <Field
              label={t('capacity')}
              preset="code"
              type="number"
              value={editCapacity}
              onChange={(e) => setEditCapacity(e.target.value)}
            />
            <Field
              label={t('price')}
              preset="amount"
              type="number"
              value={editPrice}
              onChange={(e) => setEditPrice(e.target.value)}
            />
          </div>
        </form>
      </EraModal>

      <EraModal
        open={closeOpen}
        title={t('closeBoarding')}
        onClose={() => setCloseOpen(false)}
        footer={
          <EraModalFooter
            formId={closeFormId}
            onCancel={() => setCloseOpen(false)}
            busy={busy}
            submitLabel={t('closeBoarding')}
          />
        }
      >
        <form id={closeFormId} onSubmit={closeBoarding} className={FORM_STACK_CLASS}>
          <p className="text-[13px]">{t('closeBoardingHint')}</p>
        </form>
      </EraModal>
    </div>
  );
}
