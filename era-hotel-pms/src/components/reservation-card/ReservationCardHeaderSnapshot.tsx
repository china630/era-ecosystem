'use client';

import { useTranslations } from 'next-intl';
import { TEXT_DANGER_CLASS } from '@era/satellite-kit/ui';
import {
  PAYMENT_CATEGORIES,
  type PaymentCategory,
} from '@/lib/payment-category';

export type OccupancyWorld = 'exclusive' | 'share' | 'booking';

export type ReservationCardHeaderSnapshotProps = {
  isCreate: boolean;
  categorySpend: Record<PaymentCategory, number>;
  stayDebt: number;
  stayCredit: number;
  occupancyWorld: OccupancyWorld;
  bookingRoomCount?: number;
  /** When booking world — click N-rooms chip to focus family StaysBar. */
  onOccupancyClick?: () => void;
};

const STAT_COLORS = [
  'text-[#2980B9]',
  'text-amber-600',
  'text-emerald-600',
  'text-violet-600',
  'text-sky-700',
];

/** Category spend + net stay debt/credit — guest identity lives in ModalShell title. */
export function ReservationCardHeaderSnapshot(props: ReservationCardHeaderSnapshotProps) {
  const t = useTranslations('reservationCard');
  const tf = useTranslations('folio');

  const worldLabel =
    props.occupancyWorld === 'share'
      ? t('occupancyShare')
      : props.occupancyWorld === 'booking'
        ? t('occupancyBooking', { count: props.bookingRoomCount ?? 2 })
        : t('occupancyExclusive');

  const items: Array<{
    key: string;
    label: string;
    value: string;
    danger: boolean;
    valueClass?: string;
    clickable: boolean;
  }> = PAYMENT_CATEGORIES.map((cat) => ({
    key: cat,
    label: tf(`paymentCategory_${cat}`),
    value: props.isCreate ? '—' : `${props.categorySpend[cat].toFixed(2)} AZN`,
    danger: false,
    clickable: false,
  }));

  const netLabel =
    !props.isCreate && props.stayDebt > 0.01
      ? tf('stayNetDebt')
      : !props.isCreate && props.stayCredit > 0.01
        ? tf('stayNetCredit')
        : tf('settled');
  const netValue = props.isCreate
    ? '—'
    : props.stayDebt > 0.01
      ? `${props.stayDebt.toFixed(2)} AZN`
      : props.stayCredit > 0.01
        ? `${props.stayCredit.toFixed(2)} AZN`
        : '0.00 AZN';

  items.push({
    key: 'net',
    label: netLabel,
    value: netValue,
    danger: !props.isCreate && props.stayDebt > 0.01,
    valueClass: !props.isCreate && props.stayCredit > 0.01 ? 'text-sky-700' : undefined,
    clickable: false,
  });

  if (props.occupancyWorld !== 'exclusive') {
    items.push({
      key: 'world',
      label: t('occupancyWorld'),
      value: worldLabel,
      danger: false,
      clickable:
        props.occupancyWorld === 'booking' && typeof props.onOccupancyClick === 'function',
    });
  }

  const colClass =
    items.length <= 5 ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5' : 'grid-cols-2 sm:grid-cols-3';

  return (
    <div className="mb-2 shrink-0" data-testid="reservation-card-header-snapshot">
      <div className={`grid gap-2 ${colClass}`}>
        {items.map((s, i) => {
          const inner = (
            <>
              <p className={`text-[10px] font-medium uppercase ${STAT_COLORS[i % STAT_COLORS.length]}`}>
                {s.label}
              </p>
              <p
                className={`text-base font-bold ${
                  s.danger ? TEXT_DANGER_CLASS : s.valueClass ?? 'text-[#34495E]'
                }`}
              >
                {s.value}
              </p>
            </>
          );
          if (s.clickable) {
            return (
              <button
                key={s.key}
                type="button"
                className="rounded-lg border border-[#D5DADF] bg-white p-2 text-center shadow-sm hover:border-sky-400"
                data-testid="reservation-occupancy-chip"
                title={t('focusFamilyBar')}
                onClick={props.onOccupancyClick}
              >
                {inner}
              </button>
            );
          }
          return (
            <div
              key={s.key}
              className="rounded-lg border border-[#D5DADF] bg-white p-2 text-center shadow-sm"
            >
              {inner}
            </div>
          );
        })}
      </div>
    </div>
  );
}
