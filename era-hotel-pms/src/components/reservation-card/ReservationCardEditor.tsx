'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  MODAL_FULL_CLASS,
  TAB_ITEM_ACTIVE_CLASS,
  TAB_ITEM_CLASS,
  TAB_STRIP_CLASS,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';
import { EraModal } from '@/components/EraModal';
import GuestCardModal from '@/components/GuestCardModal';
import {
  ReservationCardActions,
  ReservationCardBottomBar,
  ReservationCardToolbar,
} from '@/components/ReservationCardToolbar';
import { ReservationCardLeftPanel } from '@/components/reservation-card/ReservationCardLeftPanel';
import { ReservationCardGuestsTab } from '@/components/reservation-card/ReservationCardGuestsTab';
import { ReservationCardPricingTab } from '@/components/reservation-card/ReservationCardPricingTab';
import { ReservationCardFolioTab } from '@/components/reservation-card/ReservationCardFolioTab';
import { ReservationCardNotesTab } from '@/components/reservation-card/ReservationCardNotesTab';
import { ReservationCardAttachPanel } from '@/components/reservation-card/ReservationCardAttachPanel';
import {
  ReservationCardStaysBar,
  type BookingStaySummary,
} from '@/components/reservation-card/ReservationCardStaysBar';
import type { AttachmentRow } from '@/components/reservation-card/types';
import {
  attachGuestToPax,
  hydratePaxNames,
  partySizeFromCounts,
  syncCountsFromPaxLength,
  syncPaxToPartySize,
} from '@/components/reservation-card/party-pax';
import {
  ReservationCardSubModals,
  useReservationSubModals,
} from '@/components/reservation-card/ReservationCardSubModals';
import { reservationNamesIncomplete } from '@/lib/reservation-names';
import { canAssignDoor } from '@/lib/room-state';
import type {
  AgencyOption,
  DailyRateRow,
  FolioSubTab,
  PartyBillingMode,
  PaxRow,
  RatePlanOption,
  SelectOption,
  SourceOption,
  TabId,
} from '@/components/reservation-card/types';
import { computeGuestFolioBalance } from '@/components/reservation-card/folio-balance';
import { isOtaAgency } from '@/lib/booking-source-kind';

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

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
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
  const [shareEligible, setShareEligible] = useState(false);
  const [guestGender, setGuestGender] = useState('');
  const [shareNeighborHint, setShareNeighborHint] = useState('');
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
  const [salesContractId, setSalesContractId] = useState('');
  const [salesContracts, setSalesContracts] = useState<
    Array<{ id: string; label: string; agencyId: string | null; ratePlanId: string; code: string }>
  >([]);
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
  const [agencies, setAgencies] = useState<AgencyOption[]>([]);
  const [sources, setSources] = useState<SourceOption[]>([]);
  const [partyBillingMode, setPartyBillingMode] = useState<PartyBillingMode>('PRIMARY');
  const [roomTypes, setRoomTypes] = useState<SelectOption[]>([]);
  const [mealPlans, setMealPlans] = useState<SelectOption[]>([]);
  const [rooms, setRooms] = useState<
    Array<{
      id: string;
      roomNumber: string;
      roomTypeId?: string;
      status?: string;
      hkCondition?: string;
      inventoryStatus?: string;
      reservations?: Array<{
        id: string;
        checkInDate: string;
        checkOutDate: string;
        status: string;
      }>;
    }>
  >([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [pax, setPax] = useState<PaxRow[]>([]);
  const [ratePlanId, setRatePlanId] = useState('');
  const [ratePlans, setRatePlans] = useState<RatePlanOption[]>([]);
  const [guestId, setGuestId] = useState('');
  const [guestOptions, setGuestOptions] = useState<SelectOption[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('CARD');
  const [creditLimitAzn, setCreditLimitAzn] = useState('');
  const [quoteText, setQuoteText] = useState<string | null>(null);
  const [sellable, setSellable] = useState<{
    available: number;
    booked: number;
    quota: number;
    stopSell: boolean;
  } | null>(null);
  const [guestCardOpen, setGuestCardOpen] = useState(false);
  const [pendingRoomId, setPendingRoomId] = useState('');
  const [taskCount, setTaskCount] = useState(0);
  const [bookingGroupId, setBookingGroupId] = useState<string | null>(null);
  const [bookingCode, setBookingCode] = useState<string | null>(null);
  const [bookingName, setBookingName] = useState<string | null>(null);
  const [bookingFolioMode, setBookingFolioMode] = useState<string | null>(null);
  const [siblingStays, setSiblingStays] = useState<BookingStaySummary[]>([]);
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
    setPartyBillingMode(
      json.partyBillingMode === 'EQUAL' ? 'EQUAL' : 'PRIMARY',
    );
    setRoomTypeId(String(json.roomTypeId ?? ''));
    setRoomId(String(json.roomId ?? ''));
    setPendingRoomId(String(json.roomId ?? ''));
    setGuestId(String(json.guestId ?? ''));
    setRoomCount(String(json.roomCount ?? 1));
    setRateType(String(json.rateType ?? ''));
    setResNo(String(json.resNo ?? ''));
    setShareNo(String(json.shareNo ?? ''));
    setShareEligible(Boolean(json.shareEligible));
    const guestObj = json.guest as { gender?: string | null } | undefined;
    setGuestGender(String(json.shareGender ?? guestObj?.gender ?? ''));
    const neighbors = json.shareNeighbors as
      | Array<{ guestName: string; checkInDate: string; checkOutDate: string }>
      | undefined;
    if (neighbors && neighbors.length > 0) {
      const n = neighbors[0]!;
      setShareNeighborHint(
        `${n.guestName} (${String(n.checkInDate).slice(0, 10)} – ${String(n.checkOutDate).slice(0, 10)})`,
      );
    } else {
      setShareNeighborHint('');
    }
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
    setSalesContractId(String(json.salesContractId ?? ''));
    setAttachments((json.attachments as AttachmentRow[]) ?? []);
    const gid = (json.groupId as string | null | undefined) ?? null;
    setBookingGroupId(gid);
    const grp = json.group as
      | { code?: string; folioMode?: string; name?: string | null }
      | null
      | undefined;
    setBookingCode(grp?.code ?? null);
    setBookingName(grp?.name ?? null);
    setBookingFolioMode(grp?.folioMode ?? null);
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
    const masterGuest = json.guest as { id?: string; fullName?: string } | undefined;
    const guests = (json.paxGuests as PaxRow[] | undefined) ?? [];
    const equalMode = (json.partyBillingMode as PartyBillingMode | undefined) === 'EQUAL';
    const adultN = Number(json.adults ?? 1) || 0;
    const c11 = Number(json.children11_6 ?? 0) || 0;
    const c5 = Number(json.children5_2 ?? 0) || 0;
    const c1 = Number(json.children1_0 ?? 0) || 0;
    const targetSize = Math.max(1, partySizeFromCounts({
      adults: adultN || 1,
      children11_6: c11,
      children5_2: c5,
      children1_0: c1,
    }));

    let nextPax: PaxRow[];
    if (guests.length === 0 && masterGuest) {
      const parts = (masterGuest.fullName ?? '').split(/\s+/).filter(Boolean);
      nextPax = [
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
          ownsFolio: true,
          guestId: String(json.guestId ?? masterGuest.id ?? ''),
        },
      ];
    } else {
      nextPax = guests.map((g) => ({
        id: g.id,
        guestId: g.guestId ?? undefined,
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
        ownsFolio: g.ownsFolio ?? Boolean(g.isPrimary),
      }));
      nextPax = hydratePaxNames(nextPax, {
        id: masterGuest?.id ?? String(json.guestId ?? ''),
        fullName: masterGuest?.fullName,
      });
    }
    const sized = syncPaxToPartySize(nextPax, targetSize, equalMode);
    setPax(sized);
    if (sized.length !== targetSize) {
      const bumped = syncCountsFromPaxLength(sized.length, {
        adults: adultN || 1,
        children11_6: c11,
        children5_2: c5,
        children1_0: c1,
      });
      setAdults(String(bumped.adults));
      setChildren11_6(String(bumped.children11_6));
      setChildren5_2(String(bumped.children5_2));
      setChildren1_0(String(bumped.children1_0));
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
    if (!open || !bookingGroupId) {
      setSiblingStays([]);
      return;
    }
    let cancelled = false;
    void fetch(`/api/reservation-groups/${bookingGroupId}`)
      .then((r) => r.json())
      .then((g) => {
        if (cancelled) return;
        const list = (g.reservations ?? g.data?.reservations ?? []) as BookingStaySummary[];
        setSiblingStays(Array.isArray(list) ? list : []);
        if (g.code || g.data?.code) setBookingCode(g.code ?? g.data?.code);
        setBookingName(g.name ?? g.data?.name ?? null);
        if (g.folioMode || g.data?.folioMode) {
          setBookingFolioMode(g.folioMode ?? g.data?.folioMode);
        }
      })
      .catch(() => {
        if (!cancelled) setSiblingStays([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, bookingGroupId]);

  async function saveBookingName(nextName: string) {
    if (!bookingGroupId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/reservation-groups/${bookingGroupId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nextName || null }),
      });
      const json = await res.json();
      if (!res.ok) {
        showApiError(json, tc('failed'));
        return;
      }
      setBookingName((json.name as string | null | undefined) ?? (nextName || null));
      showSuccess(tc('saved'));
    } finally {
      setBusy(false);
    }
  }

  async function addSiblingStay() {
    if (!reservationId || isCreate) {
      showApiError({ error: tb('availableAfterSave') }, tc('failed'));
      return;
    }
    setBusy(true);
    try {
      // Ensures Booking group when stay is still standalone, then clones a sibling RoomStay.
      const res = await fetch(`/api/reservations/${reservationId}/add-room`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) {
        showApiError(json, tc('failed'));
        return;
      }
      showSuccess(tb('addStay'));
      await load();
      if (json.id) onReservationCreated?.(json.id);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    if (isCreate) {
      setLoading(false);
      setData(null);
      setTab('guests');
      setQuoteText(null);
      setSellable(null);
      // Reset commercial fields; keep FO ops defaults (14:00 / 12:00, adults=1, CARD)
      setCheckIn('');
      setCheckOut('');
      setCheckInTime('14:00');
      setCheckOutTime('12:00');
      setVoucherNo('');
      setAdults('1');
      setChildren11_6('0');
      setChildren5_2('0');
      setChildren1_0('0');
      setMarket('');
      setSegment('');
      setBooker('');
      setGuestRep('');
      setPaidBy('');
      setVipType('');
      setAccomType('');
      setRecordType('');
      setTripReason('');
      setAgencyId('');
      setSourceId('');
      setRoomTypeId('');
      setRoomId('');
      setPendingRoomId('');
      setRoomCount('1');
      setRateType('');
      setResNo('');
      setShareNo('');
      setOptionDate('');
      setOptionState('');
      setSalesProject('');
      setSpecialStates('');
      setResGroup('');
      setColorCode('');
      setPreferredLocation('');
      setPreferredBed('');
      setGivenRoomTypeId('');
      setContractRef('');
      setSalesContractId('');
      setMealPlanId('');
      setRatePlanId('');
      setGuestId('');
      setPax([]);
      setPaymentMethod('CARD');
      setCreditLimitAzn('');
      setNotes({});
      setDailyRates([]);
      setAttachments([]);
      setBookingGroupId(null);
      setBookingCode(null);
      setBookingName(null);
      setBookingFolioMode(null);
      setSiblingStays([]);
      setIsLocked(false);
      setPartyBillingMode('PRIMARY');
    } else {
      void load();
    }
  }, [open, isCreate, reservationId, load]);

  useEffect(() => {
    if (!open) return;
    void Promise.all([
      fetch('/api/agencies').then((r) => r.json()),
      fetch('/api/master/booking-sources').then((r) => r.json()),
      fetch('/api/master/room-types').then((r) => r.json()),
      fetch('/api/master/meal-plans').then((r) => r.json()),
      fetch('/api/master/rate-plans').then((r) => r.json()),
      fetch('/api/guests').then((r) => r.json()),
      fetch('/api/rooms').then((r) => r.json()),
      fetch('/api/admin/contracts?status=ACTIVE')
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
    ]).then(([ag, src, rt, mp, rp, g, rm, contracts]) => {
      if (Array.isArray(ag)) {
        setAgencies(
          ag.map((x: { id: string; code: string; name: string }) => ({
            id: x.id,
            code: x.code,
            label: `${x.code} — ${x.name}`,
            isOta: isOtaAgency(x.code, x.name),
          })),
        );
      }
      if (Array.isArray(src)) {
        setSources(
          src.map((x: { id: string; code: string; name?: string }) => ({
            id: x.id,
            code: x.code,
            label: x.name ? `${x.code} — ${x.name}` : x.code,
          })),
        );
      }
      if (Array.isArray(rp)) {
        // Nafta: medical packages (PKG-*) first, then BAR walk-in rates
        const mapped: RatePlanOption[] = rp
          .filter((x: { active?: boolean }) => x.active !== false)
          .map(
            (x: {
              id: string;
              code: string;
              name?: string;
              type?: string;
              medicalFlag?: boolean;
              mealPlanId?: string | null;
              roomTypeId?: string | null;
            }) => ({
              id: x.id,
              code: x.code,
              type: x.type,
              medicalFlag: !!x.medicalFlag,
              mealPlanId: x.mealPlanId ?? null,
              roomTypeId: x.roomTypeId ?? null,
              label: `${x.name ? `${x.code} — ${x.name}` : x.code}${
                x.medicalFlag ? tc('medicalSuffix') : ''
              }`,
            }),
          );
        mapped.sort((a, b) => {
          if (!!a.medicalFlag !== !!b.medicalFlag) return a.medicalFlag ? -1 : 1;
          return (a.code ?? a.label).localeCompare(b.code ?? b.label);
        });
        setRatePlans(mapped);
      }
      if (Array.isArray(rt)) {
        setRoomTypes(
          rt
            .filter((x: { active?: boolean }) => x.active !== false)
            .map((x: { id: string; code: string; name?: string; adultCapacity?: number }) => ({
              id: x.id,
              label: x.name ? `${x.code} — ${x.name}` : x.code,
              adultCapacity: x.adultCapacity,
            })),
        );
      }
      if (Array.isArray(mp)) {
        setMealPlans(
          mp.map((x: { id: string; code: string; name?: string }) => ({
            id: x.id,
            label: x.name ? `${x.code} — ${x.name}` : x.code,
          })),
        );
      }
      if (Array.isArray(g)) {
        setGuestOptions(g.map((x: { id: string; fullName: string }) => ({ id: x.id, label: x.fullName })));
      }
      if (Array.isArray(rm)) {
        setRooms(
          rm.map(
            (x: {
              id: string;
              roomNumber: string;
              roomTypeId?: string;
              status?: string;
              reservations?: Array<{
                id: string;
                checkInDate: string;
                checkOutDate: string;
                status: string;
              }>;
            }) => ({
              id: x.id,
              roomNumber: x.roomNumber,
              roomTypeId: x.roomTypeId,
              status: x.status,
              reservations: Array.isArray(x.reservations) ? x.reservations : [],
            }),
          ),
        );
      }
      if (Array.isArray(contracts)) {
        setSalesContracts(
          contracts.map(
            (x: {
              id: string;
              code: string;
              name: string;
              agencyId: string | null;
              ratePlanId: string;
            }) => ({
              id: x.id,
              code: x.code,
              agencyId: x.agencyId,
              ratePlanId: x.ratePlanId,
              label: `${x.code} — ${x.name}`,
            }),
          ),
        );
      }
    });
  }, [open, tc]);

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

  useEffect(() => {
    if (!isCreate || !roomTypeId || !checkIn || !checkOut) {
      setSellable(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/fo/sellable?roomTypeId=${roomTypeId}&from=${checkIn}&to=${checkOut}`)
      .then((r) => r.json())
      .then((s) => {
        if (cancelled || s.error) {
          if (!cancelled) setSellable(null);
          return;
        }
        setSellable({
          available: Number(s.available ?? 0),
          booked: Number(s.booked ?? 0),
          quota: Number(s.quota ?? 0),
          stopSell: Boolean(s.stopSell),
        });
      })
      .catch(() => {
        if (!cancelled) setSellable(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isCreate, roomTypeId, checkIn, checkOut]);

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
    if (namesIncomplete) {
      showApiError({ error: tb('namesIncomplete') }, tc('failed'));
      return;
    }
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
    if (namesIncomplete) {
      showApiError({ error: tb('namesIncomplete') }, tc('failed'));
      return;
    }
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

  async function breakShare() {
    if (!reservationId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/reservations/${reservationId}/full`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareEligible: false }),
      });
      const json = await res.json();
      if (!res.ok) {
        showApiError(json, tc('failed'));
        return;
      }
      showSuccess(t('breakShareDone'));
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
      shareEligible,
      guestGender,
      shareNeighborHint,
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
      salesContractId,
      creditLimitAzn,
      booker,
      guestRep,
      paidBy,
      vipType,
      accomType,
      recordType,
      tripReason,
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
      shareEligible,
      guestGender,
      shareNeighborHint,
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
      salesContractId,
      creditLimitAzn,
      booker,
      guestRep,
      paidBy,
      vipType,
      accomType,
      recordType,
      tripReason,
    ],
  );

  function onLeftChange(patch: Partial<Record<string, string>>) {
    if (patch.checkIn !== undefined) {
      const ci = patch.checkIn;
      const co = patch.checkOut !== undefined ? patch.checkOut : checkOut;
      if (ci && (!co || co <= ci)) {
        patch = { ...patch, checkOut: addDaysIso(ci, 1) };
      }
    } else if (patch.checkOut !== undefined) {
      const co = patch.checkOut;
      if (checkIn && co && co <= checkIn) {
        patch = { ...patch, checkOut: addDaysIso(checkIn, 1) };
      }
    }
    if (patch.sourceId !== undefined && patch.sourceId !== sourceId) {
      setAgencyId('');
      setSalesContractId('');
      setContractRef('');
      setShareEligible(false);
    }
    if (patch.agencyId !== undefined && patch.agencyId !== agencyId) {
      const agency = agencies.find((a) => a.id === patch.agencyId);
      const genderOk = guestGender === 'M' || guestGender === 'F';
      if (isCreate && agency && !agency.isOta && Number(adults) <= 1 && genderOk) {
        setShareEligible(true);
      }
      if (agency?.isOta) {
        setShareEligible(false);
      }
    }
    if (patch.salesContractId !== undefined) {
      const cid = patch.salesContractId;
      setSalesContractId(cid);
      if (cid) {
        const contract = salesContracts.find((c) => c.id === cid);
        if (contract) {
          setRatePlanId(contract.ratePlanId);
          if (contract.agencyId) setAgencyId(contract.agencyId);
          setContractRef(contract.code);
          const linkedRp = ratePlans.find((r) => r.id === contract.ratePlanId);
          if (linkedRp?.mealPlanId) setMealPlanId(linkedRp.mealPlanId);
          if (linkedRp?.roomTypeId) setRoomTypeId(linkedRp.roomTypeId);
          if (linkedRp?.medicalFlag) setSegment('Medical');
        }
      } else {
        setContractRef('');
      }
      const rest = { ...patch };
      delete rest.salesContractId;
      if (Object.keys(rest).length === 0) return;
      patch = rest;
    }
    if (patch.ratePlanId !== undefined) {
      const rp = ratePlans.find((r) => r.id === patch.ratePlanId);
      // Package / BAR → meal from plan; scoped package may set room type; medical → segment
      if (rp?.mealPlanId) setMealPlanId(rp.mealPlanId);
      else if (!patch.ratePlanId) setMealPlanId('');
      if (rp?.roomTypeId) setRoomTypeId(rp.roomTypeId);
      if (rp?.medicalFlag) setSegment('Medical');
    }
    if (patch.roomTypeId !== undefined) {
      const nextType = patch.roomTypeId;
      const current = ratePlans.find((r) => r.id === ratePlanId);
      // Clear type-scoped package when room type no longer matches
      if (
        current?.roomTypeId &&
        current.type !== 'BASE' &&
        nextType &&
        current.roomTypeId !== nextType
      ) {
        setRatePlanId('');
        setMealPlanId('');
      }
    }

    const paxCountKeys = ['adults', 'children11_6', 'children5_2', 'children1_0'] as const;
    const countsTouched = paxCountKeys.some((k) => patch[k] !== undefined);
    let nextAdults = Number(adults) || 0;
    let nextC11 = Number(children11_6) || 0;
    let nextC5 = Number(children5_2) || 0;
    let nextC1 = Number(children1_0) || 0;
    if (countsTouched) {
      nextAdults =
        patch.adults !== undefined ? Number(patch.adults) || 0 : nextAdults;
      nextC11 =
        patch.children11_6 !== undefined ? Number(patch.children11_6) || 0 : nextC11;
      nextC5 =
        patch.children5_2 !== undefined ? Number(patch.children5_2) || 0 : nextC5;
      nextC1 =
        patch.children1_0 !== undefined ? Number(patch.children1_0) || 0 : nextC1;
      if (nextAdults !== 1) {
        setShareEligible(false);
      }
    }

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
      shareEligible: (v) => setShareEligible(v === 'true'),
      guestGender: setGuestGender,
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
      salesContractId: setSalesContractId,
      creditLimitAzn: setCreditLimitAzn,
      booker: setBooker,
      guestRep: setGuestRep,
      paidBy: setPaidBy,
      vipType: setVipType,
      accomType: setAccomType,
      recordType: setRecordType,
      tripReason: setTripReason,
    };
    for (const [k, v] of Object.entries(patch)) {
      if (v !== undefined) m[k]?.(v);
    }

    if (countsTouched) {
      const target = partySizeFromCounts({
        adults: nextAdults,
        children11_6: nextC11,
        children5_2: nextC5,
        children1_0: nextC1,
      });
      setPax((prev) => {
        const sized = syncPaxToPartySize(prev, target, partyBillingMode === 'EQUAL');
        if (sized.length !== target) {
          const bumped = syncCountsFromPaxLength(sized.length, {
            adults: nextAdults,
            children11_6: nextC11,
            children5_2: nextC5,
            children1_0: nextC1,
          });
          setAdults(String(bumped.adults));
          setChildren11_6(String(bumped.children11_6));
          setChildren5_2(String(bumped.children5_2));
          setChildren1_0(String(bumped.children1_0));
        }
        return sized;
      });
    }
  }

  /** Party list → adults/children counts (bidirectional with onLeftChange pax sync). */
  function applyPaxChange(rows: PaxRow[]) {
    setPax(rows);
    const next = syncCountsFromPaxLength(rows.length, {
      adults: Number(adults) || 0,
      children11_6: Number(children11_6) || 0,
      children5_2: Number(children5_2) || 0,
      children1_0: Number(children1_0) || 0,
    });
    setAdults(String(next.adults));
    setChildren11_6(String(next.children11_6));
    setChildren5_2(String(next.children5_2));
    setChildren1_0(String(next.children1_0));
  }

  async function save() {
    setBusy(true);
    try {
      const namesBlocked =
        !isCreate &&
        reservationNamesIncomplete({
          guestFullName: (data?.guest as { fullName?: string } | undefined)?.fullName,
          adults: Number(adults) || 1,
          pax,
        });
      if (
        namesBlocked &&
        pendingRoomId &&
        pendingRoomId !== roomId
      ) {
        showApiError({ error: tb('namesIncomplete') }, tc('failed'));
        return;
      }
      if (isCreate) {
        if (!roomTypeId || !ratePlanId || !guestId || !checkIn || !checkOut) {
          showApiError({ error: tc('failed') }, tc('failed'));
          return;
        }
        if (sellable && sellable.available < 1) {
          showApiError({ error: t('noSellableInventory') }, tc('failed'));
          return;
        }
        const selectedType = roomTypes.find((r) => r.id === roomTypeId);
        const capacity = selectedType?.adultCapacity ?? 2;
        const adultCount = Math.max(1, Number(adults) || 1);
        if (adultCount > capacity) {
          showApiError(
            {
              error: t('adultsExceedCapacity', {
                adults: adultCount,
                capacity,
              }),
            },
            tc('failed'),
          );
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
            salesContractId: salesContractId || undefined,
            mealPlanId: mealPlanId || undefined,
            partyBillingMode,
            checkInDate: mergeDateTime(checkIn, checkInTime),
            checkOutDate: mergeDateTime(checkOut, checkOutTime),
            paymentMethod,
            adults: Number(adults) || 1,
            shareEligible: shareEligible && Number(adults) === 1,
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          const err = String(json.error ?? '');
          if (/no availability/i.test(err)) {
            showApiError({ error: t('noSellableInventory') }, tc('failed'));
          } else {
            showApiError(json, tc('failed'));
          }
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
      if (shareEligible && !guestGender) {
        showApiError({ error: t('shareGenderRequired') }, tc('failed'));
        return;
      }
      if (guestId && guestGender) {
        await fetch(`/api/guests/${guestId}/full`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gender: guestGender }),
        }).catch(() => undefined);
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
          partyBillingMode,
          roomTypeId: roomTypeId || undefined,
          ...(namesBlocked
            ? {}
            : { roomId: pendingRoomId || null }),
          mealPlanId: mealPlanId || null,
          roomCount: Number(roomCount) || 1,
          rateType: rateType || null,
          resNo: resNo || null,
          shareNo: shareNo || null,
          shareEligible: shareEligible && Number(adults) === 1,
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
          salesContractId: salesContractId || null,
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
            guestId: p.guestId || null,
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
            ownsFolio: p.ownsFolio ?? false,
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
  const namesIncomplete =
    !isCreate &&
    reservationNamesIncomplete({
      guestFullName: guest?.fullName,
      adults: Number(adults) || 1,
      pax,
    });
  const canCheckIn =
    status === 'CONFIRMED' && Boolean(pendingRoomId || roomId) && !namesIncomplete;
  /** Physical room / times: arrival stage or room already assigned (not on create booking). */
  const showAssignment =
    !isCreate &&
    (Boolean(pendingRoomId || roomId) ||
      status === 'CONFIRMED' ||
      status === 'IN_HOUSE' ||
      status === 'CHECKED_OUT');

  const assignableRooms = useMemo(() => {
    const typeId = roomTypeId;
    if (!typeId) return [];
    const ci = checkIn;
    const co = checkOut;
    const currentAssigned = roomId;
    const list = rooms.filter((r) => {
      if (r.roomTypeId && r.roomTypeId !== typeId) return false;
      if (
        r.status &&
        !canAssignDoor(
          {
            status: r.status as 'AVAILABLE' | 'CLEAN' | 'INSPECTED' | 'DIRTY' | 'OCCUPIED' | 'OOO' | 'OOS' | 'MAINTENANCE',
            hkCondition: r.hkCondition as 'DIRTY' | 'PICKUP' | 'CLEAN' | 'INSPECTED' | undefined,
            inventoryStatus: r.inventoryStatus as 'IN_SERVICE' | 'OOS' | 'OOO' | undefined,
          },
          false,
        )
      ) {
        if (r.id !== currentAssigned) return false;
      }
      if (!ci || !co) return true;
      const conflict = (r.reservations ?? []).some((res) => {
        if (reservationId && res.id === reservationId) return false;
        if (!['CONFIRMED', 'IN_HOUSE', 'OPTION'].includes(res.status)) return false;
        const a = res.checkInDate.slice(0, 10);
        const b = res.checkOutDate.slice(0, 10);
        return a < co && b > ci;
      });
      return !conflict;
    });
    const selectedId = pendingRoomId || roomId;
    if (selectedId && !list.some((r) => r.id === selectedId)) {
      const selected = rooms.find((r) => r.id === selectedId);
      if (selected) return [selected, ...list];
    }
    return list;
  }, [rooms, roomTypeId, checkIn, checkOut, reservationId, pendingRoomId, roomId]);

  /** Badge follows the door in the dropdown, not only the already-assigned room. */
  const selectedRoomStatus = useMemo(() => {
    const id = pendingRoomId || roomId;
    if (!id) return roomStatus;
    return rooms.find((r) => r.id === id)?.status ?? roomStatus;
  }, [pendingRoomId, roomId, rooms, roomStatus]);

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

  const pricingDisplayCurrency =
    dailyRates.map((d) => (d.currencyCode ?? 'AZN').trim().toUpperCase()).find((c) => c !== 'AZN') ??
    dailyRates[0]?.currencyCode?.trim().toUpperCase() ??
    'AZN';

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

  const cardSubtitle = isCreate
    ? t('newReservation')
    : `${guest?.fullName ?? ''}${namesIncomplete ? ` · ${tb('namesIncompleteBadge')}` : ''} · ${status ? tRes(status as 'CONFIRMED') : ''} · ${reservationId!.slice(0, 8)}`;

  const actionProps = {
    busy,
    loading,
    isLocked,
    showLock: true,
    canCheckIn: !isCreate && canCheckIn,
    onClose,
    onToggleLock: isCreate ? undefined : () => void toggleLock(),
    onSave: () => void save(),
    onConfirmCheckIn: isCreate ? undefined : () => void confirmCheckIn(),
    onHistory: reservationId
      ? () => window.open(`/reports/reservations`, '_blank', 'noopener')
      : undefined,
    attachOpen,
    onAttachToggle: reservationId ? () => setAttachOpen((o) => !o) : undefined,
    onRecalc: isCreate ? undefined : () => void recalcPricing(),
    onChargeAll: isCreate ? undefined : () => void chargeAll(),
  };

  const body = (
    <>
      {attachOpen && reservationId ? (
        <ReservationCardAttachPanel
          attachments={attachments}
          busy={busy}
          onUpload={(f) => void uploadAttachment(f)}
          onRefresh={() => void load()}
        />
      ) : null}

      {!isCreate ? (
        <ReservationCardStaysBar
          bookingCode={bookingCode}
          bookingName={bookingName}
          folioMode={bookingFolioMode}
          stays={siblingStays}
          activeStayId={reservationId}
          onSelectStay={(id) => onReservationCreated?.(id)}
          onAddStay={() => void addSiblingStay()}
          addDisabled={busy || isLocked}
          onSaveBookingName={bookingGroupId ? (name) => void saveBookingName(name) : undefined}
          nameDisabled={busy || isLocked}
        />
      ) : null}

      {namesIncomplete ? (
        <div className="mb-3 shrink-0 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-950">
          {tb('namesIncomplete')}
        </div>
      ) : null}

      {loading && !isCreate ? (
        <p className="py-8 text-center text-[13px] text-[#7F8C8D]">{tc('loading')}</p>
      ) : (
        <div className="grid min-h-0 flex-1 gap-4 overflow-hidden lg:grid-cols-[2fr_3fr]">
          <ReservationCardLeftPanel
            isCreate={isCreate}
            isLocked={isLocked}
            showAssignment={showAssignment}
            sellable={isCreate ? sellable : null}
            agencies={agencies}
            sources={sources}
            salesContracts={salesContracts}
            roomTypes={roomTypes}
            mealPlans={mealPlans}
            ratePlans={ratePlans}
            rooms={assignableRooms}
            onChange={onLeftChange}
            onAssignRoom={
              showAssignment && !namesIncomplete ? () => void assignRoom() : undefined
            }
            assignBusy={busy}
            assignTitle={namesIncomplete ? tb('namesIncomplete') : undefined}
            onFocusRoomSelect={() =>
              document.getElementById('res-card-room-select')?.focus()
            }
            onToggleLock={showAssignment ? () => void toggleLock() : undefined}
            roomStatus={selectedRoomStatus}
            reservationId={reservationId}
            folioBalance={guestFolioBalance}
            statusLabel={status ? tRes(status as 'CONFIRMED') : undefined}
            onBreakShare={
              !isCreate && shareEligible
                ? () => void breakShare()
                : undefined
            }
            breakShareBusy={busy}
            {...leftPatch}
          />

          <div className="flex min-h-0 min-w-0 flex-col">
            <div className={TAB_STRIP_CLASS} role="tablist">
              {(['guests', 'pricing', 'folio', 'notes'] as TabId[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  className={tab === id ? TAB_ITEM_ACTIVE_CLASS : TAB_ITEM_CLASS}
                  onClick={() => setTab(id)}
                >
                  {tb(`tab${id.charAt(0).toUpperCase()}${id.slice(1)}` as 'tabGuests')}
                  {id === 'notes' && noteCount > 0 ? ` (${noteCount})` : ''}
                </button>
              ))}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto pb-2">
              {tab === 'guests' && (
                <ReservationCardGuestsTab
                  isCreate={isCreate}
                  guestId={guestId}
                  guestOptions={guestOptions}
                  pax={pax}
                  partyBillingMode={partyBillingMode}
                  onPartyBillingMode={setPartyBillingMode}
                  onGuestId={setGuestId}
                  onPax={applyPaxChange}
                  onNewGuest={() => {
                    setGuestCardOpen(true);
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
                (reservationId ? (
                  <ReservationCardFolioTab
                    reservationId={reservationId}
                    folioTab={folioTab}
                    lines={folioLines}
                    displayCurrency={pricingDisplayCurrency}
                    onFolioTab={setFolioTab}
                  />
                ) : (
                  <p className="text-[13px] text-[#7F8C8D]">{tb('folioTabHint')}</p>
                ))}

              {tab === 'notes' && <ReservationCardNotesTab notes={notes} onNotes={setNotes} />}
            </div>

            <ReservationCardBottomBar
              noteCount={noteCount}
              taskCount={taskCount}
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
        onCreated={(id, meta) => {
          const firstName = meta?.firstName ?? '';
          const lastName = meta?.lastName ?? '';
          const fromFull = meta?.fullName ? meta.fullName.trim().split(/\s+/).filter(Boolean) : [];
          const fn = firstName || fromFull[0] || '';
          const ln = lastName || (fromFull.length > 1 ? fromFull.slice(1).join(' ') : '');
          void loadGuests();
          setGuestCardOpen(false);
          const attached = attachGuestToPax(
            pax,
            { id, firstName: fn, lastName: ln },
            {
              equalMode: partyBillingMode === 'EQUAL',
              reservationGuestId: guestId,
            },
          );
          setGuestId(attached.guestId);
          applyPaxChange(attached.pax);
        }}
      />
    </>
  );

  if (layout === 'page') {
    if (!open) return null;
    return (
      <div className="flex max-h-[calc(100vh-6rem)] min-h-[480px] flex-col overflow-hidden">
        <ReservationCardToolbar subtitle={cardSubtitle} {...actionProps} />
        {body}
      </div>
    );
  }

  return (
    <EraModal
      open={open}
      title={tb('reservationCardTitle')}
      subtitle={cardSubtitle}
      onClose={onClose}
      maxWidthClass={`${MODAL_FULL_CLASS} overflow-hidden flex flex-col`}
      bodyClassName="mt-4 min-h-0 flex-1 overflow-hidden flex flex-col"
      headerActions={<ReservationCardActions {...actionProps} mode="header" />}
      footer={<ReservationCardActions {...actionProps} mode="footer" />}
    >
      {body}
    </EraModal>
  );
}
