'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  FORM_FIELD_GROUP_CLASS,
  FORM_STACK_CLASS,
  MODAL_CHECKBOX_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from '@era/satellite-kit/ui';
import { EraModal, EraModalFooter } from '@/components/EraModal';

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
  const [ratePlans, setRatePlans] = useState<Option[]>([]);
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
  const [guestModalOpen, setGuestModalOpen] = useState(false);
  const [newGuestName, setNewGuestName] = useState('');
  const [newGuestPassport, setNewGuestPassport] = useState('');
  const [newGuestPhone, setNewGuestPhone] = useState('');
  const [newGuestFin, setNewGuestFin] = useState('');
  const [globalPersonId, setGlobalPersonId] = useState<string | null>(null);
  const [mdmMsg, setMdmMsg] = useState<string | null>(null);

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
        })),
      );
      setGuests(g.map((x: { id: string; fullName: string }) => ({ id: x.id, label: x.fullName })));
      setAgencies(ag.map((x: { id: string; code: string; name: string }) => ({ id: x.id, label: `${x.code} — ${x.name}` })));
    });
  }, [open, tc]);

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
          globalPersonId: globalPersonId ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? tc('failed'));
      await loadGuests();
      setGuestId(data.id);
      setGuestModalOpen(false);
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
          agencyId: agencyId || undefined,
          checkInDate: new Date(checkIn).toISOString(),
          checkOutDate: new Date(checkOut).toISOString(),
          paymentMethod,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? tc('failed'));
      onClose();
      router.push('/');
      router.refresh();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : tc('error'));
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
        <form id={formId} onSubmit={submit} className={FORM_STACK_CLASS}>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="roomTypeId">
              {t('roomType')}
            </label>
            <select
              id="roomTypeId"
              className={MODAL_INPUT_CLASS}
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
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="ratePlanId">
              {t('ratePlan')}
            </label>
            <select
              id="ratePlanId"
              className={MODAL_INPUT_CLASS}
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
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="agencyId">
              {t('agency')}
            </label>
            <select
              id="agencyId"
              className={MODAL_INPUT_CLASS}
              value={agencyId}
              onChange={(e) => setAgencyId(e.target.value)}
            >
              <option value="">{tc('select')}</option>
              {agencies.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="guestId">
              {t('guest')}
            </label>
            <select
              id="guestId"
              className={MODAL_INPUT_CLASS}
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
            <button
              type="button"
              className="mt-2 text-[13px] font-medium text-[#2980B9] hover:underline"
              onClick={() => setGuestModalOpen(true)}
            >
              {t('newGuest')}
            </button>
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="checkIn">
              {t('checkIn')}
            </label>
            <input
              id="checkIn"
              type="date"
              className={MODAL_INPUT_CLASS}
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
              required
            />
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="checkOut">
              {t('checkOut')}
            </label>
            <input
              id="checkOut"
              type="date"
              className={MODAL_INPUT_CLASS}
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              required
            />
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="paymentMethod">
              {t('paymentMethod')}
            </label>
            <select
              id="paymentMethod"
              className={MODAL_INPUT_CLASS}
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              <option value="CASH">{tPay('CASH')}</option>
              <option value="CARD">{tPay('CARD')}</option>
              <option value="COMPANY_ACCOUNT">{tPay('COMPANY_ACCOUNT')}</option>
            </select>
          </div>
          {quoteText ? (
            <p className="text-[13px] font-medium text-[#2980B9]">{t('quote')}: {quoteText}</p>
          ) : null}
        </form>
      </EraModal>

      <EraModal
        open={guestModalOpen}
        title={t('newGuest')}
        onClose={() => setGuestModalOpen(false)}
        maxWidthClass="max-w-md"
        footer={
          <EraModalFooter
            formId="new-guest-form"
            onCancel={() => setGuestModalOpen(false)}
            busy={busy}
            submitLabel={t('saveGuest')}
          />
        }
      >
        <form id="new-guest-form" onSubmit={createGuest} className={FORM_STACK_CLASS}>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="guestName">
              {t('fullName')}
            </label>
            <input
              id="guestName"
              className={MODAL_INPUT_CLASS}
              value={newGuestName}
              onChange={(e) => setNewGuestName(e.target.value)}
              required
            />
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="guestPassport">
              {t('passport')}
            </label>
            <input
              id="guestPassport"
              className={MODAL_INPUT_CLASS}
              value={newGuestPassport}
              onChange={(e) => setNewGuestPassport(e.target.value)}
              required
            />
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="guestPhone">
              {t('phone')}
            </label>
            <input
              id="guestPhone"
              className={MODAL_INPUT_CLASS}
              value={newGuestPhone}
              onChange={(e) => setNewGuestPhone(e.target.value)}
              required
            />
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="guestFin">
              FIN (MDM lookup)
            </label>
            <div className="flex gap-2">
              <input
                id="guestFin"
                className={MODAL_INPUT_CLASS}
                value={newGuestFin}
                onChange={(e) => setNewGuestFin(e.target.value)}
                placeholder="Optional — link to global person"
              />
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                disabled={busy || !newGuestFin.trim()}
                onClick={() => {
                  setMdmMsg(null);
                  void (async () => {
                    const res = await fetch('/api/mdm/person-lookup', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ fin: newGuestFin.trim() }),
                    });
                    const data = (await res.json()) as {
                      globalPersonId?: string | null;
                      error?: string;
                    };
                    if (!res.ok) {
                      setMdmMsg(data.error ?? tc('failed'));
                      return;
                    }
                    if (data.globalPersonId) {
                      setGlobalPersonId(data.globalPersonId);
                      setMdmMsg(`Linked: ${data.globalPersonId.slice(0, 8)}…`);
                    } else {
                      setGlobalPersonId(null);
                      setMdmMsg('No MDM person found (service token or FIN)');
                    }
                  })();
                }}
              >
                Lookup
              </button>
            </div>
            {mdmMsg ? <p className="text-xs text-[#7F8C8D]">{mdmMsg}</p> : null}
          </div>
        </form>
      </EraModal>
    </>
  );
}
