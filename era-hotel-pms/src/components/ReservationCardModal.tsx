'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import FinanceBoundaryBanner from '@/components/FinanceBoundaryBanner';
import { useTranslations } from 'next-intl';
import {
  FORM_FIELD_GROUP_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';
import { EraModal } from '@/components/EraModal';
import GuestCardModal from '@/components/GuestCardModal';
import { ReservationCardToolbar } from '@/components/ReservationCardToolbar';
import { RESERVATION_NOTE_TYPES } from '@/lib/reservation-note-types';

type TabId = 'guests' | 'pricing' | 'folio' | 'notes';
type FolioSubTab = 'all' | 'agency' | 'guest';

type PaxRow = {
  id?: string;
  title: string;
  gender: string;
  firstName: string;
  lastName: string;
  nationality: string;
  birthDate: string;
  age: string;
  idCardNo: string;
  passportNo: string;
  isPrimary: boolean;
};

export default function ReservationCardModal({
  open,
  onClose,
  reservationId: reservationIdProp,
}: {
  open: boolean;
  onClose: () => void;
  reservationId?: string | null;
}) {
  const [editId, setEditId] = useState<string | null>(reservationIdProp ?? null);

  useEffect(() => {
    if (open) setEditId(reservationIdProp ?? null);
  }, [open, reservationIdProp]);

  return (
    <ReservationCardEditor
      open={open}
      onClose={onClose}
      reservationId={editId}
      onReservationCreated={(id) => setEditId(id)}
    />
  );
}

function ReservationCardEditor({
  open,
  onClose,
  reservationId,
  onReservationCreated,
}: {
  open: boolean;
  onClose: () => void;
  reservationId: string | null;
  onReservationCreated?: (id: string) => void;
}) {
  const isCreate = !reservationId;
  const t = useTranslations('reservationCard');
  const tb = useTranslations('booking');
  const tc = useTranslations('common');
  const tPay = useTranslations('paymentMethod');
  const tRes = useTranslations('reservationStatus');

  const [tab, setTab] = useState<TabId>('guests');
  const [folioTab, setFolioTab] = useState<FolioSubTab>('all');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [voucherNo, setVoucherNo] = useState('');
  const [adults, setAdults] = useState('1');
  const [market, setMarket] = useState('');
  const [segment, setSegment] = useState('');
  const [booker, setBooker] = useState('');
  const [vipType, setVipType] = useState('');
  const [accomType, setAccomType] = useState('');
  const [recordType, setRecordType] = useState('');
  const [tripReason, setTripReason] = useState('');
  const [agencyId, setAgencyId] = useState('');
  const [roomTypeId, setRoomTypeId] = useState('');
  const [mealPlanId, setMealPlanId] = useState('');
  const [children11_6, setChildren11_6] = useState('0');
  const [children5_2, setChildren5_2] = useState('0');
  const [children1_0, setChildren1_0] = useState('0');
  const [isLocked, setIsLocked] = useState(false);
  const [dailyRates, setDailyRates] = useState<Array<{ stayDate: string; amount: number }>>([]);
  const [agencies, setAgencies] = useState<Array<{ id: string; label: string }>>([]);
  const [roomTypes, setRoomTypes] = useState<Array<{ id: string; label: string }>>([]);
  const [mealPlans, setMealPlans] = useState<Array<{ id: string; label: string }>>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [pax, setPax] = useState<PaxRow[]>([]);
  const [ratePlanId, setRatePlanId] = useState('');
  const [ratePlans, setRatePlans] = useState<Array<{ id: string; label: string }>>([]);
  const [guestId, setGuestId] = useState('');
  const [guestOptions, setGuestOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [paymentMethod, setPaymentMethod] = useState('CARD');
  const [quoteText, setQuoteText] = useState<string | null>(null);
  const [guestCardOpen, setGuestCardOpen] = useState(false);

  const load = useCallback(async () => {
    if (!reservationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/reservations/${reservationId}/full`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? tc('loadError'));
      setData(json);
      setCheckIn(json.checkInDate?.slice(0, 10) ?? '');
      setCheckOut(json.checkOutDate?.slice(0, 10) ?? '');
      setVoucherNo(json.voucherNo ?? '');
      setAdults(String(json.adults ?? 1));
      setMarket(json.market ?? '');
      setSegment(json.segment ?? '');
      setBooker(json.booker ?? '');
      setVipType(json.vipType ?? '');
      setAccomType(json.accomType ?? '');
      setRecordType(json.recordType ?? '');
      setTripReason(json.tripReason ?? '');
      setAgencyId(json.agencyId ?? '');
      setRoomTypeId(json.roomTypeId ?? '');
      setMealPlanId(json.mealPlanId ?? '');
      setChildren11_6(String(json.children11_6 ?? 0));
      setChildren5_2(String(json.children5_2 ?? 0));
      setChildren1_0(String(json.children1_0 ?? 0));
      setIsLocked(Boolean(json.isLocked));
      setDailyRates(
        ((json.dailyRates as Array<{ stayDate: string; amount: number }>) ?? []).map((d) => ({
          stayDate: d.stayDate?.slice?.(0, 10) ?? String(d.stayDate),
          amount: Number(d.amount),
        })),
      );
      setNotes((json.notesMap as Record<string, string>) ?? {});
      const guests = (json.paxGuests as PaxRow[] | undefined) ?? [];
      if (guests.length === 0 && json.guest) {
        const g = json.guest as { fullName: string };
        const parts = g.fullName.split(' ');
        setPax([
          {
            title: '',
            gender: '',
            firstName: parts[0] ?? '',
            lastName: parts.slice(1).join(' '),
            nationality: '',
            birthDate: '',
            age: '',
            idCardNo: '',
            passportNo: '',
            isPrimary: true,
          },
        ]);
      } else {
        setPax(
          guests.map((g) => ({
            id: g.id,
            title: g.title ?? '',
            gender: g.gender ?? '',
            firstName: g.firstName ?? '',
            lastName: g.lastName ?? '',
            nationality: g.nationality ?? '',
            birthDate: g.birthDate?.slice?.(0, 10) ?? '',
            age: g.age != null ? String(g.age) : '',
            idCardNo: g.idCardNo ?? '',
            passportNo: g.passportNo ?? '',
            isPrimary: g.isPrimary ?? false,
          })),
        );
      }
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
    } finally {
      setLoading(false);
    }
  }, [reservationId, tc]);

  useEffect(() => {
    if (!open) return;
    if (isCreate) {
      setLoading(false);
      setData(null);
      setTab('guests');
      setQuoteText(null);
    } else {
      void load();
    }
    void Promise.all([
      fetch('/api/agencies').then((r) => r.json()),
      fetch('/api/master/room-types').then((r) => r.json()),
      fetch('/api/master/meal-plans').then((r) => r.json()),
      fetch('/api/master/rate-plans').then((r) => r.json()),
      fetch('/api/guests').then((r) => r.json()),
    ]).then(([ag, rt, mp, rp, g]) => {
      if (Array.isArray(ag)) {
        setAgencies(ag.map((x: { id: string; code: string; name: string }) => ({
          id: x.id,
          label: `${x.code} — ${x.name}`,
        })));
      }
      if (Array.isArray(rt)) {
        setRoomTypes(rt.map((x: { id: string; code: string }) => ({ id: x.id, label: x.code })));
      }
      if (Array.isArray(mp)) {
        setMealPlans(mp.map((x: { id: string; code: string }) => ({ id: x.id, label: x.code })));
      }
      if (Array.isArray(rp)) {
        setRatePlans(
          rp.map((x: { id: string; code: string; medicalFlag: boolean }) => ({
            id: x.id,
            label: `${x.code}${x.medicalFlag ? tc('medicalSuffix') : ''}`,
          })),
        );
      }
      if (Array.isArray(g)) {
        setGuestOptions(g.map((x: { id: string; fullName: string }) => ({ id: x.id, label: x.fullName })));
      }
    });
  }, [open, load, isCreate, tc]);

  useEffect(() => {
    if (!open) setGuestCardOpen(false);
  }, [open]);

  useEffect(() => {
    if (!isCreate || !ratePlanId || !checkIn || !checkOut) {
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
  }, [isCreate, ratePlanId, agencyId, checkIn, checkOut]);

  async function loadGuests() {
    const g = await fetch('/api/guests').then((r) => r.json());
    if (Array.isArray(g)) {
      setGuestOptions(g.map((x: { id: string; fullName: string }) => ({ id: x.id, label: x.fullName })));
    }
  }

  async function recalcPricing() {
    if (!reservationId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/reservations/${reservationId}/pricing/recalc`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) {
        showApiError(json, tc('failed'));
        return;
      }
      showSuccess(tc('success'));
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function chargeAll() {
    if (!reservationId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/reservations/${reservationId}/pricing/charge-all`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) {
        showApiError(json, tc('failed'));
        return;
      }
      showSuccess(t('chargeAllDone', { count: json.posted?.length ?? 0 }));
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function toggleLock() {
    if (!reservationId) return;
    const res = await fetch(`/api/reservations/${reservationId}/lock`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locked: !isLocked }),
    });
    const json = await res.json();
    if (res.ok) setIsLocked(json.isLocked);
  }

  async function save() {
    setBusy(true);
    try {
      if (isCreate) {
        if (!roomTypeId || !ratePlanId || !guestId || !checkIn || !checkOut) {
          showApiError({ error: tc('failed') }, tc('failed'));
          return;
        }
        const res = await fetch('/api/reservations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomTypeId,
            ratePlanId,
            guestId,
            agencyId: agencyId || undefined,
            mealPlanId: mealPlanId || undefined,
            checkInDate: new Date(checkIn).toISOString(),
            checkOutDate: new Date(checkOut).toISOString(),
            paymentMethod,
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          showApiError(json, tc('failed'));
          return;
        }
        showSuccess(tb('createBooking'));
        if (json.id) onReservationCreated?.(json.id);
        return;
      }
      const res = await fetch(`/api/reservations/${reservationId}/full`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkInDate: checkIn ? new Date(checkIn).toISOString() : undefined,
          checkOutDate: checkOut ? new Date(checkOut).toISOString() : undefined,
          voucherNo: voucherNo || null,
          adults: Number(adults) || 1,
          agencyId: agencyId || null,
          roomTypeId: roomTypeId || undefined,
          mealPlanId: mealPlanId || null,
          children11_6: Number(children11_6) || 0,
          children5_2: Number(children5_2) || 0,
          children1_0: Number(children1_0) || 0,
          market: market || null,
          segment: segment || null,
          booker: booker || null,
          vipType: vipType || null,
          accomType: accomType || null,
          recordType: recordType || null,
          tripReason: tripReason || null,
          notes,
          paxGuests: pax.map((p) => ({
            id: p.id,
            title: p.title || null,
            gender: p.gender || null,
            firstName: p.firstName || null,
            lastName: p.lastName || null,
            nationality: p.nationality || null,
            birthDate: p.birthDate || null,
            age: p.age ? Number(p.age) : null,
            idCardNo: p.idCardNo || null,
            passportNo: p.passportNo || null,
            isPrimary: p.isPrimary,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        showApiError(json, tc('failed'));
        return;
      }
      showSuccess(tc('success'));
      await load();
    } finally {
      setBusy(false);
    }
  }

  const guest = data?.guest as { fullName?: string } | undefined;
  const status = data?.status as string | undefined;
  const folios = (data?.folios as Array<{
    type: string;
    charges: Array<{ id: string; amount: number; description?: string; revenueCode?: { code: string } }>;
    payments: Array<{ id: string; amount: number }>;
  }>) ?? [];

  const folioLines = folios.flatMap((f) =>
    f.charges.map((c) => ({
      folioType: f.type,
      ...c,
    })),
  );
  const filteredFolio =
    folioTab === 'all'
      ? folioLines
      : folioLines.filter((l) =>
          folioTab === 'agency' ? l.folioType === 'AGENCY' : l.folioType === 'GUEST',
        );

  const noteCount = Object.values(notes).filter((v) => v.trim()).length;

  return (
    <EraModal
      open={open}
      title={tb('reservationCardTitle')}
      onClose={onClose}
      maxWidthClass="max-w-[min(96vw,1400px)] w-full max-h-[92vh] overflow-hidden flex flex-col"
      footer={null}
    >
      <ReservationCardToolbar
        subtitle={
          isCreate
            ? t('newReservation')
            : `${guest?.fullName ?? ''} · ${status ? tRes(status as 'CONFIRMED') : ''} · ${reservationId!.slice(0, 8)}`
        }
        busy={busy}
        loading={loading}
        isLocked={isLocked}
        noteCount={noteCount}
        showLock={!isCreate}
        onClose={onClose}
        onToggleLock={() => void toggleLock()}
        onSave={() => void save()}
      />

      {loading && !isCreate ? (
        <p className="py-8 text-center text-[13px] text-[#7F8C8D]">{tc('loading')}</p>
      ) : (
        <div className="grid min-h-0 flex-1 gap-4 overflow-hidden lg:grid-cols-[minmax(260px,30%)_1fr]">
          <aside className="space-y-3 overflow-y-auto border-r border-[#D5DADF] pr-3 text-[13px]">
            <fieldset className="space-y-2">
              <legend className="font-semibold text-[#34495E]">{t('stay')}</legend>
              <div className={FORM_FIELD_GROUP_CLASS}>
                <label className={MODAL_FIELD_LABEL_CLASS}>{tb('checkIn')}</label>
                <input type="date" className={MODAL_INPUT_CLASS} value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
              </div>
              <div className={FORM_FIELD_GROUP_CLASS}>
                <label className={MODAL_FIELD_LABEL_CLASS}>{tb('checkOut')}</label>
                <input type="date" className={MODAL_INPUT_CLASS} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
              </div>
              <div className={FORM_FIELD_GROUP_CLASS}>
                <label className={MODAL_FIELD_LABEL_CLASS}>{t('voucherNo')}</label>
                <input className={MODAL_INPUT_CLASS} value={voucherNo} onChange={(e) => setVoucherNo(e.target.value)} />
              </div>
              <div className={FORM_FIELD_GROUP_CLASS}>
                <label className={MODAL_FIELD_LABEL_CLASS}>{t('agency')}</label>
                <select className={MODAL_INPUT_CLASS} value={agencyId} onChange={(e) => setAgencyId(e.target.value)} disabled={isLocked}>
                  <option value="">{t('individual')}</option>
                  {agencies.map((a) => (
                    <option key={a.id} value={a.id}>{a.label}</option>
                  ))}
                </select>
              </div>
              <div className={FORM_FIELD_GROUP_CLASS}>
                <label className={MODAL_FIELD_LABEL_CLASS}>{tb('roomType')}</label>
                <select
                  className={MODAL_INPUT_CLASS}
                  value={roomTypeId}
                  onChange={(e) => setRoomTypeId(e.target.value)}
                  disabled={isLocked}
                  required={isCreate}
                >
                  {isCreate ? <option value="">{tc('select')}</option> : null}
                  {roomTypes.map((rt) => (
                    <option key={rt.id} value={rt.id}>{rt.label}</option>
                  ))}
                </select>
              </div>
              {isCreate ? (
                <>
                  <div className={FORM_FIELD_GROUP_CLASS}>
                    <label className={MODAL_FIELD_LABEL_CLASS}>{tb('ratePlan')}</label>
                    <select className={MODAL_INPUT_CLASS} value={ratePlanId} onChange={(e) => setRatePlanId(e.target.value)} required>
                      <option value="">{tc('select')}</option>
                      {ratePlans.map((rp) => (
                        <option key={rp.id} value={rp.id}>{rp.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className={FORM_FIELD_GROUP_CLASS}>
                    <label className={MODAL_FIELD_LABEL_CLASS}>{tb('paymentMethod')}</label>
                    <select className={MODAL_INPUT_CLASS} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                      <option value="CASH">{tPay('CASH')}</option>
                      <option value="CARD">{tPay('CARD')}</option>
                      <option value="COMPANY_ACCOUNT">{tPay('COMPANY_ACCOUNT')}</option>
                    </select>
                  </div>
                </>
              ) : null}
              <div className={FORM_FIELD_GROUP_CLASS}>
                <label className={MODAL_FIELD_LABEL_CLASS}>{t('mealPlan')}</label>
                <select className={MODAL_INPUT_CLASS} value={mealPlanId} onChange={(e) => setMealPlanId(e.target.value)} disabled={isLocked}>
                  <option value="">—</option>
                  {mealPlans.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div className={FORM_FIELD_GROUP_CLASS}>
                <label className={MODAL_FIELD_LABEL_CLASS}>{t('adults')}</label>
                <input type="number" min={0} className={MODAL_INPUT_CLASS} value={adults} onChange={(e) => setAdults(e.target.value)} disabled={isLocked} />
              </div>
              <div className="grid grid-cols-3 gap-1">
                <div className={FORM_FIELD_GROUP_CLASS}>
                  <label className={MODAL_FIELD_LABEL_CLASS}>{t('child11_6')}</label>
                  <input type="number" min={0} className={MODAL_INPUT_CLASS} value={children11_6} onChange={(e) => setChildren11_6(e.target.value)} disabled={isLocked} />
                </div>
                <div className={FORM_FIELD_GROUP_CLASS}>
                  <label className={MODAL_FIELD_LABEL_CLASS}>{t('child5_2')}</label>
                  <input type="number" min={0} className={MODAL_INPUT_CLASS} value={children5_2} onChange={(e) => setChildren5_2(e.target.value)} disabled={isLocked} />
                </div>
                <div className={FORM_FIELD_GROUP_CLASS}>
                  <label className={MODAL_FIELD_LABEL_CLASS}>{t('child1_0')}</label>
                  <input type="number" min={0} className={MODAL_INPUT_CLASS} value={children1_0} onChange={(e) => setChildren1_0(e.target.value)} disabled={isLocked} />
                </div>
              </div>
              <div className={FORM_FIELD_GROUP_CLASS}>
                <label className={MODAL_FIELD_LABEL_CLASS}>{t('market')}</label>
                <input className={MODAL_INPUT_CLASS} value={market} onChange={(e) => setMarket(e.target.value)} />
              </div>
              <div className={FORM_FIELD_GROUP_CLASS}>
                <label className={MODAL_FIELD_LABEL_CLASS}>{t('segment')}</label>
                <input className={MODAL_INPUT_CLASS} value={segment} onChange={(e) => setSegment(e.target.value)} />
              </div>
            </fieldset>
          </aside>

          <div className="flex min-h-0 min-w-0 flex-col">
            <div className="mb-2 flex gap-1 border-b border-[#D5DADF]">
              {(['guests', 'pricing', 'folio', 'notes'] as TabId[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  className={`px-3 py-2 text-[13px] font-medium ${tab === id ? 'border-b-2 border-[#2980B9] text-[#2980B9]' : 'text-[#7F8C8D]'}`}
                  onClick={() => setTab(id)}
                >
                  {tb(`tab${id.charAt(0).toUpperCase()}${id.slice(1)}` as 'tabGuests')}
                </button>
              ))}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto pb-14">
              {tab === 'guests' && (
                <div className="space-y-4">
                  {isCreate ? (
                    <div className={FORM_FIELD_GROUP_CLASS}>
                      <label className={MODAL_FIELD_LABEL_CLASS}>{tb('guest')}</label>
                      <select className={MODAL_INPUT_CLASS} value={guestId} onChange={(e) => setGuestId(e.target.value)} required>
                        <option value="">{tc('select')}</option>
                        {guestOptions.map((g) => (
                          <option key={g.id} value={g.id}>{g.label}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="mt-2 text-[13px] font-medium text-[#2980B9] hover:underline"
                        onClick={() => setGuestCardOpen(true)}
                      >
                        {tb('newGuest')}
                      </button>
                    </div>
                  ) : null}
                  {!isCreate ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-left text-[12px]">
                      <thead className="bg-[#F8FAFC] text-[#7F8C8D]">
                        <tr>
                          <th className="p-2">{t('name')}</th>
                          <th className="p-2">{t('surname')}</th>
                          <th className="p-2">{t('nationality')}</th>
                          <th className="p-2">{t('passport')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pax.map((row, i) => (
                          <tr key={i} className="border-t border-[#D5DADF]">
                            <td className="p-1">
                              <input className={MODAL_INPUT_CLASS} value={row.firstName} onChange={(e) => {
                                const next = [...pax];
                                next[i] = { ...row, firstName: e.target.value };
                                setPax(next);
                              }} />
                            </td>
                            <td className="p-1">
                              <input className={MODAL_INPUT_CLASS} value={row.lastName} onChange={(e) => {
                                const next = [...pax];
                                next[i] = { ...row, lastName: e.target.value };
                                setPax(next);
                              }} />
                            </td>
                            <td className="p-1">
                              <input className={MODAL_INPUT_CLASS} value={row.nationality} onChange={(e) => {
                                const next = [...pax];
                                next[i] = { ...row, nationality: e.target.value };
                                setPax(next);
                              }} />
                            </td>
                            <td className="p-1">
                              <input className={MODAL_INPUT_CLASS} value={row.passportNo} onChange={(e) => {
                                const next = [...pax];
                                next[i] = { ...row, passportNo: e.target.value };
                                setPax(next);
                              }} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  ) : null}
                  {!isCreate ? (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className={FORM_FIELD_GROUP_CLASS}>
                      <label className={MODAL_FIELD_LABEL_CLASS}>{t('booker')}</label>
                      <input className={MODAL_INPUT_CLASS} value={booker} onChange={(e) => setBooker(e.target.value)} />
                    </div>
                    <div className={FORM_FIELD_GROUP_CLASS}>
                      <label className={MODAL_FIELD_LABEL_CLASS}>{t('vipType')}</label>
                      <input className={MODAL_INPUT_CLASS} value={vipType} onChange={(e) => setVipType(e.target.value)} />
                    </div>
                    <div className={FORM_FIELD_GROUP_CLASS}>
                      <label className={MODAL_FIELD_LABEL_CLASS}>{t('accomType')}</label>
                      <input className={MODAL_INPUT_CLASS} value={accomType} onChange={(e) => setAccomType(e.target.value)} />
                    </div>
                    <div className={FORM_FIELD_GROUP_CLASS}>
                      <label className={MODAL_FIELD_LABEL_CLASS}>{t('recordType')}</label>
                      <input className={MODAL_INPUT_CLASS} value={recordType} onChange={(e) => setRecordType(e.target.value)} />
                    </div>
                    <div className={FORM_FIELD_GROUP_CLASS}>
                      <label className={MODAL_FIELD_LABEL_CLASS}>{t('tripReason')}</label>
                      <input className={MODAL_INPUT_CLASS} value={tripReason} onChange={(e) => setTripReason(e.target.value)} />
                    </div>
                  </div>
                  ) : null}
                </div>
              )}

              {tab === 'pricing' && (
                <div className="space-y-4">
                  <p className="text-right text-lg font-semibold text-[#34495E]">
                    {isCreate
                      ? (quoteText ?? tb('quotePending'))
                      : `${t('total')}: ${String(data?.totalAmount ?? 0)} AZN`}
                  </p>
                  {!isCreate && dailyRates.length > 0 ? (
                    <table className="w-full font-mono text-[12px]">
                      <thead className="bg-[#F8FAFC]">
                        <tr>
                          <th className="p-2 text-left">{t('stayDate')}</th>
                          <th className="p-2 text-right">{t('amount')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dailyRates.map((d) => (
                          <tr key={d.stayDate} className="border-t border-[#D5DADF]">
                            <td className="p-2">{d.stayDate}</td>
                            <td className="p-2 text-right">{d.amount.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : !isCreate ? (
                    <p className="text-[13px] text-[#7F8C8D]">{tb('quotePending')}</p>
                  ) : null}
                  {!isCreate ? (
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="rounded-lg bg-[#E74C3C] px-4 py-2 text-[13px] font-medium text-white disabled:opacity-50" disabled={busy || isLocked} onClick={() => void recalcPricing()}>
                      {t('calcDaily')}
                    </button>
                    <button type="button" className={PRIMARY_BUTTON_CLASS} disabled={busy || isLocked} onClick={() => void chargeAll()}>
                      {t('chargeAll')}
                    </button>
                  </div>
                  ) : null}
                </div>
              )}

              {tab === 'folio' && (
                isCreate ? (
                  <p className="text-[13px] text-[#7F8C8D]">{tb('folioTabHint')}</p>
                ) : (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    {(['all', 'agency', 'guest'] as FolioSubTab[]).map((st) => (
                      <button
                        key={st}
                        type="button"
                        className={`rounded px-2 py-1 text-[12px] ${folioTab === st ? 'bg-[#2980B9] text-white' : 'bg-[#EBEDF0] text-[#34495E]'}`}
                        onClick={() => setFolioTab(st)}
                      >
                        {t(`folioTab.${st}`)}
                      </button>
                    ))}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[520px] font-mono text-[12px]">
                      <thead className="bg-[#F8FAFC]">
                        <tr>
                          <th className="p-2 text-left">{t('department')}</th>
                          <th className="p-2 text-right">{t('amount')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredFolio.map((line) => (
                          <tr key={line.id} className="border-t border-[#D5DADF]">
                            <td className="p-2">{line.revenueCode?.code ?? line.description}</td>
                            <td className="p-2 text-right">{line.amount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/folio/${reservationId}`} className={PRIMARY_BUTTON_CLASS}>
                      {t('posting')}
                    </Link>
                    <Link href={`/folio/${reservationId}?action=payment`} className="rounded-lg bg-[#E74C3C] px-4 py-2 text-[13px] font-medium text-white">
                      {t('getPayment')}
                    </Link>
                  </div>
                  <FinanceBoundaryBanner target="salesInvoices" />
                </div>
                )
              )}

              {tab === 'notes' && (
                isCreate ? (
                  <p className="text-[13px] text-[#7F8C8D]">{tb('notesTabHint')}</p>
                ) : (
                <div className="space-y-2">
                  {RESERVATION_NOTE_TYPES.map((nt) => (
                    <div key={nt} className="grid gap-2 sm:grid-cols-[180px_1fr]">
                      <label className="pt-2 text-[12px] font-medium text-[#34495E]">
                        {t(`noteType.${nt}`)}
                      </label>
                      <textarea
                        className={`${MODAL_INPUT_CLASS} min-h-[2rem]`}
                        rows={2}
                        value={notes[nt] ?? ''}
                        onChange={(e) => setNotes((prev) => ({ ...prev, [nt]: e.target.value }))}
                      />
                    </div>
                  ))}
                </div>
                )
              )}
            </div>

            <div className="sticky bottom-0 flex flex-wrap gap-2 border-t border-[#D5DADF] bg-white py-2">
              <button type="button" className="rounded-lg bg-[#E74C3C] px-3 py-1.5 text-[12px] font-medium text-white">
                {t('bottom.details')}
              </button>
              <button type="button" className="rounded-lg bg-[#E74C3C] px-3 py-1.5 text-[12px] font-medium text-white" onClick={() => setTab('notes')}>
                {t('bottom.notes', { count: noteCount })}
              </button>
              <button type="button" className="rounded-lg bg-[#E74C3C]/60 px-3 py-1.5 text-[12px] text-white" disabled>
                {t('bottom.creditCard')}
              </button>
              <button type="button" className="rounded-lg bg-[#E74C3C]/60 px-3 py-1.5 text-[12px] text-white" disabled>
                {t('bottom.packages')}
              </button>
              <button type="button" className="rounded-lg bg-[#E74C3C]/60 px-3 py-1.5 text-[12px] text-white" disabled>
                {t('bottom.tasks', { count: 0 })}
              </button>
              <button type="button" className="rounded-lg bg-[#2980B9] px-3 py-1.5 text-[12px] font-medium text-white" disabled>
                {t('bottom.folioRouting')}
              </button>
            </div>
          </div>
        </div>
      )}

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
    </EraModal>
  );
}
