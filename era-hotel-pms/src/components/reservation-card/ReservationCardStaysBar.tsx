'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import { CHIP_CLASS, GHOST_BUTTON_CLASS, SECONDARY_BUTTON_CLASS, TEXT_MUTED_CLASS } from '@era/satellite-kit/ui';

export type BookingStaySummary = {
  id: string;
  status: string;
  checkInDate: string;
  checkOutDate: string;
  roomType: { code: string };
  room: { roomNumber: string } | null;
  guest: { fullName: string };
  paxGuests: Array<{ firstName: string | null; lastName: string | null; isPrimary: boolean }>;
  ratePlan: { code: string };
};

/** Sibling RoomStay rows under the same Booking (ReservationGroup). */
export function ReservationCardStaysBar({
  bookingCode,
  bookingName,
  folioMode,
  stays,
  activeStayId,
  onSelectStay,
  onAddStay,
  addDisabled,
  onSaveBookingName,
  nameDisabled,
  onSwapRooms,
  swapDisabled,
}: {
  bookingCode?: string | null;
  bookingName?: string | null;
  folioMode?: string | null;
  stays: BookingStaySummary[];
  activeStayId?: string | null;
  onSelectStay: (id: string) => void;
  onAddStay?: () => void;
  addDisabled?: boolean;
  onSaveBookingName?: (name: string) => Promise<void> | void;
  nameDisabled?: boolean;
  onSwapRooms?: () => void;
  swapDisabled?: boolean;
}) {
  const t = useTranslations('booking');
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(bookingName ?? '');
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    setNameDraft(bookingName ?? '');
    setEditingName(false);
  }, [bookingName, bookingCode]);

  const multiRoom = stays.length > 1;
  if (!multiRoom && !bookingCode && !onAddStay) return null;

  async function commitName() {
    if (!onSaveBookingName || nameDisabled) {
      setEditingName(false);
      return;
    }
    const next = nameDraft.trim();
    if (!next) {
      setNameDraft(bookingName ?? '');
      setEditingName(false);
      return;
    }
    if (next === (bookingName ?? '').trim()) {
      setEditingName(false);
      return;
    }
    setSavingName(true);
    try {
      await onSaveBookingName(next);
      setEditingName(false);
    } finally {
      setSavingName(false);
    }
  }

  const nameLabel = (bookingName ?? '').trim();

  /** Single-door stay: thin GRP strip — no "Family / group · 1 room" chrome. */
  if (!multiRoom) {
    return (
      <div
        className="mb-2 flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-md border border-[#D5DADF] bg-[#F8F9FA] px-2.5 py-1.5"
        data-testid="reservation-family-stays-bar"
        data-mode="single"
      >
        <p className={`m-0 min-w-0 truncate text-[12px] ${TEXT_MUTED_CLASS}`}>
          {bookingCode ? (
            <>
              <span className="font-mono text-[#34495E]">{bookingCode}</span>
              {folioMode ? <span className="ml-2">{t('folioMode')}: {folioMode}</span> : null}
            </>
          ) : (
            t('singleStayHint')
          )}
        </p>
        {onAddStay ? (
          <button
            type="button"
            className={GHOST_BUTTON_CLASS}
            disabled={addDisabled}
            title={addDisabled ? t('availableAfterSave') : t('addStay')}
            aria-label={t('addStay')}
            onClick={onAddStay}
          >
            <Plus className="h-4 w-4" />
            <span className="ml-1 hidden sm:inline">{t('addStay')}</span>
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className="mb-2 shrink-0 space-y-2 rounded-lg border border-[#D5DADF] bg-[#F8F9FA] p-2.5"
      data-testid="reservation-family-stays-bar"
      data-mode="multi"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className={`flex min-w-0 flex-wrap items-center gap-x-1.5 ${TEXT_MUTED_CLASS}`}>
          <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-900">
            {t('familyGroupBadge', { count: stays.length })}
          </span>
          {onSaveBookingName && editingName ? (
            <input
              className="h-7 min-w-[10rem] max-w-[16rem] rounded border border-[#2980B9] bg-white px-2 text-[12px] font-semibold text-[#34495E] outline-none"
              value={nameDraft}
              disabled={nameDisabled || savingName}
              autoFocus
              placeholder={t('bookingNamePlaceholder')}
              aria-label={t('bookingName')}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={() => void commitName()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  (e.target as HTMLInputElement).blur();
                }
                if (e.key === 'Escape') {
                  setNameDraft(bookingName ?? '');
                  setEditingName(false);
                }
              }}
            />
          ) : onSaveBookingName ? (
            <button
              type="button"
              className="truncate text-left text-[12px] font-semibold text-[#34495E] hover:underline"
              title={t('bookingName')}
              disabled={nameDisabled}
              onClick={() => setEditingName(true)}
            >
              {nameLabel || t('bookingNamePlaceholder')}
            </button>
          ) : nameLabel ? (
            <strong className="truncate text-[#34495E]">{nameLabel}</strong>
          ) : null}

          {bookingCode ? (
            <span className="truncate font-mono text-[12px] text-[#34495E]">{bookingCode}</span>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {onSwapRooms ? (
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              disabled={swapDisabled}
              title={t('swapRooms')}
              onClick={onSwapRooms}
            >
              {t('swapRooms')}
            </button>
          ) : null}
          {onAddStay ? (
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              disabled={addDisabled}
              title={addDisabled ? t('availableAfterSave') : t('addStay')}
              onClick={onAddStay}
            >
              {t('addStay')}
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {stays.map((s) => {
          const primary = s.paxGuests.find((p) => p.isPrimary) ?? s.paxGuests[0];
          const label =
            primary?.firstName || primary?.lastName
              ? `${primary.firstName ?? ''} ${primary.lastName ?? ''}`.trim()
              : s.guest.fullName;
          const active = s.id === activeStayId;
          const roomNo = s.room?.roomNumber ? `№${s.room.roomNumber}` : s.roomType.code;
          return (
            <button
              key={s.id}
              type="button"
              className={`${CHIP_CLASS} ${active ? 'ring-2 ring-[#2980B9]' : ''}`}
              onClick={() => onSelectStay(s.id)}
              title={`${label} · ${s.status}`}
            >
              {roomNo} · {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
