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

type Service = { id: string; code: string; name: string; durationMin: number; defaultAmount: string };
type Appointment = {
  id: string;
  startAt: string;
  endAt: string;
  status: string;
  staffName: string | null;
  placeCode: string | null;
  auditNote: string | null;
  service: { code: string; name: string; defaultAmount: string };
  reservation: {
    id: string;
    guest: { fullName: string };
    room: { roomNumber: string } | null;
    ratePlan: { code: string; medicalFlag: boolean };
  };
};
type Reservation = { id: string; guest: { fullName: string }; status: string; room: { roomNumber: string } | null };

export default function ProceduresPage() {
  const { can } = useAuth();
  const t = useTranslations('procedures');
  const tc = useTranslations('common');
  const [services, setServices] = useState<Service[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [reservationId, setReservationId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [staffName, setStaffName] = useState('Dr. Hasanova');
  const [placeCode, setPlaceCode] = useState('SPA-1');
  const [startAt, setStartAt] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [procRes, resRes] = await Promise.all([
      fetch('/api/procedures'),
      fetch('/api/reservations?status=IN_HOUSE'),
    ]);
    const procData = await procRes.json();
    const resData = await resRes.json();
    setServices(procData.services ?? []);
    setAppointments(procData.appointments ?? []);
    setReservations(Array.isArray(resData) ? resData : []);
    if (!serviceId && procData.services?.[0]?.id) setServiceId(procData.services[0].id);
  }, [serviceId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!can(PERMISSIONS.MEDICAL_MANAGE)) {
    return (
      <AppShell>
        <p className="text-sm text-red-600">{tc('accessDenied')}</p>
      </AppShell>
    );
  }

  async function book() {
    if (!reservationId || !serviceId || !startAt) {
      setMsg(t('missingFields'));
      return;
    }
    const start = new Date(startAt);
    const svc = services.find((s) => s.id === serviceId);
    const end = new Date(start.getTime() + (svc?.durationMin ?? 30) * 60000);
    const res = await fetch('/api/procedures/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reservationId,
        serviceId,
        staffName,
        placeCode,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
      }),
    });
    const data = await res.json();
    setMsg(res.ok ? t('booked') : data.error ?? tc('error'));
    if (res.ok) await load();
  }

  async function finish(id: string, action: 'finish' | 'no_show') {
    const res = await fetch(`/api/procedures/appointments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    const data = await res.json();
    setMsg(
      res.ok
        ? action === 'finish'
          ? data.includedInPackage
            ? t('finishedIncluded')
            : t('finishedExtra')
          : t('noShow')
        : data.error ?? tc('error'),
    );
    if (res.ok) await load();
  }

  return (
    <AppShell>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <StatusMessage>{msg}</StatusMessage>

      <PageSection>
        <h2 className="mb-3 text-sm font-semibold text-[#34495E]">{t('bookSlot')}</h2>
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
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS}>{t('service')}</label>
            <select className={MODAL_INPUT_CLASS} value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} — {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className={FORM_FIELD_GROUP_CLASS}>
              <label className={MODAL_FIELD_LABEL_CLASS}>{t('staff')}</label>
              <input className={MODAL_INPUT_CLASS} value={staffName} onChange={(e) => setStaffName(e.target.value)} />
            </div>
            <div className={FORM_FIELD_GROUP_CLASS}>
              <label className={MODAL_FIELD_LABEL_CLASS}>{t('place')}</label>
              <input className={MODAL_INPUT_CLASS} value={placeCode} onChange={(e) => setPlaceCode(e.target.value)} />
            </div>
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS}>{t('startAt')}</label>
            <input
              type="datetime-local"
              className={MODAL_INPUT_CLASS}
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
            />
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
                <th className="py-2 pr-3">{t('when')}</th>
                <th className="py-2 pr-3">{t('guest')}</th>
                <th className="py-2 pr-3">{t('service')}</th>
                <th className="py-2 pr-3">{t('staff')}</th>
                <th className="py-2 pr-3">{tc('status')}</th>
                <th className="py-2">{tc('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((a) => (
                <tr key={a.id} className="border-b border-[#ECF0F1]">
                  <td className="py-2 pr-3">{new Date(a.startAt).toLocaleString()}</td>
                  <td className="py-2 pr-3">
                    {a.reservation.guest.fullName} · {a.reservation.room?.roomNumber ?? '—'}
                  </td>
                  <td className="py-2 pr-3">{a.service.name}</td>
                  <td className="py-2 pr-3">{a.staffName ?? '—'} / {a.placeCode ?? '—'}</td>
                  <td className="py-2 pr-3">{a.status}</td>
                  <td className="py-2 space-x-2">
                    {a.status === 'BOOKED' && (
                      <>
                        <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => finish(a.id, 'finish')}>
                          {t('finish')}
                        </button>
                        <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => finish(a.id, 'no_show')}>
                          {t('noShow')}
                        </button>
                      </>
                    )}
                    {a.auditNote && <span className="text-[#7F8C8D]">{a.auditNote}</span>}
                  </td>
                </tr>
              ))}
              {appointments.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-4 text-[#7F8C8D]">
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
