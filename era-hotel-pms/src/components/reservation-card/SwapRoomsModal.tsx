'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { FieldSelect } from '@era/satellite-kit/ui';
import { EraModal, EraModalFooter } from '@/components/EraModal';

export type SwapSibling = { id: string; label: string };

export function SwapRoomsModal({
  open,
  siblings,
  onClose,
  onConfirm,
  busy,
}: {
  open: boolean;
  siblings: SwapSibling[];
  onClose: () => void;
  onConfirm: (otherReservationId: string) => void;
  busy?: boolean;
}) {
  const t = useTranslations('reservationCard');
  const tc = useTranslations('common');
  const [otherId, setOtherId] = useState(siblings[0]?.id ?? '');

  return (
    <EraModal
      open={open}
      title={t('swapRooms')}
      onClose={onClose}
      footer={
        <EraModalFooter
          onCancel={onClose}
          busy={busy}
          submitDisabled={busy || !otherId}
          submitLabel={t('confirmSwapRooms')}
          onSubmit={() => onConfirm(otherId)}
        />
      }
    >
      <div className="space-y-3">
        <p className="m-0 text-[13px] text-[#34495E]">{t('swapRoomsHint')}</p>
        <FieldSelect
          label={t('swapWithStay')}
          preset="selectWide"
          value={otherId}
          onChange={(e) => setOtherId(e.target.value)}
        >
          <option value="">{tc('select')}</option>
          {siblings.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </FieldSelect>
      </div>
    </EraModal>
  );
}
