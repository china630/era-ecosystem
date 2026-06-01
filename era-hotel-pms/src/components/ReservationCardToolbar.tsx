'use client';

import { useTranslations } from 'next-intl';
import { PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from '@era/satellite-kit/ui';

export type ReservationCardToolbarProps = {
  subtitle?: string;
  busy?: boolean;
  loading?: boolean;
  isLocked?: boolean;
  noteCount?: number;
  onSave?: () => void;
  onClose: () => void;
  onToggleLock?: () => void;
  onPrint?: () => void;
  showLock?: boolean;
};

export function ReservationCardToolbar({
  subtitle,
  busy,
  loading,
  isLocked,
  noteCount = 0,
  onSave,
  onClose,
  onToggleLock,
  onPrint,
  showLock = true,
}: ReservationCardToolbarProps) {
  const t = useTranslations('reservationCard');
  const tc = useTranslations('common');

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[#D5DADF] pb-2">
      <span className="min-w-0 truncate text-[13px] text-[#7F8C8D]">{subtitle ?? t('newReservation')}</span>
      <div className="flex flex-wrap gap-2">
        {showLock && onToggleLock ? (
          <button type="button" className={SECONDARY_BUTTON_CLASS} disabled={busy} onClick={onToggleLock}>
            {isLocked ? t('unlock') : t('lock')}
          </button>
        ) : null}
        <button
          type="button"
          className={SECONDARY_BUTTON_CLASS}
          onClick={onPrint ?? (() => window.print())}
        >
          {t('print')}
        </button>
        {onSave ? (
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={busy || loading || isLocked}
            onClick={onSave}
          >
            {tc('save')}
          </button>
        ) : null}
        <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={onClose}>
          {tc('close')}
        </button>
      </div>
    </div>
  );
}

export function ReservationCardBottomBar({
  noteCount = 0,
  onTab,
  activeBottom,
}: {
  noteCount?: number;
  onTab?: (tab: 'details' | 'notes' | 'folio') => void;
  activeBottom?: string;
}) {
  const t = useTranslations('reservationCard');
  const items: { id: 'details' | 'notes' | 'folio'; label: string; badge?: number }[] = [
    { id: 'details', label: t('bottom.details') },
    { id: 'notes', label: t('bottom.notes'), badge: noteCount },
    { id: 'folio', label: t('bottom.folio') },
  ];

  return (
    <div className="sticky bottom-0 flex flex-wrap gap-2 border-t border-[#D5DADF] bg-white py-2">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`rounded-lg px-3 py-1.5 text-[12px] font-medium text-white ${
            activeBottom === item.id ? 'bg-[#C0392B]' : 'bg-[#E74C3C] hover:bg-[#C0392B]'
          }`}
          onClick={() => onTab?.(item.id)}
        >
          {item.label}
          {item.badge != null && item.badge > 0 ? ` (${item.badge})` : ''}
        </button>
      ))}
    </div>
  );
}
