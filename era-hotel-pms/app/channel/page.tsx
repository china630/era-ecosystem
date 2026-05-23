'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import AppNav from '@/components/AppNav';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

interface SyncError {
  id: string;
  otaReference: string | null;
  errorMessage: string;
  resolvedAt: string | null;
  createdAt: string;
}

interface StopSell {
  id: string;
  date: string;
  note: string | null;
  roomType: { code: string } | null;
}

interface RoomType {
  id: string;
  code: string;
}

export default function ChannelPage() {
  const { can } = useAuth();
  const t = useTranslations('channel');
  const tc = useTranslations('common');
  const [errors, setErrors] = useState<SyncError[]>([]);
  const [stopSells, setStopSells] = useState<StopSell[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [otaRef, setOtaRef] = useState('');
  const [errorText, setErrorText] = useState('');
  const [stopDate, setStopDate] = useState('');
  const [stopRoomTypeId, setStopRoomTypeId] = useState('');

  const load = useCallback(async () => {
    const [eRes, sRes, rtRes] = await Promise.all([
      fetch('/api/channel/errors'),
      fetch('/api/channel/stop-sell'),
      fetch('/api/master/room-types'),
    ]);
    if (eRes.ok) setErrors(await eRes.json());
    if (sRes.ok) setStopSells(await sRes.json());
    if (rtRes.ok) setRoomTypes(await rtRes.json());
  }, []);

  useEffect(() => {
    setErrorText(t('defaultSyncError'));
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  async function logError(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/channel/errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ otaReference: otaRef || undefined, errorMessage: errorText }),
    });
    const data = await res.json();
    setMsg(res.ok ? t('errorLogged') : data.error);
    await load();
  }

  async function resolve(id: string) {
    const res = await fetch(`/api/channel/errors?id=${id}`, { method: 'PATCH' });
    const data = await res.json();
    setMsg(res.ok ? t('resolved') : data.error);
    await load();
  }

  async function addStopSell(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/channel/stop-sell', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: stopDate,
        roomTypeId: stopRoomTypeId || undefined,
        note: 'CH-01 stop sell',
      }),
    });
    const data = await res.json();
    setMsg(res.ok ? t('salesClosed') : data.error);
    await load();
  }

  async function removeStopSell(id: string) {
    const res = await fetch(`/api/channel/stop-sell?id=${id}`, { method: 'DELETE' });
    const data = await res.json();
    setMsg(res.ok ? t('stopSellRemoved') : data.error);
    await load();
  }

  if (!can(PERMISSIONS.CHANNEL_MANAGE)) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <AppNav />
        <p className="text-slate-400">{tc('noPermissionChannel')}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <AppNav />
      <h1 className="mb-4 text-xl font-semibold">{t('title')}</h1>

      {msg && <p className="mb-4 text-sm text-slate-300">{msg}</p>}

      <section className="mb-8 rounded-xl border border-slate-700 p-4">
        <h2 className="mb-3 text-sm font-medium uppercase text-slate-500">{t('stopSell')}</h2>
        <p className="mb-3 text-xs text-slate-400">{t('stopSellHint')}</p>
        <form onSubmit={addStopSell} className="flex flex-wrap gap-2 text-sm">
          <input
            type="date"
            required
            className="rounded border border-slate-600 bg-slate-800 px-2 py-1"
            value={stopDate}
            onChange={(e) => setStopDate(e.target.value)}
          />
          <select
            className="rounded border border-slate-600 bg-slate-800 px-2 py-1"
            value={stopRoomTypeId}
            onChange={(e) => setStopRoomTypeId(e.target.value)}
          >
            <option value="">{t('allRoomTypes')}</option>
            {roomTypes.map((rt) => (
              <option key={rt.id} value={rt.id}>
                {rt.code}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded bg-rose-800 px-3 py-1">
            {t('closeSales')}
          </button>
        </form>
        <table className="mt-4 w-full text-left text-xs">
          <thead>
            <tr className="text-slate-500">
              <th className="py-1">{tc('date')}</th>
              <th>{t('roomType')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {stopSells.map((s) => (
              <tr key={s.id} className="border-t border-slate-800">
                <td className="py-1">{s.date.slice(0, 10)}</td>
                <td>{s.roomType?.code ?? tc('all')}</td>
                <td>
                  <button
                    type="button"
                    onClick={() => removeStopSell(s.id)}
                    className="text-sky-400 hover:underline"
                  >
                    {tc('remove')}
                  </button>
                </td>
              </tr>
            ))}
            {stopSells.length === 0 && (
              <tr>
                <td colSpan={3} className="py-2 text-slate-500">
                  {t('noStopSell')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="mb-8 rounded-xl border border-slate-700 p-4">
        <h2 className="mb-3 text-sm font-medium uppercase text-slate-500">{t('syncJournal')}</h2>
        <form onSubmit={logError} className="mb-4 grid gap-2 sm:grid-cols-2">
          <input
            placeholder={t('otaReference')}
            className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm"
            value={otaRef}
            onChange={(e) => setOtaRef(e.target.value)}
          />
          <input
            placeholder={t('errorMessage')}
            className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm"
            value={errorText}
            onChange={(e) => setErrorText(e.target.value)}
            required
          />
          <button type="submit" className="sm:col-span-2 rounded bg-sky-700 py-2 text-sm">
            {t('logSyncError')}
          </button>
        </form>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-slate-500">
              <th className="py-2">{t('otaRef')}</th>
              <th>{tc('message')}</th>
              <th>{tc('status')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {errors.map((e) => (
              <tr key={e.id} className="border-t border-slate-800">
                <td className="py-2">{e.otaReference ?? tc('dash')}</td>
                <td>{e.errorMessage}</td>
                <td>{e.resolvedAt ? t('resolved') : t('open')}</td>
                <td>
                  {!e.resolvedAt && (
                    <button
                      type="button"
                      onClick={() => resolve(e.id)}
                      className="text-xs text-sky-400 hover:underline"
                    >
                      {tc('resolve')}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
