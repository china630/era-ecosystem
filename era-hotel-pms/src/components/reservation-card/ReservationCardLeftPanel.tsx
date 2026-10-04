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
import { ReservationCardEarlyLatePanel } from '@/components/reservation-card/ReservationCardEarlyLatePanel';
import {
  bookingSourceKind,
  contractsForSource,
  isManualFoSourceKind,
  sourceKindLabel,
} from '@/lib/booking-source-kind';
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

/** Keep the stored row pickable when the source filter excludes it (legacy mismatched stays). */
function withSelectedRow<T extends { id: string }>(scoped: T[], all: T[], selectedId: string): T[] {
  if (!selectedId || scoped.some((x) => x.id === selectedId)) return scoped;
  const hit = all.find((x) => x.id === selectedId);
  return hit ? [hit, ...scoped] : scoped;
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
  contractRef: string;
  salesContractId: string;
  creditLimitAzn: string;
  folioBalance: number;
  /** One-line GUEST / AGENCY / COMPANY routing summary (ADR D3). */
  billingRoutingSummary?: string;
  onFolioRouting?: () => void;
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
  const [nightsDraft, setNightsDraft] = useState(String(nights));
  useEffect(() => {
    setNightsDraft(String(nights));
  }, [nights]);
  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    onChange({ [key]: e.target.value });
  const disabled = isLocked;
  const { byKind, roomViews, bedTypes } = useHotelLookupOptions([...LOOKUP_KINDS]);
  const setCatalog = (key: string) => (v: string | string[]) =>
    onChange({ [key]: Array.isArray(v) ? v.join(',') : v });

  const filteredRatePlans = useMemo(
    () => ratePlans.filter((rp) => ratePlanFitsRoomType(rp, props.roomTypeId)),
    [ratePlans, props.roomTypeId],
  );

  const selectedRatePlan = ratePlans.find((rp) => rp.id === props.ratePlanId);
  const mealLockedByPackage = Boolean(selectedRatePlan?.medicalFlag && selectedRatePlan.mealPlanId);

  const selectedSource = sources.find((s) => s.id === props.sourceId);
  const sourceKind = bookingSourceKind(selectedSource?.code);
  const walkInAgencies = useMemo(() => agencies.filter((a) => a.isWalkIn), [agencies]);
  const walkInLocked =
    sourceKind === 'WEB' || (sourceKind === 'WALKIN' && walkInAgencies.length === 0);
  const corporateLocked = sourceKind === 'CORPORATE';
  const agencyPickerLocked = walkInLocked || corporateLocked;
  const showAgencyContract = sourceKind === 'AGENCY' || sourceKind === 'BOOKING';
  const showCompanyContract = corporateLocked;
  const showOptionalCompany = !corporateLocked;
  const agencyOptions = useMemo(() => {
    const scoped =
      sourceKind === 'AGENCY'
        ? agencies.filter((a) => !a.isOta && !a.isWalkIn)
        : sourceKind === 'BOOKING'
          ? agencies.filter((a) => a.isOta)
          : sourceKind === 'WALKIN'
            ? walkInAgencies
            : agencies.filter((a) => !a.isWalkIn);
    return withSelectedRow(scoped, agencies, props.agencyId);
  }, [agencies, walkInAgencies, sourceKind, props.agencyId]);
  const knownAgencyId = agencies.some((a) => a.id === props.agencyId) ? props.agencyId : '';
  const knownCompanyId = companies.some((c) => c.id === props.companyId) ? props.companyId : '';
  const sourceOptions = useMemo(
    () =>
      sources.filter(
        (s) => isManualFoSourceKind(bookingSourceKind(s.code)) || s.id === props.sourceId,
      ),
    [sources, props.sourceId],
  );
  const agencyFieldLabel =
    sourceKind === 'BOOKING'
      ? t('otaChannel')
      : sourceKind === 'WALKIN' && !walkInLocked
        ? t('walkInProfile')
        : sourceKind === 'WALKIN' || sourceKind === 'WEB'
          ? t('individual')
        : sourceKind === 'CORPORATE'
          ? t('company')
          : t('agency');
  const contractsForKind = useMemo(
    () =>
      contractsForSource(salesContracts, {
        sourceKind,
        agencyId: props.agencyId,
        companyId: props.companyId,
      }),
    [salesContracts, sourceKind, props.agencyId, props.companyId],
  );

  const hkBadge = (roomHkCondition || roomStatus || '').toUpperCase() || null;

  return (
    <aside className="min-h-0 space-y-3 overflow-y-auto border-r border-[#D5DADF] pr-3 text-[13px]">
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
              <Field
                label={t('nights')}
                preset="count"
                value={nightsDraft}
                disabled={disabled}
                className="min-w-0 w-full"
                inputClassName="w-full min-w-0 text-center"
                onChange={(e) => setNightsDraft(e.target.value)}
                onBlur={() => {
                  const n = Number(nightsDraft);
                  if (!props.checkIn || !Number.isInteger(n) || n < 1) {
                    setNightsDraft(String(nights));
                    return;
                  }
                  onChange({ checkOut: addHotelDays(props.checkIn, n) });
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    (e.target as HTMLInputElement).blur();
                  }
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
            <p
              className="m-0 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-950"
              data-testid="complimentary-upgrade-chip"
            >
              {t('complimentaryUpgradeChip', {
                charge:
                  roomTypes.find((r) => r.id === props.roomTypeId)?.label ?? props.roomTypeId,
                physical:
                  roomTypes.find((r) => r.id === props.givenRoomTypeId)?.label ??
                  props.givenRoomTypeId,
              })}
            </p>
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

      {/* 4. Rate & source — sell path only (channel, counterparty, contract, rate) */}
      <FieldPanel title={t('rateAndSource')}>
        <fieldset disabled={disabled} className="space-y-2 border-0 p-0">
          <FieldRow cols={2} className="min-w-0">
            <CatalogField
              kind="CLOSED_SMALL"
              label={t('source')}
              value={props.sourceId}
              onChange={setCatalog('sourceId')}
              options={sourceOptions.map((s) => ({
                value: s.id,
                label: sourceKindLabel(t, bookingSourceKind(s.code), s.label),
              }))}
              disabled={disabled}
            />
            {corporateLocked ? (
              <CatalogField
                kind="SEARCHABLE"
                label={t('company')}
                value={knownCompanyId}
                onChange={setCatalog('companyId')}
                options={companies.map((c) => ({ value: c.id, label: c.label }))}
                disabled={disabled}
                emptyLabel={tc('select')}
              />
            ) : (
              <CatalogField
                kind="SEARCHABLE"
                label={agencyFieldLabel}
                value={agencyPickerLocked ? '' : knownAgencyId}
                onChange={setCatalog('agencyId')}
                options={
                  agencyPickerLocked
                    ? []
                    : agencyOptions.map((a) => ({ value: a.id, label: a.label }))
                }
                disabled={disabled || agencyPickerLocked}
                emptyLabel={
                  agencyPickerLocked || sourceKind === 'WALKIN' ? t('individual') : tc('select')
                }
              />
            )}
          </FieldRow>
          {showOptionalCompany ? (
            <CatalogField
              kind="SEARCHABLE"
              label={t('company')}
              value={knownCompanyId}
              onChange={setCatalog('companyId')}
              options={companies.map((c) => ({ value: c.id, label: c.label }))}
              disabled={disabled}
              emptyLabel={tc('select')}
              hint={t('companyOptionalHint')}
            />
          ) : null}
          {showAgencyContract || showCompanyContract ? (
            <FieldRow cols={2}>
              <CatalogField
                kind="ENTITY_REF"
                label={showCompanyContract ? t('companyContract') : t('agencyContract')}
                value={props.salesContractId}
                onChange={setCatalog('salesContractId')}
                options={contractsForKind.map((c) => ({ value: c.id, label: c.label }))}
                emptyLabel="—"
                disabled={
                  disabled ||
                  (showCompanyContract
                    ? !props.companyId && contractsForKind.length === 0
                    : !props.agencyId && contractsForKind.length === 0)
                }
              />
              <Field
                label={t('contractRef')}
                preset="code"
                value={props.contractRef}
                onChange={set('contractRef')}
              />
            </FieldRow>
          ) : null}
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
