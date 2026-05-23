'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import AppNav from '@/components/AppNav';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

interface Alert {
  id: string;
  message: string;
  temperature: number | null;
  guest: { fullName: string };
}

interface Guest {
  id: string;
  fullName: string;
}

interface Reservation {
  id: string;
  guest: Guest;
  status: string;
}

export default function MedicalPage() {
  const { can } = useAuth();
  const t = useTranslations('medical');
  const tc = useTranslations('common');
  const tRes = useTranslations('reservationStatus');
  const defaultAlert = t('defaultAlert');
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [guestId, setGuestId] = useState('');
  const [reservationId, setReservationId] = useState('');
  const [alertMsg, setAlertMsg] = useState(defaultAlert);
  const [orderType, setOrderType] = useState('LAB');
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [aRes, rRes] = await Promise.all([
      fetch('/api/medical/alerts'),
      fetch('/api/reservations?status=IN_HOUSE'),
    ]);
    if (aRes.ok) setAlerts(await aRes.json());
    if (rRes.ok) {
      const r = await rRes.json();
      setReservations(r);
      setReservationId((prev) => prev || r[0]?.id || '');
      setGuestId((prev) => prev || r[0]?.guest?.id || '');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createAlert(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/medical/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guestId, reservationId: reservationId || undefined, message: alertMsg, temperature: 38.2 }),
    });
    const data = await res.json();
    setMsg(res.ok ? t('alertCreated') : data.error);
    await load();
  }

  async function createOrder() {
    const res = await fetch('/api/medical/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reservationId, orderType }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error);
      return;
    }
    setMsg(t('orderCreated', { id: data.id }));
    const labRes = await fetch('/api/medical/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: data.id,
        testName: 'CBC',
        resultValue: '5.2',
        flag: 'NORMAL',
      }),
    });
    const labData = await labRes.json();
    setMsg(labRes.ok ? t('orderLabResult', { test: labData.testName }) : labData.error);
    await load();
  }

  async function postProcedure() {
    const res = await fetch('/api/medical/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reservationId,
        code: 'MED-PROC',
        name: t('procedureName'),
        amount: 50,
      }),
    });
    const data = await res.json();
    setMsg(res.ok ? t('procedurePosted') : data.error);
  }

  if (!can(PERMISSIONS.MEDICAL_MANAGE)) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <AppNav />
        <p className="text-slate-400">{tc('noPermissionMedical')}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <AppNav />
      <h1 className="mb-4 text-xl font-semibold">{t('title')}</h1>

      {msg && <p className="mb-4 text-sm text-slate-300">{msg}</p>}

      <section className="mb-8 rounded-xl border border-slate-700 p-4">
        <h2 className="mb-3 text-sm font-medium uppercase text-slate-500">{t('alerts')}</h2>
        <ul className="mb-4 space-y-1 text-sm">
          {alerts.map((a) => (
            <li key={a.id}>
              {a.guest.fullName}: {a.message}
              {a.temperature != null && ` (${a.temperature}°C)`}
            </li>
          ))}
        </ul>
        <form onSubmit={createAlert} className="grid gap-2 sm:grid-cols-2">
          <select
            className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm"
            value={guestId}
            onChange={(e) => {
              setGuestId(e.target.value);
              const r = reservations.find((x) => x.guest.id === e.target.value);
              if (r) setReservationId(r.id);
            }}
          >
            {reservations.map((r) => (
              <option key={r.guest.id} value={r.guest.id}>
                {r.guest.fullName}
              </option>
            ))}
          </select>
          <input
            className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm"
            value={alertMsg}
            onChange={(e) => setAlertMsg(e.target.value)}
          />
          <button type="submit" className="sm:col-span-2 rounded bg-rose-800 py-2 text-sm">
            {t('createAlert')}
          </button>
        </form>
      </section>

      <section className="mb-8 rounded-xl border border-slate-700 p-4">
        <h2 className="mb-3 text-sm font-medium uppercase text-slate-500">{t('orderLab')}</h2>
        <div className="flex flex-wrap gap-2">
          <select
            className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm"
            value={reservationId}
            onChange={(e) => setReservationId(e.target.value)}
          >
            {reservations.map((r) => (
              <option key={r.id} value={r.id}>
                {r.guest.fullName} ({tRes(r.status as 'IN_HOUSE')})
              </option>
            ))}
          </select>
          <input
            className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm"
            value={orderType}
            onChange={(e) => setOrderType(e.target.value)}
          />
          <button type="button" onClick={createOrder} className="rounded bg-sky-700 px-3 py-1 text-sm">
            {t('createOrderLab')}
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-slate-700 p-4">
        <h2 className="mb-3 text-sm font-medium uppercase text-slate-500">{t('procedureFolio')}</h2>
        <button type="button" onClick={postProcedure} className="rounded bg-emerald-700 px-3 py-2 text-sm">
          {t('postProcedure')}
        </button>
      </section>
    </div>
  );
}
