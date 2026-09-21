'use client';

import { useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import {
  CreditCard,
  History,
  Lock,
  LockOpen,
  MoreVertical,
  Paperclip,
  Printer,
  Zap,
} from 'lucide-react';
import {
  DROPDOWN_ITEM_CLASS,
  DROPDOWN_PANEL_CLASS,
  CHIP_CLASS,
  GHOST_BUTTON_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  SUCCESS_BUTTON_CLASS,
} from '@era/satellite-kit/ui';

export type ReservationCardToolbarProps = {
  busy?: boolean;
  loading?: boolean;
  isLocked?: boolean;
  canCheckIn?: boolean;
  onSave?: () => void;
  onClose?: () => void;
  onToggleLock?: () => void;
  onPrint?: () => void;
  onConfirmCheckIn?: () => void;
  onHistory?: () => void;
  onRecalc?: () => void;
  onChargeAll?: () => void;
  onAmendProduct?: () => void;
  attachOpen?: boolean;
  onAttachToggle?: () => void;
  showLock?: boolean;
  showClose?: boolean;
};

type ActionMode = 'header' | 'footer' | 'all';

const ICON_BTN = `${GHOST_BUTTON_CLASS} h-8 w-8 !px-0`;

/** Header / footer action cluster for reservation card (icon header, text footer). */
export function ReservationCardActions({
  busy,
  loading,
  isLocked,
  onSave,
  onClose,
  onToggleLock,
  onPrint,
  onConfirmCheckIn,
  onHistory,
  onRecalc,
  onChargeAll,
  onAmendProduct,
  attachOpen,
  onAttachToggle,
  canCheckIn,
  showLock = true,
  showClose = false,
  mode = 'all',
}: ReservationCardToolbarProps & { mode?: ActionMode }) {
  const t = useTranslations('reservationCard');
  const tc = useTranslations('common');
  const [menuOpen, setMenuOpen] = useState(false);
  const [lightningOpen, setLightningOpen] = useState(false);

  const showHeader = mode === 'header' || mode === 'all';
  const showFooter = mode === 'footer' || mode === 'all';

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {showHeader ? (
        <button
          type="button"
          className={`${ICON_BTN} ${attachOpen ? 'ring-2 ring-[#2980B9]' : ''}`}
          title={!onAttachToggle ? t('availableAfterSave') : t('attach')}
          aria-label={t('attach')}
          disabled={busy || !onAttachToggle}
          onClick={onAttachToggle}
        >
          <Paperclip className="h-4 w-4" />
        </button>
      ) : null}
      {showHeader ? (
        <div className="relative">
          <button
            type="button"
            className={ICON_BTN}
            aria-label={t('lightning')}
            disabled={busy || (!onRecalc && !onChargeAll && !onAmendProduct && !canCheckIn)}
            title={
              !onRecalc && !onChargeAll && !onAmendProduct && !canCheckIn
                ? t('availableAfterSave')
                : t('lightning')
            }
            onClick={() => setLightningOpen((o) => !o)}
          >
            <Zap className="h-4 w-4" />
          </button>
          {lightningOpen ? (
            <div className={DROPDOWN_PANEL_CLASS}>
              <button
                type="button"
                className={DROPDOWN_ITEM_CLASS}
                disabled={!onRecalc}
                onClick={() => {
                  setLightningOpen(false);
                  onRecalc?.();
                }}
              >
                {t('calcDaily')}
              </button>
              <button
                type="button"
                className={DROPDOWN_ITEM_CLASS}
                disabled={!onChargeAll}
                onClick={() => {
                  setLightningOpen(false);
                  onChargeAll?.();
                }}
              >
                {t('chargeAll')}
              </button>
              <button
                type="button"
                className={DROPDOWN_ITEM_CLASS}
                disabled={!onAmendProduct}
                onClick={() => {
                  setLightningOpen(false);
                  onAmendProduct?.();
                }}
              >
                {t('amendProduct')}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      {showHeader ? (
        <button
          type="button"
          className={ICON_BTN}
          title={!onHistory ? t('availableAfterSave') : t('history')}
          aria-label={t('history')}
          disabled={busy || !onHistory}
          onClick={onHistory}
        >
          <History className="h-4 w-4" />
        </button>
      ) : null}
      {showHeader ? (
        <div className="relative">
          <button
            type="button"
            className={ICON_BTN}
            aria-label={t('menu')}
            title={t('menu')}
            disabled={busy}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          {menuOpen ? (
            <div className={DROPDOWN_PANEL_CLASS}>
              <button
                type="button"
                className={DROPDOWN_ITEM_CLASS}
                onClick={() => {
                  setMenuOpen(false);
                  (onPrint ?? (() => window.print()))();
                }}
              >
                <span className="inline-flex items-center gap-2">
                  <Printer className="h-3.5 w-3.5" />
                  {t('print')}
                </span>
              </button>
              {showLock ? (
                <button
                  type="button"
                  className={DROPDOWN_ITEM_CLASS}
                  disabled={!onToggleLock}
                  title={!onToggleLock ? t('availableAfterSave') : undefined}
                  onClick={() => {
                    setMenuOpen(false);
                    onToggleLock?.();
                  }}
                >
                  <span className="inline-flex items-center gap-2">
                    {isLocked ? <LockOpen className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                    {isLocked ? t('unlock') : t('lock')}
                  </span>
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {showFooter ? (
        <button
          type="button"
          className={SUCCESS_BUTTON_CLASS}
          title={!canCheckIn || !onConfirmCheckIn ? t('availableAfterSave') : undefined}
          disabled={busy || loading || isLocked || !canCheckIn || !onConfirmCheckIn}
          onClick={onConfirmCheckIn}
        >
          {t('confirmCheckIn')}
        </button>
      ) : null}
      {showFooter && onSave ? (
        <button
          type="button"
          className={PRIMARY_BUTTON_CLASS}
          disabled={busy || loading || isLocked}
          onClick={onSave}
        >
          {tc('save')}
        </button>
      ) : null}
      {showFooter && showClose && onClose ? (
        <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={onClose}>
          {tc('close')}
        </button>
      ) : null}
    </div>
  );
}

/** Page layout top bar (title + actions). Modal uses ModalShell subtitle + slots. */
export function ReservationCardToolbar(props: ReservationCardToolbarProps & { subtitle?: string }) {
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[#D5DADF] pb-2">
      {props.subtitle ? (
        <span className="min-w-0 truncate text-[13px] text-[#7F8C8D]">{props.subtitle}</span>
      ) : (
        <span />
      )}
      <ReservationCardActions {...props} mode="all" showClose />
    </div>
  );
}

export function ReservationCardBottomBar({
  taskCount = 0,
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

  const stubs: { label: string; icon: ReactNode; onClick?: () => void }[] = [
    {
      label: t('bottom.creditCard'),
      icon: <CreditCard className="h-3.5 w-3.5" />,
      onClick: onCreditCard,
    },
    { label: t('bottom.packages'), icon: null, onClick: onPackages },
    {
      label: t('bottom.tasks', { count: taskCount }),
      icon: null,
      onClick: onTasks,
    },
    { label: t('bottom.folioRouting'), icon: null, onClick: onFolioRouting },
  ];

  return (
    <div className="sticky bottom-0 flex flex-wrap gap-2 border-t border-[#D5DADF] bg-white py-2">
      {stubs.map((s) => (
        <button
          key={s.label}
          type="button"
          className={CHIP_CLASS}
          disabled={!stubsEnabled || !s.onClick}
          onClick={s.onClick}
          title={s.label}
        >
          {s.icon ? (
            <span className="inline-flex items-center gap-1">
              {s.icon}
              <span className="hidden sm:inline">{s.label}</span>
            </span>
          ) : (
            s.label
          )}
        </button>
      ))}
    </div>
  );
}
