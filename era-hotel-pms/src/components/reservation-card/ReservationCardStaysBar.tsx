'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CHIP_CLASS, TEXT_MUTED_CLASS } from '@era/satellite-kit/ui';

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
  stays,
  activeStayId,
  onSelectStay,
  onSaveBookingName,
  nameDisabled,
}: {
  bookingCode?: string | null;
  bookingName?: string | null;
  stays: BookingStaySummary[];
  activeStayId?: string | null;
  onSelectStay: (id: string) => void;
  onSaveBookingName?: (name: string) => Promise<void> | void;
  nameDisabled?: boolean;
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
  if (!multiRoom) return null;

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
