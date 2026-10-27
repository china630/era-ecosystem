'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import {
  CatalogField,
  DatePicker,
  EraListFilterBar,
  useDebouncedValue,
  Field,
  FORM_STACK_CLASS,
  PRIMARY_BUTTON_CLASS,
  PageHeader,
  SECONDARY_BUTTON_CLASS,
  GHOST_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';
import { bakuDateTimeDisplay } from '@era/satellite-kit/time';
import { HotelDataGrid } from '@/components/HotelDataGrid';
import { EraModal, EraModalFooter } from '@/components/EraModal';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { hotelDateKey } from '@/lib/hotel-calendar';

type Vehicle = {
  id: string;
  code: string;
  brand: string;
  licensePlate: string;
  driverName: string | null;
  maxSeats: number;
};

type TransferOrder = {
  id: string;
  direction: string;
  flightNo: string | null;
  pickupAt: string;
  status: string;
  folioCharged: boolean;
  price: string;
  notes: string | null;
  vehicle: Vehicle | null;
  reservation: {
    id: string;
    guest: { fullName: string };
    room: { roomNumber: string } | null;
  };
};

type Reservation = {
  id: string;
  guest: { fullName: string };
  status: string;
  room: { roomNumber: string } | null;
};

const bookFormId = 'book-transfer-form';
const cancelFormId = 'cancel-transfer-form';

export default function TransfersPage() {
  const { can } = useAuth();
  const searchParams = useSearchParams();
  const guestIdFilter = searchParams.get('guestId');
  const hasFlightParam = searchParams.get('hasFlight') === '1' || searchParams.get('hasFlight') === 'true';
  const t = useTranslations('transfers');
  const tc = useTranslations('common');
  const [orders, setOrders] = useState<TransferOrder[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [reservationId, setReservationId] = useState('');
  const [direction, setDirection] = useState<'IN' | 'OUT'>('IN');
  const [flightNo, setFlightNo] = useState('');
  const [pickupDate, setPickupDate] = useState('');
  const [pickupTime, setPickupTime] = useState('12:00');
  const [price, setPrice] = useState('35');
  const [notes, setNotes] = useState('');
  const [assignVehicleId, setAssignVehicleId] = useState<Record<string, string>>({});
  const [q, setQ] = useState('');
  const debouncedQ = useDebouncedValue(q, 300);
  const [boardDate, setBoardDate] = useState(() => hotelDateKey());
  const [statusFilter, setStatusFilter] = useState('');
  const [directionFilter, setDirectionFilter] = useState('');
  const [hasFlightOnly, setHasFlightOnly] = useState(hasFlightParam);
  const [modalOpen, setModalOpen] = useState(false);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setHasFlightOnly(hasFlightParam);
  }, [hasFlightParam]);

  const load = useCallback(async () => {
    const qParams = new URLSearchParams();
    if (guestIdFilter) qParams.set('guestId', guestIdFilter);
    if (hasFlightOnly) qParams.set('hasFlight', '1');
    if (statusFilter) qParams.set('status', statusFilter);
    if (directionFilter) qParams.set('direction', directionFilter);
    const transferQ = qParams.toString() ? `?${qParams}` : '';
    const [transferRes, resRes] = await Promise.all([
      fetch(`/api/transfers${transferQ}`),
      fetch(
        guestIdFilter
          ? `/api/reservations?guestId=${encodeURIComponent(guestIdFilter)}`
          : '/api/reservations?status=CONFIRMED,OPTION,IN_HOUSE',
      ),
    ]);
    const transferData = await transferRes.json();
    const resData = await resRes.json();
    if (!transferRes.ok) {
      showApiError(transferData, tc('loadError'));
      return;
    }
    setOrders(transferData.orders ?? []);
    setVehicles(transferData.vehicles ?? []);
    setReservations(Array.isArray(resData) ? resData : []);
  }, [guestIdFilter, hasFlightOnly, statusFilter, directionFilter, tc]);

  useEffect(() => {
    void load();
  }, [load]);

  function openBookModal() {
    setReservationId('');
    setDirection('IN');
    setFlightNo('');
    setPickupDate(boardDate || hotelDateKey());
    setPickupTime('12:00');
    setPrice('35');
    setNotes('');
    setModalOpen(true);
  }

  const visibleOrders = useMemo(() => {
    let list = orders;
    if (boardDate) {
      list = list.filter((o) => o.pickupAt.slice(0, 10) === boardDate);
    }
    const qq = debouncedQ.trim().toLowerCase();
    if (!qq) return list;
    return list.filter((o) =>
      `${o.reservation.guest.fullName} ${o.flightNo ?? ''} ${o.status} ${o.direction}`
        .toLowerCase()
        .includes(qq),
    );
  }, [orders, debouncedQ, boardDate]);

  function statusLabel(s: string) {
    const map: Record<string, string> = {
      BOOKED: t('statusBooked'),
      CONFIRMED: t('statusConfirmed'),
      DONE: t('statusDone'),
      CANCELLED: t('statusCancelled'),
    };
    return map[s] ?? s;
  }

  function printDriverSheet() {
    const rows = visibleOrders
      .filter((o) => o.status !== 'CANCELLED')
      .map(
        (o) =>
          `<tr>
            <td>${bakuDateTimeDisplay(o.pickupAt)}</td>
            <td>${o.reservation.guest.fullName}</td>
            <td>${o.reservation.room?.roomNumber ?? '—'}</td>
            <td>${o.direction === 'IN' ? t('directionIn') : t('directionOut')}</td>
            <td>${o.flightNo ?? '—'}</td>
            <td>${o.vehicle ? `${o.vehicle.code} / ${o.vehicle.driverName ?? '—'}` : '—'}</td>
            <td>${statusLabel(o.status)}</td>
          </tr>`,
      )
      .join('');
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>${t('driverSheetTitle')}</title>
      <style>
        body{font-family:Segoe UI,Arial,sans-serif;padding:24px;color:#222}
        h1{font-size:18px;margin:0 0 4px} h2{font-size:13px;font-weight:normal;color:#666;margin:0 0 16px}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}
        th{background:#f5f5f5}
        @media print{button{display:none}}
      </style></head><body>
      <h1>${t('driverSheetTitle')}</h1>
      <h2>${boardDate}</h2>
      <table><thead><tr>
        <th>${t('pickupAt')}</th><th>${t('guest')}</th><th>${t('room')}</th>
        <th>${t('direction')}</th><th>${t('flightNo')}</th><th>${t('vehicle')}</th><th>${tc('status')}</th>
      </tr></thead><tbody>${rows || `<tr><td colspan="7">${t('empty')}</td></tr>`}</tbody></table>
      <script>window.onload=()=>window.print()</script>
      </body></html>`);
    w.document.close();
  }

  if (!can(PERMISSIONS.RESERVATIONS_WRITE)) {
    return <p className="text-sm text-[#7F8C8D]">{tc('accessDenied')}</p>;
  }

  async function book(e: React.FormEvent) {
    e.preventDefault();
    if (!reservationId || !pickupDate || !pickupTime || !price) {
      showApiError({ error: t('missingFields') });
      return;
    }
    setBusy(true);
    const res = await fetch('/api/transfers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reservationId,
        direction,
        flightNo: flightNo || undefined,
        pickupAt: new Date(`${pickupDate}T${pickupTime}`).toISOString(),
        price: Number(price),
        notes: notes || undefined,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      showApiError(data, tc('error'));
      return;
    }
    showSuccess(t('booked'));
    setModalOpen(false);
    await load();
  }

  async function assign(orderId: string) {
    const vehicleId = assignVehicleId[orderId];
    if (!vehicleId) {
      showApiError({ error: t('selectVehicle') });
      return;
    }
    const res = await fetch(`/api/transfers/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'assign', vehicleId }),
    });
    const data = await res.json();
    if (!res.ok) {
      showApiError(data, tc('error'));
      return;
    }
    showSuccess(t('assigned'));
    await load();
  }

  async function complete(orderId: string) {
    const res = await fetch(`/api/transfers/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'complete' }),
    });
    const data = await res.json();
    if (!res.ok) {
      showApiError(data, tc('error'));
      return;
    }
    showSuccess(t('completed'));
    await load();
  }

  async function confirmCancel(e: React.FormEvent) {
    e.preventDefault();
    if (!cancelId) return;
    setBusy(true);
    const res = await fetch(`/api/transfers/${cancelId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel' }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      showApiError(data, tc('error'));
      return;
    }
    showSuccess(t('cancelled'));
    setCancelId(null);
    await load();
  }

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={hasFlightOnly ? t('subtitleAirport') : t('subtitle')}
        actions={
          <div className="flex flex-wrap gap-2">
            <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={printDriverSheet}>
              {t('printDriverSheet')}
            </button>
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={openBookModal}>
              <Plus className="h-4 w-4" aria-hidden />
              {t('book')}
            </button>
          </div>
        }
      />

      <EraListFilterBar
        resetLabel={tc('filterReset')}
        onReset={() => {
          setQ('');
          setBoardDate(hotelDateKey());
          setStatusFilter('');
          setDirectionFilter('');
          setHasFlightOnly(false);
        }}
      >
        <DatePicker
          label={t('boardDate')}
          value={boardDate}
          onChange={setBoardDate}
          placeholder={tc('datePlaceholder')}
          openCalendarLabel={tc('openCalendar')}
        />
        <CatalogField
          kind="CLOSED_SMALL"
          label={tc('status')}
          value={statusFilter}
          onChange={(v) => setStatusFilter(String(v))}
          options={[
            { value: '', label: t('statusAll') },
            { value: 'BOOKED', label: t('statusBooked') },
            { value: 'CONFIRMED', label: t('statusConfirmed') },
            { value: 'DONE', label: t('statusDone') },
            { value: 'CANCELLED', label: t('statusCancelled') },
          ]}
        />
        <CatalogField
          kind="CLOSED_SMALL"
          label={t('direction')}
          value={directionFilter}
          onChange={(v) => setDirectionFilter(String(v))}
          options={[
            { value: '', label: t('directionAll') },
            { value: 'IN', label: t('directionIn') },
            { value: 'OUT', label: t('directionOut') },
          ]}
        />
        <CatalogField
          kind="CLOSED_SMALL"
          label={t('hasFlight')}
          value={hasFlightOnly ? '1' : ''}
          onChange={(v) => setHasFlightOnly(String(v) === '1')}
          options={[
            { value: '', label: t('allTransfers') },
            { value: '1', label: t('withFlight') },
          ]}
        />
        <Field label={tc('search')} preset="longText" value={q} onChange={(e) => setQ(e.target.value)} />
      </EraListFilterBar>

      <HotelDataGrid<TransferOrder & Record<string, unknown>>
        columns={[
          {
            key: 'pickup',
            header: t('pickupAt'),
            render: (o) => bakuDateTimeDisplay(o.pickupAt),
          },
          {
            key: 'guest',
            header: t('guest'),
            render: (o) => `${o.reservation.guest.fullName} · ${o.reservation.room?.roomNumber ?? '—'}`,
          },
          {
            key: 'direction',
            header: t('direction'),
            render: (o) => (o.direction === 'IN' ? t('directionIn') : t('directionOut')),
          },
          {
            key: 'flight',
            header: t('flightNo'),
            render: (o) => o.flightNo ?? '—',
          },
          {
            key: 'vehicle',
            header: t('vehicle'),
            render: (o) =>
              o.vehicle
                ? `${o.vehicle.code} (${o.vehicle.licensePlate})`
                : o.status === 'BOOKED'
                  ? (
                      <CatalogField
                        kind="ENTITY_REF"
                        label={t('vehicle')}
                        value={assignVehicleId[o.id] ?? ''}
                        onChange={(v) =>
                          setAssignVehicleId((prev) => ({
                            ...prev,
                            [o.id]: String(v ?? ''),
                          }))
                        }
                        options={vehicles.map((v) => ({
                          value: v.id,
                          label: `${v.code} — ${v.brand}`,
                        }))}
                        emptyLabel={tc('select')}
                      />
                    )
                  : '—',
          },
          { key: 'price', header: t('price') },
          {
            key: 'status',
            header: tc('status'),
            render: (o) => (
              <span>
                {statusLabel(o.status)}
                {o.folioCharged && o.status === 'DONE' ? ` · ${t('charged')}` : ''}
              </span>
            ),
          },
          {
            key: 'actions',
            header: tc('actions'),
            render: (o) => (
              <div className="flex flex-wrap gap-1">
                {o.status === 'BOOKED' && !o.vehicle ? (
                  <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void assign(o.id)}>
                    {t('assign')}
                  </button>
                ) : null}
                {['BOOKED', 'CONFIRMED'].includes(o.status) ? (
                  <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void complete(o.id)}>
                    {t('complete')}
                  </button>
                ) : null}
                {['BOOKED', 'CONFIRMED', 'DONE'].includes(o.status) ? (
                  <button type="button" className={GHOST_BUTTON_CLASS} onClick={() => setCancelId(o.id)}>
                    {t('cancel')}
                  </button>
                ) : null}
              </div>
            ),
          },
        ]}
        rows={visibleOrders}
        rowKey={(r) => r.id}
        emptyMessage={t('empty')}
      />

      <EraModal
        open={modalOpen}
        title={t('bookTransfer')}
        onClose={() => setModalOpen(false)}
        footer={
          <EraModalFooter
            formId={bookFormId}
            onCancel={() => setModalOpen(false)}
            busy={busy}
            submitLabel={t('book')}
          />
        }
      >
        <form id={bookFormId} onSubmit={book} className={FORM_STACK_CLASS}>
          <CatalogField
            kind="ENTITY_REF"
            label={t('guestStay')}
            value={reservationId}
            onChange={(v) => setReservationId(String(v ?? ''))}
            options={reservations.map((r) => ({
              value: r.id,
              label: `${r.guest.fullName} · ${r.room?.roomNumber ?? '—'} · ${r.status}`,
            }))}
            required
            emptyLabel={null}
          />
          <CatalogField
            kind="CLOSED_SMALL"
            label={t('direction')}
            value={direction}
            onChange={(v) => setDirection(String(v) as 'IN' | 'OUT')}
            options={[
              { value: 'IN', label: t('directionIn') },
              { value: 'OUT', label: t('directionOut') },
            ]}
          />
          <Field label={t('flightNo')} preset="code" value={flightNo} onChange={(e) => setFlightNo(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <DatePicker
              label={t('pickupAt')}
              value={pickupDate}
              onChange={setPickupDate}
              placeholder={tc('datePlaceholder')}
              openCalendarLabel={tc('openCalendar')}
              required
            />
            <Field
              label={tc('time')}
              preset="time"
              type="time"
              value={pickupTime}
              onChange={(e) => setPickupTime(e.target.value)}
              required
            />
          </div>
          <Field
            label={t('price')}
            preset="amount"
            type="number"
            min={0}
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
          />
          <Field label={t('notes')} preset="longText" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </form>
      </EraModal>

      <EraModal
        open={!!cancelId}
        title={t('cancel')}
        onClose={() => setCancelId(null)}
        footer={
          <EraModalFooter
            formId={cancelFormId}
            onCancel={() => setCancelId(null)}
            busy={busy}
            submitLabel={t('cancel')}
          />
        }
      >
        <form id={cancelFormId} onSubmit={confirmCancel} className={FORM_STACK_CLASS}>
          <p className="text-[13px]">{t('confirmCancel')}</p>
        </form>
      </EraModal>
    </>
  );
}
