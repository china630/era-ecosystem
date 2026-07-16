'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Field,
  FieldRow,
  FieldSelect,
  FORM_STACK_CLASS,
  showApiError,
} from '@era/satellite-kit/ui';
import { EraModal, EraModalFooter } from '@/components/EraModal';
import GuestCardModal from '@/components/GuestCardModal';

interface Option {
  id: string;
  label: string;
}

export default function NewBookingModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const t = useTranslations('booking');
  const tc = useTranslations('common');
  const tPay = useTranslations('paymentMethod');
  const [roomTypes, setRoomTypes] = useState<Option[]>([]);
  const [ratePlans, setRatePlans] = useState<Array<Option & { medical?: boolean }>>([]);
  const [agencies, setAgencies] = useState<Option[]>([]);
  const [guests, setGuests] = useState<Option[]>([]);
  const [roomTypeId, setRoomTypeId] = useState('');
  const [ratePlanId, setRatePlanId] = useState('');
  const [agencyId, setAgencyId] = useState('');
  const [guestId, setGuestId] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [quoteText, setQuoteText] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('CARD');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [guestCardOpen, setGuestCardOpen] = useState(false);
  const [clinicCapWarn, setClinicCapWarn] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    Promise.all([
      fetch('/api/master/room-types').then((r) => r.json()),
      fetch('/api/master/rate-plans').then((r) => r.json()),
      fetch('/api/guests').then((r) => r.json()),
      fetch('/api/agencies').then((r) => r.json()),
    ]).then(([rt, rp, g, ag]) => {
      setRoomTypes(rt.map((x: { id: string; code: string }) => ({ id: x.id, label: x.code })));
      setRatePlans(
        rp.map((x: { id: string; code: string; medicalFlag: boolean }) => ({
          id: x.id,
          label: `${x.code}${x.medicalFlag ? tc('medicalSuffix') : ''}`,
          medical: x.medicalFlag,
        })),
      );
      setGuests(g.map((x: { id: string; fullName: string }) => ({ id: x.id, label: x.fullName })));
      setAgencies(ag.map((x: { id: string; code: string; name: string }) => ({ id: x.id, label: `${x.code} — ${x.name}` })));
    });
  }, [open, tc]);

  useEffect(() => {
    if (open) return;
    setGuestCardOpen(false);
    setMsg(null);
    setClinicCapWarn(null);
  }, [open]);

  useEffect(() => {
    const plan = ratePlans.find((p) => p.id === ratePlanId);
    if (!open || !plan?.medical || !checkIn) {
      setClinicCapWarn(null);
      return;
    }
    let cancelled = false;
    void fetch(`/api/clinic/capacity?date=${encodeURIComponent(checkIn)}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const cap = d.data ?? d;
        if (!cap?.riskLevel || cap.riskLevel === 'ok') {
          setClinicCapWarn(null);
          return;
        }
        setClinicCapWarn(cap.message ?? t('clinicCapacityWarn'));
      })
      .catch(() => {
        if (!cancelled) setClinicCapWarn(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open, ratePlanId, checkIn, ratePlans, t]);

  useEffect(() => {
    if (!ratePlanId || !checkIn || !checkOut) {
      setQuoteText(null);
      return;
    }
    const qs = new URLSearchParams({
      ratePlanId,
      checkInDate: checkIn,
      checkOutDate: checkOut,
    });
    if (agencyId) qs.set('agencyId', agencyId);
    fetch(`/api/bookings/quote?${qs}`)
      .then((r) => r.json())
      .then((q) => {
        if (q.error) {
          setQuoteText(null);
          return;
        }
        const suffix = q.contractRuleName
          ? ` (${q.contractRuleName}: ${q.baseNightly} → ${q.adjustedNightly} AZN/night)`
          : ` (${q.adjustedNightly} AZN/night)`;
        setQuoteText(`${q.totalAmount.toFixed(2)} AZN · ${q.nights} nights${suffix}`);
      })
      .catch(() => setQuoteText(null));
  }, [ratePlanId, agencyId, checkIn, checkOut]);

  async function loadGuests() {
    const g = await fetch('/api/guests').then((r) => r.json());
    setGuests(g.map((x: { id: string; fullName: string }) => ({ id: x.id, label: x.fullName })));
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
          agencyId: agencyId || undefined,
          checkInDate: new Date(checkIn).toISOString(),
          checkOutDate: new Date(checkOut).toISOString(),
          paymentMethod,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('failed'));
        return;
      }
      onClose();
      router.push('/');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const formId = 'new-booking-form';

  return (
    <>
      <EraModal
        open={open}
        title={t('title')}
        onClose={onClose}
        maxWidthClass="max-w-lg"
        footer={
          <EraModalFooter
            formId={formId}
            onCancel={onClose}
            busy={busy}
            submitLabel={t('createBooking')}
            cancelLabel={tc('cancel')}
          />
        }
      >
        {msg ? <p className="mb-4 text-[13px] text-[#7F8C8D]">{msg}</p> : null}
        {clinicCapWarn ? (
          <p className="mb-4 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-[13px] text-amber-950">
            {clinicCapWarn}
          </p>
        ) : null}
        <form id={formId} onSubmit={submit} className={FORM_STACK_CLASS}>
          <FieldSelect
            label={t('roomType')}
            preset="selectWide"
            id="roomTypeId"
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
          </FieldSelect>
          <FieldSelect
            label={t('ratePlan')}
            preset="selectWide"
            id="ratePlanId"
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
          </FieldSelect>
          <FieldSelect
            label={t('agency')}
            preset="selectWide"
            id="agencyId"
            value={agencyId}
            onChange={(e) => setAgencyId(e.target.value)}
          >
            <option value="">{tc('select')}</option>
            {agencies.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </FieldSelect>
          <div>
            <FieldSelect
              label={t('guest')}
              preset="selectWide"
              id="guestId"
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
            </FieldSelect>
            <button
              type="button"
              className="mt-2 text-[13px] font-medium text-[#2980B9] hover:underline"
              onClick={() => setGuestCardOpen(true)}
            >
              {t('newGuest')}
            </button>
          </div>
          <FieldRow cols={2}>
            <Field
              label={t('checkIn')}
              preset="date"
              id="checkIn"
              type="date"
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
              required
            />
            <Field
              label={t('checkOut')}
              preset="date"
              id="checkOut"
              type="date"
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              required
            />
          </FieldRow>
          <FieldSelect
            label={t('paymentMethod')}
            preset="select"
            id="paymentMethod"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
          >
            <option value="CASH">{tPay('CASH')}</option>
            <option value="CARD">{tPay('CARD')}</option>
            <option value="COMPANY_ACCOUNT">{tPay('COMPANY_ACCOUNT')}</option>
          </FieldSelect>
          {quoteText ? (
            <p className="text-[13px] font-medium text-[#2980B9]">
              {t('quote')}: {quoteText}
            </p>
          ) : null}
        </form>
      </EraModal>

      <GuestCardModal
        open={guestCardOpen}
        guestId={null}
        onClose={() => setGuestCardOpen(false)}
        onCreated={(id) => {
          setGuestId(id);
          setGuestCardOpen(false);
          void loadGuests();
        }}
      />
    </>
  );
}
