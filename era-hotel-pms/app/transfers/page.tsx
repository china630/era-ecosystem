'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import {
  CARD_CONTAINER_CLASS,
  DatePicker,
  EraListFilterBar,
  useDebouncedValue,
  Field,
  FieldSelect,
  FORM_STACK_CLASS,
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  PageHeader,
  SECONDARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';
import { EraModal, EraModalFooter } from '@/components/EraModal';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

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

export default function TransfersPage() {
  const { can } = useAuth();
  const searchParams = useSearchParams();
  const guestIdFilter = searchParams.get('guestId');
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
  const [boardDate, setBoardDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const transferQ = guestIdFilter ? `?guestId=${encodeURIComponent(guestIdFilter)}` : '';
    const [transferRes, resRes] = await Promise.all([
      fetch(`/api/transfers${transferQ}`),
      fetch(
        guestIdFilter
          ? `/api/reservations?guestId=${encodeURIComponent(guestIdFilter)}`
          : '/api/reservations?status=IN_HOUSE',
      ),
    ]);
    const transferData = await transferRes.json();
    const resData = await resRes.json();
    setOrders(transferData.orders ?? []);
    setVehicles(transferData.vehicles ?? []);
    setReservations(Array.isArray(resData) ? resData : []);
  }, [guestIdFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  function openBookModal() {
    setReservationId('');
    setDirection('IN');
    setFlightNo('');
    setPickupDate('');
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
    const q = debouncedQ.trim().toLowerCase();
    if (!q) return list;
    return list.filter((o) =>
      `${o.reservation.guest.fullName} ${o.flightNo ?? ''} ${o.status} ${o.direction}`
        .toLowerCase()
        .includes(q),
    );
  }, [orders, debouncedQ, boardDate]);

  function printDriverSheet() {
    const rows = visibleOrders
      .filter((o) => o.status !== 'CANCELLED')
      .map(
        (o) =>
          `<tr>
            <td>${new Date(o.pickupAt).toLocaleString()}</td>
            <td>${o.reservation.guest.fullName}</td>
            <td>${o.reservation.room?.roomNumber ?? '—'}</td>
            <td>${o.direction === 'IN' ? 'IN' : 'OUT'}</td>
            <td>${o.flightNo ?? '—'}</td>
            <td>${o.vehicle ? `${o.vehicle.code} / ${o.vehicle.driverName ?? '—'}` : '—'}</td>
            <td>${o.status}</td>
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
        <th>${t('pickupAt')}</th><th>${t('guest')}</th><th>Room</th>
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

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
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
          setBoardDate(new Date().toISOString().slice(0, 10));
        }}
      >
        <DatePicker
          label={t('boardDate')}
          value={boardDate}
          onChange={setBoardDate}
          placeholder={tc('datePlaceholder')}
          openCalendarLabel={tc('openCalendar')}
        />
        <Field
          label={tc('search')}
          preset="longText"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </EraListFilterBar>

      <section className={`${CARD_CONTAINER_CLASS} p-4`}>
        <h2 className="mb-3 text-sm font-semibold text-[#34495E]">{t('schedule')}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b text-left text-[#7F8C8D]">
                <th className="py-2 pr-3">{t('pickupAt')}</th>
                <th className="py-2 pr-3">{t('guest')}</th>
                <th className="py-2 pr-3">{t('direction')}</th>
                <th className="py-2 pr-3">{t('flightNo')}</th>
                <th className="py-2 pr-3">{t('vehicle')}</th>
                <th className="py-2 pr-3">{t('price')}</th>
                <th className="py-2 pr-3">{tc('status')}</th>
                <th className="py-2">{tc('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {visibleOrders.map((o) => (
                <tr key={o.id} className="border-b border-[#ECF0F1]">
                  <td className="py-2 pr-3">{new Date(o.pickupAt).toLocaleString()}</td>
                  <td className="py-2 pr-3">
                    {o.reservation.guest.fullName} · {o.reservation.room?.roomNumber ?? '—'}
                  </td>
                  <td className="py-2 pr-3">{o.direction === 'IN' ? t('directionIn') : t('directionOut')}</td>
                  <td className="py-2 pr-3">{o.flightNo ?? '—'}</td>
                  <td className="py-2 pr-3">
                    {o.vehicle
                      ? `${o.vehicle.code} (${o.vehicle.licensePlate})`
                      : o.status === 'BOOKED'
                        ? (
                            <select
                              className={MODAL_INPUT_CLASS}
                              value={assignVehicleId[o.id] ?? ''}
                              onChange={(e) =>
                                setAssignVehicleId((prev) => ({ ...prev, [o.id]: e.target.value }))
                              }
                            >
                              <option value="">{tc('select')}</option>
                              {vehicles.map((v) => (
                                <option key={v.id} value={v.id}>
                                  {v.code} — {v.brand}
                                </option>
                              ))}
                            </select>
                          )
                        : '—'}
                  </td>
                  <td className="py-2 pr-3">{o.price}</td>
                  <td className="py-2 pr-3">{o.status}</td>
                  <td className="py-2 space-x-2">
                    {o.status === 'BOOKED' && !o.vehicle && (
                      <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => assign(o.id)}>
                        {t('assign')}
                      </button>
                    )}
                    {['BOOKED', 'CONFIRMED'].includes(o.status) && (
                      <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => complete(o.id)}>
                        {t('complete')}
                      </button>
                    )}
                    {['BOOKED', 'CONFIRMED', 'DONE'].includes(o.status) && (
                      <button
                        type="button"
                        className={SECONDARY_BUTTON_CLASS}
                        onClick={async () => {
                          if (!confirm(t('confirmCancel'))) return;
                          const res = await fetch(`/api/transfers/${o.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'cancel' }),
                          });
                          const data = await res.json();
                          if (!res.ok) {
                            showApiError(data, tc('error'));
                            return;
                          }
                          showSuccess(t('cancelled'));
                          await load();
                        }}
                      >
                        {t('cancel')}
                      </button>
                    )}
                    {o.folioCharged && o.status === 'DONE' && (
                      <span className="text-[#7F8C8D]">{t('charged')}</span>
                    )}
                  </td>
                </tr>
              ))}
              {visibleOrders.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-4 text-[#7F8C8D]">
                    {t('empty')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

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
          <FieldSelect
            label={t('guestStay')}
            preset="selectWide"
            value={reservationId}
            onChange={(e) => setReservationId(e.target.value)}
            required
          >
            <option value="">{tc('select')}</option>
            {reservations.map((r) => (
              <option key={r.id} value={r.id}>
                {r.guest.fullName} · {r.room?.roomNumber ?? '—'}
              </option>
            ))}
          </FieldSelect>
          <div className="grid grid-cols-2 gap-3">
            <FieldSelect
              label={t('direction')}
              preset="select"
              value={direction}
              onChange={(e) => setDirection(e.target.value as 'IN' | 'OUT')}
            >
              <option value="IN">{t('directionIn')}</option>
              <option value="OUT">{t('directionOut')}</option>
            </FieldSelect>
            <Field label={t('flightNo')} preset="code" value={flightNo} onChange={(e) => setFlightNo(e.target.value)} />
          </div>
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
    </>
  );
}
