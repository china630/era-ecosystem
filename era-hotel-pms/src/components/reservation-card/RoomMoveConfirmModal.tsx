'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CatalogField } from '@era/satellite-kit/ui';
import { EraModal, EraModalFooter } from '@/components/EraModal';
import type { RoomMoveReason } from '@/lib/services/room-move-door.service';
import { classSettlementChoices, type ClassSettlement } from '@/lib/room-move-settlement';

const REASONS: RoomMoveReason[] = ['GUEST_REFUSED', 'DID_NOT_OCCUPY', 'HOTEL'];

export function RoomMoveConfirmModal({
  open,
  onClose,
  onConfirm,
  busy,
  askReason,
  askSettlement,
  chargedNightly,
  doorNightly,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (input: { reason?: RoomMoveReason; settlement?: ClassSettlement }) => void;
  busy?: boolean;
  askReason: boolean;
  askSettlement: boolean;
  chargedNightly?: number | null;
  doorNightly?: number | null;
}) {
  const t = useTranslations('reservationCard');
  const choiceKey = classSettlementChoices(chargedNightly, doorNightly).join(',');
  const choices = choiceKey.split(',') as ClassSettlement[];
  const [reason, setReason] = useState<RoomMoveReason>('GUEST_REFUSED');
  const [settlement, setSettlement] = useState<ClassSettlement>(choices[0] ?? 'HOTEL');
  useEffect(() => {
    if (!open) return;
    const next = (choiceKey.split(',')[0] ?? 'HOTEL') as ClassSettlement;
    setSettlement(next);
  }, [open, choiceKey]);

  return (
    <EraModal
      open={open}
      title={t('moveReasonTitle')}
      onClose={onClose}
      footer={
        <EraModalFooter
          onCancel={onClose}
          busy={busy}
          submitDisabled={busy}
          submitLabel={t('moveReasonConfirm')}
          onSubmit={() =>
            onConfirm({
              ...(askReason ? { reason } : {}),
              ...(askSettlement ? { settlement } : {}),
            })
          }
        />
      }
    >
      <div className="space-y-3">
        <p className="m-0 text-[13px] text-[#34495E]">{t('moveReasonHint')}</p>
        {askReason ? (
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
        ) : null}
        {askSettlement ? (
          <CatalogField
            kind="CLOSED_SMALL"
            label={t('classSettlementLabel')}
            value={settlement}
            onChange={(v) => {
              const next = String(Array.isArray(v) ? (v[0] ?? '') : v) as ClassSettlement;
              if (choices.includes(next)) setSettlement(next);
            }}
            options={choices.map((code) => ({
              value: code,
              label: t(
                code === 'HOTEL'
                  ? 'classHotelCovers'
                  : code === 'GUEST_PAY'
                    ? 'classGuestPays'
                    : code === 'HOTEL_REFUND'
                      ? 'classHotelRefund'
                      : 'classGuestCheaper',
              ),
            }))}
          />
        ) : null}
      </div>
    </EraModal>
  );
}
