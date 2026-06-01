'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from '@era/satellite-kit/ui';
import { EraModal } from '@/components/EraModal';

type RoomStatus =
  | 'AVAILABLE'
  | 'OCCUPIED'
  | 'DIRTY'
  | 'CLEAN'
  | 'INSPECTED'
  | 'OOO'
  | 'OOS'
  | 'MAINTENANCE';

type ReservationStatus =
  | 'OPTION'
  | 'CONFIRMED'
  | 'IN_HOUSE'
  | 'CHECKED_OUT'
  | 'CANCELLED'
  | 'NO_SHOW';

type Guest = { id: string; fullName: string };

type Reservation = {
  id: string;
  status: ReservationStatus;
  guest: Guest;
  totalAmount: number;
};

type Room = {
  id: string;
  roomNumber: string;
  status: RoomStatus;
  roomType: { code: string; name: string };
  reservations: Reservation[];
};

export type RoomInfoModalProps = {
  room: Room | null;
  open: boolean;
  onClose: () => void;
  busy: boolean;
  canFolioRead: boolean;
  canCheckIn: boolean;
  canCheckOut: boolean;
  canCharge: boolean;
  foodCodeId?: string;
  onCheckIn: (reservationId: string) => void;
  onCheckOut: (reservationId: string) => void;
  onAddCharge: (reservationId: string, revenueCodeId: string) => void;
  onSetStatus: (status: RoomStatus) => void;
  onOpenReservation?: (reservationId: string) => void;
};

export default function RoomInfoModal({
  room,
  open,
  onClose,
  busy,
  canFolioRead,
  canCheckIn,
  canCheckOut,
  canCharge,
  foodCodeId,
  onCheckIn,
  onCheckOut,
  onAddCharge,
  onSetStatus,
  onOpenReservation,
}: RoomInfoModalProps) {
  const t = useTranslations('chessboard');
  const tRoom = useTranslations('roomStatus');
  const tRes = useTranslations('reservationStatus');

  if (!room) return null;

  const activeReservation = room.reservations?.[0];

  return (
    <EraModal
      open={open}
      onClose={onClose}
      title={t('roomTitle', { number: room.roomNumber })}
      subtitle={`${room.roomType.name} · ${tRoom(room.status)}`}
    >
      {activeReservation ? (
        <div className="space-y-2 text-[13px] text-[#34495E]">
          <p>
            {t('guest')}: {activeReservation.guest.fullName}
          </p>
          <p>
            {t('reservation')}: {tRes(activeReservation.status)}
          </p>
          <p>
            {t('balance')}: {activeReservation.totalAmount} AZN
          </p>
          <div className="flex flex-wrap gap-3">
            {onOpenReservation ? (
              <button
                type="button"
                className="text-[#2980B9] hover:underline"
                onClick={() => onOpenReservation(activeReservation.id)}
              >
                {t('openReservationCard')}
              </button>
            ) : null}
            {canFolioRead && (
              <Link href={`/folio/${activeReservation.id}`} className="text-[#2980B9] hover:underline">
                {t('openFolio')}
              </Link>
            )}
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            {activeReservation.status === 'CONFIRMED' && canCheckIn && (
              <button
                type="button"
                disabled={busy}
                onClick={() => onCheckIn(activeReservation.id)}
                className={PRIMARY_BUTTON_CLASS}
              >
                {t('checkIn')}
              </button>
            )}
            {activeReservation.status === 'IN_HOUSE' && (
              <>
                {foodCodeId && canCharge && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onAddCharge(activeReservation.id, foodCodeId)}
                    className={SECONDARY_BUTTON_CLASS}
                  >
                    {t('addCharge')}
                  </button>
                )}
                {canCheckOut && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onCheckOut(activeReservation.id)}
                    className={SECONDARY_BUTTON_CLASS}
                  >
                    {t('checkOut')}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      ) : (
        <p className="text-[13px] text-[#7F8C8D]">{t('noReservation')}</p>
      )}

      <div className="mt-6 border-t border-[#D5DADF] pt-4">
        <p className="mb-2 text-xs font-semibold uppercase text-[#7F8C8D]">{t('housekeeping')}</p>
        <div className="flex flex-wrap gap-2">
          {(['CLEAN', 'INSPECTED', 'DIRTY', 'AVAILABLE', 'OOO'] as RoomStatus[]).map((s) => (
            <button
              key={s}
              type="button"
              disabled={busy}
              onClick={() => onSetStatus(s)}
              className={SECONDARY_BUTTON_CLASS}
            >
              {tRoom(s)}
            </button>
          ))}
        </div>
      </div>
    </EraModal>
  );
}
