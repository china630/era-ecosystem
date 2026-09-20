'use client';

import { useTranslations } from 'next-intl';
import { TEXT_DANGER_CLASS } from '@era/satellite-kit/ui';

export type OccupancyWorld = 'exclusive' | 'share' | 'booking';

export type ReservationCardHeaderSnapshotProps = {
  isCreate: boolean;
  totalAmount: number;
  depositAmount: number;
  folioBalance: number;
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
];

/** Financial strip only — guest identity lives in ModalShell title (density). */
export function ReservationCardHeaderSnapshot(props: ReservationCardHeaderSnapshotProps) {
  const t = useTranslations('reservationCard');

  const worldLabel =
    props.occupancyWorld === 'share'
      ? t('occupancyShare')
      : props.occupancyWorld === 'booking'
        ? t('occupancyBooking', { count: props.bookingRoomCount ?? 2 })
        : t('occupancyExclusive');

  const items = [
    {
      key: 'total',
      label: t('headerTotal'),
      value: props.isCreate ? '—' : `${props.totalAmount.toFixed(2)} AZN`,
      danger: false,
      clickable: false,
    },
    {
      key: 'deposit',
      label: t('headerDeposit'),
      value: props.isCreate ? '—' : `${props.depositAmount.toFixed(2)} AZN`,
      danger: false,
      clickable: false,
    },
    {
      key: 'balance',
      label: t('folioBalance'),
      value: props.isCreate ? '—' : `${props.folioBalance.toFixed(2)} AZN`,
      danger: !props.isCreate && props.folioBalance > 0.01,
      clickable: false,
    },
  ];

  /** Occupancy chip only when not the default exclusive single-stay. */
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

  return (
    <div className="mb-2 shrink-0" data-testid="reservation-card-header-snapshot">
      <div
        className={`grid gap-2 ${
          items.length === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'
        }`}
      >
        {items.map((s, i) => {
          const inner = (
            <>
              <p className={`text-[10px] font-medium uppercase ${STAT_COLORS[i % STAT_COLORS.length]}`}>
                {s.label}
              </p>
              <p
                className={`text-base font-bold ${
                  s.danger ? TEXT_DANGER_CLASS : 'text-[#34495E]'
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
