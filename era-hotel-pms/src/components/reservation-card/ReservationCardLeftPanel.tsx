'use client';

import Link from 'next/link';
import { Bed, Lock, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  FORM_FIELD_GROUP_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  MODAL_INPUT_CLASS,
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

  return (
    <aside className="space-y-3 overflow-y-auto border-r border-[#D5DADF] pr-3 text-[13px]">
      <fieldset className="space-y-2" disabled={isLocked}>
        <legend className="font-semibold text-[#34495E]">{t('stay')}</legend>
        <div className={FORM_FIELD_GROUP_CLASS}>
          <label className={MODAL_FIELD_LABEL_CLASS}>{tb('checkIn')}</label>
          <input type="date" className={MODAL_INPUT_CLASS} value={props.checkIn} onChange={set('checkIn')} />
        </div>
        <div className={FORM_FIELD_GROUP_CLASS}>
          <label className={MODAL_FIELD_LABEL_CLASS}>{tb('checkOut')}</label>
          <input type="date" className={MODAL_INPUT_CLASS} value={props.checkOut} onChange={set('checkOut')} />
        </div>
        <div className={FORM_FIELD_GROUP_CLASS}>
          <label className={MODAL_FIELD_LABEL_CLASS}>{t('nights')}</label>
          <input className={MODAL_INPUT_CLASS} value={String(nights)} readOnly />
        </div>
        {!isCreate ? (
          <>
            <div className={FORM_FIELD_GROUP_CLASS}>
              <label className={MODAL_FIELD_LABEL_CLASS}>{t('checkInTime')}</label>
              <input type="time" className={MODAL_INPUT_CLASS} value={props.checkInTime} onChange={set('checkInTime')} />
            </div>
            <div className={FORM_FIELD_GROUP_CLASS}>
              <label className={MODAL_FIELD_LABEL_CLASS}>{t('checkOutTime')}</label>
              <input type="time" className={MODAL_INPUT_CLASS} value={props.checkOutTime} onChange={set('checkOutTime')} />
            </div>
            {props.reservationId ? (
              <ReservationCardEarlyLatePanel
                reservationId={props.reservationId}
                checkInTime={props.checkInTime}
                checkOutTime={props.checkOutTime}
              />
            ) : null}
          </>
        ) : null}
        <div className={FORM_FIELD_GROUP_CLASS}>
          <label className={MODAL_FIELD_LABEL_CLASS}>{t('voucherNo')}</label>
          <input className={MODAL_INPUT_CLASS} value={props.voucherNo} onChange={set('voucherNo')} />
        </div>
        <div className={FORM_FIELD_GROUP_CLASS}>
          <label className={MODAL_FIELD_LABEL_CLASS}>{t('resNo')}</label>
          <input className={MODAL_INPUT_CLASS} value={props.resNo} onChange={set('resNo')} />
        </div>
        <div className={FORM_FIELD_GROUP_CLASS}>
          <label className={MODAL_FIELD_LABEL_CLASS}>{t('shareNo')}</label>
          <input className={MODAL_INPUT_CLASS} value={props.shareNo} onChange={set('shareNo')} />
        </div>
        <div className={FORM_FIELD_GROUP_CLASS}>
          <label className={MODAL_FIELD_LABEL_CLASS}>{t('agency')}</label>
          <select className={MODAL_INPUT_CLASS} value={props.agencyId} onChange={set('agencyId')}>
            <option value="">{t('individual')}</option>
            {agencies.map((a) => (
              <option key={a.id} value={a.id}>{a.label}</option>
            ))}
          </select>
        </div>
        <div className={FORM_FIELD_GROUP_CLASS}>
          <label className={MODAL_FIELD_LABEL_CLASS}>{t('source')}</label>
          <select className={MODAL_INPUT_CLASS} value={props.sourceId} onChange={set('sourceId')}>
            <option value="">—</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>
        <div className={FORM_FIELD_GROUP_CLASS}>
          <label className={MODAL_FIELD_LABEL_CLASS}>{tb('roomType')}</label>
          <select className={MODAL_INPUT_CLASS} value={props.roomTypeId} onChange={set('roomTypeId')} required={isCreate}>
            {isCreate ? <option value="">{tc('select')}</option> : null}
            {roomTypes.map((rt) => (
              <option key={rt.id} value={rt.id}>{rt.label}</option>
            ))}
          </select>
        </div>
        <div className={FORM_FIELD_GROUP_CLASS}>
          <label className={MODAL_FIELD_LABEL_CLASS}>{t('preferredLocation')}</label>
          <input className={MODAL_INPUT_CLASS} value={props.preferredLocation} onChange={set('preferredLocation')} />
        </div>
        <div className={FORM_FIELD_GROUP_CLASS}>
          <label className={MODAL_FIELD_LABEL_CLASS}>{t('preferredBed')}</label>
          <input className={MODAL_INPUT_CLASS} value={props.preferredBed} onChange={set('preferredBed')} />
        </div>
        <div className={FORM_FIELD_GROUP_CLASS}>
          <label className={MODAL_FIELD_LABEL_CLASS}>{t('givenRoomType')}</label>
          <select className={MODAL_INPUT_CLASS} value={props.givenRoomTypeId} onChange={set('givenRoomTypeId')}>
            <option value="">—</option>
            {roomTypes.map((rt) => (
              <option key={rt.id} value={rt.id}>{rt.label}</option>
            ))}
          </select>
        </div>
        <div className={FORM_FIELD_GROUP_CLASS}>
          <label className={MODAL_FIELD_LABEL_CLASS}>{t('salesContract')}</label>
          <select className={MODAL_INPUT_CLASS} value={props.salesContractId} onChange={set('salesContractId')}>
            <option value="">—</option>
            {salesContracts
              .filter((c) => !props.agencyId || !c.agencyId || c.agencyId === props.agencyId)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
          </select>
        </div>
        <div className={FORM_FIELD_GROUP_CLASS}>
          <label className={MODAL_FIELD_LABEL_CLASS}>{t('contractRef')}</label>
          <input className={MODAL_INPUT_CLASS} value={props.contractRef} onChange={set('contractRef')} />
        </div>
        {!isCreate ? (
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS}>{t('roomNo')}</label>
            <div className="flex flex-wrap items-center gap-1">
              <select
                id="res-card-room-select"
                className={MODAL_INPUT_CLASS}
                value={props.roomId}
                onChange={set('roomId')}
              >
                <option value="">—</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>{r.roomNumber}</option>
                ))}
              </select>
              <div className="flex gap-0.5">
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
                  <button type="button" className={SECONDARY_BUTTON_CLASS} title={t('roomSearch')} onClick={onFocusRoomSelect}>
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
              </div>
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
          </div>
        ) : null}
        <div className={FORM_FIELD_GROUP_CLASS}>
          <label className={MODAL_FIELD_LABEL_CLASS}>{t('roomCount')}</label>
          <input type="number" min={1} className={MODAL_INPUT_CLASS} value={props.roomCount} onChange={set('roomCount')} />
        </div>
        <div className={FORM_FIELD_GROUP_CLASS}>
          <label className={MODAL_FIELD_LABEL_CLASS}>{t('rateType')}</label>
          <input className={MODAL_INPUT_CLASS} value={props.rateType} onChange={set('rateType')} />
        </div>
        {isCreate ? (
          <>
            <div className={FORM_FIELD_GROUP_CLASS}>
              <label className={MODAL_FIELD_LABEL_CLASS}>{tb('ratePlan')}</label>
              <select className={MODAL_INPUT_CLASS} value={props.ratePlanId} onChange={set('ratePlanId')} required>
                <option value="">{tc('select')}</option>
                {ratePlans.map((rp) => (
                  <option key={rp.id} value={rp.id}>{rp.label}</option>
                ))}
              </select>
            </div>
            <div className={FORM_FIELD_GROUP_CLASS}>
              <label className={MODAL_FIELD_LABEL_CLASS}>{tb('paymentMethod')}</label>
              <select className={MODAL_INPUT_CLASS} value={props.paymentMethod} onChange={set('paymentMethod')}>
                <option value="CASH">{tPay('CASH')}</option>
                <option value="CARD">{tPay('CARD')}</option>
                <option value="COMPANY_ACCOUNT">{tPay('COMPANY_ACCOUNT')}</option>
              </select>
            </div>
          </>
        ) : null}
        <div className={FORM_FIELD_GROUP_CLASS}>
          <label className={MODAL_FIELD_LABEL_CLASS}>{t('mealPlan')}</label>
          <select className={MODAL_INPUT_CLASS} value={props.mealPlanId} onChange={set('mealPlanId')}>
            <option value="">—</option>
            {mealPlans.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>
        <div className={FORM_FIELD_GROUP_CLASS}>
          <label className={MODAL_FIELD_LABEL_CLASS}>{t('adults')}</label>
          <input type="number" min={0} className={MODAL_INPUT_CLASS} value={props.adults} onChange={set('adults')} />
        </div>
        <div className="grid grid-cols-3 gap-1">
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS}>{t('child11_6')}</label>
            <input type="number" min={0} className={MODAL_INPUT_CLASS} value={props.children11_6} onChange={set('children11_6')} />
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS}>{t('child5_2')}</label>
            <input type="number" min={0} className={MODAL_INPUT_CLASS} value={props.children5_2} onChange={set('children5_2')} />
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS}>{t('child1_0')}</label>
            <input type="number" min={0} className={MODAL_INPUT_CLASS} value={props.children1_0} onChange={set('children1_0')} />
          </div>
        </div>
        <div className={FORM_FIELD_GROUP_CLASS}>
          <label className={MODAL_FIELD_LABEL_CLASS}>{t('market')}</label>
          <input className={MODAL_INPUT_CLASS} value={props.market} onChange={set('market')} />
        </div>
        <div className={FORM_FIELD_GROUP_CLASS}>
          <label className={MODAL_FIELD_LABEL_CLASS}>{t('segment')}</label>
          <input className={MODAL_INPUT_CLASS} value={props.segment} onChange={set('segment')} />
        </div>
        <div className={FORM_FIELD_GROUP_CLASS}>
          <label className={MODAL_FIELD_LABEL_CLASS}>{t('optionDate')}</label>
          <input type="date" className={MODAL_INPUT_CLASS} value={props.optionDate} onChange={set('optionDate')} />
        </div>
        <div className={FORM_FIELD_GROUP_CLASS}>
          <label className={MODAL_FIELD_LABEL_CLASS}>{t('optionState')}</label>
          <input className={MODAL_INPUT_CLASS} value={props.optionState} onChange={set('optionState')} />
        </div>
        <div className={FORM_FIELD_GROUP_CLASS}>
          <label className={MODAL_FIELD_LABEL_CLASS}>{t('salesProject')}</label>
          <input className={MODAL_INPUT_CLASS} value={props.salesProject} onChange={set('salesProject')} />
        </div>
        <div className={FORM_FIELD_GROUP_CLASS}>
          <label className={MODAL_FIELD_LABEL_CLASS}>{t('specialStates')}</label>
          <input className={MODAL_INPUT_CLASS} value={props.specialStates} onChange={set('specialStates')} />
        </div>
        <div className={FORM_FIELD_GROUP_CLASS}>
          <label className={MODAL_FIELD_LABEL_CLASS}>{t('resGroup')}</label>
          <input className={MODAL_INPUT_CLASS} value={props.resGroup} onChange={set('resGroup')} />
        </div>
        <div className={FORM_FIELD_GROUP_CLASS}>
          <label className={MODAL_FIELD_LABEL_CLASS}>{t('colorCode')}</label>
          <input className={MODAL_INPUT_CLASS} value={props.colorCode} onChange={set('colorCode')} />
        </div>
      </fieldset>
      {!isCreate ? (
        <fieldset className="space-y-2" disabled={isLocked}>
          <legend className="font-semibold text-[#34495E]">{t('billing')}</legend>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS}>{t('creditLimitAzn')}</label>
            <input
              type="number"
              min={0}
              step={0.01}
              className={MODAL_INPUT_CLASS}
              value={props.creditLimitAzn}
              onChange={set('creditLimitAzn')}
              placeholder={t('creditLimitPlaceholder')}
            />
          </div>
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
      ) : null}
    </aside>
  );
}
