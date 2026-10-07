'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Copy, Lock, LockOpen, MoreVertical, Printer, ScanLine } from 'lucide-react';
import {
  DROPDOWN_ITEM_CLASS,
  DROPDOWN_PANEL_CLASS,
  GHOST_BUTTON_CLASS,
  PRIMARY_BUTTON_CLASS,
} from '@era/satellite-kit/ui';

const ICON_BTN = `${GHOST_BUTTON_CLASS} h-8 w-8 !px-0`;

export function GuestCardActions({
  mode,
  busy,
  loading,
  isLocked,
  guestId,
  onSave,
  onCopy,
  onToggleLock,
  onPrint,
  onIdReader,
}: {
  mode: 'header' | 'footer';
  busy?: boolean;
  loading?: boolean;
  isLocked?: boolean;
  guestId?: string | null;
  onSave?: () => void;
  onCopy?: () => void;
  onToggleLock?: () => void;
  onPrint?: () => void;
  onIdReader?: () => void;
}) {
  const t = useTranslations('guestCard');
  const tc = useTranslations('common');
  const [menuOpen, setMenuOpen] = useState(false);

  if (mode === 'footer') {
    return (
      <div className="flex justify-end">
        <button
          type="button"
          className={PRIMARY_BUTTON_CLASS}
          disabled={busy || loading || !onSave}
          onClick={onSave}
        >
          {tc('save')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <button
        type="button"
        className={ICON_BTN}
        title={t('idReader')}
        aria-label={t('idReader')}
        disabled={busy || !onIdReader}
        onClick={onIdReader}
      >
        <ScanLine className="h-4 w-4" />
      </button>
      <button
        type="button"
        className={ICON_BTN}
        title={!onCopy ? t('availableAfterSave') : t('toolbar.copy')}
        aria-label={t('toolbar.copy')}
        disabled={!onCopy}
        onClick={onCopy}
      >
        <Copy className="h-4 w-4" />
      </button>
      <div className="relative">
        <button
          type="button"
          className={ICON_BTN}
          aria-label={t('toolbar.menu')}
          title={t('toolbar.menu')}
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
                onPrint?.();
              }}
            >
              <span className="inline-flex items-center gap-2">
                <Printer className="h-3.5 w-3.5" />
                {t('toolbar.print')}
              </span>
            </button>
            <button
              type="button"
              className={DROPDOWN_ITEM_CLASS}
              disabled={!guestId || !onToggleLock}
              title={!guestId ? t('availableAfterSave') : undefined}
              onClick={() => {
                setMenuOpen(false);
                onToggleLock?.();
              }}
            >
              <span className="inline-flex items-center gap-2">
                {isLocked ? <LockOpen className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                {isLocked ? t('toolbar.unlock') : t('toolbar.lock')}
              </span>
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
