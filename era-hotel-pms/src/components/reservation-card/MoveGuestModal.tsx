'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { DatePicker, FieldSelect } from '@era/satellite-kit/ui';
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
  const [effectiveDate, setEffectiveDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );

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
        <FieldSelect
          label={t('moveToStay')}
          preset="selectWide"
          value={toId}
          onChange={(e) => setToId(e.target.value)}
        >
          <option value="">{tc('select')}</option>
          {siblings.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </FieldSelect>
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
