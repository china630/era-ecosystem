'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import AppNav from '@/components/AppNav';

interface Option {
  id: string;
  label: string;
}

export default function NewBookingPage() {
  const router = useRouter();
  const t = useTranslations('booking');
  const tc = useTranslations('common');
  const tPay = useTranslations('paymentMethod');
  const [roomTypes, setRoomTypes] = useState<Option[]>([]);
  const [ratePlans, setRatePlans] = useState<Option[]>([]);
  const [guests, setGuests] = useState<Option[]>([]);
  const [roomTypeId, setRoomTypeId] = useState('');
  const [ratePlanId, setRatePlanId] = useState('');
  const [guestId, setGuestId] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CARD');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showNewGuest, setShowNewGuest] = useState(false);
  const [newGuestName, setNewGuestName] = useState('');
  const [newGuestPassport, setNewGuestPassport] = useState('');
  const [newGuestPhone, setNewGuestPhone] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/master/room-types').then((r) => r.json()),
      fetch('/api/master/rate-plans').then((r) => r.json()),
      fetch('/api/guests').then((r) => r.json()),
    ]).then(([rt, rp, g]) => {
      setRoomTypes(rt.map((x: { id: string; code: string }) => ({ id: x.id, label: x.code })));
      setRatePlans(
        rp.map((x: { id: string; code: string; medicalFlag: boolean }) => ({
          id: x.id,
          label: `${x.code}${x.medicalFlag ? tc('medicalSuffix') : ''}`,
        })),
      );
      setGuests(g.map((x: { id: string; fullName: string }) => ({ id: x.id, label: x.fullName })));
    });
  }, [tc]);

  async function loadGuests() {
    const g = await fetch('/api/guests').then((r) => r.json());
    setGuests(g.map((x: { id: string; fullName: string }) => ({ id: x.id, label: x.fullName })));
  }

  async function createGuest(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch('/api/guests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: newGuestName,
          passportNumber: newGuestPassport,
          phone: newGuestPhone,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? tc('failed'));
      await loadGuests();
      setGuestId(data.id);
      setShowNewGuest(false);
      setMsg(t('guestCreated', { name: data.fullName }));
    } catch (err) {
      setMsg(err instanceof Error ? err.message : tc('error'));
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomTypeId,
          ratePlanId,
          guestId,
          checkInDate: new Date(checkIn).toISOString(),
          checkOutDate: new Date(checkOut).toISOString(),
          paymentMethod,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? tc('failed'));
      setMsg(t('bookingCreated', { id: data.id }));
      setTimeout(() => router.push('/'), 800);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : tc('error'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <AppNav />
      <h1 className="mb-4 text-xl font-semibold">{t('title')}</h1>
      <form onSubmit={submit} className="space-y-3 rounded-xl border border-slate-700 p-4">
        <label className="block text-sm">
          {t('roomType')}
          <select
            className="mt-1 w-full rounded border border-slate-600 bg-slate-800 px-2 py-1"
            value={roomTypeId}
            onChange={(e) => setRoomTypeId(e.target.value)}
            required
          >
            <option value="">{tc('select')}</option>
            {roomTypes.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          {t('ratePlan')}
          <select
            className="mt-1 w-full rounded border border-slate-600 bg-slate-800 px-2 py-1"
            value={ratePlanId}
            onChange={(e) => setRatePlanId(e.target.value)}
            required
          >
            <option value="">{tc('select')}</option>
            {ratePlans.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <div className="text-sm">
          <label className="block">
            {t('guest')}
            <select
              className="mt-1 w-full rounded border border-slate-600 bg-slate-800 px-2 py-1"
              value={guestId}
              onChange={(e) => setGuestId(e.target.value)}
              required
            >
              <option value="">{tc('select')}</option>
              {guests.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="mt-2 text-xs text-sky-400 hover:underline"
            onClick={() => setShowNewGuest((v) => !v)}
          >
            {showNewGuest ? t('cancelNewGuest') : t('newGuest')}
          </button>
          {showNewGuest && (
            <form onSubmit={createGuest} className="mt-2 space-y-2 rounded border border-slate-600 p-2">
              <input
                placeholder={t('fullName')}
                className="w-full rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm"
                value={newGuestName}
                onChange={(e) => setNewGuestName(e.target.value)}
                required
              />
              <input
                placeholder={t('passport')}
                className="w-full rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm"
                value={newGuestPassport}
                onChange={(e) => setNewGuestPassport(e.target.value)}
                required
              />
              <input
                placeholder={t('phone')}
                className="w-full rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm"
                value={newGuestPhone}
                onChange={(e) => setNewGuestPhone(e.target.value)}
                required
              />
              <button type="submit" disabled={busy} className="w-full rounded bg-sky-700 py-1 text-xs disabled:opacity-50">
                {t('saveGuest')}
              </button>
            </form>
          )}
        </div>
        <label className="block text-sm">
          {t('checkIn')}
          <input
            type="date"
            className="mt-1 w-full rounded border border-slate-600 bg-slate-800 px-2 py-1"
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
            required
          />
        </label>
        <label className="block text-sm">
          {t('checkOut')}
          <input
            type="date"
            className="mt-1 w-full rounded border border-slate-600 bg-slate-800 px-2 py-1"
            value={checkOut}
            onChange={(e) => setCheckOut(e.target.value)}
            required
          />
        </label>
        <label className="block text-sm">
          {t('paymentMethod')}
          <select
            className="mt-1 w-full rounded border border-slate-600 bg-slate-800 px-2 py-1"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
          >
            <option value="CASH">{tPay('CASH')}</option>
            <option value="CARD">{tPay('CARD')}</option>
            <option value="COMPANY_ACCOUNT">{tPay('COMPANY_ACCOUNT')}</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-emerald-700 py-2 text-sm font-medium disabled:opacity-50"
        >
          {t('createBooking')}
        </button>
      </form>
      {msg && <p className="mt-4 text-sm text-slate-300">{msg}</p>}
    </div>
  );
}
