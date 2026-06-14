'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { showApiError, showSuccess } from '@era/satellite-kit/ui';
import { EraModal } from '@/components/EraModal';
import GuestCardModal from '@/components/GuestCardModal';
import { ReservationCardToolbar, ReservationCardBottomBar } from '@/components/ReservationCardToolbar';
import { ReservationCardLeftPanel } from '@/components/reservation-card/ReservationCardLeftPanel';
import { ReservationCardGuestsTab } from '@/components/reservation-card/ReservationCardGuestsTab';
import { ReservationCardPricingTab } from '@/components/reservation-card/ReservationCardPricingTab';
import { ReservationCardFolioTab } from '@/components/reservation-card/ReservationCardFolioTab';
import { ReservationCardNotesTab } from '@/components/reservation-card/ReservationCardNotesTab';
import { ReservationCardAttachPanel } from '@/components/reservation-card/ReservationCardAttachPanel';
import type { AttachmentRow } from '@/components/reservation-card/types';
import {
  ReservationCardSubModals,
  useReservationSubModals,
} from '@/components/reservation-card/ReservationCardSubModals';
import type { BottomTab, DailyRateRow, FolioSubTab, PaxRow, SelectOption, TabId } from '@/components/reservation-card/types';
import { computeGuestFolioBalance } from '@/components/reservation-card/folio-balance';

function mergeDateTime(date: string, time: string): string | undefined {
  if (!date) return undefined;
  const t = time || '14:00';
  return new Date(`${date}T${t}:00`).toISOString();
}

function timeFromIso(iso?: string): string {
  if (!iso) return '14:00';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export type ReservationCardEditorProps = {
  layout: 'modal' | 'page';
  open: boolean;
  onClose: () => void;
  reservationId: string | null;
  onReservationCreated?: (id: string) => void;
};

export function ReservationCardEditor({
  layout,
  open,
  onClose,
  reservationId,
  onReservationCreated,
}: ReservationCardEditorProps) {
  const isCreate = !reservationId;
  const t = useTranslations('reservationCard');
  const tb = useTranslations('booking');
  const tc = useTranslations('common');
  const tRes = useTranslations('reservationStatus');

  const [tab, setTab] = useState<TabId>('guests');
  const [bottomTab, setBottomTab] = useState<BottomTab>('details');
  const [folioTab, setFolioTab] = useState<FolioSubTab>('all');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [checkInTime, setCheckInTime] = useState('14:00');
  const [checkOutTime, setCheckOutTime] = useState('12:00');
  const [voucherNo, setVoucherNo] = useState('');
  const [adults, setAdults] = useState('1');
  const [market, setMarket] = useState('');
  const [segment, setSegment] = useState('');
  const [booker, setBooker] = useState('');
  const [guestRep, setGuestRep] = useState('');
  const [paidBy, setPaidBy] = useState('');
  const [vipType, setVipType] = useState('');
  const [accomType, setAccomType] = useState('');
  const [recordType, setRecordType] = useState('');
  const [tripReason, setTripReason] = useState('');
  const [agencyId, setAgencyId] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [roomTypeId, setRoomTypeId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [roomCount, setRoomCount] = useState('1');
  const [rateType, setRateType] = useState('');
  const [resNo, setResNo] = useState('');
  const [shareNo, setShareNo] = useState('');
  const [optionDate, setOptionDate] = useState('');
  const [optionState, setOptionState] = useState('');
  const [salesProject, setSalesProject] = useState('');
  const [specialStates, setSpecialStates] = useState('');
  const [resGroup, setResGroup] = useState('');
  const [colorCode, setColorCode] = useState('');
  const [preferredLocation, setPreferredLocation] = useState('');
  const [preferredBed, setPreferredBed] = useState('');
  const [givenRoomTypeId, setGivenRoomTypeId] = useState('');
  const [contractRef, setContractRef] = useState('');
  const [attachments, setAttachments] = useState<AttachmentRow[]>([]);
  const [attachOpen, setAttachOpen] = useState(false);
  const [roomStatus, setRoomStatus] = useState('');
  const [mealPlanId, setMealPlanId] = useState('');
  const [children11_6, setChildren11_6] = useState('0');
  const [children5_2, setChildren5_2] = useState('0');
  const [children1_0, setChildren1_0] = useState('0');
  const [isLocked, setIsLocked] = useState(false);
  const [useManualRate, setUseManualRate] = useState(false);
  const [manualDailyRate, setManualDailyRate] = useState('');
  const [discountActive, setDiscountActive] = useState(false);
  const [dailyRates, setDailyRates] = useState<DailyRateRow[]>([]);
  const [agencies, setAgencies] = useState<SelectOption[]>([]);
  const [sources, setSources] = useState<SelectOption[]>([]);
  const [roomTypes, setRoomTypes] = useState<SelectOption[]>([]);
  const [mealPlans, setMealPlans] = useState<SelectOption[]>([]);
  const [rooms, setRooms] = useState<Array<{ id: string; roomNumber: string }>>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [pax, setPax] = useState<PaxRow[]>([]);
  const [ratePlanId, setRatePlanId] = useState('');
  const [ratePlans, setRatePlans] = useState<SelectOption[]>([]);
  const [guestId, setGuestId] = useState('');
  const [guestOptions, setGuestOptions] = useState<SelectOption[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('CARD');
  const [creditLimitAzn, setCreditLimitAzn] = useState('');
  const [quoteText, setQuoteText] = useState<string | null>(null);
  const [guestCardOpen, setGuestCardOpen] = useState(false);
  const [pendingRoomId, setPendingRoomId] = useState('');
  const [taskCount, setTaskCount] = useState(0);
  const { openSubModal, subModalProps } = useReservationSubModals(reservationId);

  const applyJson = useCallback((json: Record<string, unknown>) => {
    setData(json);
    setCheckIn(String(json.checkInDate ?? '').slice(0, 10));
    setCheckOut(String(json.checkOutDate ?? '').slice(0, 10));
    setCheckInTime(timeFromIso(json.checkInDate as string | undefined));
    setCheckOutTime(timeFromIso(json.checkOutDate as string | undefined));
    setVoucherNo(String(json.voucherNo ?? ''));
    setAdults(String(json.adults ?? 1));
    setMarket(String(json.market ?? ''));
    setSegment(String(json.segment ?? ''));
    setBooker(String(json.booker ?? ''));
    setGuestRep(String(json.guestRep ?? ''));
    setPaidBy(String(json.paidBy ?? ''));
    setVipType(String(json.vipType ?? ''));
    setAccomType(String(json.accomType ?? ''));
    setRecordType(String(json.recordType ?? ''));
    setTripReason(String(json.tripReason ?? ''));
    setAgencyId(String(json.agencyId ?? ''));
    setSourceId(String(json.sourceId ?? ''));
    setRoomTypeId(String(json.roomTypeId ?? ''));
    setRoomId(String(json.roomId ?? ''));
    setPendingRoomId(String(json.roomId ?? ''));
    setRoomCount(String(json.roomCount ?? 1));
    setRateType(String(json.rateType ?? ''));
    setResNo(String(json.resNo ?? ''));
    setShareNo(String(json.shareNo ?? ''));
    setOptionDate(json.optionDate ? String(json.optionDate).slice(0, 10) : '');
    setOptionState(String(json.optionState ?? ''));
    setSalesProject(String(json.salesProject ?? ''));
    setSpecialStates(String(json.specialStates ?? ''));
    setResGroup(String(json.resGroup ?? ''));
    setColorCode(String(json.colorCode ?? ''));
    setPreferredLocation(String(json.preferredLocation ?? ''));
    setPreferredBed(String(json.preferredBed ?? ''));
    setGivenRoomTypeId(String(json.givenRoomTypeId ?? ''));
    setContractRef(String(json.contractRef ?? ''));
    setAttachments((json.attachments as AttachmentRow[]) ?? []);
    const rm = json.room as { status?: string } | null | undefined;
    setRoomStatus(rm?.status ?? '');
    setMealPlanId(String(json.mealPlanId ?? ''));
    setChildren11_6(String(json.children11_6 ?? 0));
    setChildren5_2(String(json.children5_2 ?? 0));
    setChildren1_0(String(json.children1_0 ?? 0));
    setIsLocked(Boolean(json.isLocked));
    setUseManualRate(Boolean(json.useManualRate));
    setManualDailyRate(json.manualDailyRate != null ? String(json.manualDailyRate) : '');
    setDiscountActive(Boolean(json.discountActive));
    setCreditLimitAzn(json.creditLimitAzn != null ? String(json.creditLimitAzn) : '');
    setDailyRates(
      (
        (json.dailyRates as Array<{
          stayDate: string;
          amount: number;
          manualFlag?: boolean;
          currencyCode?: string;
          fixPrice?: boolean;
          discountPct?: number | null;
        }>) ?? []
      ).map((d) => ({
        stayDate: String(d.stayDate).slice(0, 10),
        amount: Number(d.amount),
        currencyCode: d.currencyCode ?? 'AZN',
        fixPrice: Boolean(d.fixPrice),
        discountPct: d.discountPct ?? null,
        manualFlag: Boolean(d.manualFlag),
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
          memberNo: '',
          payStatus: '',
          externalResId: '',
          guestState: '',
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
          memberNo: (g as { memberNo?: string }).memberNo ?? '',
          payStatus: (g as { payStatus?: string }).payStatus ?? '',
          externalResId: (g as { externalResId?: string }).externalResId ?? '',
          guestState: (g as { guestState?: string }).guestState ?? '',
          isPrimary: g.isPrimary ?? false,
        })),
      );
    }
  }, []);

  const load = useCallback(async () => {
    if (!reservationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/reservations/${reservationId}/full`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? tc('loadError'));
      applyJson(json);
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
    } finally {
      setLoading(false);
    }
  }, [reservationId, tc, applyJson]);

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
      fetch('/api/master/booking-sources').then((r) => r.json()),
      fetch('/api/master/room-types').then((r) => r.json()),
      fetch('/api/master/meal-plans').then((r) => r.json()),
      fetch('/api/master/rate-plans').then((r) => r.json()),
      fetch('/api/guests').then((r) => r.json()),
      fetch('/api/rooms').then((r) => r.json()),
    ]).then(([ag, src, rt, mp, rp, g, rm]) => {
      if (Array.isArray(ag)) {
        setAgencies(ag.map((x: { id: string; code: string; name: string }) => ({
          id: x.id,
          label: `${x.code} — ${x.name}`,
        })));
      }
      if (Array.isArray(src)) {
        setSources(src.map((x: { id: string; code: string; name?: string }) => ({
          id: x.id,
          label: x.name ? `${x.code} — ${x.name}` : x.code,
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
      if (Array.isArray(rm)) {
        setRooms(rm.map((x: { id: string; roomNumber: string }) => ({ id: x.id, roomNumber: x.roomNumber })));
      }
    });
  }, [open, load, isCreate, tc]);

  useEffect(() => {
    if (!open) setGuestCardOpen(false);
  }, [open]);

  useEffect(() => {
    if (!reservationId || isCreate) {
      setTaskCount(0);
      return;
    }
    fetch(`/api/reservations/${reservationId}/tasks`)
      .then((r) => r.json())
      .then((list) => setTaskCount(Array.isArray(list) ? list.length : 0))
      .catch(() => setTaskCount(0));
  }, [reservationId, isCreate, open]);

  useEffect(() => {
    if (!isCreate || !ratePlanId || !checkIn || !checkOut) {
      setQuoteText(null);
      return;
    }
    const qs = new URLSearchParams({ ratePlanId, checkInDate: checkIn, checkOutDate: checkOut });
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

  async function confirmCheckIn() {
    if (!reservationId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/reservations/${reservationId}/check-in`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) {
        showApiError(json, tc('failed'));
        return;
      }
      showSuccess(t('checkInDone'));
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function assignRoom() {
    if (!reservationId || !pendingRoomId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/reservations/${reservationId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: pendingRoomId }),
      });
      const json = await res.json();
      if (!res.ok) {
        showApiError(json, tc('failed'));
        return;
      }
      showSuccess(tc('success'));
      setRoomId(pendingRoomId);
      await load();
    } finally {
      setBusy(false);
    }
  }

  const leftPatch = useMemo(
    () => ({
      checkIn,
      checkOut,
      checkInTime,
      checkOutTime,
      voucherNo,
      agencyId,
      sourceId,
      roomTypeId,
      roomId: pendingRoomId,
      roomCount,
      rateType,
      mealPlanId,
      ratePlanId,
      paymentMethod,
      adults,
      children11_6,
      children5_2,
      children1_0,
      market,
      segment,
      resNo,
      shareNo,
      optionDate,
      optionState,
      salesProject,
      specialStates,
      resGroup,
      colorCode,
      preferredLocation,
      preferredBed,
      givenRoomTypeId,
      contractRef,
      creditLimitAzn,
    }),
    [
      checkIn,
      checkOut,
      checkInTime,
      checkOutTime,
      voucherNo,
      agencyId,
      sourceId,
      roomTypeId,
      pendingRoomId,
      roomCount,
      rateType,
      mealPlanId,
      ratePlanId,
      paymentMethod,
      adults,
      children11_6,
      children5_2,
      children1_0,
      market,
      segment,
      resNo,
      shareNo,
      optionDate,
      optionState,
      salesProject,
      specialStates,
      resGroup,
      colorCode,
      preferredLocation,
      preferredBed,
      givenRoomTypeId,
      contractRef,
      creditLimitAzn,
    ],
  );

  function onLeftChange(patch: Partial<Record<string, string>>) {
    const m: Record<string, (v: string) => void> = {
      checkIn: setCheckIn,
      checkOut: setCheckOut,
      checkInTime: setCheckInTime,
      checkOutTime: setCheckOutTime,
      voucherNo: setVoucherNo,
      agencyId: setAgencyId,
      sourceId: setSourceId,
      roomTypeId: setRoomTypeId,
      roomId: setPendingRoomId,
      roomCount: setRoomCount,
      rateType: setRateType,
      mealPlanId: setMealPlanId,
      ratePlanId: setRatePlanId,
      paymentMethod: setPaymentMethod,
      adults: setAdults,
      children11_6: setChildren11_6,
      children5_2: setChildren5_2,
      children1_0: setChildren1_0,
      market: setMarket,
      segment: setSegment,
      resNo: setResNo,
      shareNo: setShareNo,
      optionDate: setOptionDate,
      optionState: setOptionState,
      salesProject: setSalesProject,
      specialStates: setSpecialStates,
      resGroup: setResGroup,
      colorCode: setColorCode,
      preferredLocation: setPreferredLocation,
      preferredBed: setPreferredBed,
      givenRoomTypeId: setGivenRoomTypeId,
      contractRef: setContractRef,
      creditLimitAzn: setCreditLimitAzn,
    };
    for (const [k, v] of Object.entries(patch)) {
      if (v !== undefined) m[k]?.(v);
    }
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
            sourceId: sourceId || undefined,
            mealPlanId: mealPlanId || undefined,
            checkInDate: mergeDateTime(checkIn, checkInTime),
            checkOutDate: mergeDateTime(checkOut, checkOutTime),
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
      if (creditLimitAzn.trim() !== '') {
        const limit = Number(creditLimitAzn);
        if (Number.isNaN(limit) || limit < 0) {
          showApiError({ error: t('creditLimitInvalid') }, tc('failed'));
          return;
        }
      }
      const res = await fetch(`/api/reservations/${reservationId}/full`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkInDate: mergeDateTime(checkIn, checkInTime),
          checkOutDate: mergeDateTime(checkOut, checkOutTime),
          voucherNo: voucherNo || null,
          adults: Number(adults) || 1,
          agencyId: agencyId || null,
          sourceId: sourceId || null,
          roomTypeId: roomTypeId || undefined,
          roomId: pendingRoomId || null,
          mealPlanId: mealPlanId || null,
          roomCount: Number(roomCount) || 1,
          rateType: rateType || null,
          resNo: resNo || null,
          shareNo: shareNo || null,
          optionDate: optionDate ? new Date(optionDate).toISOString() : null,
          optionState: optionState || null,
          salesProject: salesProject || null,
          specialStates: specialStates || null,
          resGroup: resGroup || null,
          colorCode: colorCode || null,
          preferredLocation: preferredLocation || null,
          preferredBed: preferredBed || null,
          givenRoomTypeId: givenRoomTypeId || null,
          contractRef: contractRef || null,
          creditLimitAzn:
            creditLimitAzn.trim() === '' ? null : Math.round(Number(creditLimitAzn) * 100) / 100,
          useManualRate,
          manualDailyRate: manualDailyRate ? Number(manualDailyRate) : null,
          discountActive,
          children11_6: Number(children11_6) || 0,
          children5_2: Number(children5_2) || 0,
          children1_0: Number(children1_0) || 0,
          market: market || null,
          segment: segment || null,
          booker: booker || null,
          guestRep: guestRep || null,
          paidBy: paidBy || null,
          vipType: vipType || null,
          accomType: accomType || null,
          recordType: recordType || null,
          tripReason: tripReason || null,
          notes,
          dailyRates: dailyRates.map((d) => ({
            stayDate: d.stayDate,
            amount: d.amount,
            manualFlag: d.manualFlag,
            currencyCode: d.currencyCode ?? 'AZN',
            fixPrice: d.fixPrice ?? false,
            discountPct: d.discountPct ?? null,
          })),
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
            memberNo: p.memberNo || null,
            payStatus: p.payStatus || null,
            externalResId: p.externalResId || null,
            guestState: p.guestState || null,
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
      applyJson(json);
    } finally {
      setBusy(false);
    }
  }

  const guest = data?.guest as { fullName?: string } | undefined;
  const status = data?.status as string | undefined;
  const canCheckIn = status === 'CONFIRMED' && Boolean(pendingRoomId || roomId);

  const folios = (data?.folios as Array<{
    type: string;
    charges: Array<{
      id: string;
      amount: number;
      description?: string;
      businessDate?: string;
      paxNo?: number | null;
      invoiceRef?: string | null;
      revenueCode?: { code: string };
    }>;
    payments?: Array<{ amount: number }>;
  }>) ?? [];

  const guestFolioBalance = computeGuestFolioBalance(folios);

  const fiscalInvoices = (data?.fiscalDocuments as Array<{ invoiceNumber?: string | null }>) ?? [];

  const folioLines = folios.flatMap((f) =>
    f.charges.map((c) => ({
      folioType: f.type,
      stayDate: c.businessDate?.slice?.(0, 10),
      invoiceRef: c.invoiceRef ?? fiscalInvoices[0]?.invoiceNumber ?? null,
      ...c,
    })),
  );

  async function uploadAttachment(file: File) {
    if (!reservationId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/reservations/${reservationId}/attachments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type || undefined,
          fileSize: file.size,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        showApiError(json, tc('failed'));
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  const noteCount = Object.values(notes).filter((v) => v.trim()).length;

  function onBottomTab(id: BottomTab) {
    setBottomTab(id);
    if (id === 'details') setTab('guests');
    if (id === 'notes') setTab('notes');
    if (id === 'folio') setTab('folio');
  }

  const inner = (
    <>
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
        canCheckIn={!isCreate && canCheckIn}
        onClose={onClose}
        onToggleLock={() => void toggleLock()}
        onSave={() => void save()}
        onConfirmCheckIn={() => void confirmCheckIn()}
        onHistory={
          reservationId
            ? () => window.open(`/reports/reservations`, '_blank', 'noopener')
            : undefined
        }
        attachOpen={attachOpen}
        onAttachToggle={!isCreate && reservationId ? () => setAttachOpen((o) => !o) : undefined}
        onRecalc={!isCreate ? () => void recalcPricing() : undefined}
        onChargeAll={!isCreate ? () => void chargeAll() : undefined}
      />

      {attachOpen && !isCreate && reservationId ? (
        <ReservationCardAttachPanel
          attachments={attachments}
          busy={busy}
          onUpload={(f) => void uploadAttachment(f)}
          onRefresh={() => void load()}
        />
      ) : null}

      {loading && !isCreate ? (
        <p className="py-8 text-center text-[13px] text-[#7F8C8D]">{tc('loading')}</p>
      ) : (
        <div className="grid min-h-0 flex-1 gap-4 overflow-hidden lg:grid-cols-[minmax(260px,30%)_1fr]">
          <ReservationCardLeftPanel
            isCreate={isCreate}
            isLocked={isLocked}
            agencies={agencies}
            sources={sources}
            roomTypes={roomTypes}
            mealPlans={mealPlans}
            ratePlans={ratePlans}
            rooms={rooms}
            onChange={onLeftChange}
            onAssignRoom={!isCreate ? () => void assignRoom() : undefined}
            assignBusy={busy}
            onFocusRoomSelect={() =>
              document.getElementById('res-card-room-select')?.focus()
            }
            onToggleLock={!isCreate ? () => void toggleLock() : undefined}
            roomStatus={roomStatus}
            reservationId={reservationId}
            folioBalance={guestFolioBalance}
            {...leftPatch}
          />

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
                <ReservationCardGuestsTab
                  isCreate={isCreate}
                  guestId={guestId}
                  guestOptions={guestOptions}
                  pax={pax}
                  booker={booker}
                  guestRep={guestRep}
                  paidBy={paidBy}
                  vipType={vipType}
                  accomType={accomType}
                  recordType={recordType}
                  tripReason={tripReason}
                  onGuestId={setGuestId}
                  onPax={setPax}
                  onField={(key, value) => {
                    const setters: Record<string, (v: string) => void> = {
                      booker: setBooker,
                      guestRep: setGuestRep,
                      paidBy: setPaidBy,
                      vipType: setVipType,
                      accomType: setAccomType,
                      recordType: setRecordType,
                      tripReason: setTripReason,
                    };
                    setters[key]?.(value);
                  }}
                  onNewGuest={() => setGuestCardOpen(true)}
                  onRepeatGuest={() => {
                    if (pax.length > 0) {
                      const src = pax[0];
                      setPax([
                        ...pax,
                        { ...src, id: undefined, isPrimary: false },
                      ]);
                    }
                  }}
                />
              )}

              {tab === 'pricing' && (
                <ReservationCardPricingTab
                  isCreate={isCreate}
                  quoteText={quoteText}
                  totalAmount={Number(data?.totalAmount ?? 0)}
                  dailyRates={dailyRates}
                  useManualRate={useManualRate}
                  manualDailyRate={manualDailyRate}
                  discountActive={discountActive}
                  busy={busy}
                  isLocked={isLocked}
                  onDailyRates={setDailyRates}
                  onToggle={(key, value) => {
                    if (key === 'useManualRate') setUseManualRate(value);
                    else setDiscountActive(value);
                  }}
                  onManualRate={setManualDailyRate}
                  onRecalc={() => void recalcPricing()}
                  onChargeAll={() => void chargeAll()}
                />
              )}

              {tab === 'folio' &&
                (isCreate ? (
                  <p className="text-[13px] text-[#7F8C8D]">{tb('folioTabHint')}</p>
                ) : (
                  <ReservationCardFolioTab
                    reservationId={reservationId!}
                    folioTab={folioTab}
                    lines={folioLines}
                    onFolioTab={setFolioTab}
                  />
                ))}

              {tab === 'notes' &&
                (isCreate ? (
                  <p className="text-[13px] text-[#7F8C8D]">{tb('notesTabHint')}</p>
                ) : (
                  <ReservationCardNotesTab notes={notes} onNotes={setNotes} />
                ))}
            </div>

            <ReservationCardBottomBar
              noteCount={noteCount}
              taskCount={taskCount}
              activeBottom={bottomTab}
              onTab={onBottomTab}
              stubsEnabled={!isCreate && Boolean(reservationId)}
              onCreditCard={() => openSubModal('creditCard')}
              onPackages={() => openSubModal('packages')}
              onTasks={() => openSubModal('tasks')}
              onFolioRouting={() => openSubModal('folioRouting')}
            />
          </div>
        </div>
      )}

      <ReservationCardSubModals {...subModalProps} />

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

  if (layout === 'page') {
    if (!open) return null;
    return (
      <div className="flex max-h-[calc(100vh-6rem)] min-h-[480px] flex-col overflow-hidden">
        {inner}
      </div>
    );
  }

  return (
    <EraModal
      open={open}
      title={tb('reservationCardTitle')}
      onClose={onClose}
      maxWidthClass="max-w-[min(96vw,1400px)] w-full max-h-[92vh] overflow-hidden flex flex-col"
      footer={null}
    >
      {inner}
    </EraModal>
  );
}
