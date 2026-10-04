'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { CatalogField, DatePicker } from '@era/satellite-kit/ui';
import { hotelDateKey } from '@/lib/hotel-calendar';
import { EraModal, EraModalFooter } from '@/components/EraModal';

export type MoveGuestSibling = {
  id: string;
  label: string;
};

export function MoveGuestModal({
  open,
  guestLabel,
  siblings,
  onClose,
  onConfirm,
  busy,
}: {
  open: boolean;
  guestLabel: string;
  siblings: MoveGuestSibling[];
  onClose: () => void;
  onConfirm: (input: { toReservationId: string; effectiveDate: string }) => void;
  busy?: boolean;
}) {
  const t = useTranslations('reservationCard');
  const tc = useTranslations('common');
  const [toId, setToId] = useState(siblings[0]?.id ?? '');
  const [effectiveDate, setEffectiveDate] = useState(() => hotelDateKey());

  return (
    <EraModal
      open={open}
      title={t('moveGuest')}
      subtitle={guestLabel}
      onClose={onClose}
      footer={
        <EraModalFooter
          onCancel={onClose}
          busy={busy}
          submitDisabled={busy || !toId || !effectiveDate}
          submitLabel={t('confirmMoveGuest')}
          onSubmit={() => onConfirm({ toReservationId: toId, effectiveDate })}
        />
      }
    >
      <div className="space-y-3">
        <p className="m-0 text-[13px] text-[#34495E]">{t('moveGuestHint')}</p>
        <CatalogField
          kind="ENTITY_REF"
          label={t('moveToStay')}
          value={toId}
          onChange={(v) => setToId(String(v ?? ''))}
          options={siblings.map((s) => ({ value: s.id, label: s.label }))}
          emptyLabel={tc('select')}
        />
        <DatePicker
          label={t('effectiveDate')}
          fluid
          value={effectiveDate}
          onChange={setEffectiveDate}
          placeholder={tc('datePlaceholder')}
          openCalendarLabel={tc('openCalendar')}
        />
      </div>
    </EraModal>
  );
}
