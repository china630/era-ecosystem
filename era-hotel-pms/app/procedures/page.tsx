'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
  PRIMARY_BUTTON_CLASS,
  PageHeader,
  SECONDARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';
import { EraModal, EraModalFooter } from '@/components/EraModal';
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

const bookFormId = 'book-procedure-form';

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
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('10:00');
  const [q, setQ] = useState('');
  const debouncedQ = useDebouncedValue(q, 300);
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);

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
    void load();
  }, [load]);

  function openBookModal() {
    setReservationId('');
    setStaffName('Dr. Hasanova');
    setPlaceCode('SPA-1');
    setStartDate('');
    setStartTime('10:00');
    if (services[0]?.id) setServiceId(services[0].id);
    setModalOpen(true);
  }

  const visibleAppointments = useMemo(() => {
    const q = debouncedQ.trim().toLowerCase();
    if (!q) return appointments;
    return appointments.filter((a) =>
      `${a.reservation.guest.fullName} ${a.service.name} ${a.staffName ?? ''} ${a.status}`
        .toLowerCase()
        .includes(q),
    );
  }, [appointments, debouncedQ]);

  if (!can(PERMISSIONS.MEDICAL_MANAGE)) {
    return <p className="text-sm text-[#7F8C8D]">{tc('accessDenied')}</p>;
  }

  async function book(e: React.FormEvent) {
    e.preventDefault();
    if (!reservationId || !serviceId || !startDate || !startTime) {
      showApiError({ error: t('missingFields') });
      return;
    }
    setBusy(true);
    const start = new Date(`${startDate}T${startTime}`);
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
    setBusy(false);
    if (!res.ok) {
      showApiError(data, tc('error'));
      return;
    }
    showSuccess(t('booked'));
    setModalOpen(false);
    await load();
  }

  async function finish(id: string, action: 'finish' | 'no_show') {
    const res = await fetch(`/api/procedures/appointments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    const data = await res.json();
    if (!res.ok) {
      showApiError(data, tc('error'));
      return;
    }
    showSuccess(
      action === 'finish'
        ? data.includedInPackage
          ? t('finishedIncluded')
          : t('finishedExtra')
        : t('noShow'),
    );
    await load();
  }

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={openBookModal}>
            <Plus className="h-4 w-4" aria-hidden />
            {t('book')}
          </button>
        }
      />

      <EraListFilterBar
        resetLabel={tc('filterReset')}
        onReset={() => setQ('')}
      >
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
                <th className="py-2 pr-3">{t('when')}</th>
                <th className="py-2 pr-3">{t('guest')}</th>
                <th className="py-2 pr-3">{t('service')}</th>
                <th className="py-2 pr-3">{t('staff')}</th>
                <th className="py-2 pr-3">{tc('status')}</th>
                <th className="py-2">{tc('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {visibleAppointments.map((a) => (
                <tr key={a.id} className="border-b border-[#ECF0F1]">
                  <td className="py-2 pr-3">{new Date(a.startAt).toLocaleString()}</td>
                  <td className="py-2 pr-3">
                    {a.reservation.guest.fullName} · {a.reservation.room?.roomNumber ?? '—'}
                  </td>
                  <td className="py-2 pr-3">{a.service.name}</td>
                  <td className="py-2 pr-3">
                    {a.staffName ?? '—'} / {a.placeCode ?? '—'}
                  </td>
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
      </section>

      <EraModal
        open={modalOpen}
        title={t('bookSlot')}
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
          <FieldSelect
            label={t('service')}
            preset="selectWide"
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
            required
          >
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} — {s.name}
              </option>
            ))}
          </FieldSelect>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('staff')} preset="longText" value={staffName} onChange={(e) => setStaffName(e.target.value)} />
            <Field label={t('place')} preset="code" value={placeCode} onChange={(e) => setPlaceCode(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <DatePicker
              label={t('startAt')}
              value={startDate}
              onChange={setStartDate}
              placeholder={tc('datePlaceholder')}
              openCalendarLabel={tc('openCalendar')}
              required
            />
            <Field
              label={tc('time')}
              preset="time"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
            />
          </div>
        </form>
      </EraModal>
    </>
  );
}
