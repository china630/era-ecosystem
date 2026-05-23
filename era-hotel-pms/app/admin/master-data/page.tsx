'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import AppNav from '@/components/AppNav';

interface RoomType {
  id: string;
  code: string;
  name: string;
  baseQuota: number;
}

interface Room {
  id: string;
  roomNumber: string;
  roomTypeId: string;
  roomType: { code: string };
}

interface RatePlan {
  id: string;
  code: string;
  name: string;
  pricePerNight: string;
  medicalFlag: boolean;
}

interface RevenueCode {
  id: string;
  code: string;
  name: string;
}

export default function MasterDataPage() {
  const t = useTranslations('masterData');
  const tc = useTranslations('common');
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([]);
  const [revenueCodes, setRevenueCodes] = useState<RevenueCode[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const [rt, rm, rp, rc] = await Promise.all([
      fetch('/api/master/room-types').then((r) => r.json()),
      fetch('/api/rooms').then((r) => r.json()),
      fetch('/api/master/rate-plans').then((r) => r.json()),
      fetch('/api/master/revenue-codes').then((r) => r.json()),
    ]);
    setRoomTypes(rt);
    setRooms(rm);
    setRatePlans(rp);
    setRevenueCodes(rc);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <AppNav />
      <h1 className="mb-6 text-xl font-semibold">{t('title')}</h1>
      {msg && <p className="mb-4 text-sm text-slate-300">{msg}</p>}

      <section className="mb-8 rounded-lg border border-slate-700 p-4">
        <h2 className="mb-2 text-sm font-medium text-slate-400">{t('roomTypes')}</h2>
        <ul className="mb-3 text-xs text-slate-400">
          {roomTypes.map((rt) => (
            <li key={rt.id}>
              {t('roomTypeQuota', { code: rt.code, name: rt.name, quota: rt.baseQuota })}
            </li>
          ))}
        </ul>
        <form
          className="flex flex-wrap gap-2 text-sm"
          onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const res = await fetch('/api/master/room-types', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                code: fd.get('code'),
                name: fd.get('name'),
                baseQuota: Number(fd.get('quota')),
              }),
            });
            setMsg(res.ok ? t('roomTypeCreated') : tc('error'));
            await load();
          }}
        >
          <input name="code" placeholder={tc('code')} className="rounded border border-slate-600 bg-slate-800 px-2 py-1" required />
          <input name="name" placeholder={tc('name')} className="rounded border border-slate-600 bg-slate-800 px-2 py-1" required />
          <input name="quota" type="number" placeholder={tc('quota')} className="w-20 rounded border border-slate-600 bg-slate-800 px-2 py-1" required />
          <button type="submit" className="rounded bg-sky-700 px-3 py-1">
            {tc('add')}
          </button>
        </form>
      </section>

      <section className="mb-8 rounded-lg border border-slate-700 p-4">
        <h2 className="mb-2 text-sm font-medium text-slate-400">{t('rooms')}</h2>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-slate-500">
              <th className="py-1 text-left">{t('room')}</th>
              <th>{t('type')}</th>
              <th>{t('change')}</th>
            </tr>
          </thead>
          <tbody>
            {rooms.map((room) => (
              <tr key={room.id} className="border-t border-slate-800">
                <td className="py-1">{room.roomNumber}</td>
                <td>{room.roomType?.code}</td>
                <td>
                  <select
                    className="rounded border border-slate-600 bg-slate-800 px-1 py-0.5"
                    defaultValue={room.roomTypeId}
                    onChange={async (e) => {
                      const res = await fetch(`/api/rooms/${room.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ roomTypeId: e.target.value }),
                      });
                      setMsg(res.ok ? t('roomUpdated', { room: room.roomNumber }) : tc('error'));
                      await load();
                    }}
                  >
                    {roomTypes.map((rt) => (
                      <option key={rt.id} value={rt.id}>
                        {rt.code}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mb-8 rounded-lg border border-slate-700 p-4">
        <h2 className="mb-2 text-sm font-medium text-slate-400">{t('ratePlans')}</h2>
        <ul className="mb-3 max-h-32 overflow-auto text-xs text-slate-400">
          {ratePlans.map((rp) => (
            <li key={rp.id}>
              {t('ratePlanLine', {
                code: rp.code,
                name: rp.name,
                price: rp.pricePerNight,
                medical: rp.medicalFlag ? t('medicalFlag') : '',
              })}
            </li>
          ))}
        </ul>
        <form
          className="flex flex-wrap gap-2 text-sm"
          onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const res = await fetch('/api/master/rate-plans', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                code: fd.get('code'),
                name: fd.get('name'),
                pricePerNight: Number(fd.get('price')),
                medicalFlag: fd.get('medical') === 'on',
                roomTypeId: (fd.get('roomTypeId') as string) || undefined,
              }),
            });
            setMsg(res.ok ? t('ratePlanCreated') : tc('error'));
            await load();
          }}
        >
          <input name="code" placeholder={tc('code')} className="rounded border border-slate-600 bg-slate-800 px-2 py-1" required />
          <input name="name" placeholder={tc('name')} className="rounded border border-slate-600 bg-slate-800 px-2 py-1" required />
          <input name="price" type="number" step="0.01" placeholder={t('pricePerNight')} className="w-28 rounded border border-slate-600 bg-slate-800 px-2 py-1" required />
          <select name="roomTypeId" className="rounded border border-slate-600 bg-slate-800 px-2 py-1">
            <option value="">{t('anyType')}</option>
            {roomTypes.map((rt) => (
              <option key={rt.id} value={rt.id}>
                {rt.code}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1 text-xs">
            <input name="medical" type="checkbox" /> {t('medical')}
          </label>
          <button type="submit" className="rounded bg-sky-700 px-3 py-1">
            {tc('add')}
          </button>
        </form>
      </section>

      <section className="rounded-lg border border-slate-700 p-4">
        <h2 className="mb-2 text-sm font-medium text-slate-400">{t('revenueCodes')}</h2>
        <ul className="mb-3 max-h-32 overflow-auto text-xs text-slate-400">
          {revenueCodes.map((rc) => (
            <li key={rc.id}>
              {t('revenueCodeLine', { code: rc.code, name: rc.name })}
            </li>
          ))}
        </ul>
        <form
          className="flex flex-wrap gap-2 text-sm"
          onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const res = await fetch('/api/master/revenue-codes', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                code: fd.get('code'),
                name: fd.get('name'),
                targetFolioType: (fd.get('folioType') as string) || undefined,
              }),
            });
            setMsg(res.ok ? t('revenueCodeCreated') : tc('error'));
            await load();
          }}
        >
          <input name="code" placeholder={tc('code')} className="rounded border border-slate-600 bg-slate-800 px-2 py-1" required />
          <input name="name" placeholder={tc('name')} className="rounded border border-slate-600 bg-slate-800 px-2 py-1" required />
          <select name="folioType" className="rounded border border-slate-600 bg-slate-800 px-2 py-1">
            <option value="">{t('defaultFolio')}</option>
            <option value="GUEST">GUEST</option>
            <option value="COMPANY">COMPANY</option>
          </select>
          <button type="submit" className="rounded bg-sky-700 px-3 py-1">
            {tc('add')}
          </button>
        </form>
      </section>
    </div>
  );
}
