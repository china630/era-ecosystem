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

type Saloon = { id: string; code: string; name: string; maxPax: number };
type MenuPackage = { id: string; code: string; name: string; pricePerPax: string };
type Reservation = { id: string; guest: { fullName: string }; room: { roomNumber: string } | null };
type BanquetEvent = {
  id: string;
  referenceNo: string | null;
  eventName: string;
  eventDate: string;
  pax: number;
  advanceAmount: string;
  status: string;
  contactName: string | null;
  saloon: { code: string; name: string };
  menuPackage: { code: string; name: string; pricePerPax: string } | null;
  reservation: { guest: { fullName: string }; room: { roomNumber: string } | null } | null;
};

export default function BanquetsPage() {
  const { can } = useAuth();
  const t = useTranslations('banquets');
  const tc = useTranslations('common');
  const [saloons, setSaloons] = useState<Saloon[]>([]);
  const [menuPackages, setMenuPackages] = useState<MenuPackage[]>([]);
  const [events, setEvents] = useState<BanquetEvent[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [eventName, setEventName] = useState('');
  const [saloonId, setSaloonId] = useState('');
  const [menuPackageId, setMenuPackageId] = useState('');
  const [reservationId, setReservationId] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [pax, setPax] = useState('50');
  const [advanceAmount, setAdvanceAmount] = useState('500');
  const [contactName, setContactName] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [banquetRes, resRes] = await Promise.all([
      fetch('/api/banquets'),
      fetch('/api/reservations?status=IN_HOUSE'),
    ]);
    const banquetData = await banquetRes.json();
    const resData = await resRes.json();
    setSaloons(banquetData.saloons ?? []);
    setMenuPackages(banquetData.menuPackages ?? []);
    setEvents(banquetData.events ?? []);
    setReservations(Array.isArray(resData) ? resData : []);
    if (!saloonId && banquetData.saloons?.[0]?.id) setSaloonId(banquetData.saloons[0].id);
    if (!menuPackageId && banquetData.menuPackages?.[0]?.id) {
      setMenuPackageId(banquetData.menuPackages[0].id);
    }
  }, [saloonId, menuPackageId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!can(PERMISSIONS.RESERVATIONS_READ)) {
    return (
      <AppShell>
        <p className="text-sm text-red-600">{tc('accessDenied')}</p>
      </AppShell>
    );
  }

  async function createBeo() {
    if (!eventName || !saloonId || !eventDate || !pax) {
      setMsg(t('missingFields'));
      return;
    }
    const res = await fetch('/api/banquets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventName,
        saloonId,
        menuPackageId: menuPackageId || undefined,
        reservationId: reservationId || undefined,
        eventDate,
        pax: Number(pax),
        advanceAmount: Number(advanceAmount) || 0,
        contactName: contactName || undefined,
      }),
    });
    const data = await res.json();
    setMsg(res.ok ? t('created') : data.error ?? tc('error'));
    if (res.ok) {
      setEventName('');
      await load();
    }
  }

  async function confirm(id: string) {
    const res = await fetch(`/api/banquets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'confirm' }),
    });
    const data = await res.json();
    setMsg(res.ok ? t('confirmed') : data.error ?? tc('error'));
    if (res.ok) await load();
  }

  return (
    <AppShell>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <StatusMessage>{msg}</StatusMessage>

      {can(PERMISSIONS.RESERVATIONS_WRITE) && (
        <PageSection>
          <h2 className="mb-3 text-sm font-semibold text-[#34495E]">{t('createBeo')}</h2>
          <div className={`${FORM_STACK_CLASS} max-w-xl`}>
            <div className={FORM_FIELD_GROUP_CLASS}>
              <label className={MODAL_FIELD_LABEL_CLASS}>{t('eventName')}</label>
              <input
                className={MODAL_INPUT_CLASS}
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
              />
            </div>
            <div className={FORM_FIELD_GROUP_CLASS}>
              <label className={MODAL_FIELD_LABEL_CLASS}>{t('saloon')}</label>
              <select className={MODAL_INPUT_CLASS} value={saloonId} onChange={(e) => setSaloonId(e.target.value)}>
                {saloons.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} — {s.name} (max {s.maxPax})
                  </option>
                ))}
              </select>
            </div>
            <div className={FORM_FIELD_GROUP_CLASS}>
              <label className={MODAL_FIELD_LABEL_CLASS}>{t('menuPackage')}</label>
              <select
                className={MODAL_INPUT_CLASS}
                value={menuPackageId}
                onChange={(e) => setMenuPackageId(e.target.value)}
              >
                <option value="">{tc('select')}</option>
                {menuPackages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name} ({p.pricePerPax} AZN/pax)
                  </option>
                ))}
              </select>
            </div>
            <div className={FORM_FIELD_GROUP_CLASS}>
              <label className={MODAL_FIELD_LABEL_CLASS}>{t('depositFolio')}</label>
              <select
                className={MODAL_INPUT_CLASS}
                value={reservationId}
                onChange={(e) => setReservationId(e.target.value)}
              >
                <option value="">{t('noFolio')}</option>
                {reservations.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.guest.fullName} · {r.room?.roomNumber ?? '—'}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className={FORM_FIELD_GROUP_CLASS}>
                <label className={MODAL_FIELD_LABEL_CLASS}>{t('eventDate')}</label>
                <input
                  type="date"
                  className={MODAL_INPUT_CLASS}
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                />
              </div>
              <div className={FORM_FIELD_GROUP_CLASS}>
                <label className={MODAL_FIELD_LABEL_CLASS}>{t('pax')}</label>
                <input
                  type="number"
                  min={1}
                  className={MODAL_INPUT_CLASS}
                  value={pax}
                  onChange={(e) => setPax(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className={FORM_FIELD_GROUP_CLASS}>
                <label className={MODAL_FIELD_LABEL_CLASS}>{t('advance')}</label>
                <input
                  type="number"
                  min={0}
                  className={MODAL_INPUT_CLASS}
                  value={advanceAmount}
                  onChange={(e) => setAdvanceAmount(e.target.value)}
                />
              </div>
              <div className={FORM_FIELD_GROUP_CLASS}>
                <label className={MODAL_FIELD_LABEL_CLASS}>{t('contact')}</label>
                <input
                  className={MODAL_INPUT_CLASS}
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                />
              </div>
            </div>
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={createBeo}>
              {t('create')}
            </button>
          </div>
        </PageSection>
      )}

      <PageSection>
        <h2 className="mb-3 text-sm font-semibold text-[#34495E]">{t('list')}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b text-left text-[#7F8C8D]">
                <th className="py-2 pr-3">{t('eventDate')}</th>
                <th className="py-2 pr-3">{t('eventName')}</th>
                <th className="py-2 pr-3">{t('saloon')}</th>
                <th className="py-2 pr-3">{t('pax')}</th>
                <th className="py-2 pr-3">{t('menuPackage')}</th>
                <th className="py-2 pr-3">{t('advance')}</th>
                <th className="py-2 pr-3">{tc('status')}</th>
                <th className="py-2">{tc('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr key={ev.id} className="border-b border-[#ECF0F1]">
                  <td className="py-2 pr-3">{new Date(ev.eventDate).toLocaleDateString()}</td>
                  <td className="py-2 pr-3">{ev.eventName}</td>
                  <td className="py-2 pr-3">{ev.saloon.name}</td>
                  <td className="py-2 pr-3">{ev.pax}</td>
                  <td className="py-2 pr-3">{ev.menuPackage?.name ?? '—'}</td>
                  <td className="py-2 pr-3">{ev.advanceAmount}</td>
                  <td className="py-2 pr-3">{ev.status}</td>
                  <td className="py-2">
                    {ev.status === 'DRAFT' && can(PERMISSIONS.RESERVATIONS_WRITE) && (
                      <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => confirm(ev.id)}>
                        {t('confirm')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {events.length === 0 && (
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
