'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { CatalogField } from '@era/satellite-kit/ui';
import { EraModal, EraModalFooter } from '@/components/EraModal';
import type { RoomMoveReason } from '@/lib/services/room-move-door.service';

const REASONS: RoomMoveReason[] = ['GUEST_REFUSED', 'DID_NOT_OCCUPY', 'HOTEL'];

export function RoomMoveReasonModal({
  open,
  onClose,
  onConfirm,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: RoomMoveReason) => void;
  busy?: boolean;
}) {
  const t = useTranslations('reservationCard');
  const [reason, setReason] = useState<RoomMoveReason>('GUEST_REFUSED');

  return (
    <EraModal
      open={open}
      title={t('moveReasonTitle')}
      onClose={onClose}
      footer={
        <EraModalFooter
          onCancel={onClose}
          busy={busy}
          submitDisabled={busy || !reason}
          submitLabel={t('moveReasonConfirm')}
          onSubmit={() => onConfirm(reason)}
        />
      }
    >
      <div className="space-y-3">
        <p className="m-0 text-[13px] text-[#34495E]">{t('moveReasonHint')}</p>
        <CatalogField
          kind="CLOSED_SMALL"
          label={t('moveReasonLabel')}
          value={reason}
          onChange={(v) => {
            const next = String(Array.isArray(v) ? (v[0] ?? '') : v) as RoomMoveReason;
            if (REASONS.includes(next)) setReason(next);
          }}
          options={REASONS.map((code) => ({
            value: code,
            label: t(`moveReason.${code}`),
          }))}
        />
      </div>
    </EraModal>
  );
}
