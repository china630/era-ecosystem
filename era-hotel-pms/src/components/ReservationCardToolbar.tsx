'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from '@era/satellite-kit/ui';

export type ReservationCardToolbarProps = {
  subtitle?: string;
  busy?: boolean;
  loading?: boolean;
  isLocked?: boolean;
  noteCount?: number;
  canCheckIn?: boolean;
  onSave?: () => void;
  onClose: () => void;
  onToggleLock?: () => void;
  onPrint?: () => void;
  onConfirmCheckIn?: () => void;
  onHistory?: () => void;
  onRecalc?: () => void;
  onChargeAll?: () => void;
  attachOpen?: boolean;
  onAttachToggle?: () => void;
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
  onConfirmCheckIn,
  onHistory,
  onRecalc,
  onChargeAll,
  attachOpen,
  onAttachToggle,
  canCheckIn,
  showLock = true,
}: ReservationCardToolbarProps) {
  const t = useTranslations('reservationCard');
  const tc = useTranslations('common');
  const [menuOpen, setMenuOpen] = useState(false);
  const [lightningOpen, setLightningOpen] = useState(false);

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[#D5DADF] pb-2">
      <span className="min-w-0 truncate text-[13px] text-[#7F8C8D]">{subtitle ?? t('newReservation')}</span>
      <div className="flex flex-wrap gap-2">
        {onAttachToggle ? (
          <button
            type="button"
            className={`${SECONDARY_BUTTON_CLASS} ${attachOpen ? 'ring-2 ring-[#2980B9]' : ''}`}
            disabled={busy}
            onClick={onAttachToggle}
          >
            {t('attach')}
          </button>
        ) : null}
        {onRecalc || onChargeAll ? (
          <div className="relative">
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              disabled={busy}
              title={t('lightning')}
              onClick={() => setLightningOpen((o) => !o)}
            >
              {t('lightning')}
            </button>
            {lightningOpen ? (
              <div className="absolute right-0 top-full z-10 mt-1 min-w-[160px] rounded-lg border border-[#D5DADF] bg-white py-1 shadow-lg">
                {onRecalc ? (
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-[13px] hover:bg-[#F8FAFC]"
                    onClick={() => {
                      setLightningOpen(false);
                      onRecalc();
                    }}
                  >
                    {t('calcDaily')}
                  </button>
                ) : null}
                {onChargeAll ? (
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-[13px] hover:bg-[#F8FAFC]"
                    onClick={() => {
                      setLightningOpen(false);
                      onChargeAll();
                    }}
                  >
                    {t('chargeAll')}
                  </button>
                ) : null}
                {canCheckIn && onConfirmCheckIn ? (
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-[13px] hover:bg-[#F8FAFC]"
                    onClick={() => {
                      setLightningOpen(false);
                      onConfirmCheckIn();
                    }}
                  >
                    {t('confirmCheckIn')}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
        {onHistory ? (
          <button type="button" className={SECONDARY_BUTTON_CLASS} disabled={busy} onClick={onHistory}>
            {t('history')}
          </button>
        ) : null}
        <div className="relative">
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            disabled={busy}
            onClick={() => setMenuOpen((o) => !o)}
          >
            {t('menu')}
          </button>
          {menuOpen ? (
            <div className="absolute right-0 top-full z-10 mt-1 min-w-[140px] rounded-lg border border-[#D5DADF] bg-white py-1 shadow-lg">
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-[13px] hover:bg-[#F8FAFC]"
                onClick={() => {
                  setMenuOpen(false);
                  (onPrint ?? (() => window.print()))();
                }}
              >
                {t('print')}
              </button>
              {showLock && onToggleLock ? (
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-[13px] hover:bg-[#F8FAFC]"
                  onClick={() => {
                    setMenuOpen(false);
                    onToggleLock();
                  }}
                >
                  {isLocked ? t('unlock') : t('lock')}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        {canCheckIn && onConfirmCheckIn ? (
          <button
            type="button"
            className="rounded-lg bg-[#27AE60] px-3 py-1.5 text-[13px] font-medium text-white disabled:opacity-50"
            disabled={busy || loading || isLocked}
            onClick={onConfirmCheckIn}
          >
            {t('confirmCheckIn')}
          </button>
        ) : null}
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
  taskCount = 0,
  onTab,
  activeBottom,
  onCreditCard,
  onPackages,
  onTasks,
  onFolioRouting,
  stubsEnabled = false,
}: {
  noteCount?: number;
  taskCount?: number;
  onTab?: (tab: 'details' | 'notes' | 'folio') => void;
  activeBottom?: string;
  onCreditCard?: () => void;
  onPackages?: () => void;
  onTasks?: () => void;
  onFolioRouting?: () => void;
  stubsEnabled?: boolean;
}) {
  const t = useTranslations('reservationCard');
  const items: { id: 'details' | 'notes' | 'folio'; label: string; badge?: number }[] = [
    { id: 'details', label: t('bottom.details') },
    { id: 'notes', label: t('bottom.notes', { count: noteCount }) },
    { id: 'folio', label: t('bottom.folio') },
  ];

  const stubs: { label: string; onClick?: () => void }[] = [
    { label: t('bottom.creditCard'), onClick: onCreditCard },
    { label: t('bottom.packages'), onClick: onPackages },
    { label: t('bottom.tasks', { count: taskCount }), onClick: onTasks },
    { label: t('bottom.folioRouting'), onClick: onFolioRouting },
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
        </button>
      ))}
      {stubs.map((s) => (
        <button
          key={s.label}
          type="button"
          className={`rounded-lg px-3 py-1.5 text-[12px] font-medium text-white ${
            stubsEnabled && s.onClick ? 'bg-[#E74C3C] hover:bg-[#C0392B]' : 'bg-[#E74C3C]/60'
          }`}
          disabled={!stubsEnabled || !s.onClick}
          onClick={s.onClick}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
