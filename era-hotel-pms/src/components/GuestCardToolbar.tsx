'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from '@era/satellite-kit/ui';

export function GuestCardToolbar({
  subtitle,
  busy,
  loading,
  isLocked,
  onClose,
  onSave,
  onCopy,
  onToggleLock,
  onAttach,
  guestId,
}: {
  subtitle?: string;
  busy?: boolean;
  loading?: boolean;
  isLocked?: boolean;
  onClose: () => void;
  onSave?: () => void;
  onCopy?: () => void;
  onToggleLock?: () => void;
  onAttach?: () => void;
  guestId?: string | null;
}) {
  const t = useTranslations('guestCard');
  const tc = useTranslations('common');
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[#D5DADF] pb-2">
      <span className="min-w-0 truncate text-[13px] font-semibold text-[#34495E]">
        {subtitle ?? t('title')}
        {guestId ? (
          <span className="ml-2 font-mono text-[11px] font-normal text-[#7F8C8D]">{guestId.slice(0, 8)}</span>
        ) : null}
      </span>
      <div className="flex flex-wrap gap-2">
        {onAttach ? (
          <button type="button" className={SECONDARY_BUTTON_CLASS} disabled={busy} onClick={onAttach}>
            {t('toolbar.attach')}
          </button>
        ) : null}
        <button
          type="button"
          className={SECONDARY_BUTTON_CLASS}
          disabled={!onCopy}
          onClick={onCopy}
          title={!onCopy ? t('comingSoon') : undefined}
        >
          {t('toolbar.copy')}
        </button>
        <div className="relative">
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            disabled={busy}
            onClick={() => setMenuOpen((o) => !o)}
          >
            {t('toolbar.menu')}
          </button>
          {menuOpen ? (
            <div className="absolute right-0 top-full z-10 mt-1 min-w-[140px] rounded-lg border border-[#D5DADF] bg-white py-1 shadow-lg">
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-[13px] hover:bg-[#F8FAFC]"
                onClick={() => {
                  setMenuOpen(false);
                  window.print();
                }}
              >
                {t('toolbar.print')}
              </button>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-[13px] hover:bg-[#F8FAFC]"
                onClick={() => {
                  setMenuOpen(false);
                  window.print();
                }}
              >
                {t('toolbar.printSummary')}
              </button>
            </div>
          ) : null}
        </div>
        {onToggleLock ? (
          <button type="button" className={SECONDARY_BUTTON_CLASS} disabled={busy} onClick={onToggleLock}>
            {isLocked ? t('toolbar.unlock') : t('toolbar.lock')}
          </button>
        ) : null}
        {onSave ? (
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={busy || loading}
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
