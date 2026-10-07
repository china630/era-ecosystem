'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Lock, PlaneLanding, PlaneTakeoff, Search } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import {
  DatePicker,
  CatalogField,
  Field,
  FieldPanel,
  FieldRow,
  FieldSection,
  FieldSelect,
  hotelTenderOptions,
  MODAL_CHECKBOX_CLASS,
  SECONDARY_BUTTON_CLASS,
  SUBSECTION_SURFACE_CLASS,
  TEXT_DANGER_CLASS,
  TEXT_MUTED_CLASS,
  TEXT_SUCCESS_CLASS,
} from '@era/satellite-kit/ui';
import { bakuDateTimeDisplay } from '@era/satellite-kit/time';
import { ReservationCardEarlyLatePanel } from '@/components/reservation-card/ReservationCardEarlyLatePanel';
import { CommercialPartyStrip } from '@/components/reservation-card/CommercialPartyStrip';
import { NightsCountField } from '@/components/reservation-card/NightsCountField';
import { useHotelLookupOptions, withOrphanOption } from '@/lib/hotel-lookups';
import { addHotelDays } from '@/lib/hotel-calendar';
import { resolveStayWindowPlane } from '@/lib/stay-window-plane';
import type { AgencyOption, RatePlanOption, SelectOption, SourceOption } from './types';

/** BAR (BASE) or unscoped plans apply to any room type; derived packages may be type-scoped. */
function ratePlanFitsRoomType(rp: RatePlanOption, roomTypeId: string): boolean {
  if (!roomTypeId) return true;
  if (rp.type === 'BASE' || !rp.roomTypeId) return true;
  return rp.roomTypeId === roomTypeId;
}

function nightlyForType(
  plans: RatePlanOption[],
  ratePlanId: string,
  typeId: string,
): number | null {
  const matches = plans.filter(
    (r) => r.roomTypeId === typeId && r.pricePerNight != null && r.pricePerNight > 0,
  );
  if (matches.length === 0 || !typeId) return null;
  const current = plans.find((r) => r.id === ratePlanId);
  const peer = matches.find((r) => Boolean(r.medicalFlag) === Boolean(current?.medicalFlag));
  return (peer ?? matches[0]).pricePerNight ?? null;
}

function moveReasonLabel(
  code: string | null | undefined,
  notes: string | null | undefined,
  t: (key: string) => string,
): string {
  const raw = (code ?? '').trim();
  const note = (notes ?? '').trim();
  if (raw === 'CARD_ASSIGN' || note === 'CARD_ASSIGN') return t('roomMoveReasonCard');
  if (raw === 'SWAP') return t('roomMoveReasonSwap');
  if (raw === 'RELOCATE') return t('roomMoveReasonRelocate');
  if (note) return note;
  return t('roomMoveReasonOther');
}

function RoomMoves({
  changes,
}: {
  changes?: Array<{
    id: string;
    effectiveAt: string;
    fromRoom?: { roomNumber: string } | null;
    toRoom?: { roomNumber: string } | null;
    reasonCode?: string | null;
    notes?: string | null;
  }>;
}) {
  const t = useTranslations('reservationCard');
  const rows = [...(changes ?? [])].sort((a, b) =>
    String(b.effectiveAt).localeCompare(String(a.effectiveAt)),
  );
  if (rows.length === 0) return null;
  return (
    <details className={`text-[12px] ${TEXT_MUTED_CLASS}`} data-testid="room-moves">
      <summary className="cursor-pointer font-semibold">{t('roomMoves')}</summary>
      <ul className="m-0 mt-1 list-none p-0">
        {rows.map((c) => (
          <li key={c.id}>
            {c.fromRoom?.roomNumber ?? '—'} → {c.toRoom?.roomNumber ?? '—'},{' '}
            {bakuDateTimeDisplay(c.effectiveAt)}, {moveReasonLabel(c.reasonCode, c.notes, t)}
          </li>
        ))}
      </ul>
    </details>
  );
}

function ClassSettlement({
  chargeLabel,
  givenLabel,
  chargedNightly,
  givenNightly,
  hotelCovers,
  disabled,
  onHotel,
  onGuestPays,
  onHotelRefund,
  onGuestCheaper,
}: {
  chargeLabel: string;
  givenLabel: string;
  chargedNightly: number | null;
  givenNightly: number | null;
  hotelCovers: boolean;
  disabled: boolean;
  onHotel: () => void;
  onGuestPays: () => void;
  onHotelRefund: () => void;
  onGuestCheaper: () => void;
}) {
  const t = useTranslations('reservationCard');
  const givenLower =
    chargedNightly != null && givenNightly != null && givenNightly < chargedNightly;
  return (
    <div
      className="space-y-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-950"
      data-testid="class-settlement"
    >
      <p className="m-0">
        {t('classDiffers', { charge: chargeLabel, physical: givenLabel })}
      </p>
      {hotelCovers ? (
        <p className="m-0 font-medium">{t('classHotelCovers')}</p>
      ) : givenLower ? (
        <div className="flex flex-wrap gap-1">
          <button type="button" className={SECONDARY_BUTTON_CLASS} disabled={disabled} onClick={onHotelRefund}>
            {t('classHotelRefund')}
          </button>
          <button type="button" className={SECONDARY_BUTTON_CLASS} disabled={disabled} onClick={onGuestCheaper}>
            {t('classGuestCheaper')}
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-1">
          <button type="button" className={SECONDARY_BUTTON_CLASS} disabled={disabled} onClick={onHotel}>
            {t('classHotelCovers')}
          </button>
          <button type="button" className={SECONDARY_BUTTON_CLASS} disabled={disabled} onClick={onGuestPays}>
            {t('classGuestPays')}
          </button>
        </div>
      )}
    </div>
  );
}

function nightsBetween(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0;
  const a = new Date(checkIn);
  const b = new Date(checkOut);
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000));
}

/** One plane: arrival (red landing), departure (red takeoff), or IN_HOUSE mid-stay early checkout (yellow takeoff). */
function StayDateFlightIcons({
  checkIn,
  checkOut,
  status,
  canEarlyStayCheckout,
  earlyStayCheckoutBusy,
  onEarlyStayCheckout,
}: {
  checkIn: string;
  checkOut: string;
  status?: string;
  canEarlyStayCheckout?: boolean;
  earlyStayCheckoutBusy?: boolean;
  onEarlyStayCheckout?: () => void;
}) {
  const t = useTranslations('reservationCard');
  const kind = resolveStayWindowPlane({ checkIn, checkOut, status });
  if (!kind) return <div className="h-3.5" data-testid="stay-flight-icons" />;
  const frame = `${SECONDARY_BUTTON_CLASS} !px-2`;
  if (kind === 'arrival') {
    return (
      <div className="flex items-center justify-center" data-testid="stay-flight-icons">
        <span title={t('flightIconArrival')} aria-label={t('flightIconArrival')} className={`${frame} !text-[#E74C3C]`}>
          <PlaneLanding className="h-4 w-4" />
        </span>
      </div>
    );
  }
  if (kind === 'departure') {
    return (
      <div className="flex items-center justify-center" data-testid="stay-flight-icons">
        <span title={t('flightIconDeparture')} aria-label={t('flightIconDeparture')} className={`${frame} !text-[#E74C3C]`}>
          <PlaneTakeoff className="h-4 w-4" />
        </span>
      </div>
    );
  }
  const earlyLabel = t('flightIconEarlyCheckout');
  if (canEarlyStayCheckout && onEarlyStayCheckout) {
    return (
      <div className="flex items-center justify-center" data-testid="stay-flight-icons">
        <button
          type="button"
          title={earlyLabel}
          aria-label={earlyLabel}
          disabled={earlyStayCheckoutBusy}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onEarlyStayCheckout();
          }}
          className={`${frame} !text-amber-500 hover:!text-amber-600 disabled:opacity-50`}
        >
          <PlaneTakeoff className="h-4 w-4" />
        </button>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center" data-testid="stay-flight-icons">
      <span title={earlyLabel} aria-label={earlyLabel} className={`${frame} !text-amber-500`}>
        <PlaneTakeoff className="h-4 w-4" />
      </span>
    </div>
  );
}


const OPTION_STATE_OPTIONS = ['OPTION', 'CONFIRMED', 'EXPIRED', 'RELEASED'] as const;

const LOOKUP_KINDS = [
  'MARKET',
  'SEGMENT',
  'ACCOM_TYPE',
  'RECORD_TYPE',
  'SPECIAL_STATE',
] as const;

export type ReservationCardLeftPanelProps = {
  isCreate: boolean;
  isLocked: boolean;
  /** Show physical door assign / share / early-late (CONFIRMED+ or room already assigned). */
  showAssignment?: boolean;
  /** Create-only sellable preview (same gate as POST /api/reservations). */
  sellable?: { available: number; booked: number; quota: number; stopSell: boolean } | null;
  checkIn: string;
  checkOut: string;
  checkInTime: string;
  checkOutTime: string;
  stayStatus?: string;
  canEarlyStayCheckout?: boolean;
  earlyStayCheckoutBusy?: boolean;
  onEarlyStayCheckout?: () => void;
  voucherNo: string;
  agencyId: string;
  companyId: string;
  sourceId: string;
  roomTypeId: string;
  roomId: string;
  rateType: string;
  mealPlanId: string;
  ratePlanId: string;
  paymentMethod: string;
  adults: string;
  children11_6: string;
  children5_2: string;
  children1_0: string;
  market: string;
  segment: string;
  resNo: string;
  shareNo: string;
  shareEligible: boolean;
  guestGender: string;
  shareNeighborHint?: string;
  onBreakShare?: () => void;
  breakShareBusy?: boolean;
  optionDate: string;
  optionState: string;
  salesProject: string;
  specialStates: string;
  resGroup: string;
  colorCode: string;
  preferredLocation: string;
  preferredBed: string;
  givenRoomTypeId: string;
  /** Assigned door no longer matches Given / Room type physical category. */
  doorPhysicalMismatch?: boolean;
  assignedRoomLabel?: string;
  roomChanges?: Array<{
    id: string;
    effectiveAt: string;
    fromRoom?: { roomNumber: string } | null;
    toRoom?: { roomNumber: string } | null;
    reasonCode?: string | null;
    notes?: string | null;
  }>;
  onClassSettlement?: (
    action: 'HOTEL' | 'GUEST_PAY' | 'HOTEL_REFUND' | 'GUEST_CHEAPER',
  ) => void;
  contractRef: string;
  salesContractId: string;
  creditLimitAzn: string;
  folioBalance: number;
  /** One-line GUEST / AGENCY / COMPANY routing summary (ADR D3). */
  billingRoutingSummary?: string;
  onFolioRouting?: () => void;
  onPackageRoomGap?: (mode: 'CHARGE' | 'REFUND' | 'COMP') => void;
  onAgencyCreated?: (row: AgencyOption) => void;
  onCompanyCreated?: (row: AgencyOption) => void;
  /** Optional until FO editor wires commercial booker fields. */
  booker?: string;
  guestRep?: string;
  paidBy?: string;
  accomType?: string;
  recordType?: string;
  reservationId?: string | null;
  agencies: AgencyOption[];
  companies: AgencyOption[];
  sources: SourceOption[];
  salesContracts: Array<{
    id: string;
    label: string;
    agencyId: string | null;
    companyId: string | null;
    counterpartyType?: string | null;
    ratePlanId: string;
    code: string;
  }>;
  roomTypes: SelectOption[];
  mealPlans: SelectOption[];
  ratePlans: RatePlanOption[];
  rooms: Array<{ id: string; roomNumber: string }>;
  onChange: (patch: Partial<Record<string, string>>) => void;
  onAssignRoom?: () => void;
  assignBusy?: boolean;
  /** Tooltip when Assign is disabled (e.g. names incomplete). */
  assignTitle?: string;
  onFocusRoomSelect?: () => void;
  onToggleLock?: () => void;
  /** HK condition badge (CLEAN/DIRTY/INSPECTED/PICKUP), not inventory status. */
  roomHkCondition?: string;
  roomStatus?: string;
};

export function ReservationCardLeftPanel(props: ReservationCardLeftPanelProps) {
  const t = useTranslations('reservationCard');
  const tb = useTranslations('booking');
  const tc = useTranslations('common');
  const locale = useLocale();
  const [hotelCoversClass, setHotelCoversClass] = useState(false);
  useEffect(() => {
    setHotelCoversClass(false);
  }, [props.givenRoomTypeId, props.roomTypeId]);
  const tenderLocale = locale.startsWith('az') ? 'az' : locale.startsWith('ru') ? 'ru' : 'en';
  const {
    isCreate,
    isLocked,
    showAssignment = false,
    sellable = null,
    booker = '',
    guestRep = '',
    paidBy = '',
    accomType = '',
    recordType = '',
    agencies,
    companies,
    sources,
    salesContracts,
    roomTypes,
    mealPlans,
    ratePlans,
    rooms,
    onChange,
    onAssignRoom,
    assignBusy,
    assignTitle,
    onFocusRoomSelect,
    onToggleLock,
    roomHkCondition,
    roomStatus,
    onBreakShare,
    breakShareBusy,
  } = props;

  const nights = nightsBetween(props.checkIn, props.checkOut);
  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    onChange({ [key]: e.target.value });
  const disabled = isLocked;
  const { byKind, roomViews, bedTypes } = useHotelLookupOptions([...LOOKUP_KINDS]);
  const setCatalog = (key: string) => (v: string | string[]) =>
    onChange({ [key]: Array.isArray(v) ? v.join(',') : v });

  const filteredRatePlans = useMemo(() => {
    const list = [...ratePlans];
    list.sort((a, b) => {
      const af = ratePlanFitsRoomType(a, props.roomTypeId) ? 0 : 1;
      const bf = ratePlanFitsRoomType(b, props.roomTypeId) ? 0 : 1;
      if (af !== bf) return af - bf;
      return (a.label || '').localeCompare(b.label || '');
    });
    return list;
  }, [ratePlans, props.roomTypeId]);

  const selectedRatePlan = ratePlans.find((rp) => rp.id === props.ratePlanId);
  const mealLockedByPackage = Boolean(selectedRatePlan?.medicalFlag && selectedRatePlan.mealPlanId);

  const hkBadge = (roomHkCondition || roomStatus || '').toUpperCase() || null;

  return (
    <aside className="min-h-0 space-y-3 overflow-y-auto border-r border-[#D5DADF] pr-3 text-[13px]">
      <CommercialPartyStrip
        sourceId={props.sourceId}
        agencyId={props.agencyId}
        companyId={props.companyId}
        salesContractId={props.salesContractId}
        contractRef={props.contractRef}
        checkIn={props.checkIn}
        sources={sources}
        agencies={agencies}
        companies={companies}
        contracts={salesContracts}
        disabled={disabled}
        onSource={(id) => onChange({ sourceId: id })}
        onAgency={(id) => onChange({ agencyId: id })}
        onCompany={(id) => onChange({ companyId: id })}
        onContract={(id) => onChange({ salesContractId: id })}
        onContractRef={(value) => onChange({ contractRef: value })}
        onAgencyCreated={(row) => props.onAgencyCreated?.(row)}
        onCompanyCreated={(row) => props.onCompanyCreated?.(row)}
      />
      {/* 1. Stay window — dates + times always visible */}
      <FieldPanel title={t('stayWindow')}>
        <div className="space-y-2">
          <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)_4.5rem] items-end gap-1.5">
            <fieldset disabled={disabled} className="contents">
              <DatePicker
                label={tb('checkIn')}
                fluid
                value={props.checkIn}
                onChange={(iso) => onChange({ checkIn: iso })}
                placeholder={tc('datePlaceholder')}
                openCalendarLabel={tc('openCalendar')}
                disabled={disabled}
              />
              <Field
                label={t('checkInTime')}
                preset="time"
                type="time"
                value={props.checkInTime}
                onChange={set('checkInTime')}
              />
              <NightsCountField
                label={t('nights')}
                value={String(nights)}
                disabled={disabled || !props.checkIn}
                onCommit={(n) => {
                  if (!props.checkIn) return;
                  onChange({ checkOut: addHotelDays(props.checkIn, n) });
                }}
              />
              <DatePicker
                label={tb('checkOut')}
                fluid
                value={props.checkOut}
                onChange={(iso) => onChange({ checkOut: iso })}
                placeholder={tc('datePlaceholder')}
                openCalendarLabel={tc('openCalendar')}
                disabled={disabled}
              />
              <Field
                label={t('checkOutTime')}
                preset="time"
                type="time"
                value={props.checkOutTime}
                onChange={set('checkOutTime')}
              />
            </fieldset>
            <StayDateFlightIcons
              checkIn={props.checkIn}
              checkOut={props.checkOut}
              status={props.stayStatus}
              canEarlyStayCheckout={props.canEarlyStayCheckout}
              earlyStayCheckoutBusy={props.earlyStayCheckoutBusy}
              onEarlyStayCheckout={props.onEarlyStayCheckout}
            />
          </div>
          <fieldset disabled={disabled} className="space-y-2 border-0 p-0">
            <FieldRow cols={2}>
              <Field label={t('resNo')} preset="code" value={props.resNo} onChange={set('resNo')} />
              <Field
                label={t('voucherNo')}
                preset="code"
                value={props.voucherNo}
                onChange={set('voucherNo')}
              />
            </FieldRow>
            {props.reservationId ? (
              <ReservationCardEarlyLatePanel
                reservationId={props.reservationId}
                checkInTime={props.checkInTime}
                checkOutTime={props.checkOutTime}
              />
            ) : null}
          </fieldset>
        </div>
      </FieldPanel>

      {/* 2. Room — Room type = charge; Given = physical door list; Room no. follows Given||Room type */}
      <FieldPanel title={t('roomSection')}>
        <fieldset disabled={disabled} className="space-y-2 border-0 p-0">
          <FieldRow cols={2} className="min-w-0">
            <CatalogField
              kind="ENTITY_REF"
              label={tb('roomType')}
              className="min-w-0"
              value={props.roomTypeId}
              onChange={setCatalog('roomTypeId')}
              options={roomTypes.map((rt) => ({ value: rt.id, label: rt.label }))}
              required
              emptyLabel={null}
              hint={t('roomTypeChargeHint')}
              disabled={disabled}
            />
            <CatalogField
              kind="ENTITY_REF"
              label={t('givenRoomType')}
              className="min-w-0"
              value={props.givenRoomTypeId}
              onChange={setCatalog('givenRoomTypeId')}
              options={roomTypes.map((rt) => ({ value: rt.id, label: rt.label }))}
              emptyLabel="—"
              hint={t('givenRoomTypePhysicalHint')}
              disabled={disabled}
            />
          </FieldRow>
          {props.givenRoomTypeId &&
          props.roomTypeId &&
          props.givenRoomTypeId !== props.roomTypeId ? (
            <ClassSettlement
              chargeLabel={
                roomTypes.find((r) => r.id === props.roomTypeId)?.label ?? props.roomTypeId
              }
              givenLabel={
                roomTypes.find((r) => r.id === props.givenRoomTypeId)?.label ??
                props.givenRoomTypeId
              }
              chargedNightly={nightlyForType(ratePlans, props.ratePlanId, props.roomTypeId)}
              givenNightly={nightlyForType(ratePlans, props.ratePlanId, props.givenRoomTypeId)}
              hotelCovers={hotelCoversClass}
              disabled={disabled}
              onHotel={() => {
                setHotelCoversClass(true);
                props.onClassSettlement?.('HOTEL');
              }}
              onGuestPays={() => props.onClassSettlement?.('GUEST_PAY')}
              onHotelRefund={() => props.onClassSettlement?.('HOTEL_REFUND')}
              onGuestCheaper={() => props.onClassSettlement?.('GUEST_CHEAPER')}
            />
          ) : null}
          {props.doorPhysicalMismatch ? (
            <p
              className="m-0 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] text-rose-950"
              data-testid="door-physical-mismatch"
            >
              {t('doorPhysicalMismatch', {
                room: props.assignedRoomLabel ?? '—',
              })}
            </p>
          ) : null}
          {isCreate && sellable ? (
            <div
              className={`rounded-md border px-3 py-2 text-[12px] ${
                sellable.available < 1
                  ? 'border-rose-200 bg-rose-50 text-rose-900'
                  : 'border-sky-200 bg-sky-50 text-sky-900'
              }`}
            >
              <div className="font-medium">
                {t('sellableLabel')}: {sellable.available}
                {sellable.stopSell ? ` (${t('stopSell')})` : ''}
              </div>
              <div className={TEXT_MUTED_CLASS}>
                {t('sellableDetail', {
                  booked: sellable.booked,
                  quota: sellable.quota,
                })}
              </div>
              <div className="mt-1">
                {sellable.available < 1 ? <span>{t('noSellableHint')} </span> : null}
                <Link href="/fo/availability" className="underline">
                  {t('openRoomTypeAvailability')}
                </Link>
              </div>
            </div>
          ) : null}
          {showAssignment ? (
            <>
              <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                <CatalogField
                  kind="ENTITY_REF"
                  label={t('roomNo')}
                  id="res-card-room-select"
                  value={props.roomId}
                  onChange={setCatalog('roomId')}
                  options={rooms.map((r) => ({ value: r.id, label: r.roomNumber }))}
                  emptyLabel="—"
                  hint={t('roomNoPhysicalHint')}
                  disabled={disabled}
                />
                <div
                  className="flex shrink-0 flex-wrap items-end gap-1 pb-0.5"
                  data-testid="room-door-actions"
                >
                  <button
                    type="button"
                    className={`${SECONDARY_BUTTON_CLASS} !px-2`}
                    title={isLocked ? t('unlock') : t('lock')}
                    aria-label={isLocked ? t('unlock') : t('lock')}
                    disabled={!onToggleLock}
                    onClick={onToggleLock}
                  >
                    <Lock className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className={`${SECONDARY_BUTTON_CLASS} !px-2`}
                    title={t('roomSearch')}
                    aria-label={t('roomSearch')}
                    disabled={!onFocusRoomSelect}
                    onClick={onFocusRoomSelect}
                  >
                    <Search className="h-4 w-4" />
                  </button>
                  {props.roomId ? (
                    <Link
                      href={`/hk?roomId=${props.roomId}`}
                      className={`${SECONDARY_BUTTON_CLASS} min-w-[4.75rem] justify-center text-[11px]`}
                      title={t('roomHk')}
                      data-testid="reservation-hk-badge"
                    >
                      {hkBadge ?? 'HK'}
                    </Link>
                  ) : (
                    <span
                      className={`${SECONDARY_BUTTON_CLASS} min-w-[4.75rem] justify-center text-[11px] opacity-40`}
                      aria-hidden
                      data-testid="reservation-hk-badge-placeholder"
                    >
                      —
                    </span>
                  )}
                  <button
                    type="button"
                    className={SECONDARY_BUTTON_CLASS}
                    title={assignTitle ?? t('assignRoom')}
                    disabled={assignBusy || !props.roomId || !onAssignRoom}
                    onClick={onAssignRoom}
                  >
                    {t('assignRoom')}
                  </button>
                </div>
              </div>
              <FieldRow cols={2} className="items-end">
                <label className="flex items-center gap-2 text-[12px] text-[#34495E]">
                  <input
                    type="checkbox"
                    className={MODAL_CHECKBOX_CLASS}
                    checked={props.shareEligible}
                    disabled={disabled || Number(props.adults) !== 1}
                    onChange={(e) =>
                      onChange({ shareEligible: e.target.checked ? 'true' : 'false' })
                    }
                  />
                  <span title={t('shareEligibleHint')}>{t('shareEligible')}</span>
                </label>
                {props.shareEligible ? (
                  <CatalogField
                    kind="CLOSED_SMALL"
                    label={t('gender')}
                    value={props.guestGender}
                    onChange={(v) =>
                      onChange({ guestGender: (Array.isArray(v) ? v[0] : v) ?? '' })
                    }
                    options={[
                      { value: 'M', label: t('genderMale') },
                      { value: 'F', label: t('genderFemale') },
                    ]}
                    disabled={disabled}
                  />
                ) : null}
              </FieldRow>
              {props.shareEligible && props.shareNeighborHint ? (
                <p className={`text-[11px] ${TEXT_MUTED_CLASS}`}>{props.shareNeighborHint}</p>
              ) : null}
              {props.shareEligible && !isCreate && onBreakShare ? (
                <button
                  type="button"
                  className={SECONDARY_BUTTON_CLASS}
                  disabled={disabled || breakShareBusy}
                  onClick={onBreakShare}
                >
                  {t('breakShare')}
                </button>
              ) : null}
            </>
          ) : props.roomId ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-[12px] ${TEXT_MUTED_CLASS}`}>
                {t('roomNo')}:{' '}
                <strong>
                  {rooms.find((r) => r.id === props.roomId)?.roomNumber ?? props.roomId}
                </strong>
              </span>
              <Link
                href={`/hk?roomId=${props.roomId}`}
                className={`${SECONDARY_BUTTON_CLASS} min-w-[4.75rem] justify-center text-[11px]`}
                title={t('roomHk')}
                data-testid="reservation-hk-badge"
              >
                {hkBadge ?? 'HK'}
              </Link>
            </div>
          ) : null}
          <RoomMoves changes={props.roomChanges} />
        </fieldset>
      </FieldPanel>

      {/* 3. Pax & board */}
      <FieldPanel title={t('paxAndBoard')}>
        <fieldset disabled={disabled} className="space-y-2 border-0 p-0">
          <FieldRow cols={4}>
            <Field
              label={t('adults')}
              preset="count"
              type="number"
              min={0}
              value={props.adults}
              onChange={set('adults')}
            />
            <Field
              label={t('child11_6')}
              preset="count"
              type="number"
              min={0}
              value={props.children11_6}
              onChange={set('children11_6')}
            />
            <Field
              label={t('child5_2')}
              preset="count"
              type="number"
              min={0}
              value={props.children5_2}
              onChange={set('children5_2')}
            />
            <Field
              label={t('child1_0')}
              preset="count"
              type="number"
              min={0}
              value={props.children1_0}
              onChange={set('children1_0')}
            />
          </FieldRow>
          <CatalogField
            kind="CLOSED_SMALL"
            label={t('mealPlan')}
            className="min-w-0"
            value={props.mealPlanId}
            onChange={setCatalog('mealPlanId')}
            options={mealPlans.map((m) => ({ value: m.id, label: m.label }))}
            disabled={disabled || mealLockedByPackage}
          />
        </fieldset>
      </FieldPanel>

      {/* Package stays with the room. Source and contract sit above the dates. */}
      <FieldPanel title={t('rateAndSource')}>
        <fieldset disabled={disabled} className="space-y-2 border-0 p-0">
          <CatalogField
            kind="ENTITY_REF"
            label={t('packageOrRate')}
            className="min-w-0"
            value={props.ratePlanId}
            onChange={setCatalog('ratePlanId')}
            options={filteredRatePlans.map((rp) => ({ value: rp.id, label: rp.label }))}
            required
            emptyLabel={null}
            disabled={disabled}
          />
          {selectedRatePlan?.roomTypeId &&
          props.roomTypeId &&
          selectedRatePlan.roomTypeId !== props.roomTypeId ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-2 py-2 text-[12px] text-amber-950">
              <p className="m-0">{t('packageRoomGap')}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className={SECONDARY_BUTTON_CLASS}
                  disabled={disabled}
                  onClick={() => props.onPackageRoomGap?.('CHARGE')}
                >
                  {t('packageGapCharge')}
                </button>
                <button
                  type="button"
                  className={SECONDARY_BUTTON_CLASS}
                  disabled={disabled}
                  onClick={() => props.onPackageRoomGap?.('REFUND')}
                >
                  {t('packageGapRefund')}
                </button>
                <button
                  type="button"
                  className={SECONDARY_BUTTON_CLASS}
                  disabled={disabled}
                  onClick={() => props.onPackageRoomGap?.('COMP')}
                >
                  {t('packageGapComp')}
                </button>
              </div>
            </div>
          ) : null}
          <FieldRow cols={2} className="min-w-0">
            <CatalogField
              kind="SEARCHABLE"
              label={t('market')}
              className="min-w-0"
              value={props.market}
              onChange={setCatalog('market')}
              options={withOrphanOption(byKind.MARKET ?? [], props.market)}
              disabled={disabled}
            />
            <CatalogField
              kind="SEARCHABLE"
              label={t('segment')}
              className="min-w-0"
              value={props.segment}
              onChange={setCatalog('segment')}
              options={withOrphanOption(byKind.SEGMENT ?? [], props.segment)}
              disabled={disabled}
            />
          </FieldRow>
        </fieldset>
      </FieldPanel>

      {/* 5. Billing summary */}
      <FieldPanel title={t('billing')}>
        <fieldset disabled={disabled} className="space-y-2 border-0 p-0">
          <CatalogField
            kind="CLOSED_SMALL"
            label={tb('paymentMethod')}
            value={props.paymentMethod}
            onChange={setCatalog('paymentMethod')}
            options={hotelTenderOptions(tenderLocale)}
            disabled={disabled}
          />
          {props.billingRoutingSummary ? (
            <div className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
              <span className={TEXT_MUTED_CLASS} data-testid="billing-routing-summary">
                {t('billingRouting')}: <strong className="text-[#34495E]">{props.billingRoutingSummary}</strong>
              </span>
              {props.onFolioRouting ? (
                <button
                  type="button"
                  className={SECONDARY_BUTTON_CLASS}
                  disabled={disabled}
                  onClick={props.onFolioRouting}
                >
                  {t('editFolioRouting')}
                </button>
              ) : null}
            </div>
          ) : null}
          {!isCreate ? (
            <FieldRow cols={2}>
              <Field
                label={t('creditLimitAzn')}
                preset="amount"
                type="number"
                min={0}
                step={0.01}
                value={props.creditLimitAzn}
                onChange={set('creditLimitAzn')}
                placeholder={t('creditLimitPlaceholder')}
              />
              <div className={SUBSECTION_SURFACE_CLASS}>
                <div className="flex justify-between">
                  <span className={TEXT_MUTED_CLASS}>{t('folioBalance')}</span>
                  <span className="font-mono">{props.folioBalance.toFixed(2)} AZN</span>
                </div>
                {props.creditLimitAzn !== '' && !Number.isNaN(Number(props.creditLimitAzn)) ? (
                  <div className="mt-1 flex justify-between">
                    <span className={TEXT_MUTED_CLASS}>{t('creditRemaining')}</span>
                    <span
                      className={`font-mono ${
                        Number(props.creditLimitAzn) - props.folioBalance <= 0
                          ? TEXT_DANGER_CLASS
                          : TEXT_SUCCESS_CLASS
                      }`}
                    >
                      {Math.max(0, Number(props.creditLimitAzn) - props.folioBalance).toFixed(2)} AZN
                    </span>
                  </div>
                ) : (
                  <p className={`mt-1 ${TEXT_MUTED_CLASS}`}>{t('creditLimitUnset')}</p>
                )}
              </div>
            </FieldRow>
          ) : null}
        </fieldset>
      </FieldPanel>

      {/* 6. Additional — rare / ElektraWeb residue */}
      <FieldSection title={t('additionalSection')} defaultOpen={false}>
        <fieldset disabled={disabled} className="space-y-3 border-0 p-0">
          <FieldRow cols={2}>
            <DatePicker
              label={t('optionDate')}
              fluid
              value={props.optionDate}
              onChange={(iso) => onChange({ optionDate: iso })}
              placeholder={tc('datePlaceholder')}
              openCalendarLabel={tc('openCalendar')}
              disabled={disabled}
            />
            <FieldSelect
              label={t('optionState')}
              preset="select"
              value={props.optionState}
              onChange={set('optionState')}
            >
              <option value="">—</option>
              {OPTION_STATE_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
              {props.optionState && !(OPTION_STATE_OPTIONS as readonly string[]).includes(props.optionState) ? (
                <option value={props.optionState}>{props.optionState}</option>
              ) : null}
            </FieldSelect>
          </FieldRow>
          <Field label={t('shareNo')} preset="code" value={props.shareNo} onChange={set('shareNo')} />
          <FieldRow cols={2}>
            <CatalogField
              kind="SEARCHABLE"
              label={t('preferredLocation')}
              value={props.preferredLocation}
              onChange={setCatalog('preferredLocation')}
              options={withOrphanOption(roomViews, props.preferredLocation)}
              disabled={disabled}
            />
            <CatalogField
              kind="SEARCHABLE"
              label={t('preferredBed')}
              value={props.preferredBed}
              onChange={setCatalog('preferredBed')}
              options={withOrphanOption(bedTypes, props.preferredBed)}
              disabled={disabled}
            />
          </FieldRow>
          <FieldRow cols={2}>
            <CatalogField
              kind="CLOSED_SMALL"
              label={t('accomType')}
              value={accomType}
              onChange={setCatalog('accomType')}
              options={withOrphanOption(byKind.ACCOM_TYPE ?? [], accomType)}
              disabled={disabled}
            />
            <CatalogField
              kind="CLOSED_SMALL"
              label={t('recordType')}
              value={recordType}
              onChange={setCatalog('recordType')}
              options={withOrphanOption(byKind.RECORD_TYPE ?? [], recordType)}
              disabled={disabled}
            />
          </FieldRow>
          <FieldRow cols={2}>
            <CatalogField
              kind="MULTI"
              label={t('specialStates')}
              value={
                props.specialStates
                  ? props.specialStates.split(',').map((s) => s.trim()).filter(Boolean)
                  : []
              }
              onChange={setCatalog('specialStates')}
              options={byKind.SPECIAL_STATE ?? []}
              disabled={disabled}
            />
            <Field label={t('resGroup')} preset="code" value={props.resGroup} onChange={set('resGroup')} />
          </FieldRow>
          <FieldRow cols={2}>
            <Field label={t('colorCode')} preset="code" value={props.colorCode} onChange={set('colorCode')} />
            <Field label={t('rateType')} preset="code" value={props.rateType} onChange={set('rateType')} />
          </FieldRow>
          <Field
            label={t('salesProject')}
            preset="shortText"
            value={props.salesProject}
            onChange={set('salesProject')}
          />
          <FieldRow cols={3}>
            <Field label={t('booker')} preset="shortText" value={booker} onChange={set('booker')} />
            <Field label={t('guestRep')} preset="shortText" value={guestRep} onChange={set('guestRep')} />
            <Field label={t('paidBy')} preset="shortText" value={paidBy} onChange={set('paidBy')} />
          </FieldRow>
        </fieldset>
      </FieldSection>
    </aside>
  );
}
