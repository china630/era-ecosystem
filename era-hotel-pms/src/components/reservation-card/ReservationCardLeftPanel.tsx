'use client';

import Link from 'next/link';
import { Bed, Lock, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  Field,
  FieldRow,
  FieldSection,
  FieldSelect,
  SECONDARY_BUTTON_CLASS,
} from '@era/satellite-kit/ui';
import { ReservationCardEarlyLatePanel } from '@/components/reservation-card/ReservationCardEarlyLatePanel';
import type { SelectOption } from './types';

function nightsBetween(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0;
  const a = new Date(checkIn);
  const b = new Date(checkOut);
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000));
}

export type ReservationCardLeftPanelProps = {
  isCreate: boolean;
  isLocked: boolean;
  checkIn: string;
  checkOut: string;
  checkInTime: string;
  checkOutTime: string;
  voucherNo: string;
  agencyId: string;
  sourceId: string;
  roomTypeId: string;
  roomId: string;
  roomCount: string;
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
  reservationId?: string | null;
  agencies: SelectOption[];
  sources: SelectOption[];
  salesContracts: Array<{ id: string; label: string; agencyId: string | null; ratePlanId: string; code: string }>;
  roomTypes: SelectOption[];
  mealPlans: SelectOption[];
  ratePlans: SelectOption[];
  rooms: Array<{ id: string; roomNumber: string }>;
  onChange: (patch: Partial<Record<string, string>>) => void;
  onAssignRoom?: () => void;
  assignBusy?: boolean;
  onFocusRoomSelect?: () => void;
  onToggleLock?: () => void;
  roomStatus?: string;
};

export function ReservationCardLeftPanel(props: ReservationCardLeftPanelProps) {
  const t = useTranslations('reservationCard');
  const tb = useTranslations('booking');
  const tc = useTranslations('common');
  const tPay = useTranslations('paymentMethod');
  const {
    isCreate,
    isLocked,
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
    onFocusRoomSelect,
    onToggleLock,
    roomStatus,
  } = props;

  const nights = nightsBetween(props.checkIn, props.checkOut);

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    onChange({ [key]: e.target.value });

  const disabled = isLocked;

  return (
    <aside className="space-y-4 overflow-y-auto border-r border-[#D5DADF] pr-3 text-[13px]">
      <FieldSection title={t('stay')} defaultOpen>
        <fieldset disabled={disabled} className="space-y-4 border-0 p-0">
          <FieldRow cols={3}>
            <Field label={tb('checkIn')} preset="date" type="date" value={props.checkIn} onChange={set('checkIn')} />
            <Field label={tb('checkOut')} preset="date" type="date" value={props.checkOut} onChange={set('checkOut')} />
            <Field label={t('nights')} preset="count" value={String(nights)} readOnly />
          </FieldRow>
          {!isCreate ? (
            <>
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
            </>
          ) : null}
          <FieldRow cols={2}>
            <Field label={t('resNo')} preset="code" value={props.resNo} onChange={set('resNo')} />
            <Field label={t('voucherNo')} preset="code" value={props.voucherNo} onChange={set('voucherNo')} />
          </FieldRow>
          <Field label={t('shareNo')} preset="code" value={props.shareNo} onChange={set('shareNo')} />
          {isCreate ? (
            <FieldSelect
              label={tb('roomType')}
              preset="selectWide"
              value={props.roomTypeId}
              onChange={set('roomTypeId')}
              required
            >
              <option value="">{tc('select')}</option>
              {roomTypes.map((rt) => (
                <option key={rt.id} value={rt.id}>
                  {rt.label}
                </option>
              ))}
            </FieldSelect>
          ) : null}
          {!isCreate ? (
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
                {onToggleLock ? (
                  <button
                    type="button"
                    className={SECONDARY_BUTTON_CLASS}
                    title={isLocked ? t('unlock') : t('lock')}
                    onClick={onToggleLock}
                  >
                    <Lock className="h-4 w-4" />
                  </button>
                ) : null}
                {onFocusRoomSelect ? (
                  <button
                    type="button"
                    className={SECONDARY_BUTTON_CLASS}
                    title={t('roomSearch')}
                    onClick={onFocusRoomSelect}
                  >
                    <Search className="h-4 w-4" />
                  </button>
                ) : null}
                {props.roomId ? (
                  <Link
                    href={`/housekeeping?roomId=${props.roomId}`}
                    className={`${SECONDARY_BUTTON_CLASS} text-[11px]`}
                    title={t('roomHk')}
                  >
                    {roomStatus ?? 'HK'}
                  </Link>
                ) : null}
                <span className={SECONDARY_BUTTON_CLASS} title={t('preferredBed')}>
                  <Bed className="h-4 w-4" />
                </span>
                {onAssignRoom ? (
                  <button
                    type="button"
                    className="shrink-0 rounded-lg border border-[#D5DADF] px-2 text-[12px] hover:bg-[#F8FAFC]"
                    disabled={assignBusy || !props.roomId}
                    onClick={onAssignRoom}
                  >
                    {t('assignRoom')}
                  </button>
                ) : null}
              </div>
            </FieldRow>
          ) : null}
        </fieldset>
      </FieldSection>

      <FieldSection title={t('commercial')} defaultOpen>
        <fieldset disabled={disabled} className="space-y-4 border-0 p-0">
          <FieldSelect label={t('agency')} preset="selectWide" value={props.agencyId} onChange={set('agencyId')}>
            <option value="">{t('individual')}</option>
            {agencies.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </FieldSelect>
          <FieldSelect label={t('source')} preset="select" value={props.sourceId} onChange={set('sourceId')}>
            <option value="">—</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </FieldSelect>
          <FieldSelect
            label={t('salesContract')}
            preset="selectWide"
            value={props.salesContractId}
            onChange={set('salesContractId')}
          >
            <option value="">—</option>
            {salesContracts
              .filter((c) => !props.agencyId || !c.agencyId || c.agencyId === props.agencyId)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
          </FieldSelect>
          <Field label={t('contractRef')} preset="code" value={props.contractRef} onChange={set('contractRef')} />
          {isCreate ? (
            <>
              <FieldSelect
                label={tb('ratePlan')}
                preset="selectWide"
                value={props.ratePlanId}
                onChange={set('ratePlanId')}
                required
              >
                <option value="">{tc('select')}</option>
                {ratePlans.map((rp) => (
                  <option key={rp.id} value={rp.id}>
                    {rp.label}
                  </option>
                ))}
              </FieldSelect>
              <FieldSelect
                label={tb('paymentMethod')}
                preset="select"
                value={props.paymentMethod}
                onChange={set('paymentMethod')}
              >
                <option value="CASH">{tPay('CASH')}</option>
                <option value="CARD">{tPay('CARD')}</option>
                <option value="COMPANY_ACCOUNT">{tPay('COMPANY_ACCOUNT')}</option>
              </FieldSelect>
            </>
          ) : null}
          <FieldSelect label={t('mealPlan')} preset="select" value={props.mealPlanId} onChange={set('mealPlanId')}>
            <option value="">—</option>
            {mealPlans.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </FieldSelect>
        </fieldset>
      </FieldSection>

      <FieldSection title={t('pax')} defaultOpen>
        <fieldset disabled={disabled} className="space-y-4 border-0 p-0">
          <Field
            label={t('adults')}
            preset="count"
            type="number"
            min={0}
            value={props.adults}
            onChange={set('adults')}
          />
          <FieldRow cols={3}>
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
          <Field
            label={t('roomCount')}
            preset="count"
            type="number"
            min={1}
            value={props.roomCount}
            onChange={set('roomCount')}
          />
        </fieldset>
      </FieldSection>

      <FieldSection title={t('segmentation')} defaultOpen={false}>
        <fieldset disabled={disabled} className="space-y-4 border-0 p-0">
          <FieldRow cols={2}>
            <Field label={t('market')} preset="code" value={props.market} onChange={set('market')} />
            <Field label={t('segment')} preset="code" value={props.segment} onChange={set('segment')} />
          </FieldRow>
          <Field label={t('rateType')} preset="code" value={props.rateType} onChange={set('rateType')} />
          <FieldRow cols={2}>
            <Field
              label={t('optionDate')}
              preset="date"
              type="date"
              value={props.optionDate}
              onChange={set('optionDate')}
            />
            <Field label={t('optionState')} preset="shortText" value={props.optionState} onChange={set('optionState')} />
          </FieldRow>
        </fieldset>
      </FieldSection>

      <FieldSection title={t('preferences')} defaultOpen={false}>
        <fieldset disabled={disabled} className="space-y-4 border-0 p-0">
          <FieldRow cols={2}>
            <Field
              label={t('preferredLocation')}
              preset="shortText"
              value={props.preferredLocation}
              onChange={set('preferredLocation')}
            />
            <Field label={t('preferredBed')} preset="shortText" value={props.preferredBed} onChange={set('preferredBed')} />
          </FieldRow>
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
            <Field label={t('resGroup')} preset="code" value={props.resGroup} onChange={set('resGroup')} />
            <Field label={t('colorCode')} preset="code" value={props.colorCode} onChange={set('colorCode')} />
          </FieldRow>
          <Field label={t('specialStates')} preset="shortText" value={props.specialStates} onChange={set('specialStates')} />
          <Field label={t('salesProject')} preset="shortText" value={props.salesProject} onChange={set('salesProject')} />
        </fieldset>
      </FieldSection>

      {!isCreate ? (
        <FieldSection title={t('billing')} defaultOpen>
          <fieldset disabled={disabled} className="space-y-4 border-0 p-0">
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
            <div className="rounded bg-[#F8FAFC] p-2 text-[12px]">
              <div className="flex justify-between">
                <span className="text-[#7F8C8D]">{t('folioBalance')}</span>
                <span className="font-mono">{props.folioBalance.toFixed(2)} AZN</span>
              </div>
              {props.creditLimitAzn !== '' && !Number.isNaN(Number(props.creditLimitAzn)) ? (
                <div className="mt-1 flex justify-between">
                  <span className="text-[#7F8C8D]">{t('creditRemaining')}</span>
                  <span
                    className={`font-mono ${
                      Number(props.creditLimitAzn) - props.folioBalance <= 0 ? 'text-[#E74C3C]' : 'text-[#27AE60]'
                    }`}
                  >
                    {Math.max(0, Number(props.creditLimitAzn) - props.folioBalance).toFixed(2)} AZN
                  </span>
                </div>
              ) : (
                <p className="mt-1 text-[#7F8C8D]">{t('creditLimitUnset')}</p>
              )}
            </div>
          </fieldset>
        </FieldSection>
      ) : null}
    </aside>
  );
}
