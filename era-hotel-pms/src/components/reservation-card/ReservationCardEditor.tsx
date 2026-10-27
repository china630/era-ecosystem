'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  DANGER_BUTTON_CLASS,
  MODAL_FULL_CLASS,
  SECONDARY_BUTTON_CLASS,
  TAB_ITEM_ACTIVE_CLASS,
  TAB_ITEM_CLASS,
  TAB_STRIP_CLASS,
  TEXT_DANGER_CLASS,
  showApiError,
  showSuccess,
  showWarning,
} from '@era/satellite-kit/ui';
import { bakuTimeLabel, todayBakuYmd } from '@era/satellite-kit/time';
import { guestListItems } from '@/lib/guest-list-identity';
import {
  isPreArrivalStatus,
  operationalGapDetails,
  operationalGapLabelKey,
  operationalGaps,
} from '@/lib/guest-stay-requirements';
import { addHotelDays, hotelDateKey } from '@/lib/hotel-calendar';
import { revenueRoleIn, STAY_NIGHT_ROLES } from '@/lib/revenue-code-match';
import { parsePackageNight, parseRoomChargeNote } from '@/lib/folio-charge-note';
import { CatalogField, FieldTextarea } from '@era/satellite-kit/ui';
import { EraModal, EraModalFooter } from '@/components/EraModal';
import { FolioCheckoutModal } from '@/components/folio/FolioCheckoutModal';
import GuestCardModal from '@/components/GuestCardModal';
import {
  ReservationCardActions,
  ReservationCardBottomBar,
  ReservationCardToolbar,
} from '@/components/ReservationCardToolbar';
import { ReservationCardHeaderSnapshot } from '@/components/reservation-card/ReservationCardHeaderSnapshot';
import { ReservationCardLeftPanel } from '@/components/reservation-card/ReservationCardLeftPanel';
import { ReservationCardGuestsTab } from '@/components/reservation-card/ReservationCardGuestsTab';
import { DepartGuestModal } from '@/components/reservation-card/DepartGuestModal';
import { MoveGuestModal } from '@/components/reservation-card/MoveGuestModal';
import { RoomMoveReasonModal } from '@/components/reservation-card/RoomMoveReasonModal';
import { RoomMoveConfirmModal } from '@/components/reservation-card/RoomMoveConfirmModal';
import { doorTypeNeedsSettlement, type ClassSettlement } from '@/lib/room-move-settlement';
import type { RoomMoveReason } from '@/lib/services/room-move-door.service';
import {
  medicalPackageChoices,
  ratePlanRequiresGuestPackage,
  stayProductFamily,
  stayProductFamilyRank,
  stayProductFamilySuffixKey,
} from '@/lib/services/medical-package-resolve.service';
import { ReservationCardPricingTab } from '@/components/reservation-card/ReservationCardPricingTab';
import { StayAmendmentModal } from '@/components/reservation-card/StayAmendmentModal';
import {
  ReservationCardFolioTab,
  type FolioAccount,
} from '@/components/reservation-card/ReservationCardFolioTab';
import { ReservationCardNotesTab } from '@/components/reservation-card/ReservationCardNotesTab';
import { ReservationCardAttachPanel } from '@/components/reservation-card/ReservationCardAttachPanel';
import {
  ReservationCardStaysBar,
  type BookingStaySummary,
} from '@/components/reservation-card/ReservationCardStaysBar';
import { ReservationNoteLine } from '@/components/reservation-card/ReservationNoteLine';
import { buildStayFormHtml, type StayPrintKind } from '@/components/reservation-card/stay-print-html';
import { StayJournal } from '@/components/reservation-card/StayJournal';
import { openPrintDocument } from '@/lib/print-window';
import type { StayJournalEntry } from '@/lib/reservation-journal';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';
import {
  ageYearsFromBirthDate,
  attachGuestToPax,
  guestFitsSlot,
  countsFromPax,
  paxAgeYears,
  hydratePaxDemographicsFromGuest,
  hydratePaxNames,
  stampEmptySlotsFromCounts,
  syncPaxToBandCounts,
  syncPaxToPartySize,
} from '@/components/reservation-card/party-pax';
import {
  ReservationCardSubModals,
  useReservationSubModals,
} from '@/components/reservation-card/ReservationCardSubModals';
import { reservationNamesIncomplete, missingAdultNameCount, isTbaDisplayName, paxHasRealName } from '@/lib/reservation-names';
import {
  hotelStayDayGap,
  preArrivalVoidKind,
  resolveStayWindowPlane,
  stayActionForPlane,
  type StayActionKind,
} from '@/lib/stay-window-plane';
import { canJoinOccupiedDoor } from '@/lib/share-door-join';
import { doorAssignBlock, doorConflictToast, type DoorBlock } from '@/lib/door-assign-reason';
import type {
  AgencyOption,
  AttachmentRow,
  DailyRateRow,
  FolioSubTab,
  PartyBillingMode,
  PaxRow,
  RatePlanOption,
  SelectOption,
  SourceOption,
  TabId,
} from '@/components/reservation-card/types';
import { stayMoneyPair } from '@/lib/folio-money-pair';
import {
  isOtaAgency,
  isWalkInRecordedAgency,
  inferSourceKindFromAgency,
  bookingSourceKind,
  persistCounterpartyIds,
  defaultsFromSalesContract,
  contractCounterpartyType,
} from '@/lib/booking-source-kind';
import { previewOccupancyAfterDepart } from '@/lib/occupancy-party';
import { catalogLabel, type LocalizedCatalogRow } from '@/lib/catalog-label';

function mergeDateTime(date: string, time: string): string | undefined {
  if (!date) return undefined;
  const t = time || '14:00';
  return new Date(`${date}T${t}:00`).toISOString();
}

function timeFromIso(iso?: string): string {
  if (!iso) return '14:00';
  return bakuTimeLabel(iso);
}

function addDaysIso(iso: string, days: number): string {
  return addHotelDays(iso, days);
}

function formatOperationalGaps(
  people: unknown,
  t: (key: string, values?: Record<string, string>) => string,
): string {
  return t('checkInBlocked', {
    details: operationalGapDetails(people, (gap) => t(operationalGapLabelKey(gap))),
  });
}

function warnOperationalGaps(
  people: unknown,
  t: (key: string, values?: Record<string, string>) => string,
) {
  if (!Array.isArray(people) || people.length === 0) return;
  showWarning(
    t('checkInDocsLater', {
      details: operationalGapDetails(people, (gap) => t(operationalGapLabelKey(gap))),
    }),
  );
}

function personDocLine(
  row: {
    firstName: string;
    lastName: string;
    sex?: string;
    nationality: string;
    birthDate: string;
    age: string;
    idCardNo: string;
    passportNo: string;
    guestId?: string;
    departedAt?: string | null;
  },
  profile: {
    sex?: string | null;
    nationality?: string | null;
    phone?: string | null;
    documents?: Array<{ docType?: string | null; docNumber?: string | null }>;
  } | null,
  today: string,
  t: (key: string) => string,
): string | null {
  if (row.departedAt) return null;
  if (!(row.firstName.trim() || row.lastName.trim())) return null;
  const sex = row.sex?.trim() || profile?.sex?.trim() || '';
  const nationality = row.nationality?.trim() || profile?.nationality?.trim() || '';
  const gaps = operationalGaps(
    {
      name: [row.firstName, row.lastName].filter((part) => part.trim()).join(' '),
      sex: sex || null,
      nationality: nationality || null,
      birthDate: row.birthDate || null,
      age: row.age.trim() ? Number(row.age) : null,
      phone: profile?.phone ?? null,
      documents: profile?.documents,
      idCardNo: row.idCardNo,
      passportNo: row.passportNo,
    },
    today,
  );
  if (gaps.length === 0) return null;
  const name = [row.firstName, row.lastName].filter((part) => part.trim()).join(' ');
  return `${name}: ${gaps.map((gap) => t(operationalGapLabelKey(gap))).join(', ')}`;
}

export type ReservationCardEditorProps = {
  layout: 'modal' | 'page';
  open: boolean;
  onClose: () => void;
  reservationId: string | null;
  /** Right-hand tab shown when the card opens. Create still starts on guests. */
  initialTab?: TabId;
  initialStayAction?: StayActionKind | null;
  onReservationCreated?: (id: string) => void;
};

function nightlyForChargedType(
  plans: RatePlanOption[],
  ratePlanId: string,
  typeId: string,
  adults: string,
  checkIn: string,
): number | null {
  if (!typeId) return null;
  const current = plans.find((r) => r.id === ratePlanId);
  const occ = Math.max(1, Number(adults) || 1);
  const cell = (current?.sellCells ?? []).find((c) => {
    if (c.roomTypeId !== typeId || c.occupancy !== occ) return false;
    if (!checkIn) return true;
    const from = c.effectiveFrom.slice(0, 10);
    const to = c.effectiveTo ? c.effectiveTo.slice(0, 10) : null;
    return from <= checkIn && (to == null || to >= checkIn);
  });
  if (cell) return cell.sellPrice;
  const matches = plans.filter(
    (r) => r.roomTypeId === typeId && r.pricePerNight != null && r.pricePerNight > 0,
  );
  if (matches.length === 0) return null;
  const peer = matches.find((r) => Boolean(r.medicalFlag) === Boolean(current?.medicalFlag));
  return (peer ?? matches[0]).pricePerNight ?? null;
}

export function ReservationCardEditor({
  layout,
  open,
  onClose,
  reservationId,
  initialTab = 'guests',
  initialStayAction = null,
  onReservationCreated,
}: ReservationCardEditorProps) {
  const isCreate = !reservationId;
  const t = useTranslations('reservationCard');
  const reportApiError = (body: unknown, fallback?: string) => {
    const code =
      body && typeof body === 'object' && 'code' in body
        ? String((body as { code?: unknown }).code ?? '')
        : '';
    if (code === 'STAY_RECORD_EXISTS') {
      showApiError({ error: t('stayRecordExists') }, fallback);
      return;
    }
    if (code === 'STAY_SAVE_FAILED') {
      showApiError({ error: t('staySaveFailed') }, fallback);
      return;
    }
    if (code === 'FOLIO_HAS_MONEY') {
      showApiError({ error: t('folioHasMoney') }, fallback);
      return;
    }
    if (code === 'CITY_LEDGER_CHECKIN') {
      showApiError({ error: t('cityLedgerCheckIn') }, fallback);
      return;
    }
    if (code === 'CONTRACT_REQUIRED_FOR_PAYER') {
      showApiError({ error: t('contractRequiredToast') }, fallback);
      return;
    }
    if (code === 'AGENCY_REQUIRED_FOR_PAYER') {
      showApiError({ error: t('agencyRequiredForPayerToast') }, fallback);
      return;
    }
    if (code === 'COMPANY_REQUIRED_FOR_PAYER') {
      showApiError({ error: t('companyRequiredForPayerToast') }, fallback);
      return;
    }
    const clash = doorConflictToast(body);
    if (clash) {
      showApiError({ error: t(clash.key, { from: clash.from, to: clash.to }) }, fallback);
      return;
    }
    showApiError(body, fallback);
  };
  const tb = useTranslations('booking');
  const tc = useTranslations('common');
  const locale = useLocale();
  const tRes = useTranslations('reservationStatus');
  const { can } = useAuth();

  const [tab, setTab] = useState<TabId>(initialTab);
  useEffect(() => {
    if (!open || isCreate) return;
    setTab(initialTab);
  }, [open, isCreate, reservationId, initialTab]);
  const [folioTab, setFolioTab] = useState<FolioSubTab>('all');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [checkInTime, setCheckInTime] = useState('14:00');
  const [checkOutTime, setCheckOutTime] = useState('12:00');
  const [voucherNo, setVoucherNo] = useState('');
  const [adults, setAdults] = useState('0');
  const [market, setMarket] = useState('');
  const [segment, setSegment] = useState('');
  const [booker, setBooker] = useState('');
  const [guestRep, setGuestRep] = useState('');
  const [paidBy, setPaidBy] = useState('');
  const [vipType, setVipType] = useState('');
  const [accomType, setAccomType] = useState('');
  const [billingMode, setBillingMode] = useState<'NORMAL' | 'COMP' | 'HOUSE'>('NORMAL');
  const [recordType, setRecordType] = useState('');
  const [tripReason, setTripReason] = useState('');
  const [agencyId, setAgencyId] = useState('');
  const [walkInProfileCode, setWalkInProfileCode] = useState('');
  const [walkInProfiles, setWalkInProfiles] = useState<Array<{ code: string; label: string }>>([]);
  const [companyId, setCompanyId] = useState('');
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
  const [linenEveryNights, setLinenEveryNights] = useState('');
  const [deepEveryNights, setDeepEveryNights] = useState('');
  const [salesProject, setSalesProject] = useState('');
  const [specialStates, setSpecialStates] = useState('');
  const [resGroup, setResGroup] = useState('');
  const [colorCode, setColorCode] = useState('');
  const [preferredLocation, setPreferredLocation] = useState('');
  const [preferredBed, setPreferredBed] = useState('');
  const [givenRoomTypeId, setGivenRoomTypeId] = useState('');
  const [contractRef, setContractRef] = useState('');
  const [salesContractId, setSalesContractId] = useState('');
  const [roomPayer, setRoomPayer] = useState<'GUEST' | 'AGENCY' | 'COMPANY'>('GUEST');
  const [commissionBasis, setCommissionBasis] = useState<'GROSS' | 'NET'>('GROSS');
  const [commercialAmendOpen, setCommercialAmendOpen] = useState(false);
  const [commercialAmendReason, setCommercialAmendReason] = useState('');
  const [commercialAmendBusy, setCommercialAmendBusy] = useState(false);
  const [salesContracts, setSalesContracts] = useState<
    Array<{
      id: string;
      label: string;
      agencyId: string | null;
      companyId: string | null;
      counterpartyType?: string | null;
      ratePlanId: string;
      code: string;
      validFrom?: string | null;
      validTo?: string | null;
      commissionPercent?: number | string | null;
      commissionBasis?: string | null;
    }>
  >([]);
  const [attachments, setAttachments] = useState<AttachmentRow[]>([]);
  const [attachOpen, setAttachOpen] = useState(false);
  const [roomStatus, setRoomStatus] = useState('');
  const [roomHkCondition, setRoomHkCondition] = useState('');
  const [departPaxIdx, setDepartPaxIdx] = useState<number | null>(null);
  const [movePaxIdx, setMovePaxIdx] = useState<number | null>(null);
  const [movePromptOpen, setMovePromptOpen] = useState(false);
  const [cardMoveAsk, setCardMoveAsk] = useState<{ askReason: boolean; askSettlement: boolean } | null>(
    null,
  );
  const [splitMoveAsk, setSplitMoveAsk] = useState<{
    fromDate: string;
    roomTypeId: string;
    roomId: string | null;
    askReason: boolean;
    askSettlement: boolean;
  } | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [stayAudit, setStayAudit] = useState<StayJournalEntry[]>([]);
  const [stayAuditStatus, setStayAuditStatus] = useState<'idle' | 'loading' | 'error' | 'ready'>(
    'idle',
  );
  const [scanPaxIndex, setScanPaxIndex] = useState<number | null>(null);
  const [allergenCount, setAllergenCount] = useState(0);
  const staysBarRef = useRef<HTMLDivElement | null>(null);
  const [mealPlanId, setMealPlanId] = useState('');
  const [children11_6, setChildren11_6] = useState('0');
  const [children5_2, setChildren5_2] = useState('0');
  const [children1_0, setChildren1_0] = useState('0');
  const [isLocked, setIsLocked] = useState(false);
  const [useManualRate, setUseManualRate] = useState(false);
  const [manualDailyRate, setManualDailyRate] = useState('');
  const [discountPercent, setDiscountPercent] = useState('');
  const [discountActive, setDiscountActive] = useState(false);
  const [amendOpen, setAmendOpen] = useState(false);
  const [dailyRates, setDailyRates] = useState<DailyRateRow[]>([]);
  const [pricingBusinessDate, setPricingBusinessDate] = useState<string | null>(null);
  const [agencies, setAgencies] = useState<AgencyOption[]>([]);
  const [companies, setCompanies] = useState<AgencyOption[]>([]);
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
      maxBed?: number | null;
      roomType?: { adultCapacity?: number; code?: string };
      reservations?: Array<{
        id: string;
        checkInDate: string;
        checkOutDate: string;
        status: string;
        shareEligible?: boolean;
        shareGender?: string | null;
        adults?: number;
        guest?: { sex?: string | null };
      }>;
    }>
  >([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [pax, setPax] = useState<PaxRow[]>([]);
  const [ratePlanId, setRatePlanId] = useState('');
  const [ratePlans, setRatePlans] = useState<RatePlanOption[]>([]);
  const [guestId, setGuestId] = useState('');
  const [guestOptions, setGuestOptions] = useState<SelectOption[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [creditLimitAzn, setCreditLimitAzn] = useState('');
  const [quoteText, setQuoteText] = useState<string | null>(null);
  const [sellable, setSellable] = useState<{
    available: number;
    booked: number;
    quota: number;
    stopSell: boolean;
    contractScoped?: boolean;
    contractAllotment?: number | null;
    reason?: string | null;
  } | null>(null);
  const [guestCardOpen, setGuestCardOpen] = useState(false);
  const [guestCardId, setGuestCardId] = useState<string | null>(null);
  const [guestCardOpenIdReader, setGuestCardOpenIdReader] = useState(false);
  const [notesAlertOpen, setNotesAlertOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [undoCheckoutOpen, setUndoCheckoutOpen] = useState(false);
  const [undoReason, setUndoReason] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [restoreTypeId, setRestoreTypeId] = useState('');
  const [restoreRoomId, setRestoreRoomId] = useState('');
  const [pendingStayAction, setPendingStayAction] = useState<StayActionKind | null>(initialStayAction);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [earlyCheckoutPreview, setEarlyCheckoutPreview] = useState<{
    applicable?: boolean;
    unusedNights?: number;
    guestCashRefund?: number;
  } | null>(null);
  const [notesAlertSeenFor, setNotesAlertSeenFor] = useState<string | null>(null);
  const [packageCompose, setPackageCompose] = useState<{
    total: number;
    lines: Array<{ code?: string; label?: string; amount: number }>;
  } | null>(null);
  const [pendingRoomId, setPendingRoomId] = useState('');
  const [taskCount, setTaskCount] = useState(0);
  const [bookingGroupId, setBookingGroupId] = useState<string | null>(null);
  const [bookingCode, setBookingCode] = useState<string | null>(null);
  const [bookingName, setBookingName] = useState<string | null>(null);
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
    setBillingMode(
      json.billingMode === 'COMP' || json.billingMode === 'HOUSE' ? json.billingMode : 'NORMAL',
    );
    setRecordType(String(json.recordType ?? ''));
    setTripReason(String(json.tripReason ?? ''));
    setAgencyId(String(json.agencyId ?? ''));
    setWalkInProfileCode(String(json.walkInProfileCode ?? ''));
    setCompanyId(String(json.companyId ?? ''));
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
    const guestObj = json.guest as { sex?: string | null; gender?: string | null } | undefined;
    setGuestGender(String(json.shareGender ?? guestObj?.sex ?? guestObj?.gender ?? ''));
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
    setLinenEveryNights(
      json.linenEveryNights == null || json.linenEveryNights === ''
        ? ''
        : String(json.linenEveryNights),
    );
    setDeepEveryNights(
      json.deepEveryNights == null || json.deepEveryNights === ''
        ? ''
        : String(json.deepEveryNights),
    );
    setSalesProject(String(json.salesProject ?? ''));
    setSpecialStates(String(json.specialStates ?? ''));
    setResGroup(String(json.resGroup ?? ''));
    setColorCode(String(json.colorCode ?? ''));
    setPreferredLocation(String(json.preferredLocation ?? ''));
    setPreferredBed(String(json.preferredBed ?? ''));
    setGivenRoomTypeId(String(json.givenRoomTypeId ?? ''));
    setContractRef(String(json.contractRef ?? ''));
    setSalesContractId(String(json.salesContractId ?? ''));
    setRoomPayer(
      json.roomPayer === 'AGENCY' || json.roomPayer === 'COMPANY' ? json.roomPayer : 'GUEST',
    );
    setCommissionBasis(json.commissionBasis === 'NET' ? 'NET' : 'GROSS');
    setAttachments((json.attachments as AttachmentRow[]) ?? []);
    const gid = (json.groupId as string | null | undefined) ?? null;
    setBookingGroupId(gid);
    const grp = json.group as
      | { code?: string; folioMode?: string; name?: string | null }
      | null
      | undefined;
    setBookingCode(grp?.code ?? null);
    setBookingName(grp?.name ?? null);
    const rm = json.room as { status?: string; hkCondition?: string } | null | undefined;
    setRoomStatus(rm?.status ?? '');
    setRoomHkCondition(rm?.hkCondition ?? '');
    setMealPlanId(String(json.mealPlanId ?? ''));
    setRatePlanId(String(json.ratePlanId ?? ''));
    setChildren11_6(String(json.children11_6 ?? 0));
    setChildren5_2(String(json.children5_2 ?? 0));
    setChildren1_0(String(json.children1_0 ?? 0));
    setIsLocked(Boolean(json.isLocked));
    setUseManualRate(Boolean(json.useManualRate));
    setManualDailyRate(json.manualDailyRate != null ? String(json.manualDailyRate) : '');
    setDiscountPercent(json.discountPercent != null ? String(json.discountPercent) : '');
    setDiscountActive(Boolean(json.discountActive) || Number(json.discountPercent) > 0);
    setCreditLimitAzn(json.creditLimitAzn != null ? String(json.creditLimitAzn) : '');
    setPaymentMethod(typeof json.paymentMethod === 'string' ? json.paymentMethod : '');
    setPricingBusinessDate(
      typeof json.pricingBusinessDate === 'string' ? json.pricingBusinessDate.slice(0, 10) : null,
    );
    setDailyRates(
      (
        (json.dailyRates as Array<{
          stayDate: string;
          amount: number;
          tariffAmount?: number | null;
          manualFlag?: boolean;
          currencyCode?: string;
          fixPrice?: boolean;
          discountPct?: number | null;
        }>) ?? []
      ).map((d) => ({
        stayDate: String(d.stayDate).slice(0, 10),
        amount: Number(d.amount),
        tariffAmount: d.tariffAmount == null ? null : Number(d.tariffAmount),
        currencyCode: d.currencyCode ?? 'AZN',
        fixPrice: Boolean(d.fixPrice),
        discountPct: d.discountPct ?? null,
        manualFlag: Boolean(d.manualFlag),
      })),
    );
    const compose = json.packageCompose as
      | {
          total?: number;
          lines?: Array<{
            code?: string;
            label?: string;
            name?: string;
            note?: string;
            amount?: number;
          }>;
        }
      | null
      | undefined;
    if (compose && Number(compose.total) > 0) {
      setPackageCompose({
        total: Number(compose.total),
        lines: Array.isArray(compose.lines)
          ? compose.lines.map((l) => ({
              code: l.code,
              label: l.label ?? l.name ?? l.note ?? l.code,
              amount: Number(l.amount ?? 0),
            }))
          : [],
      });
    } else {
      setPackageCompose(null);
    }
    setNotes((json.notesMap as Record<string, string>) ?? {});
    const masterGuest = json.guest as {
      id?: string;
      fullName?: string;
      sex?: string | null;
      nationality?: string | null;
      birthDate?: string | Date | null;
      documents?: Array<{ docType?: string | null; docNumber?: string | null; isPrimary?: boolean }>;
    } | undefined;
    const guests = (json.paxGuests as PaxRow[] | undefined) ?? [];
    const equalMode = (json.partyBillingMode as PartyBillingMode | undefined) === 'EQUAL';
    const adultN = Number(json.adults ?? 1) || 0;
    const c11 = Number(json.children11_6 ?? 0) || 0;
    const c5 = Number(json.children5_2 ?? 0) || 0;
    const c1 = Number(json.children1_0 ?? 0) || 0;

    let nextPax: PaxRow[];
    if (guests.length === 0 && masterGuest) {
      const parts = (masterGuest.fullName ?? '').split(/\s+/).filter(Boolean);
      nextPax = [
        {
          title: '',
          sex: masterGuest.sex ?? '',
          middleName: '',
          firstName: parts[0] ?? '',
          lastName: parts.slice(1).join(' '),
          nationality: masterGuest.nationality ?? '',
          birthDate: masterGuest.birthDate
            ? String(masterGuest.birthDate).slice(0, 10)
            : '',
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
          medicalPackageCode:
            (json as { medicalPackageCode?: string | null }).medicalPackageCode ?? '',
        },
      ];
      nextPax = hydratePaxDemographicsFromGuest(
        nextPax,
        new Map(),
        masterGuest.id
          ? {
              id: masterGuest.id,
              sex: masterGuest.sex,
              nationality: masterGuest.nationality,
              birthDate: masterGuest.birthDate,
              documents: masterGuest.documents,
            }
          : null,
      );
    } else {
      nextPax = guests.map((g) => ({
        id: g.id,
        guestId: g.guestId ?? undefined,
        title: g.title ?? '',
        sex: g.sex ?? (g as { gender?: string | null }).gender ?? '',
        middleName: g.middleName ?? '',
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
        medicalPackageCode:
          (g as { medicalPackageCode?: string | null }).medicalPackageCode ?? '',
        departedAt: (g as { departedAt?: string | Date | null }).departedAt
          ? String((g as { departedAt?: string | Date | null }).departedAt)
          : null,
      }));
      const nameByGuestId = new Map<string, string>();
      const demoByGuestId = new Map<
        string,
        {
          id: string;
          sex?: string | null;
          nationality?: string | null;
          birthDate?: string | Date | null;
          documents?: Array<{
            docType?: string | null;
            docNumber?: string | null;
            isPrimary?: boolean;
          }>;
        }
      >();
      for (const g of guests) {
        const linked = (
          g as {
            guest?: {
              id?: string;
              fullName?: string;
              firstName?: string | null;
              lastName?: string | null;
              sex?: string | null;
              nationality?: string | null;
              birthDate?: string | Date | null;
              documents?: Array<{
                docType?: string | null;
                docNumber?: string | null;
                isPrimary?: boolean;
              }>;
            };
          }
        ).guest;
        const gid = g.guestId ?? linked?.id ?? undefined;
        if (!gid) continue;
        const label =
          linked?.fullName?.trim() ||
          [linked?.firstName, linked?.lastName].filter(Boolean).join(' ').trim();
        if (label) nameByGuestId.set(gid, label);
        if (linked) {
          demoByGuestId.set(gid, {
            id: gid,
            sex: linked.sex,
            nationality: linked.nationality,
            birthDate: linked.birthDate,
            documents: linked.documents,
          });
        }
      }
      if (masterGuest?.id) {
        demoByGuestId.set(masterGuest.id, {
          id: masterGuest.id,
          sex: masterGuest.sex,
          nationality: masterGuest.nationality,
          birthDate: masterGuest.birthDate,
          documents: masterGuest.documents,
        });
      }
      nextPax = hydratePaxNames(
        nextPax,
        {
          id: masterGuest?.id ?? String(json.guestId ?? ''),
          fullName: masterGuest?.fullName,
        },
        nameByGuestId,
      );
      nextPax = hydratePaxDemographicsFromGuest(
        nextPax,
        demoByGuestId,
        masterGuest ?? null,
      );
    }
    const inHouse = json.status === 'IN_HOUSE';
    if (inHouse) {
      nextPax = nextPax.filter((row) => Boolean(row.guestId) || paxHasRealName(row));
    }
    const bandCounts = inHouse
      ? countsFromPax(nextPax)
      : {
          adults: Math.max(0, adultN),
          children11_6: c11,
          children5_2: c5,
          children1_0: c1,
        };
    const stamped = stampEmptySlotsFromCounts(nextPax, bandCounts);
    const sized = syncPaxToBandCounts(stamped, bandCounts, equalMode);
    setPax(sized);
    const actualBands = countsFromPax(sized);
    if (
      actualBands.adults !== bandCounts.adults ||
      actualBands.children11_6 !== bandCounts.children11_6 ||
      actualBands.children5_2 !== bandCounts.children5_2 ||
      actualBands.children1_0 !== bandCounts.children1_0
    ) {
      setAdults(String(actualBands.adults));
      setChildren11_6(String(actualBands.children11_6));
      setChildren5_2(String(actualBands.children5_2));
      setChildren1_0(String(actualBands.children1_0));
    }
  }, []);

  useEffect(() => {
    if (!historyOpen || !reservationId) return;
    let cancelled = false;
    setStayAuditStatus('loading');
    void fetch(`/api/reservations/${reservationId}/journal`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('journal'))))
      .then((body) => {
        if (cancelled) return;
        const payload = body?.data ?? body;
        setStayAudit(Array.isArray(payload?.entries) ? payload.entries : []);
        setStayAuditStatus('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setStayAudit([]);
        setStayAuditStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [historyOpen, reservationId]);

  const loadSeq = useRef(0);
  const load = useCallback(async () => {
    if (!reservationId) return;
    const seq = ++loadSeq.current;
    const requestedId = reservationId;
    setLoading(true);
    try {
      const res = await fetch(`/api/reservations/${reservationId}/full`);
      const json = await res.json();
      if (seq !== loadSeq.current) return;
      if (!res.ok) throw new Error(json.error ?? tc('loadError'));
      if (requestedId !== reservationId) return;
      applyJson(json);
    } catch (e) {
      if (seq !== loadSeq.current) return;
      reportApiError({ error: e instanceof Error ? e.message : tc('loadError') });
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [reservationId, tc, applyJson]);

  useEffect(() => {
    const checkoutAsk =
      pendingStayAction === 'earlyCheckOut' || pendingStayAction === 'checkOut';
    if (!checkoutAsk || !reservationId) {
      setEarlyCheckoutPreview(null);
      return;
    }
    let cancelled = false;
    void fetch(`/api/reservations/${reservationId}/early-checkout-preview`)
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled) setEarlyCheckoutPreview(json);
      })
      .catch(() => {
        if (!cancelled) setEarlyCheckoutPreview(null);
      });
    return () => {
      cancelled = true;
    };
  }, [pendingStayAction, reservationId]);

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
      })
      .catch(() => {
        if (!cancelled) setSiblingStays([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, bookingGroupId]);

  useEffect(() => {
    if (!open || sourceId || !agencyId || sources.length === 0 || agencies.length === 0) return;
    const agency = agencies.find((a) => a.id === agencyId);
    if (!agency) return;
    const kind = inferSourceKindFromAgency(agency.code, agency.label);
    if (!kind) return;
    const match = sources.find((s) => bookingSourceKind(s.code) === kind);
    if (match) setSourceId(match.id);
  }, [open, sourceId, agencyId, sources, agencies]);

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
        reportApiError(json, tc('failed'));
        return;
      }
      setBookingName((json.name as string | null | undefined) ?? (nextName || null));
      showSuccess(tc('saved'));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    if (isCreate) {
      loadSeq.current += 1;
      setLoading(false);
      setData(null);
      setTab('guests');
      setQuoteText(null);
      setSellable(null);
      // Reset commercial fields; keep FO ops defaults (14:00 / 12:00, adults=0). Payment method stays empty.
      setCheckIn('');
      setCheckOut('');
      setCheckInTime('14:00');
      setCheckOutTime('12:00');
      setVoucherNo('');
      setAdults('0');
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
      setWalkInProfileCode('');
      setCompanyId('');
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
      setLinenEveryNights('');
      setDeepEveryNights('');
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
      setPaymentMethod('');
      setCreditLimitAzn('');
      setNotes({});
      setDailyRates([]);
      setPackageCompose(null);
      setAttachments([]);
      setBookingGroupId(null);
      setBookingCode(null);
      setBookingName(null);
      setSiblingStays([]);
      setIsLocked(false);
      setPartyBillingMode('PRIMARY');
    } else {
      void load();
    }
  }, [open, isCreate, reservationId, load]);

  useEffect(() => {
    if (!open) return;
    void fetch('/api/master/lookups?kind=WALKIN_PROFILE&activeOnly=1')
      .then((r) => r.json())
      .then((rows) => {
        if (!Array.isArray(rows)) return;
        setWalkInProfiles(
          rows.map((row: { code?: string; name?: string }) => ({
            code: String(row.code ?? ''),
            label: String(row.name ?? row.code ?? ''),
          })),
        );
      })
      .catch(() => undefined);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    void Promise.all([
      fetch('/api/agencies').then((r) => r.json()),
      fetch('/api/companies').then((r) => r.json()),
      fetch('/api/master/booking-sources').then((r) => r.json()),
      fetch('/api/master/room-types').then((r) => r.json()),
      fetch('/api/master/meal-plans').then((r) => r.json()),
      fetch('/api/master/rate-plans').then((r) => r.json()),
      fetch('/api/guests').then((r) => r.json()),
      fetch('/api/rooms').then((r) => r.json()),
      fetch('/api/admin/contracts?status=ACTIVE')
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
    ]).then(([ag, co, src, rt, mp, rp, g, rm, contracts]) => {
      if (Array.isArray(ag)) {
        setAgencies(
          ag.map((x: { id: string; code: string; name: string }) => ({
            id: x.id,
            code: x.code,
            label: x.name || x.code,
            isOta: isOtaAgency(x.code, x.name),
            isWalkIn: isWalkInRecordedAgency(x.code, x.name),
          })),
        );
      }
      if (Array.isArray(co)) {
        setCompanies(
          co.map((x: { id: string; code: string; name: string }) => ({
            id: x.id,
            code: x.code,
            label: x.name || x.code,
            isOta: false,
            isWalkIn: false,
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
        // Nafta: Medical Rates, then Infotur, then BAR walk-in rates
        const mapped: RatePlanOption[] = rp
          .filter((x: { active?: boolean }) => x.active !== false)
          .map(
            (x: LocalizedCatalogRow & {
              id: string;
              code: string;
              name?: string;
              type?: string;
              medicalFlag?: boolean;
              mealPlanId?: string | null;
              roomTypeId?: string | null;
              pricePerNight?: number | string | null;
              sellVersions?: Array<{
                roomTypeId: string | null;
                mealPlanId: string | null;
                occupancy: number;
                sellPrice: number | string;
                effectiveFrom: string;
                effectiveTo: string | null;
              }>;
            }) => ({
              id: x.id,
              code: x.code,
              type: x.type,
              medicalFlag: !!x.medicalFlag,
              mealPlanId: x.mealPlanId ?? null,
              roomTypeId: x.roomTypeId ?? null,
              pricePerNight:
                x.pricePerNight != null ? Number(x.pricePerNight) : null,
              sellCells: (x.sellVersions ?? [])
                .filter((v) => v.roomTypeId)
                .map((v) => ({
                  roomTypeId: v.roomTypeId as string,
                  mealPlanId: v.mealPlanId,
                  occupancy: v.occupancy,
                  sellPrice: Number(v.sellPrice),
                  effectiveFrom: String(v.effectiveFrom),
                  effectiveTo: v.effectiveTo ? String(v.effectiveTo) : null,
                })),
              label: `${x.name ? `${x.code} — ${catalogLabel(x, locale)}` : x.code}${
                (() => {
                  const suffix = stayProductFamilySuffixKey({ code: x.code });
                  return suffix ? tc(suffix) : '';
                })()
              }`,
            }),
          );
        mapped.sort((a, b) => {
          const rank = stayProductFamilyRank(a) - stayProductFamilyRank(b);
          if (rank !== 0) return rank;
          return (a.code ?? a.label).localeCompare(b.code ?? b.label);
        });
        setRatePlans(mapped);
      }
      if (Array.isArray(rt)) {
        setRoomTypes(
          rt
            .filter((x: { active?: boolean }) => x.active !== false)
            .map((x: LocalizedCatalogRow & { id: string; code: string; name?: string; adultCapacity?: number }) => ({
              id: x.id,
              label: x.name ? `${x.code} — ${catalogLabel(x, locale)}` : x.code,
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
      if (Array.isArray(g) || (g && typeof g === 'object' && Array.isArray((g as { items?: unknown }).items))) {
        setGuestOptions(guestListItems(g).map((x) => ({ ...x, label: x.fullName })));
      }
      if (Array.isArray(rm)) {
        setRooms(
          rm.map(
            (x: {
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
                shareEligible?: boolean;
                shareGender?: string | null;
                adults?: number;
                guest?: { sex?: string | null };
              }>;
              maxBed?: number | null;
              roomType?: { adultCapacity?: number; code?: string };
            }) => ({
              id: x.id,
              roomNumber: x.roomNumber,
              roomTypeId: x.roomTypeId,
              status: x.status,
              hkCondition: x.hkCondition,
              inventoryStatus: x.inventoryStatus,
              maxBed: x.maxBed,
              roomType: x.roomType,
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
              companyId: string | null;
              counterpartyType?: string | null;
              ratePlanId: string;
              validFrom?: string | null;
              validTo?: string | null;
              commissionPercent?: number | string | null;
              commissionBasis?: string | null;
            }) => ({
              id: x.id,
              code: x.code,
              agencyId: x.agencyId,
              companyId: x.companyId,
              counterpartyType: x.counterpartyType,
              ratePlanId: x.ratePlanId,
              validFrom: x.validFrom,
              validTo: x.validTo,
              commissionPercent: x.commissionPercent,
              commissionBasis: x.commissionBasis,
              label: `${x.code} — ${x.name}`,
            }),
          ),
        );
      }
    });
  }, [open, tc, locale]);

  useEffect(() => {
    if (!open) {
      setGuestCardOpen(false);
      setNotesAlertOpen(false);
      setNotesAlertSeenFor(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open || isCreate || !reservationId) return;
    if (notesAlertSeenFor === reservationId) return;
    const cin = (notes.CIN_NOTE ?? '').trim();
    const extra = (notes.EXTRA_REQ ?? '').trim();
    if (!cin && !extra && allergenCount <= 0) return;
    setNotesAlertOpen(true);
    setNotesAlertSeenFor(reservationId);
  }, [open, isCreate, reservationId, notes, allergenCount, notesAlertSeenFor]);

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
    if (!open || !guestId) {
      setAllergenCount(0);
      return;
    }
    let cancelled = false;
    fetch(`/api/guests/${guestId}/crm-badges`)
      .then((r) => r.json())
      .then((b) => {
        if (!cancelled) setAllergenCount(Number(b.allergens ?? 0));
      })
      .catch(() => {
        if (!cancelled) setAllergenCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [open, guestId]);

  const billingRoutingSummary = useMemo(() => {
    const agencyName = agencies.find((a) => a.id === agencyId)?.label;
    const companyName = companies.find((c) => c.id === companyId)?.label;
    if (roomPayer === 'AGENCY') return t('roomPaidByAgency', { name: agencyName || '—' });
    if (roomPayer === 'COMPANY') return t('roomPaidByCompany', { name: companyName || '—' });
    return t('roomPaidByGuest');
  }, [agencyId, companyId, roomPayer, agencies, companies, t]);

  const departOccupancyPreview = useMemo(() => {
    if (departPaxIdx == null || !pax[departPaxIdx]) return null;
    const next = previewOccupancyAfterDepart(
      {
        adults: Number(adults) || 0,
        children11_6: Number(children11_6) || 0,
        children5_2: Number(children5_2) || 0,
        children1_0: Number(children1_0) || 0,
      },
      {
        age: paxAgeYears(pax[departPaxIdx]),
      },
    );
    return t('departOccupancyPreview', {
      from: `${adults}+${children11_6}+${children5_2}+${children1_0}`,
      to: `${next.adults}+${next.children11_6}+${next.children5_2}+${next.children1_0}`,
    });
  }, [departPaxIdx, pax, adults, children11_6, children5_2, children1_0, t]);

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
    const qs = new URLSearchParams({
      roomTypeId,
      from: checkIn,
      to: checkOut,
    });
    if (salesContractId) qs.set('salesContractId', salesContractId);
    fetch(`/api/fo/sellable?${qs}`)
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
          contractScoped: Boolean(s.contractScoped),
          contractAllotment:
            s.contractAllotment == null ? null : Number(s.contractAllotment),
          reason: typeof s.reason === 'string' ? s.reason : null,
        });
      })
      .catch(() => {
        if (!cancelled) setSellable(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isCreate, roomTypeId, checkIn, checkOut, salesContractId]);

  async function loadGuests() {
    const g = await fetch('/api/guests').then((r) => r.json());
    setGuestOptions(guestListItems(g).map((x) => ({ ...x, label: x.fullName })));
  }

  async function recalcPricing() {
    if (!reservationId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/reservations/${reservationId}/pricing/recalc`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) {
        reportApiError(json, tc('failed'));
        return;
      }
      showSuccess(tc('success'));
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function postMissedNights() {
    if (!reservationId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/reservations/${reservationId}/missed-nights`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) {
        reportApiError(json, tc('failed'));
        return;
      }
      showSuccess(t('missedNightsPosted', { count: json.nights?.length ?? 0 }));
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function postOneNight(ymd: string) {
    if (!reservationId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/reservations/${reservationId}/pricing/post-night`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: ymd.slice(0, 10) }),
      });
      const json = await res.json();
      if (!res.ok) {
        reportApiError(json, tc('failed'));
        return;
      }
      showSuccess(t('postNightDone'));
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

  function checkInGapLines(early = false): string[] {
    const lines: string[] = [];
    if (!roomId) lines.push(t('checkInNeedRoom'));
    if (doorPendingDirty) lines.push(t('checkInNeedSaveRoom'));
    if (roomId && !assignedMatchesPhysical) lines.push(t('checkInNeedDoorType'));
    if (!early && Boolean(checkIn) && checkIn > todayBakuYmd()) lines.push(t('checkInNeedArrival'));
    const missingNames = missingAdultNameCount({ adults: Number(adults) || 1, pax });
    if (missingNames > 0) lines.push(t('checkInNeedAdultNames', { count: String(missingNames) }));
    else if (isTbaDisplayName((data?.guest as { fullName?: string } | undefined)?.fullName)) {
      lines.push(t('checkInNeedRealName'));
    }
    const master = data?.guest as
      | {
          id?: string;
          sex?: string | null;
          nationality?: string | null;
          phone?: string | null;
          documents?: Array<{ docType?: string | null; docNumber?: string | null }>;
        }
      | undefined;
    const loaded =
      (data?.paxGuests as
        | Array<{
            guestId?: string | null;
            guest?: {
              id?: string;
              sex?: string | null;
              nationality?: string | null;
              phone?: string | null;
              documents?: Array<{ docType?: string | null; docNumber?: string | null }>;
            } | null;
          }>
        | undefined) ?? [];
    const today = todayBakuYmd();
    for (const row of pax) {
      const linked =
        (row.guestId && master?.id === row.guestId ? master : null) ??
        loaded.find((item) => item.guestId === row.guestId || item.guest?.id === row.guestId)?.guest ??
        null;
      const line = personDocLine(row, linked, today, t);
      if (line) lines.push(line);
    }
    return lines;
  }

  function requestStayAction() {
    const kind = stayActionForPlane(
      resolveStayWindowPlane({ checkIn, checkOut, status, todayKey: todayBakuYmd() }),
    );
    if (!kind || !reservationId) return;
    if (kind === 'earlyCheckIn' || kind === 'checkIn') {
      const lines = checkInGapLines(kind === 'earlyCheckIn');
      if (lines.length > 0) {
        showWarning(t('checkInNeedList', { details: lines.join('; ') }));
        return;
      }
    }
    setPendingStayAction(kind);
  }

  async function voidStay(kind: 'cancel' | 'noShow', reason?: string) {
    if (!reservationId) return;
    if (kind === 'cancel' && !reason?.trim()) {
      setCancelReason('');
      setCancelOpen(true);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/reservations/${reservationId}/cancel`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          noShow: kind === 'noShow',
          reason: kind === 'cancel' ? reason?.trim() : undefined,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        reportApiError(json, tc('error'));
        return;
      }
      setCancelOpen(false);
      showSuccess(kind === 'noShow' ? t('noShowDone') : t('cancelDone'));
      applyJson(json as Record<string, unknown>);
    } finally {
      setBusy(false);
    }
  }

  async function restoreStay() {
    if (!reservationId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/reservations/${reservationId}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomTypeId: restoreTypeId || undefined,
          roomId: restoreRoomId || null,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        reportApiError(json, tc('error'));
        return;
      }
      setRestoreOpen(false);
      showSuccess(t('restoreDone'));
      applyJson(json as Record<string, unknown>);
    } finally {
      setBusy(false);
    }
  }

  async function undoCheckoutStay() {
    if (!reservationId || !undoReason.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/reservations/${reservationId}/undo-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: undoReason.trim() }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        reportApiError(json, tc('error'));
        return;
      }
      setUndoCheckoutOpen(false);
      setUndoReason('');
      showSuccess(t('restoreDone'));
      applyJson((json as { reservation?: Record<string, unknown> }).reservation ?? json);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function deleteStay() {
    if (!reservationId || !deleteReason.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/reservations/${reservationId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: deleteReason.trim() }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        reportApiError(json, tc('error'));
        return;
      }
      setDeleteOpen(false);
      showSuccess(t('deleteStayDone'));
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function printStayForm(kind: StayPrintKind) {
    const title =
      kind === 'registration' ? t('printRegistration') : kind === 'proforma' ? t('printProforma') : t('printConfirmation');
    const profileRes = await fetch('/api/hotel/profile');
    const profileJson = profileRes.ok ? ((await profileRes.json()) as { data?: Record<string, unknown> } | Record<string, unknown>) : null;
    const profile = (profileJson && 'data' in profileJson && profileJson.data ? profileJson.data : profileJson) as {
      name?: string;
      printName?: string | null;
      address?: string | null;
      phone?: string | null;
      email?: string | null;
      website?: string | null;
    } | null;
    const guest = data?.guest as {
      fullName?: string;
      phone?: string | null;
      email?: string | null;
      nationality?: string | null;
      sex?: string | null;
      birthDate?: string | null;
    } | undefined;
    const primary = pax.find((row) => row.isPrimary) ?? pax[0];
    const guestName =
      [primary?.firstName, primary?.lastName].filter(Boolean).join(' ').trim() || guest?.fullName || '';
    const priced = dailyRates.filter((row) => row.amount > 0);
    const nightPrice = priced[0]?.amount ?? dailyRates[0]?.amount ?? 0;
    const total = Number(data?.totalAmount ?? 0);
    const roomType = roomTypes.find((row) => row.id === roomTypeId)?.label ?? '';
    const board = mealPlans.find((row) => row.id === mealPlanId)?.label ?? '';
    const agency = agencies.find((row) => row.id === agencyId)?.label ?? '';
    const infants = Number(children1_0) || 0;
    const children = (Number(children11_6) || 0) + (Number(children5_2) || 0);
    const adultCount = Number(adults) || 0;
    const opened = openPrintDocument(
      buildStayFormHtml({
        kind,
        title,
        hotel: {
          name: profile?.printName || profile?.name || '',
          address: profile?.address ?? '',
          phone: profile?.phone ?? '',
          email: profile?.email ?? '',
          website: profile?.website ?? '',
        },
        resNo: resNo || String(data?.externalRef ?? ''),
        guestName,
        agency,
        voucher: voucherNo,
        rate: ratePlans.find((row) => row.id === ratePlanId)?.label ?? '',
        arrival: checkIn,
        departure: checkOut,
        roomType,
        roomNumber: rooms.find((row) => row.id === roomId)?.roomNumber ?? '',
        board,
        adults: adultCount,
        children,
        infants,
        nights: priced.length || dailyRates.length,
        nightPrice,
        total,
        deposit: stayPair.unused,
        balance: stayPair.debt,
        phone: guest?.phone ?? '',
        email: guest?.email ?? '',
        documentNo: primary?.passportNo || primary?.idCardNo || '',
        nationality: primary?.nationality || guest?.nationality || '',
        birthDate: primary?.birthDate || (guest?.birthDate ? String(guest.birthDate).slice(0, 10) : ''),
        sex: primary?.sex || guest?.sex || '',
        currency: 'AZN',
        notes: Object.values(notes).filter(Boolean).join('\n'),
        nightsGrid: dailyRates.map((row) => ({
          date: String(row.stayDate).slice(0, 10),
          roomType,
          board,
          adults: adultCount,
          children,
          infants,
          price: row.amount,
        })),
        labels: {
          resNo: t('printForm.resNo'),
          agency: t('printForm.agency'),
          voucher: t('printForm.voucher'),
          rate: t('printForm.rate'),
          arrival: t('printForm.arrival'),
          departure: t('printForm.departure'),
          room: t('printForm.room'),
          board: t('printForm.board'),
          pax: t('printForm.pax'),
          guest: t('printForm.guest'),
          phone: t('printForm.phone'),
          email: t('printForm.email'),
          document: t('printForm.document'),
          nationality: t('printForm.nationality'),
          birth: t('printForm.birth'),
          sex: t('printForm.sex'),
          signature: t('printForm.signature'),
          nightPrice: t('printForm.nightPrice'),
          nights: t('printForm.nights'),
          total: t('printForm.total'),
          deposit: t('overpaid'),
          balance: t('printForm.balance'),
          date: t('printForm.date'),
          roomType: t('printForm.roomType'),
          price: t('printForm.price'),
          adults: t('printForm.adults'),
          children: t('printForm.children'),
          infants: t('printForm.infants'),
          dear: t('printForm.dear'),
          confirmed: t('printForm.confirmed'),
          contact: t('printForm.contact'),
          notes: t('printForm.notes'),
          legal: [t('printForm.legalHours'), t('printForm.legalSafe'), t('printForm.legalNotify'), t('printForm.legalExpenses'), t('printForm.legalPenalty')],
        },
      }),
    );
    if (!opened) reportApiError({ error: t('printBlocked') }, t('printBlocked'));
  }

  async function warnGuestOverlaps(): Promise<boolean> {
    const url = reservationId
      ? `/api/reservations/${reservationId}/guest-overlaps`
      : guestId && checkIn && checkOut
        ? `/api/reservations/guest-overlaps?guestId=${encodeURIComponent(guestId)}&checkIn=${encodeURIComponent(checkIn)}&checkOut=${encodeURIComponent(checkOut)}`
        : null;
    if (!url) return true;
    const res = await fetch(url);
    if (!res.ok) return true;
    const body = (await res.json()) as
      | Array<{ roomNumber: string; checkIn: string; checkOut: string }>
      | { data?: Array<{ roomNumber: string; checkIn: string; checkOut: string }> };
    const list = Array.isArray(body) ? body : body.data ?? [];
    if (list.length === 0) return true;
    const first = list[0]!;
    return window.confirm(t('guestOverlapWarn', { room: first.roomNumber, from: first.checkIn, to: first.checkOut }));
  }

  async function splitStay(
    input: { fromDate: string; roomTypeId: string; roomId: string | null },
    confirmed?: { reasonCode?: RoomMoveReason; settlement?: ClassSettlement },
  ) {
    if (!reservationId) return;
    const door = input.roomId ? rooms.find((row) => row.id === input.roomId) : undefined;
    const askSettlement = doorTypeNeedsSettlement(roomTypeId, givenRoomTypeId, door?.roomTypeId);
    const askReason = data?.status === 'IN_HOUSE' && Boolean(input.roomId);
    if ((askReason || askSettlement) && !confirmed) {
      setSplitMoveAsk({ ...input, askReason, askSettlement });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/reservations/${reservationId}/stay-split`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...input,
          ...(confirmed?.reasonCode ? { reasonCode: confirmed.reasonCode } : {}),
          ...(confirmed?.settlement ? { settlement: confirmed.settlement } : {}),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const code = (json as { code?: string } | null)?.code;
        if (code === 'ROOM_TYPE_SETTLEMENT_REQUIRED' && input.roomId) {
          setSplitMoveAsk({
            ...input,
            askReason: data?.status === 'IN_HOUSE',
            askSettlement: true,
          });
          return;
        }
        reportApiError(json, tc('error'));
        return;
      }
      const pending = Boolean((json as { movePending?: boolean } | null)?.movePending);
      showSuccess(pending ? t('splitStayPlanned') : t('splitStayDone'));
      applyJson(json as Record<string, unknown>);
    } finally {
      setBusy(false);
    }
  }

  async function confirmCheckIn(early = false) {
    if (!reservationId) return;
    const lines = checkInGapLines(early);
    if (lines.length > 0) {
      showWarning(t('checkInNeedList', { details: lines.join('; ') }));
      return;
    }
    if (!(await warnGuestOverlaps())) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/reservations/${reservationId}/check-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          early,
          checkInTime: !early && checkInTime < '14:00' ? checkInTime : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json?.code === 'BUSINESS_DATE_LAG') {
          reportApiError(
            {
              error: t('checkInBusinessDateLag', {
                businessDate: String(json.businessDate ?? ''),
                arrivalDate: String(json.arrivalDate ?? ''),
              }),
            },
            tc('failed'),
          );
        } else {
          reportApiError(
            json?.code === 'GUEST_CHECK_IN_INCOMPLETE'
              ? { error: formatOperationalGaps(json.people, t) }
              : json,
            tc('failed'),
          );
        }
        await load();
        return;
      }
      showSuccess(early ? t('earlyCheckInDone') : t('checkInDone'));
      setPendingStayAction(null);
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
        reportApiError(json, tc('failed'));
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
      companyId,
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
      linenEveryNights,
      deepEveryNights,
      salesProject,
      specialStates,
      resGroup,
      colorCode,
      preferredLocation,
      preferredBed,
      givenRoomTypeId,
      salesContractId,
      roomPayer,
      commissionBasis,
      creditLimitAzn,
      booker,
      guestRep,
      paidBy,
      accomType,
      billingMode,
      recordType,
    }),
    [
      checkIn,
      checkOut,
      checkInTime,
      checkOutTime,
      voucherNo,
      agencyId,
      companyId,
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
      linenEveryNights,
      deepEveryNights,
      salesProject,
      specialStates,
      resGroup,
      colorCode,
      preferredLocation,
      preferredBed,
      givenRoomTypeId,
      salesContractId,
      roomPayer,
      commissionBasis,
      creditLimitAzn,
      booker,
      guestRep,
      paidBy,
      accomType,
      billingMode,
      recordType,
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
      setWalkInProfileCode('');
      setSalesContractId('');
      setContractRef('');
      setShareEligible(false);
    }
    if (patch.agencyId !== undefined && patch.agencyId !== agencyId) {
      const current = salesContracts.find((c) => c.id === salesContractId);
      if (current && contractCounterpartyType(current) === 'AGENCY') {
        setSalesContractId('');
        setContractRef('');
      }
      const agency = agencies.find((a) => a.id === patch.agencyId);
      if (agency?.isOta) {
        setShareEligible(false);
      }
    }
    if (patch.companyId !== undefined && patch.companyId !== companyId) {
      const current = salesContracts.find((c) => c.id === salesContractId);
      if (current && contractCounterpartyType(current) === 'CORPORATE') {
        setSalesContractId('');
        setContractRef('');
      }
    }
    if (patch.salesContractId !== undefined) {
      const cid = patch.salesContractId;
      setSalesContractId(cid);
      if (cid) {
        const contract = salesContracts.find((c) => c.id === cid);
        if (contract) {
          setRatePlanId(contract.ratePlanId);
          const defaults = defaultsFromSalesContract(contract);
          if (defaults.agencyId !== undefined) setAgencyId(defaults.agencyId ?? '');
          if (defaults.companyId !== undefined) setCompanyId(defaults.companyId ?? '');
          if (defaults.commissionBasis) setCommissionBasis(defaults.commissionBasis);
          if (defaults.roomPayer) setRoomPayer(defaults.roomPayer);
          const linkedRp = ratePlans.find((r) => r.id === contract.ratePlanId);
          if (linkedRp?.mealPlanId) setMealPlanId(linkedRp.mealPlanId);
          if (linkedRp?.roomTypeId) setRoomTypeId(linkedRp.roomTypeId);
          if (stayProductFamily(linkedRp ?? {}) === 'medical') setSegment('Medical');
          if (
            !ratePlanRequiresGuestPackage({
              code: linkedRp?.code,
              medicalFlag: linkedRp?.medicalFlag,
            })
          ) {
            setPax((rows) => rows.map((row) => ({ ...row, medicalPackageCode: '' })));
          }
        }
      }
      const rest = { ...patch };
      delete rest.salesContractId;
      if (Object.keys(rest).length === 0) return;
      patch = rest;
    }
    if (patch.roomPayer === 'GUEST' || patch.roomPayer === 'AGENCY' || patch.roomPayer === 'COMPANY') {
      setRoomPayer(patch.roomPayer);
      const rest = { ...patch };
      delete rest.roomPayer;
      if (Object.keys(rest).length === 0) return;
      patch = rest;
    }
    if (patch.commissionBasis === 'GROSS' || patch.commissionBasis === 'NET') {
      setCommissionBasis(patch.commissionBasis);
      const rest = { ...patch };
      delete rest.commissionBasis;
      if (Object.keys(rest).length === 0) return;
      patch = rest;
    }
    if (patch.ratePlanId !== undefined) {
      const rp = ratePlans.find((r) => r.id === patch.ratePlanId);
      const contract = salesContracts.find((c) => c.id === salesContractId);
      if (contract && patch.ratePlanId && patch.ratePlanId !== contract.ratePlanId) {
        showWarning(t('rateNotContractToast'));
      }
      // Package / BAR → meal from plan; scoped package may set room type; medical → segment
      if (rp?.mealPlanId) setMealPlanId(rp.mealPlanId);
      else if (!patch.ratePlanId) setMealPlanId('');
      if (rp?.roomTypeId) setRoomTypeId(rp.roomTypeId);
      if (stayProductFamily(rp ?? {}) === 'medical') setSegment('Medical');
    }
    if (patch.roomTypeId !== undefined) {
      const nextType = patch.roomTypeId;
      const current = ratePlans.find((r) => r.id === ratePlanId);
      // Clear type-scoped package when room type no longer matches
      if (
        current?.roomTypeId &&
        current.type !== 'BASE' &&
        nextType &&
        current.roomTypeId !== nextType &&
        current.mealPlanId
      ) {
        setMealPlanId(current.mealPlanId);
      }
      // Physical filter may fall back to Room type — drop incompatible pending door
      const physical = (givenRoomTypeId || nextType).trim();
      if (physical && pendingRoomId) {
        const door = rooms.find((r) => r.id === pendingRoomId);
        if (door?.roomTypeId && door.roomTypeId !== physical) setPendingRoomId('');
      }
    }
    if (patch.givenRoomTypeId !== undefined) {
      const physical = (patch.givenRoomTypeId || roomTypeId).trim();
      if (physical && pendingRoomId) {
        const door = rooms.find((r) => r.id === pendingRoomId);
        if (door?.roomTypeId && door.roomTypeId !== physical) setPendingRoomId('');
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
      walkInProfileCode: setWalkInProfileCode,
      companyId: setCompanyId,
      sourceId: setSourceId,
      roomTypeId: setRoomTypeId,
      roomId: setPendingRoomId,
      roomCount: setRoomCount,
      rateType: setRateType,
      mealPlanId: setMealPlanId,
      ratePlanId: (v) => {
        setRatePlanId(v);
        const plan = ratePlans.find((row) => row.id === v);
        if (!ratePlanRequiresGuestPackage({ code: plan?.code, medicalFlag: plan?.medicalFlag })) {
          setPax((rows) => rows.map((row) => ({ ...row, medicalPackageCode: '' })));
        }
      },
      billingMode: (v) =>
        setBillingMode(v === 'COMP' || v === 'HOUSE' ? v : 'NORMAL'),
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
      linenEveryNights: setLinenEveryNights,
      deepEveryNights: setDeepEveryNights,
      salesProject: setSalesProject,
      specialStates: setSpecialStates,
      resGroup: setResGroup,
      colorCode: setColorCode,
      preferredLocation: setPreferredLocation,
      preferredBed: setPreferredBed,
      givenRoomTypeId: setGivenRoomTypeId,
      salesContractId: setSalesContractId,
      roomPayer: (v) => {
        if (v === 'GUEST' || v === 'AGENCY' || v === 'COMPANY') setRoomPayer(v);
      },
      commissionBasis: (v) => {
        if (v === 'GROSS' || v === 'NET') setCommissionBasis(v);
      },
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
      setPax((prev) => {
        const sized = syncPaxToBandCounts(
          prev,
          {
            adults: nextAdults,
            children11_6: nextC11,
            children5_2: nextC5,
            children1_0: nextC1,
          },
          partyBillingMode === 'EQUAL',
        );
        const actual = countsFromPax(sized);
        if (
          actual.adults !== nextAdults ||
          actual.children11_6 !== nextC11 ||
          actual.children5_2 !== nextC5 ||
          actual.children1_0 !== nextC1
        ) {
          setAdults(String(actual.adults));
          setChildren11_6(String(actual.children11_6));
          setChildren5_2(String(actual.children5_2));
          setChildren1_0(String(actual.children1_0));
        }
        return sized;
      });
    }
  }

  /** Party list → adults/children counts (bidirectional with onLeftChange pax sync). */
  function applyPaxChange(rows: PaxRow[]) {
    const next = syncPaxToPartySize(rows, rows.length, partyBillingMode === 'EQUAL');
    setPax(next);
    const counts = countsFromPax(next);
    setAdults(String(counts.adults));
    setChildren11_6(String(counts.children11_6));
    setChildren5_2(String(counts.children5_2));
    setChildren1_0(String(counts.children1_0));
  }

  async function save(choice?: { reason?: RoomMoveReason; settlement?: ClassSettlement }) {
    const moveReasonCode = choice?.reason;
    const doorChanged =
      !isCreate && Boolean(roomId) && Boolean(pendingRoomId) && pendingRoomId !== roomId;
    const targetDoor = pendingRoomId ? rooms.find((row) => row.id === pendingRoomId) : undefined;
    const askSettlement = doorTypeNeedsSettlement(roomTypeId, givenRoomTypeId, targetDoor?.roomTypeId);
    const askReason = data?.status === 'IN_HOUSE';
    if (doorChanged && (askReason || askSettlement) && !choice) {
      setCardMoveAsk({ askReason, askSettlement });
      return;
    }
    if (!(await warnGuestOverlaps())) return;
    setBusy(true);
    try {
      const sourceKind = bookingSourceKind(sources.find((s) => s.id === sourceId)?.code);
      const parties = persistCounterpartyIds({
        sourceKind,
        agencyId,
        companyId,
        agencyIsWalkIn: agencies.find((a) => a.id === agencyId)?.isWalkIn ?? false,
      });
      const namesBlocked =
        !isCreate &&
        reservationNamesIncomplete({
          guestFullName: (data?.guest as { fullName?: string } | undefined)?.fullName,
          adults: Number(adults) || 1,
          pax,
        });
      if (namesBlocked && pendingRoomId && pendingRoomId !== roomId) {
        reportApiError({ error: tb('namesIncomplete') }, tc('failed'));
        return;
      }
      const selectedType = roomTypes.find((r) => r.id === roomTypeId);
      const typeCap = selectedType?.adultCapacity ?? 2;
      const doorId = pendingRoomId || roomId;
      const door = rooms.find((r) => r.id === doorId);
      const doorCap = door?.maxBed;
      const capacity = doorCap != null && doorCap > 0 ? Math.min(typeCap, doorCap) : typeCap;
      const adultCount = Math.max(0, Number(adults) || 0);
      if (roomTypeId && adultCount > capacity) {
        reportApiError(
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
      if ((roomPayer === 'AGENCY' || roomPayer === 'COMPANY') && !salesContractId) {
        reportApiError({ error: t('contractRequiredToast') }, tc('failed'));
        return;
      }
      if (isCreate) {
        const missing: string[] = [];
        if (!roomTypeId) missing.push(tb('roomType'));
        if (!ratePlanId) missing.push(t('packageOrRate'));
        if (!guestId) missing.push(t('pickGuestRequired'));
        if (!checkIn) missing.push(tb('checkIn'));
        if (!checkOut) missing.push(tb('checkOut'));
        if (missing.length > 0) {
          reportApiError(
            { error: t('missingRequired', { fields: missing.join(', ') }) },
            tc('failed'),
          );
          return;
        }
        if (sellable && sellable.available < 1) {
          reportApiError(
            {
              error:
                sellable.reason === 'NO_ALLOTMENT'
                  ? t('noContractAllotmentInventory')
                  : sellable.contractScoped
                    ? t('noContractSellableInventory')
                    : t('noSellableInventory'),
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
            givenRoomTypeId: givenRoomTypeId || undefined,
            ratePlanId,
            guestId,
            agencyId: parties.agencyId ?? undefined,
            walkInProfileCode: sourceKind === 'WALKIN' ? walkInProfileCode || null : null,
            companyId: parties.companyId ?? undefined,
            sourceId: sourceId || undefined,
            salesContractId: salesContractId || undefined,
            roomPayer,
            commissionBasis,
            mealPlanId: mealPlanId || undefined,
            partyBillingMode,
            checkInDate: mergeDateTime(checkIn, checkInTime),
            checkOutDate: mergeDateTime(checkOut, checkOutTime),
            paymentMethod: paymentMethod || null,
            adults: Math.max(0, Number(adults) || 0),
            children11_6: Number(children11_6) || 0,
            children5_2: Number(children5_2) || 0,
            children1_0: Number(children1_0) || 0,
            shareEligible: false,
            market: market || null,
            segment: segment || null,
            vipType: vipType || null,
            tripReason: tripReason || null,
            booker: booker || null,
            guestRep: guestRep || null,
            paidBy: paidBy || null,
            voucherNo: voucherNo || null,
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
            contractRef: contractRef || null,
            creditLimitAzn:
              creditLimitAzn.trim() === '' ? null : Math.round(Number(creditLimitAzn) * 100) / 100,
            rateType: rateType || null,
            accomType: accomType || null,
            billingMode,
            recordType: recordType || null,
            roomId: pendingRoomId || undefined,
            useManualRate,
            manualDailyRate: manualDailyRate ? Number(manualDailyRate) : null,
            discountPercent: discountPercent === '' ? null : Number(discountPercent),
            discountActive: Number(discountPercent) > 0,
            notes,
            paxGuests: pax
              .filter(
                (p) =>
                  Boolean(p.guestId) ||
                  Boolean(p.firstName.trim()) ||
                  Boolean(p.lastName.trim()),
              )
              .map((p) => ({
                guestId: p.guestId || null,
                firstName: p.firstName || null,
                lastName: p.lastName || null,
                middleName: p.middleName || null,
                sex: p.sex || null,
                nationality: p.nationality || null,
                birthDate: p.birthDate || null,
                age: p.age ? Number(p.age) : null,
                idCardNo: p.idCardNo || null,
                passportNo: p.passportNo || null,
                isPrimary: p.isPrimary,
                ownsFolio: p.ownsFolio ?? false,
                medicalPackageCode: p.medicalPackageCode?.trim()
                  ? p.medicalPackageCode.trim().toUpperCase()
                  : null,
              })),
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          const err = String(json.error ?? json.code ?? '');
          if (/contract allotment exhausted/i.test(err)) {
            reportApiError({ error: t('noContractSellableInventory') }, tc('failed'));
          } else if (/no contract allotment|contract allotment/i.test(err)) {
            reportApiError({ error: t('noContractAllotmentInventory') }, tc('failed'));
          } else if (/no availability/i.test(err)) {
            reportApiError({ error: t('noSellableInventory') }, tc('failed'));
          } else {
            reportApiError(json, tc('failed'));
          }
          return;
        }
        showSuccess(tb('createBooking'));
        if (isPreArrivalStatus(String(json.status ?? 'CONFIRMED'))) {
          warnOperationalGaps(json.operationalGaps, t);
        }
        if (json.id) onReservationCreated?.(json.id);
        return;
      }
      if (creditLimitAzn.trim() !== '') {
        const limit = Number(creditLimitAzn);
        if (Number.isNaN(limit) || limit < 0) {
          reportApiError({ error: t('creditLimitInvalid') }, tc('failed'));
          return;
        }
      }
      if (shareEligible && !guestGender) {
        reportApiError({ error: t('shareGenderRequired') }, tc('failed'));
        return;
      }
      if (guestId && guestGender) {
        await fetch(`/api/guests/${guestId}/full`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sex: guestGender }),
        }).catch(() => undefined);
      }
      let party = pax;
      let partyAdults = Math.max(0, Number(adults) || 0);
      let partyC11 = Number(children11_6) || 0;
      let partyC5 = Number(children5_2) || 0;
      let partyC1 = Number(children1_0) || 0;
      if (status === 'IN_HOUSE') {
        const kept = pax.filter((row) => Boolean(row.guestId) || paxHasRealName(row));
        if (kept.length !== pax.length) {
          party = kept;
          const counts = countsFromPax(kept);
          partyAdults = counts.adults;
          partyC11 = counts.children11_6;
          partyC5 = counts.children5_2;
          partyC1 = counts.children1_0;
          applyPaxChange(kept);
          showWarning(t('emptyGuestDropped'));
        }
      }
      const res = await fetch(`/api/reservations/${reservationId}/full`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkInDate: mergeDateTime(checkIn, checkInTime),
          checkOutDate: mergeDateTime(checkOut, checkOutTime),
          paymentMethod: paymentMethod || null,
          voucherNo: voucherNo || null,
          adults: partyAdults,
          agencyId: parties.agencyId,
          walkInProfileCode: sourceKind === 'WALKIN' ? walkInProfileCode || null : null,
          companyId: parties.companyId,
          sourceId: sourceId || null,
          partyBillingMode,
          roomTypeId: roomTypeId || undefined,
          ...(pendingRoomId === roomId ? {} : { roomId: pendingRoomId || null }),
          ...(doorChanged && moveReasonCode ? { moveReasonCode } : {}),
          ...(doorChanged && choice?.settlement ? { settlement: choice.settlement } : {}),
          mealPlanId: mealPlanId || null,
          roomCount: Number(roomCount) || 1,
          rateType: rateType || null,
          resNo: resNo || null,
          shareNo: shareNo || null,
          shareEligible: shareEligible && Number(adults) === 1,
          optionDate: optionDate ? new Date(optionDate).toISOString() : null,
          optionState: optionState || null,
          linenEveryNights: (() => {
            const n = Number(linenEveryNights);
            return linenEveryNights.trim() === '' || !Number.isFinite(n) ? null : n;
          })(),
          deepEveryNights: (() => {
            const n = Number(deepEveryNights);
            return deepEveryNights.trim() === '' || !Number.isFinite(n) ? null : n;
          })(),
          salesProject: salesProject || null,
          specialStates: specialStates || null,
          resGroup: resGroup || null,
          colorCode: colorCode || null,
          preferredLocation: preferredLocation || null,
          preferredBed: preferredBed || null,
          givenRoomTypeId: givenRoomTypeId || null,
          salesContractId: salesContractId || null,
          roomPayer,
          commissionBasis,
          creditLimitAzn:
            creditLimitAzn.trim() === '' ? null : Math.round(Number(creditLimitAzn) * 100) / 100,
          useManualRate,
          manualDailyRate: manualDailyRate ? Number(manualDailyRate) : null,
          discountPercent: discountPercent === '' ? null : Number(discountPercent),
          discountActive: Number(discountPercent) > 0,
          children11_6: partyC11,
          children5_2: partyC5,
          children1_0: partyC1,
          market: market || null,
          segment: segment || null,
          ratePlanId: ratePlanId || undefined,
          booker: booker || null,
          guestRep: guestRep || null,
          paidBy: paidBy || null,
          vipType: vipType || null,
          accomType: accomType || null,
          billingMode,
          recordType: recordType || null,
          tripReason: tripReason || null,
          notes,
          dailyRates: dailyRates.map((d) => ({
            stayDate: d.stayDate,
            amount: d.amount,
            tariffAmount: d.tariffAmount ?? null,
            manualFlag: d.manualFlag,
            currencyCode: d.currencyCode ?? 'AZN',
            fixPrice: d.fixPrice ?? false,
            discountPct: d.discountPct ?? null,
          })),
          paxGuests: party.map((p) => ({
            id: p.id,
            guestId: p.guestId || null,
            title: p.title || null,
            sex: p.sex || null,
            middleName: p.middleName || null,
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
            departedAt: p.departedAt || null,
            isPrimary: p.isPrimary,
            ownsFolio: p.ownsFolio ?? false,
            medicalPackageCode: p.medicalPackageCode?.trim()
              ? p.medicalPackageCode.trim().toUpperCase()
              : null,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json?.code === 'ROOM_TYPE_SETTLEMENT_REQUIRED') {
          setCardMoveAsk({ askReason: data?.status === 'IN_HOUSE', askSettlement: true });
          return;
        }
        const errText = String(json?.error ?? json?.code ?? '');
        if (
          errText === 'COMMERCIAL_AMEND_REQUIRED' ||
          json?.code === 'COMMERCIAL_AMEND_REQUIRED'
        ) {
          setCommercialAmendOpen(true);
          return;
        }
        if (errText === 'AGENCY_FOLIO_HAS_LINES' || json?.code === 'AGENCY_FOLIO_HAS_LINES') {
          showApiError({ error: t('agencyHasLinesToast') }, tc('failed'));
          return;
        }
        if (errText === 'COMPANY_FOLIO_HAS_LINES' || json?.code === 'COMPANY_FOLIO_HAS_LINES') {
          showApiError({ error: t('companyHasLinesToast') }, tc('failed'));
          return;
        }
        if (errText === 'CONTRACT_REQUIRED_FOR_PAYER' || json?.code === 'CONTRACT_REQUIRED_FOR_PAYER') {
          showApiError({ error: t('contractRequiredToast') }, tc('failed'));
          return;
        }
        if (errText === 'AGENCY_REQUIRED_FOR_PAYER' || json?.code === 'AGENCY_REQUIRED_FOR_PAYER') {
          showApiError({ error: t('agencyRequiredForPayerToast') }, tc('failed'));
          return;
        }
        if (errText === 'COMPANY_REQUIRED_FOR_PAYER' || json?.code === 'COMPANY_REQUIRED_FOR_PAYER') {
          showApiError({ error: t('companyRequiredForPayerToast') }, tc('failed'));
          return;
        }
        reportApiError(json, tc('failed'));
        return;
      }
      showSuccess(json.movePending ? t('splitStayPlanned') : tc('success'));
      if (isPreArrivalStatus(String(json.status ?? ''))) {
        warnOperationalGaps(json.operationalGaps, t);
      }
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
  const physicalRoomTypeId = (givenRoomTypeId || roomTypeId).trim();
  const assignedDoor = rooms.find((r) => r.id === roomId);
  const assignedMatchesPhysical =
    !roomId ||
    !physicalRoomTypeId ||
    !assignedDoor?.roomTypeId ||
    assignedDoor.roomTypeId === physicalRoomTypeId;
  const doorPendingDirty = Boolean(pendingRoomId && pendingRoomId !== roomId);
  const arrivalReached = Boolean(checkIn) && checkIn <= todayBakuYmd();
  const canCheckIn =
    status === 'CONFIRMED' &&
    Boolean(roomId) &&
    !doorPendingDirty &&
    assignedMatchesPhysical &&
    !namesIncomplete &&
    arrivalReached;
  /** Physical room / times: arrival stage or room already assigned (not on create booking). */
  const showAssignment =
    !isCreate &&
    (Boolean(pendingRoomId || roomId) ||
      status === 'CONFIRMED' ||
      status === 'IN_HOUSE' ||
      status === 'CHECKED_OUT');

  function doorBlockLabel(block: DoorBlock): string {
    if (block.code === 'OOS') return t('doorBlockedOos');
    if (block.code === 'OOO') return t('doorBlockedOoo');
    if (block.code === 'OCCUPIED') return t('doorBlockedOccupied');
    if (block.code === 'BOOKED') return t('doorBlockedBooked');
    if (block.code === 'DIRTY') return t('doorBlockedDirty');
    return t('doorBlockedWrongType', { door: block.doorType ?? '—', need: block.needType ?? '—' });
  }

  const assignableRooms = useMemo(() => {
    const typeId = physicalRoomTypeId;
    const needCode =
      rooms.find((r) => r.roomTypeId === typeId)?.roomType?.code ??
      roomTypes.find((rt) => rt.id === typeId)?.label?.split('—')[0]?.trim();
    const today = todayBakuYmd();
    const ci = status === 'IN_HOUSE' && checkIn && checkIn < today ? today : checkIn;
    const co = checkOut;
    return rooms.map((r) => {
      const overlapping = (r.reservations ?? []).filter((res) => {
        if (reservationId && res.id === reservationId) return false;
        if (!['CONFIRMED', 'IN_HOUSE', 'OPTION'].includes(res.status)) return false;
        if (!ci || !co) return false;
        const a = res.checkInDate.slice(0, 10);
        const b = res.checkOutDate.slice(0, 10);
        return a < co && b > ci;
      });
      const canShare =
        overlapping.length === 0 ||
        canJoinOccupiedDoor({
          candidate: {
            shareEligible,
            adults: Math.max(0, Number(adults) || 0),
            gender: guestGender || null,
          },
          overlapping: overlapping.map((res) => ({
            shareEligible: res.shareEligible,
            shareGender: res.shareGender ?? res.guest?.sex ?? null,
            adults: res.adults,
          })),
          maxBed: r.maxBed ?? r.roomType?.adultCapacity ?? 2,
        });
      const held = overlapping.length > 0 && !canShare;
      const inHouseHold = held && overlapping.some((res) => res.status === 'IN_HOUSE');
      const block = doorAssignBlock(
        {
          id: r.id,
          roomNumber: r.roomNumber,
          roomTypeId: r.roomTypeId,
          roomTypeCode: r.roomType?.code,
          status: r.status,
          hkCondition: r.hkCondition,
          inventoryStatus: r.inventoryStatus,
        },
        {
          needTypeId: typeId,
          needTypeCode: needCode,
          inHouse: status === 'IN_HOUSE',
          occupied: inHouseHold,
          booked: held && !inHouseHold,
          currentAssignedId: roomId,
        },
      );
      return {
        ...r,
        disabled: Boolean(block),
        roomNumber: block ? `${r.roomNumber} · ${doorBlockLabel(block)}` : r.roomNumber,
      };
    });
  }, [
    rooms,
    physicalRoomTypeId,
    roomTypes,
    checkIn,
    checkOut,
    reservationId,
    roomId,
    shareEligible,
    adults,
    guestGender,
    status,
    t,
  ]);

  /** Drop pending door when physical category no longer matches. */
  useEffect(() => {
    if (!physicalRoomTypeId || !pendingRoomId) return;
    const door = rooms.find((r) => r.id === pendingRoomId);
    if (door?.roomTypeId && door.roomTypeId !== physicalRoomTypeId) {
      setPendingRoomId('');
    }
  }, [physicalRoomTypeId, pendingRoomId, rooms]);

  /** Badge follows the door in the dropdown, not only the already-assigned room. */
  const selectedRoomStatus = useMemo(() => {
    const id = pendingRoomId || roomId;
    if (!id) return roomStatus;
    return rooms.find((r) => r.id === id)?.status ?? roomStatus;
  }, [pendingRoomId, roomId, rooms, roomStatus]);

  const selectedRoomHkCondition = useMemo(() => {
    const id = pendingRoomId || roomId;
    if (!id) return roomHkCondition;
    return rooms.find((r) => r.id === id)?.hkCondition ?? roomHkCondition;
  }, [pendingRoomId, roomId, rooms, roomHkCondition]);

  const occupancyWorld = useMemo(() => {
    if (shareEligible) return 'share' as const;
    if (bookingGroupId && siblingStays.length > 1) return 'booking' as const;
    return 'exclusive' as const;
  }, [shareEligible, bookingGroupId, siblingStays.length]);

  const folios = (data?.folios as FolioAccount[] | undefined) ?? [];

  const stayPair = stayMoneyPair(
    folios.flatMap((folio) => folio.charges),
    folios.flatMap((folio) => folio.payments ?? []),
  );
  const guestFolioBalance = stayPair.debt;

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
        reportApiError(json, tc('failed'));
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  const noteCount = Object.values(notes).filter((v) => v.trim()).length;

  const cardTitle = isCreate
    ? tb('reservationCardTitle')
    : `${guest?.fullName?.trim() || tb('reservationCardTitle')}${vipType ? ` · VIP` : ''}`;

  const cardSubtitle = isCreate
    ? t('newReservation')
    : [
        status ? tRes(status as 'CONFIRMED') : null,
        reservationId ? reservationId.slice(0, 8) : null,
        namesIncomplete ? tb('namesIncompleteBadge') : null,
      ]
        .filter(Boolean)
        .join(' · ');

  const stayActionKind = isCreate
    ? null
    : stayActionForPlane(
        resolveStayWindowPlane({ checkIn, checkOut, status, todayKey: todayBakuYmd() }),
      );
  const stayActionLabel =
    stayActionKind === 'earlyCheckIn'
      ? t('earlyCheckIn')
      : stayActionKind === 'checkIn'
        ? t('confirmCheckIn')
        : stayActionKind === 'earlyCheckOut'
          ? t('earlyCheckOut')
          : stayActionKind === 'checkOut'
            ? t('confirmCheckOut')
            : undefined;

  async function saveWithCommercialAmend(mode: 'NEXT_NIGHTS' | 'MOVE_POSTED') {
    if (!reservationId) return;
    if (mode === 'MOVE_POSTED' && !commercialAmendReason.trim()) {
      showApiError({ error: t('moveReasonRequired') }, tc('failed'));
      return;
    }
    setCommercialAmendBusy(true);
    try {
      const res = await fetch(`/api/reservations/${reservationId}/full`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomPayer,
          commissionBasis,
          agencyId: agencyId || null,
          companyId: companyId || null,
          salesContractId: salesContractId || null,
          commercialAmendMode: mode,
          commercialAmendReason: commercialAmendReason.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        reportApiError(json, tc('failed'));
        return;
      }
      setCommercialAmendOpen(false);
      setCommercialAmendReason('');
      showSuccess(tc('success'));
      applyJson(json);
    } finally {
      setCommercialAmendBusy(false);
    }
  }

  const actionProps = {
    busy,
    loading,
    isLocked,
    showLock: true,
    canCheckIn: !isCreate && status === 'CONFIRMED',
    stayActionLabel,
    onStayAction: stayActionKind ? requestStayAction : undefined,
    onClose,
    onToggleLock: isCreate ? undefined : () => void toggleLock(),
    voidKind:
      can(PERMISSIONS.RESERVATIONS_CANCEL)
        ? preArrivalVoidKind({ checkIn, status, todayKey: todayBakuYmd() })
        : null,
    onVoidStay: (kind: 'cancel' | 'noShow') => void voidStay(kind),
    onRestore:
      status === 'CANCELLED'
        ? () => {
            setRestoreTypeId(roomTypeId);
            setRestoreRoomId(roomId);
            setRestoreOpen(true);
          }
        : undefined,
    onSave: () => void save(),
    onConfirmCheckIn: isCreate ? undefined : () => void confirmCheckIn(),
    onHistory: reservationId ? () => setHistoryOpen(true) : undefined,
    attachOpen,
    onAttachToggle: reservationId ? () => setAttachOpen((o) => !o) : undefined,
    onRecalc: isCreate ? undefined : () => void recalcPricing(),
    onAmendProduct: isCreate ? undefined : () => setAmendOpen(true),
    onPrintForm: isCreate ? undefined : printStayForm,
    onUndoCheckout: status === 'CHECKED_OUT' ? () => setUndoCheckoutOpen(true) : undefined,
    onDeleteStay:
      !isCreate &&
      (status === 'OPTION' || status === 'CONFIRMED' || status === 'CHECKED_OUT') &&
      can(PERMISSIONS.RESERVATIONS_CANCEL)
        ? () => setDeleteOpen(true)
        : undefined,
  };

  const body = (
    <>
      <EraModal
        open={commercialAmendOpen}
        title={t('changeRoomPayerTitle')}
        onClose={() => {
          if (commercialAmendBusy) return;
          setCommercialAmendOpen(false);
          setCommercialAmendReason('');
        }}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              disabled={commercialAmendBusy}
              onClick={() => {
                setCommercialAmendOpen(false);
                setCommercialAmendReason('');
              }}
            >
              {tc('cancel')}
            </button>
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              disabled={commercialAmendBusy}
              onClick={() => void saveWithCommercialAmend('NEXT_NIGHTS')}
            >
              {t('nextNightsOnly')}
            </button>
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              disabled={commercialAmendBusy}
              onClick={() => void saveWithCommercialAmend('MOVE_POSTED')}
            >
              {t('alsoMovePosted')}
            </button>
          </div>
        }
      >
        <div className="space-y-3 text-[13px] text-[#34495E]">
          <p className="m-0">
            {t('changeRoomPayerBody', {
              date: todayBakuYmd(),
              summary: billingRoutingSummary,
            })}
          </p>
          <FieldTextarea
            label={t('moveReasonLabel')}
            value={commercialAmendReason}
            onChange={(e) => setCommercialAmendReason(e.target.value)}
            rows={3}
          />
        </div>
      </EraModal>
      {attachOpen && reservationId ? (
        <ReservationCardAttachPanel
          attachments={attachments}
          busy={busy}
          onUpload={(f) => void uploadAttachment(f)}
          onRefresh={() => void load()}
        />
      ) : null}

      {!isCreate ? (
        <div ref={staysBarRef}>
          <ReservationCardStaysBar
            bookingCode={bookingCode}
            bookingName={bookingName}
            stays={siblingStays}
            activeStayId={reservationId}
            onSelectStay={(id) => onReservationCreated?.(id)}
            onSaveBookingName={bookingGroupId ? (name) => void saveBookingName(name) : undefined}
            nameDisabled={busy || isLocked}
          />
          <ReservationNoteLine
            className="my-1 rounded-md border border-[#D5DADF] bg-white px-2.5 py-1 text-[12px] leading-5 text-[#34495E]"
            notes={Object.entries(notes).map(([noteType, text]) => ({ noteType, text }))}
          />
        </div>
      ) : null}

      <EraModal
        open={Boolean(pendingStayAction)}
        title={
          pendingStayAction === 'earlyCheckIn'
            ? t('earlyCheckIn')
            : pendingStayAction === 'checkIn'
              ? t('confirmCheckIn')
              : pendingStayAction === 'earlyCheckOut'
                ? t('earlyCheckOut')
                : t('confirmCheckOut')
        }
        onClose={() => setPendingStayAction(null)}
        footer={
          <EraModalFooter
            onCancel={() => setPendingStayAction(null)}
            onSubmit={() => {
              const kind = pendingStayAction;
              if (kind === 'earlyCheckIn') void confirmCheckIn(true);
              else if (kind === 'checkIn') void confirmCheckIn(false);
              else {
                setPendingStayAction(null);
                setCheckoutModalOpen(true);
              }
            }}
            busy={busy}
            submitLabel={stayActionLabel}
          />
        }
      >
        <div className="space-y-2 text-[13px] text-[#34495E]">
          <p className="m-0">
            {pendingStayAction === 'earlyCheckIn'
              ? t('stayActionEarlyIn', {
                  days: String(hotelStayDayGap(checkIn, todayBakuYmd())),
                })
              : pendingStayAction === 'earlyCheckOut'
                ? t('stayActionEarlyOut', {
                    days: String(hotelStayDayGap(checkOut, todayBakuYmd())),
                  })
                : pendingStayAction === 'checkOut'
                  ? t('stayActionCheckOut')
                  : pendingStayAction === 'checkIn' &&
                      checkIn < (pricingBusinessDate ?? todayBakuYmd())
                    ? t('stayActionLateIn', { date: pricingBusinessDate ?? todayBakuYmd() })
                    : checkInTime < '14:00'
                      ? t('stayActionEarlyHour')
                      : t('stayActionCheckIn')}
          </p>
          {earlyCheckoutPreview?.unusedNights ? (
            <p className="m-0">{t('earlyStayCheckoutUnused', { nights: earlyCheckoutPreview.unusedNights })}</p>
          ) : null}
          {guestFolioBalance > 0.01 &&
          (pendingStayAction === 'earlyCheckOut' || pendingStayAction === 'checkOut') ? (
            <p className={`m-0 ${TEXT_DANGER_CLASS}`}>{t('earlyStayCheckoutFolioHint')}</p>
          ) : null}
        </div>
      </EraModal>

      {namesIncomplete ? (
        <div className="mb-3 shrink-0 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-950">
          {tb('namesIncomplete')}
        </div>
      ) : null}

      {loading && !isCreate ? (
        <p className="py-8 text-center text-[13px] text-[#7F8C8D]">{tc('loading')}</p>
      ) : (
        <>
          <ReservationCardHeaderSnapshot
            isCreate={isCreate}
            totalAmount={Number(data?.totalAmount ?? 0)}
            unusedAmount={stayPair.unused}
            folioBalance={stayPair.debt}
            occupancyWorld={occupancyWorld}
            bookingRoomCount={siblingStays.length || undefined}
            onOccupancyClick={
              occupancyWorld === 'booking'
                ? () =>
                    staysBarRef.current?.scrollIntoView({
                      behavior: 'smooth',
                      block: 'nearest',
                    })
                : undefined
            }
          />
          <div className="grid min-h-0 flex-1 gap-3 overflow-hidden lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <ReservationCardLeftPanel
            isCreate={isCreate}
            isLocked={isLocked}
            showAssignment={showAssignment}
            showRoomSelect
            sellable={isCreate ? sellable : null}
            agencies={agencies}
            walkInProfileCode={walkInProfileCode}
            walkInProfiles={walkInProfiles}
            staySlices={
              Array.isArray(data?.staySlices)
                ? (data.staySlices as Array<{
                    id: string;
                    fromDate: string;
                    toDate: string;
                    roomType?: { code?: string } | null;
                    room?: { roomNumber?: string } | null;
                  }>).map((slice) => ({
                    id: slice.id,
                    fromDate: slice.fromDate,
                    toDate: slice.toDate,
                    roomTypeCode: slice.roomType?.code ?? null,
                    roomNumber: slice.room?.roomNumber ?? null,
                  }))
                : []
            }
            splitDoors={rooms}
            splitBusy={busy}
            onSplitStay={
              status === 'CONFIRMED' || status === 'OPTION' || status === 'IN_HOUSE'
                ? (input) => void splitStay(input)
                : undefined
            }
            companies={companies}
            sources={sources}
            salesContracts={salesContracts}
            onAgencyCreated={(row) =>
              setAgencies((prev) => (prev.some((a) => a.id === row.id) ? prev : [...prev, row]))
            }
            onCompanyCreated={(row) =>
              setCompanies((prev) => (prev.some((c) => c.id === row.id) ? prev : [...prev, row]))
            }
            roomTypes={roomTypes}
            mealPlans={mealPlans}
            ratePlans={ratePlans}
            rooms={assignableRooms}
            onChange={onLeftChange}
            onFocusRoomSelect={() =>
              document.getElementById('res-card-room-select')?.focus()
            }
            onToggleLock={showAssignment ? () => void toggleLock() : undefined}
            roomStatus={selectedRoomStatus}
            roomHkCondition={selectedRoomHkCondition}
            doorPhysicalMismatch={!assignedMatchesPhysical}
            assignedRoomLabel={assignedDoor?.roomNumber}
            roomChanges={
              Array.isArray(data?.roomChanges)
                ? (data.roomChanges as Array<{
                    id: string;
                    effectiveAt: string;
                    fromRoom?: { roomNumber: string } | null;
                    toRoom?: { roomNumber: string } | null;
                    reasonCode?: string | null;
                    notes?: string | null;
                  }>)
                : []
            }
            onClassSettlement={(action) => {
              const givenNightly = nightlyForChargedType(
                ratePlans,
                ratePlanId,
                givenRoomTypeId,
                adults,
                checkIn,
              );
              const note =
                action === 'HOTEL'
                  ? t('classHotelCoversNote')
                  : action === 'GUEST_PAY'
                    ? t('classGuestPaysNote')
                    : action === 'HOTEL_REFUND'
                      ? t('classHotelRefundNote')
                      : t('classGuestCheaperNote');
              if (action !== 'HOTEL' && givenRoomTypeId) {
                setRoomTypeId(givenRoomTypeId);
                setGivenRoomTypeId('');
                if (givenNightly != null && givenNightly > 0) {
                  const today = todayBakuYmd();
                  setUseManualRate(true);
                  setManualDailyRate(String(givenNightly));
                  setDailyRates((rows) =>
                    rows.map((d) =>
                      d.fixPrice || d.stayDate < today
                        ? d
                        : { ...d, amount: givenNightly, manualFlag: true, fixPrice: true },
                    ),
                  );
                }
              }
              setNotes((prev) => {
                const existing = prev.PRICE_NOTE ?? '';
                if (existing.includes(note)) return prev;
                return {
                  ...prev,
                  PRICE_NOTE: [existing, note].filter(Boolean).join('\n'),
                };
              });
            }}
            reservationId={reservationId}
            folioBalance={stayPair.debt}
            unusedAmount={stayPair.unused}
            billingRoutingSummary={billingRoutingSummary}
            stayStatus={status}
            earlyStayCheckoutBusy={busy}
            onStayAction={isCreate ? undefined : requestStayAction}
            onFolioRouting={
              !isCreate ? () => openSubModal('folioRouting') : undefined
            }
            onPackageRoomGap={(mode) => {
              const soldPrice =
                nightlyForChargedType(ratePlans, ratePlanId, roomTypeId, adults, checkIn) ?? 0;
              const peerPrice =
                nightlyForChargedType(ratePlans, ratePlanId, givenRoomTypeId, adults, checkIn) ??
                soldPrice;
              if (mode === 'COMP') {
                setNotes((prev) => ({
                  ...prev,
                  PRICE_NOTE: [prev.PRICE_NOTE, t('packageGapComp')].filter(Boolean).join('\n'),
                }));
                return;
              }
              const nightly = mode === 'CHARGE' ? Math.max(soldPrice, peerPrice) : Math.min(soldPrice, peerPrice);
              if (nightly > 0) {
                const today = todayBakuYmd();
                setUseManualRate(true);
                setManualDailyRate(String(nightly));
                setDailyRates((rows) =>
                  rows.map((d) =>
                    d.fixPrice || d.stayDate < today
                      ? d
                      : { ...d, amount: nightly, manualFlag: true, fixPrice: true },
                  ),
                );
              }
              const gapLabel = mode === 'CHARGE' ? t('packageGapCharge') : t('packageGapRefund');
              setNotes((prev) => ({
                ...prev,
                PRICE_NOTE: [prev.PRICE_NOTE, `${gapLabel}: ${nightly} AZN`].filter(Boolean).join('\n'),
              }));
            }}
            onBreakShare={
              !isCreate && shareEligible
                ? () => void breakShare()
                : undefined
            }
            breakShareBusy={busy}
            {...leftPatch}
            priceNote={notes.PRICE_NOTE ?? ''}
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

            <div
              className={
                tab === 'pricing' || tab === 'folio'
                  ? 'flex min-h-0 flex-1 flex-col overflow-hidden pb-2'
                  : 'min-h-0 flex-1 overflow-y-auto pb-2'
              }
            >
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
                  preferredBed={preferredBed}
                  preferredLocation={preferredLocation}
                  voucherNo={voucherNo}
                  allergenCount={allergenCount}
                  vipType={vipType}
                  tripReason={tripReason}
                  onVipType={setVipType}
                  onTripReason={setTripReason}
                  partyOpsEnabled={!isCreate && status === 'IN_HOUSE'}
                  onDepartGuest={(idx) => setDepartPaxIdx(idx)}
                  onMoveGuest={
                    siblingStays.length > 1 ? (idx) => setMovePaxIdx(idx) : undefined
                  }
                  onOpenGuestCard={(id) => {
                    setGuestCardId(id);
                    setGuestCardOpenIdReader(false);
                    setGuestCardOpen(true);
                  }}
                  onScanId={(id, index) => {
                    setScanPaxIndex(index ?? null);
                    setGuestCardId(id);
                    setGuestCardOpenIdReader(true);
                    setGuestCardOpen(true);
                  }}
                  onNewGuest={(index) => {
                    setScanPaxIndex(index);
                    setGuestCardId(null);
                    setGuestCardOpenIdReader(false);
                    setGuestCardOpen(true);
                  }}
                  packageOptions={medicalPackageChoices(ratePlans)}
                  showMedicalPackages={ratePlanRequiresGuestPackage({
                    code: ratePlans.find((row) => row.id === ratePlanId)?.code,
                    medicalFlag: ratePlans.find((row) => row.id === ratePlanId)?.medicalFlag,
                  })}
                />
              )}

              {tab === 'pricing' && (
                <ReservationCardPricingTab
                  isCreate={isCreate}
                  quoteText={quoteText}
                  dailyRates={dailyRates}
                  manualDailyRate={manualDailyRate}
                  discountPercent={discountPercent}
                  busy={busy}
                  isLocked={isLocked}
                  packageCompose={packageCompose}
                  tariffNightly={(() => {
                    const plan = ratePlans.find((item) => item.id === ratePlanId);
                    if (plan?.medicalFlag) {
                      return nightlyForChargedType(ratePlans, ratePlanId, roomTypeId, adults, checkIn);
                    }
                    return plan?.pricePerNight ?? null;
                  })()}
                  businessDate={pricingBusinessDate}
                  postedDates={folios.flatMap((folio) =>
                    folio.charges
                      .map((charge) => {
                        const description = charge.description ?? '';
                        const noted = parseRoomChargeNote(description);
                        if (noted?.date) return noted.date;
                        const packageNight = parsePackageNight(description);
                        if (packageNight) return packageNight;
                        if (
                          !revenueRoleIn(
                            { systemRole: charge.revenueCode?.systemRole ?? null },
                            STAY_NIGHT_ROLES,
                          )
                        ) {
                          return '';
                        }
                        return charge.businessDate ? hotelDateKey(charge.businessDate) : '';
                      })
                      .filter(Boolean),
                  )}
                  onPostNight={
                    status === 'OPTION' || status === 'CONFIRMED' || status === 'IN_HOUSE'
                      ? (ymd) => void postOneNight(ymd)
                      : undefined
                  }
                  onPostMissed={
                    status === 'OPTION' || status === 'CONFIRMED' || status === 'IN_HOUSE'
                      ? () => void postMissedNights()
                      : undefined
                  }
                  onDailyRates={setDailyRates}
                  onManualRate={setManualDailyRate}
                  onDiscountPercent={setDiscountPercent}
                  onUseManual={setUseManualRate}
                />
              )}

              {tab === 'folio' &&
                (reservationId ? (
                  <ReservationCardFolioTab
                    reservationId={reservationId}
                    folioTab={folioTab}
                    accounts={folios}
                    pax={pax}
                    displayCurrency={pricingDisplayCurrency}
                    canPostCharges={status === 'OPTION' || status === 'CONFIRMED' || status === 'IN_HOUSE'}
                    hasAgency={Boolean(agencyId)}
                    hasCompany={Boolean(companyId)}
                    fiscalDocuments={
                      (data?.fiscalDocuments as Array<{
                        id: string;
                        invoiceNumber?: string | null;
                        fiscalStatus: string;
                        rejectionReason?: string | null;
                      }>) ?? []
                    }
                    onFolioTab={setFolioTab}
                    onChanged={() => void load()}
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
        </>
      )}
    </>
  );

  const extras = (
    <>
      <ReservationCardSubModals {...subModalProps} />
      <DepartGuestModal
        open={departPaxIdx != null}
        guestLabel={
          departPaxIdx != null
            ? [pax[departPaxIdx]?.firstName, pax[departPaxIdx]?.lastName]
                .filter(Boolean)
                .join(' ') || t('departGuest')
            : ''
        }
        busy={busy}
        ownsFolio={Boolean(departPaxIdx != null && pax[departPaxIdx]?.ownsFolio)}
        occupancyPreview={departOccupancyPreview}
        onClose={() => setDepartPaxIdx(null)}
        onConfirm={(input) => {
          const row = departPaxIdx != null ? pax[departPaxIdx] : null;
          if (!reservationId || !row?.id) return;
          setBusy(true);
          void fetch(`/api/reservations/${reservationId}/pax/${row.id}/depart`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
          })
            .then(async (res) => {
              const json = await res.json();
              if (!res.ok) {
                reportApiError(json, tc('failed'));
                return;
              }
              const payload = (json.data ?? json) as {
                kind?: string;
                folioPath?: string;
              };
              if (payload.kind === 'needs_checkout') {
                showSuccess(t('departNeedsCheckout'));
                setDepartPaxIdx(null);
                window.location.assign(payload.folioPath ?? `/folio/${reservationId}`);
                return;
              }
              showSuccess(t('departGuestDone'));
              setDepartPaxIdx(null);
              await load();
            })
            .finally(() => setBusy(false));
        }}
      />
      <MoveGuestModal
        open={movePaxIdx != null}
        guestLabel={
          movePaxIdx != null
            ? [pax[movePaxIdx]?.firstName, pax[movePaxIdx]?.lastName]
                .filter(Boolean)
                .join(' ') || t('moveGuest')
            : ''
        }
        siblings={siblingStays
          .filter((s) => s.id !== reservationId)
          .map((s) => ({
            id: s.id,
            label: `${s.room?.roomNumber ? `№${s.room.roomNumber}` : s.roomType.code} · ${s.guest.fullName}`,
          }))}
        busy={busy}
        onClose={() => setMovePaxIdx(null)}
        onConfirm={(input) => {
          const row = movePaxIdx != null ? pax[movePaxIdx] : null;
          if (!reservationId || !row?.id) return;
          setBusy(true);
          void fetch(`/api/reservations/${reservationId}/pax/${row.id}/move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
          })
            .then(async (res) => {
              const json = await res.json();
              if (!res.ok) {
                reportApiError(json, tc('failed'));
                return;
              }
              showSuccess(t('moveGuestDone'));
              setMovePaxIdx(null);
              const toId = (json.data ?? json)?.toReservationId as string | undefined;
              if (toId && onReservationCreated) {
                onReservationCreated(toId);
              } else {
                await load();
              }
            })
            .finally(() => setBusy(false));
        }}
      />
      <RoomMoveReasonModal
        open={movePromptOpen}
        busy={busy}
        onClose={() => setMovePromptOpen(false)}
        onConfirm={(reason) => {
          setMovePromptOpen(false);
          void save({ reason });
        }}
      />
      <RoomMoveConfirmModal
        open={Boolean(cardMoveAsk)}
        busy={busy}
        askReason={Boolean(cardMoveAsk?.askReason)}
        askSettlement={Boolean(cardMoveAsk?.askSettlement)}
        onClose={() => setCardMoveAsk(null)}
        onConfirm={(choice) => {
          setCardMoveAsk(null);
          void save(choice);
        }}
      />
      <RoomMoveConfirmModal
        open={Boolean(splitMoveAsk)}
        busy={busy}
        askReason={Boolean(splitMoveAsk?.askReason)}
        askSettlement={Boolean(splitMoveAsk?.askSettlement)}
        onClose={() => setSplitMoveAsk(null)}
        onConfirm={(choice) => {
          const ask = splitMoveAsk;
          setSplitMoveAsk(null);
          if (!ask) return;
          void splitStay(
            { fromDate: ask.fromDate, roomTypeId: ask.roomTypeId, roomId: ask.roomId },
            { reasonCode: choice.reason, settlement: choice.settlement },
          );
        }}
      />
      <StayAmendmentModal
        open={amendOpen}
        reservationId={reservationId}
        roomTypes={roomTypes}
        ratePlans={ratePlans}
        defaultRoomTypeId={roomTypeId}
        defaultRatePlanId={ratePlanId}
        onClose={() => setAmendOpen(false)}
        onApplied={() => void load()}
      />
      <GuestCardModal
        open={guestCardOpen}
        guestId={guestCardId}
        openIdReaderOnOpen={guestCardOpenIdReader}
        onClose={() => {
          setGuestCardOpen(false);
          setGuestCardOpenIdReader(false);
          setGuestCardId(null);
        }}
        onSaved={() => {
          void loadGuests();
          void load();
        }}
        onCreated={(id, meta) => {
          const firstName = meta?.firstName ?? '';
          const lastName = meta?.lastName ?? '';
          const fromFull = meta?.fullName ? meta.fullName.trim().split(/\s+/).filter(Boolean) : [];
          const fn = firstName || fromFull[0] || '';
          const ln = lastName || (fromFull.length > 1 ? fromFull.slice(1).join(' ') : '');
          void loadGuests();
          setGuestCardId(id);
          setGuestCardOpen(true);
          const target = scanPaxIndex;
          setScanPaxIndex(null);
          if (
            target != null &&
            pax[target] &&
            meta?.birthDate &&
            !guestFitsSlot(meta.birthDate, pax[target])
          ) {
            showWarning(t('guestAgeMismatch'));
            return;
          }
          if (target != null && pax[target]) {
            const filled: PaxRow = {
              ...pax[target],
              guestId: id,
              firstName: fn || pax[target].firstName,
              lastName: ln || pax[target].lastName,
              birthDate: meta?.birthDate || pax[target].birthDate,
              age: meta?.birthDate ? ageYearsFromBirthDate(meta.birthDate) : pax[target].age,
            };
            if (filled.isPrimary || !guestId) setGuestId(id);
            applyPaxChange(pax.map((row, i) => (i === target ? filled : row)));
            return;
          }
          const attached = attachGuestToPax(
            pax,
            { id, firstName: fn, lastName: ln, birthDate: meta?.birthDate },
            {
              equalMode: partyBillingMode === 'EQUAL',
              reservationGuestId: guestId,
            },
          );
          setGuestId(attached.guestId);
          applyPaxChange(attached.pax);
        }}
      />
      {reservationId ? (
        <FolioCheckoutModal
          open={checkoutModalOpen}
          reservationId={reservationId}
          onClose={() => setCheckoutModalOpen(false)}
          onDone={() => void load()}
        />
      ) : null}
      <EraModal
        open={historyOpen}
        title={t('stayJournal')}
        onClose={() => setHistoryOpen(false)}
        maxWidthClass={`${MODAL_FULL_CLASS} overflow-hidden flex flex-col`}
        bodyClassName="mt-3 min-h-0 flex-1 overflow-hidden flex flex-col"
      >
        <StayJournal
          entries={stayAudit}
          loading={stayAuditStatus === 'loading'}
          error={stayAuditStatus === 'error'}
        />
      </EraModal>
      <EraModal
        open={cancelOpen}
        title={t('cancelReasonTitle')}
        onClose={() => setCancelOpen(false)}
        maxWidthClass="max-w-md"
        footer={
          <EraModalFooter
            onCancel={() => setCancelOpen(false)}
            busy={busy}
            submitDisabled={!cancelReason.trim()}
            submitLabel={t('cancelStay')}
            onSubmit={() => void voidStay('cancel', cancelReason)}
          />
        }
      >
        <FieldTextarea
          label={t('cancelReason')}
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
          rows={3}
        />
      </EraModal>
      <EraModal
        open={undoCheckoutOpen}
        title={t('restoreStay')}
        onClose={() => setUndoCheckoutOpen(false)}
        maxWidthClass="max-w-md"
        footer={
          <EraModalFooter
            onCancel={() => setUndoCheckoutOpen(false)}
            busy={busy}
            submitDisabled={!undoReason.trim()}
            submitLabel={t('restoreStay')}
            onSubmit={() => void undoCheckoutStay()}
          />
        }
      >
        <FieldTextarea
          label={t('restoreReason')}
          value={undoReason}
          onChange={(e) => setUndoReason(e.target.value)}
          rows={3}
        />
      </EraModal>
      <EraModal
        open={deleteOpen}
        title={t('deleteStay')}
        onClose={() => setDeleteOpen(false)}
        maxWidthClass="max-w-md"
        footer={
          <EraModalFooter
            onCancel={() => setDeleteOpen(false)}
            busy={busy}
            submitDisabled={!deleteReason.trim()}
            submitLabel={t('deleteStay')}
            onSubmit={() => void deleteStay()}
          />
        }
      >
        <FieldTextarea
          label={t('deleteReason')}
          value={deleteReason}
          onChange={(e) => setDeleteReason(e.target.value)}
          rows={3}
        />
      </EraModal>
      <EraModal
        open={restoreOpen}
        title={t('restoreStay')}
        onClose={() => setRestoreOpen(false)}
        maxWidthClass="max-w-md"
        footer={
          <EraModalFooter
            onCancel={() => setRestoreOpen(false)}
            busy={busy}
            submitDisabled={!restoreTypeId}
            submitLabel={t('restoreStay')}
            onSubmit={() => void restoreStay()}
          />
        }
      >
        <div className="space-y-3">
          <p className="m-0 text-[13px] text-[#7F8C8D]">{t('restoreHint')}</p>
          <CatalogField
            kind="ENTITY_REF"
            label={t('roomType')}
            value={restoreTypeId}
            onChange={(v) => {
              setRestoreTypeId(String(v ?? ''));
              setRestoreRoomId('');
            }}
            options={roomTypes.map((row) => ({ value: row.id, label: row.label }))}
            emptyLabel={null}
          />
          <CatalogField
            kind="ENTITY_REF"
            label={t('roomNo')}
            value={restoreRoomId}
            onChange={(v) => setRestoreRoomId(String(v ?? ''))}
            options={rooms.map((r) => {
              const hits = (r.reservations ?? []).filter((res) => {
                if (reservationId && res.id === reservationId) return false;
                if (!['CONFIRMED', 'IN_HOUSE', 'OPTION'].includes(res.status)) return false;
                const a = res.checkInDate.slice(0, 10);
                const b = res.checkOutDate.slice(0, 10);
                return Boolean(checkIn && checkOut && a < checkOut && b > checkIn);
              });
              const inHouseHold = hits.some((res) => res.status === 'IN_HOUSE');
              const needCode =
                rooms.find((row) => row.roomTypeId === restoreTypeId)?.roomType?.code ??
                roomTypes.find((rt) => rt.id === restoreTypeId)?.label?.split('—')[0]?.trim();
              const block = doorAssignBlock(
                {
                  id: r.id,
                  roomNumber: r.roomNumber,
                  roomTypeId: r.roomTypeId,
                  roomTypeCode: r.roomType?.code,
                  status: r.status,
                  hkCondition: r.hkCondition,
                  inventoryStatus: r.inventoryStatus,
                },
                {
                  needTypeId: restoreTypeId,
                  needTypeCode: needCode,
                  inHouse: false,
                  occupied: inHouseHold,
                  booked: hits.length > 0 && !inHouseHold,
                },
              );
              return {
                value: r.id,
                label: block ? `${r.roomNumber} · ${doorBlockLabel(block)}` : r.roomNumber,
                disabled: Boolean(block),
              };
            })}
            emptyLabel="—"
          />
        </div>
      </EraModal>
      <EraModal
        open={notesAlertOpen}
        title={t('notesAlertTitle')}
        onClose={() => setNotesAlertOpen(false)}
        maxWidthClass="max-w-md"
      >
        <div className="space-y-2 text-[13px] text-[#34495E]" data-testid="notes-alert-popup">
          {allergenCount > 0 ? (
            <p className="m-0 rounded bg-amber-50 px-2 py-1 text-amber-950">
              {t('notesAlertAllergens', { count: allergenCount })}
            </p>
          ) : null}
          {(notes.CIN_NOTE ?? '').trim() ? (
            <p className="m-0 whitespace-pre-wrap">
              <strong>{t('noteType.CIN_NOTE')}:</strong> {notes.CIN_NOTE}
            </p>
          ) : null}
          {(notes.EXTRA_REQ ?? '').trim() ? (
            <p className="m-0 whitespace-pre-wrap">
              <strong>{t('noteType.EXTRA_REQ')}:</strong> {notes.EXTRA_REQ}
            </p>
          ) : null}
        </div>
      </EraModal>
    </>
  );

  if (layout === 'page') {
    if (!open) return null;
    return (
      <>
        <div className="flex max-h-[calc(100vh-6rem)] min-h-[480px] flex-col overflow-hidden">
          <ReservationCardToolbar subtitle={`${cardTitle}${cardSubtitle ? ` · ${cardSubtitle}` : ''}`} {...actionProps} />
          {body}
        </div>
        {extras}
      </>
    );
  }

  return (
    <>
      <EraModal
        open={open}
        title={cardTitle}
        subtitle={cardSubtitle}
        onClose={onClose}
        maxWidthClass={`${MODAL_FULL_CLASS} overflow-hidden flex flex-col`}
        bodyClassName="mt-3 min-h-0 flex-1 overflow-hidden flex flex-col"
        headerActions={<ReservationCardActions {...actionProps} mode="header" />}
        footer={<ReservationCardActions {...actionProps} mode="footer" />}
      >
        {body}
      </EraModal>
      {extras}
    </>
  );
}
