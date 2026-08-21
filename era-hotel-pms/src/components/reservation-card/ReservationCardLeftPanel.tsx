'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { Lock, Search } from 'lucide-react';
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
import { bookingSourceKind } from '@/lib/booking-source-kind';
import { useHotelLookupOptions, withOrphanOption } from '@/lib/hotel-lookups';
import type { AgencyOption, RatePlanOption, SelectOption, SourceOption } from './types';

/** BAR (BASE) or unscoped plans apply to any room type; derived packages may be type-scoped. */
function ratePlanFitsRoomType(rp: RatePlanOption, roomTypeId: string): boolean {
  if (!roomTypeId) return true;
  if (rp.type === 'BASE' || !rp.roomTypeId) return true;
  return rp.roomTypeId === roomTypeId;
}

function nightsBetween(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0;
  const a = new Date(checkIn);
  const b = new Date(checkOut);
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000));
}

const OPTION_STATE_OPTIONS = ['OPTION', 'CONFIRMED', 'EXPIRED', 'RELEASED'] as const;

const LOOKUP_KINDS = [
  'MARKET',
  'SEGMENT',
  'VIP_TYPE',
  'TRIP_REASON',
  'ACCOM_TYPE',
  'RECORD_TYPE',
  'SPECIAL_STATE',
] as const;

export type ReservationCardLeftPanelProps = {
  isCreate: boolean;
  isLocked: boolean;
  /** Show physical room / times / early-late (CONFIRMED+ or room already assigned). */
  showAssignment?: boolean;
  /** Create-only sellable preview (same gate as POST /api/reservations). */
  sellable?: { available: number; booked: number; quota: number; stopSell: boolean } | null;
  checkIn: string;
  checkOut: string;
  checkInTime: string;
  checkOutTime: string;
  voucherNo: string;
  agencyId: string;
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
  contractRef: string;
  salesContractId: string;
  creditLimitAzn: string;
  folioBalance: number;
  /** Optional until FO editor wires commercial booker fields. */
  booker?: string;
  guestRep?: string;
  paidBy?: string;
  vipType?: string;
  accomType?: string;
  recordType?: string;
  tripReason?: string;
  statusLabel?: string;
  reservationId?: string | null;
  agencies: AgencyOption[];
  sources: SourceOption[];
  salesContracts: Array<{ id: string; label: string; agencyId: string | null; ratePlanId: string; code: string }>;
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
    vipType = '',
    accomType = '',
    recordType = '',
    tripReason = '',
    agencies,
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

  const contractsForAgency = salesContracts.filter(
    (c) => !props.agencyId || !c.agencyId || c.agencyId === props.agencyId,
  );

  const filteredRatePlans = useMemo(
    () => ratePlans.filter((rp) => ratePlanFitsRoomType(rp, props.roomTypeId)),
    [ratePlans, props.roomTypeId],
  );

  const selectedRatePlan = ratePlans.find((rp) => rp.id === props.ratePlanId);
  const mealLockedByPackage = Boolean(selectedRatePlan?.medicalFlag && selectedRatePlan.mealPlanId);

  const selectedSource = sources.find((s) => s.id === props.sourceId);
  const sourceKind = bookingSourceKind(selectedSource?.code);
  const walkInLocked = sourceKind === 'WALKIN';
  const agencyOptions = useMemo(() => {
    if (sourceKind === 'AGENCY') return agencies.filter((a) => !a.isOta);
    if (sourceKind === 'BOOKING') return agencies.filter((a) => a.isOta);
    return agencies;
  }, [agencies, sourceKind]);
  const agencyFieldLabel =
    sourceKind === 'BOOKING' ? t('otaChannel') : sourceKind === 'WALKIN' ? t('individual') : t('agency');
  const agencyFieldHint =
    sourceKind === 'BOOKING'
      ? t('hintOtaChannel')
      : sourceKind === 'WALKIN'
        ? t('hintAgency')
        : t('hintAgency');

  return (
    <aside className="min-h-0 space-y-3 overflow-y-auto border-r border-[#D5DADF] pr-3 text-[13px]">
      {/* 1. Stay — agency booking dates + refs */}
      <FieldPanel title={t('stay')}>
        <fieldset disabled={disabled} className="space-y-3 border-0 p-0">
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_4.75rem] items-end gap-2">
            <DatePicker
              label={tb('checkIn')}
              fluid
              value={props.checkIn}
              onChange={(iso) => onChange({ checkIn: iso })}
              placeholder={tc('datePlaceholder')}
              openCalendarLabel={tc('openCalendar')}
              hint={t('hintCheckIn')}
              disabled={disabled}
            />
            <DatePicker
              label={tb('checkOut')}
              fluid
              value={props.checkOut}
              onChange={(iso) => onChange({ checkOut: iso })}
              placeholder={tc('datePlaceholder')}
              openCalendarLabel={tc('openCalendar')}
              hint={t('hintCheckOut')}
              disabled={disabled}
            />
            <Field
              label={t('nights')}
              preset="count"
              value={String(nights)}
              readOnly
              className="min-w-0"
              inputClassName="w-full min-w-0 text-center"
              hint={t('hintNights')}
            />
          </div>
          <FieldRow cols={2}>
            <Field
              label={t('resNo')}
              preset="code"
              value={props.resNo}
              onChange={set('resNo')}
              hint={t('hintResNo')}
            />
            <Field
              label={t('voucherNo')}
              preset="code"
              value={props.voucherNo}
              onChange={set('voucherNo')}
              hint={t('hintVoucherNo')}
            />
          </FieldRow>
        </fieldset>
      </FieldPanel>

      {/* 2. Product — Nafta package / BAR + room category (not door) */}
      <FieldPanel title={t('productSection')}>
        <fieldset disabled={disabled} className="space-y-3 border-0 p-0">
          <FieldRow cols={3} className="min-w-0">
            <FieldSelect
              label={tb('roomType')}
              preset="select"
              className="min-w-0"
              selectClassName="w-full min-w-0 max-w-full"
              value={props.roomTypeId}
              onChange={set('roomTypeId')}
              hint={t('hintRoomType')}
              required
            >
              <option value="">{tc('select')}</option>
              {roomTypes.map((rt) => (
                <option key={rt.id} value={rt.id}>
                  {rt.label}
                </option>
              ))}
            </FieldSelect>
            <FieldSelect
              label={t('packageOrRate')}
              preset="select"
              className="min-w-0"
              selectClassName="w-full min-w-0 max-w-full"
              value={props.ratePlanId}
              onChange={set('ratePlanId')}
              hint={t('hintPackageOrRate')}
              required
            >
              <option value="">{tc('select')}</option>
              {filteredRatePlans.map((rp) => (
                <option key={rp.id} value={rp.id}>
                  {rp.label}
                </option>
              ))}
            </FieldSelect>
            <FieldSelect
              label={t('mealPlan')}
              preset="select"
              className="min-w-0"
              selectClassName="w-full min-w-0 max-w-full"
              value={props.mealPlanId}
              onChange={set('mealPlanId')}
              hint={mealLockedByPackage ? t('hintMealLocked') : t('hintMealPlan')}
              disabled={mealLockedByPackage}
            >
              <option value="">—</option>
              {mealPlans.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </FieldSelect>
          </FieldRow>
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
              {sellable.available < 1 ? (
                <div className="mt-1">
                  {t('noSellableHint')}{' '}
                  <Link href="/fo/availability" className="underline">
                    {t('openRoomTypeAvailability')}
                  </Link>
                </div>
              ) : (
                <div className="mt-1">
                  <Link href="/fo/availability" className="underline">
                    {t('openRoomTypeAvailability')}
                  </Link>
                </div>
              )}
            </div>
          ) : null}
        </fieldset>
      </FieldPanel>

      {/* 3. Pax — one row of count fields */}
      <FieldPanel title={t('pax')}>
        <fieldset disabled={disabled} className="space-y-3 border-0 p-0">
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
        </fieldset>
      </FieldPanel>

      {/* 4. Classification — agency-relevant only */}
      <FieldPanel title={t('classification')}>
        <fieldset disabled={disabled} className="space-y-3 border-0 p-0">
          {props.statusLabel ? (
            <Field label={t('statusLabel')} preset="shortText" value={props.statusLabel} readOnly />
          ) : null}
          <FieldRow cols={4} className="min-w-0">
            <CatalogField
              kind="CLOSED_SMALL"
              label={t('market')}
              className="min-w-0"
              value={props.market}
              onChange={setCatalog('market')}
              options={withOrphanOption(byKind.MARKET ?? [], props.market)}
              hint={t('hintMarket')}
              disabled={disabled}
            />
            <CatalogField
              kind="CLOSED_SMALL"
              label={t('segment')}
              className="min-w-0"
              value={props.segment}
              onChange={setCatalog('segment')}
              options={withOrphanOption(byKind.SEGMENT ?? [], props.segment)}
              hint={t('hintSegment')}
              disabled={disabled}
            />
            <CatalogField
              kind="CLOSED_SMALL"
              label={t('vipType')}
              className="min-w-0"
              value={vipType}
              onChange={setCatalog('vipType')}
              options={withOrphanOption(byKind.VIP_TYPE ?? [], vipType)}
              hint={t('vipFromGuestHint')}
              disabled={disabled}
            />
            <CatalogField
              kind="CLOSED_SMALL"
              label={t('tripReason')}
              className="min-w-0"
              value={tripReason}
              onChange={setCatalog('tripReason')}
              options={withOrphanOption(byKind.TRIP_REASON ?? [], tripReason)}
              disabled={disabled}
            />
          </FieldRow>
        </fieldset>
      </FieldPanel>

      {/* 5. Commercial — agency / contract / payer */}
      <FieldPanel title={t('commercialSales')}>
        <fieldset disabled={disabled} className="space-y-3 border-0 p-0">
          <FieldRow cols={2}>
            <FieldSelect
              label={t('source')}
              preset="select"
              value={props.sourceId}
              onChange={set('sourceId')}
              hint={t('hintSource')}
            >
              <option value="">—</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </FieldSelect>
            <FieldSelect
              label={agencyFieldLabel}
              preset="selectWide"
              value={walkInLocked ? '' : props.agencyId}
              onChange={set('agencyId')}
              hint={agencyFieldHint}
              disabled={walkInLocked}
            >
              <option value="">{walkInLocked ? t('individual') : tc('select')}</option>
              {!walkInLocked
                ? agencyOptions.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))
                : null}
            </FieldSelect>
          </FieldRow>
          <FieldRow cols={2}>
            <FieldSelect
              label={t('salesContract')}
              preset="selectWide"
              value={props.salesContractId}
              onChange={set('salesContractId')}
              disabled={!props.agencyId && contractsForAgency.length === 0}
              hint={t('hintSalesContract')}
            >
              <option value="">—</option>
              {contractsForAgency.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </FieldSelect>
            <Field label={t('contractRef')} preset="code" value={props.contractRef} onChange={set('contractRef')} />
          </FieldRow>
          <FieldRow cols={3}>
            <Field label={t('booker')} preset="shortText" value={booker} onChange={set('booker')} />
            <Field label={t('guestRep')} preset="shortText" value={guestRep} onChange={set('guestRep')} />
            <Field label={t('paidBy')} preset="shortText" value={paidBy} onChange={set('paidBy')} />
          </FieldRow>
            <CatalogField
              kind="CLOSED_SMALL"
              label={tb('paymentMethod')}
              value={props.paymentMethod}
              onChange={setCatalog('paymentMethod')}
              options={hotelTenderOptions(tenderLocale)}
              disabled={disabled}
            />
        </fieldset>
      </FieldPanel>

      {/* 6. Assignment — physical room / times (hidden until arrival stage) */}
      {showAssignment ? (
        <FieldPanel title={t('assignmentSection')}>
          <fieldset disabled={disabled} className="space-y-3 border-0 p-0">
            <FieldRow cols={2} className="items-end">
              <FieldSelect
                label={t('roomNo')}
                preset="selectWide"
                id="res-card-room-select"
                value={props.roomId}
                onChange={set('roomId')}
              >
                <option value="">—</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.roomNumber}
                  </option>
                ))}
              </FieldSelect>
              <div className="flex flex-wrap items-end gap-1 pb-0.5">
                <button
                  type="button"
                  className={SECONDARY_BUTTON_CLASS}
                  title={isLocked ? t('unlock') : t('lock')}
                  disabled={!onToggleLock}
                  onClick={onToggleLock}
                >
                  <Lock className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className={SECONDARY_BUTTON_CLASS}
                  title={t('roomSearch')}
                  disabled={!onFocusRoomSelect}
                  onClick={onFocusRoomSelect}
                >
                  <Search className="h-4 w-4" />
                </button>
                {props.roomId ? (
                  <Link
                    href={`/hk?roomId=${props.roomId}`}
                    className={`${SECONDARY_BUTTON_CLASS} text-[11px]`}
                    title={t('roomHk')}
                  >
                    {roomStatus ?? 'HK'}
                  </Link>
                ) : null}
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
            </FieldRow>
            <FieldRow cols={2} className="items-end">
              <label className="flex items-center gap-2 text-[12px] text-[#34495E]">
                <input
                  type="checkbox"
                  className={MODAL_CHECKBOX_CLASS}
                  checked={props.shareEligible}
                  disabled={disabled || Number(props.adults) !== 1}
                  onChange={(e) => onChange({ shareEligible: e.target.checked ? 'true' : 'false' })}
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
            <FieldSelect
              label={t('givenRoomType')}
              preset="select"
              value={props.givenRoomTypeId}
              onChange={set('givenRoomTypeId')}
            >
              <option value="">—</option>
              {roomTypes.map((rt) => (
                <option key={rt.id} value={rt.id}>
                  {rt.label}
                </option>
              ))}
            </FieldSelect>
            <FieldRow cols={2}>
              <Field
                label={t('checkInTime')}
                preset="time"
                type="time"
                value={props.checkInTime}
                onChange={set('checkInTime')}
              />
              <Field
                label={t('checkOutTime')}
                preset="time"
                type="time"
                value={props.checkOutTime}
                onChange={set('checkOutTime')}
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
        </FieldPanel>
      ) : null}

      {/* 7. Billing — after save */}
      {!isCreate ? (
        <FieldPanel title={t('billing')}>
          <fieldset disabled={disabled} className="space-y-3 border-0 p-0">
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
          </fieldset>
        </FieldPanel>
      ) : null}

      {/* 8. Additional — rare / ElektraWeb residue (collapsed) */}
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
              kind="CLOSED_MEDIUM"
              label={t('preferredLocation')}
              value={props.preferredLocation}
              onChange={setCatalog('preferredLocation')}
              options={withOrphanOption(roomViews, props.preferredLocation)}
              disabled={disabled}
            />
            <CatalogField
              kind="CLOSED_MEDIUM"
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
        </fieldset>
      </FieldSection>
    </aside>
  );
}
