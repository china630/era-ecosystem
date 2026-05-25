'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  FORM_FIELD_GROUP_CLASS,
  FORM_STACK_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from '@era/satellite-kit/ui';
import { PageHeader } from '@era/satellite-kit/ui';
import AppShell, { PageSection, StatusMessage } from '@/components/layout/AppShell';
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

export default function TransfersPage() {
  const { can } = useAuth();
  const t = useTranslations('transfers');
  const tc = useTranslations('common');
  const [orders, setOrders] = useState<TransferOrder[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [reservationId, setReservationId] = useState('');
  const [direction, setDirection] = useState<'IN' | 'OUT'>('IN');
  const [flightNo, setFlightNo] = useState('');
  const [pickupAt, setPickupAt] = useState('');
  const [price, setPrice] = useState('35');
  const [notes, setNotes] = useState('');
  const [assignVehicleId, setAssignVehicleId] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [transferRes, resRes] = await Promise.all([
      fetch('/api/transfers'),
      fetch('/api/reservations?status=IN_HOUSE'),
    ]);
    const transferData = await transferRes.json();
    const resData = await resRes.json();
    setOrders(transferData.orders ?? []);
    setVehicles(transferData.vehicles ?? []);
    setReservations(Array.isArray(resData) ? resData : []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!can(PERMISSIONS.RESERVATIONS_WRITE)) {
    return (
      <AppShell>
        <p className="text-sm text-red-600">{tc('accessDenied')}</p>
      </AppShell>
    );
  }

  async function book() {
    if (!reservationId || !pickupAt || !price) {
      setMsg(t('missingFields'));
      return;
    }
    const res = await fetch('/api/transfers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reservationId,
        direction,
        flightNo: flightNo || undefined,
        pickupAt: new Date(pickupAt).toISOString(),
        price: Number(price),
        notes: notes || undefined,
      }),
    });
    const data = await res.json();
    setMsg(res.ok ? t('booked') : data.error ?? tc('error'));
    if (res.ok) await load();
  }

  async function assign(orderId: string) {
    const vehicleId = assignVehicleId[orderId];
    if (!vehicleId) {
      setMsg(t('selectVehicle'));
      return;
    }
    const res = await fetch(`/api/transfers/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'assign', vehicleId }),
    });
    const data = await res.json();
    setMsg(res.ok ? t('assigned') : data.error ?? tc('error'));
    if (res.ok) await load();
  }

  async function complete(orderId: string) {
    const res = await fetch(`/api/transfers/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'complete' }),
    });
    const data = await res.json();
    setMsg(res.ok ? t('completed') : data.error ?? tc('error'));
    if (res.ok) await load();
  }

  return (
    <AppShell>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <StatusMessage>{msg}</StatusMessage>

      <PageSection>
        <h2 className="mb-3 text-sm font-semibold text-[#34495E]">{t('bookTransfer')}</h2>
        <div className={`${FORM_STACK_CLASS} max-w-xl`}>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS}>{t('guestStay')}</label>
            <select
              className={MODAL_INPUT_CLASS}
              value={reservationId}
              onChange={(e) => setReservationId(e.target.value)}
            >
              <option value="">{tc('select')}</option>
              {reservations.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.guest.fullName} · {r.room?.roomNumber ?? '—'}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className={FORM_FIELD_GROUP_CLASS}>
              <label className={MODAL_FIELD_LABEL_CLASS}>{t('direction')}</label>
              <select
                className={MODAL_INPUT_CLASS}
                value={direction}
                onChange={(e) => setDirection(e.target.value as 'IN' | 'OUT')}
              >
                <option value="IN">{t('directionIn')}</option>
                <option value="OUT">{t('directionOut')}</option>
              </select>
            </div>
            <div className={FORM_FIELD_GROUP_CLASS}>
              <label className={MODAL_FIELD_LABEL_CLASS}>{t('flightNo')}</label>
              <input className={MODAL_INPUT_CLASS} value={flightNo} onChange={(e) => setFlightNo(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className={FORM_FIELD_GROUP_CLASS}>
              <label className={MODAL_FIELD_LABEL_CLASS}>{t('pickupAt')}</label>
              <input
                type="datetime-local"
                className={MODAL_INPUT_CLASS}
                value={pickupAt}
                onChange={(e) => setPickupAt(e.target.value)}
              />
            </div>
            <div className={FORM_FIELD_GROUP_CLASS}>
              <label className={MODAL_FIELD_LABEL_CLASS}>{t('price')}</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className={MODAL_INPUT_CLASS}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS}>{t('notes')}</label>
            <input className={MODAL_INPUT_CLASS} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={book}>
            {t('book')}
          </button>
        </div>
      </PageSection>

      <PageSection>
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
              {orders.map((o) => (
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
                    {o.folioCharged && o.status === 'DONE' && (
                      <span className="text-[#7F8C8D]">{t('charged')}</span>
                    )}
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-4 text-[#7F8C8D]">
                    {t('empty')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </PageSection>
    </AppShell>
  );
}
