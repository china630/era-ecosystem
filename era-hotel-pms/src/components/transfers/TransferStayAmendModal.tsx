'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CatalogField, FORM_STACK_CLASS, showApiError } from '@era/satellite-kit/ui';
import { bakuDateTimeDisplay } from '@era/satellite-kit/time';
import { EraModal, EraModalFooter } from '@/components/EraModal';

export type TransferStayDecision = {
  orderId: string;
  action: 'SHIFT' | 'KEEP' | 'CANCEL' | 'LEAVE';
  pickupAt?: string;
};

type PreviewRow = {
  id: string;
  direction: 'IN' | 'OUT';
  status: string;
  pickupAt: string;
  proposedPickupAt: string;
  flightNo: string | null;
};

type Props = {
  open: boolean;
  reservationId: string;
  checkInIso: string;
  checkOutIso: string;
  onClose: () => void;
  onConfirm: (decisions: TransferStayDecision[]) => void;
};

export function TransferStayAmendModal({
  open,
  reservationId,
  checkInIso,
  checkOutIso,
  onClose,
  onConfirm,
}: Props) {
  const t = useTranslations('transfers');
  const tc = useTranslations('common');
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [actions, setActions] = useState<Record<string, TransferStayDecision['action']>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setBusy(true);
    void fetch('/api/transfers/stay-preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reservationId,
        checkInDate: checkInIso,
        checkOutDate: checkOutIso,
      }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          showApiError(data);
          return;
        }
        const list = (data.transfers ?? data.data?.transfers ?? []) as PreviewRow[];
        setRows(list);
        const next: Record<string, TransferStayDecision['action']> = {};
        for (const row of list) next[row.id] = 'SHIFT';
        setActions(next);
      })
      .finally(() => setBusy(false));
  }, [open, reservationId, checkInIso, checkOutIso]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onConfirm(
      rows.map((row) => ({
        orderId: row.id,
        action: actions[row.id] ?? 'SHIFT',
        pickupAt: (actions[row.id] ?? 'SHIFT') === 'SHIFT' ? row.proposedPickupAt : undefined,
      })),
    );
  }

  return (
    <EraModal
      open={open}
      title={t('stayDateAmendTitle')}
      onClose={onClose}
      footer={
        <EraModalFooter
          formId="transfer-stay-amend"
          onCancel={onClose}
          busy={busy}
          submitLabel={tc('save')}
        />
      }
    >
      <form id="transfer-stay-amend" onSubmit={submit} className={FORM_STACK_CLASS}>
        <p className="m-0 text-[13px] text-[#34495E]">{t('stayDateAmendHint')}</p>
        {rows.length === 0 && !busy ? (
          <p className="m-0 text-[13px] text-[#7F8C8D]">{tc('empty')}</p>
        ) : null}
        {rows.map((row) => (
          <div key={row.id} className="rounded-lg border border-[#D5DADF] p-3 space-y-2">
            <p className="m-0 text-[13px] font-medium text-[#34495E]">
              {row.direction === 'OUT' ? t('directionOut') : t('directionIn')}
              {' · '}
              {bakuDateTimeDisplay(row.pickupAt)}
              {row.flightNo ? ` · ${row.flightNo}` : ''}
            </p>
            <p className="m-0 text-[12px] text-[#7F8C8D]">
              {t('proposedPickup')}: {bakuDateTimeDisplay(row.proposedPickupAt)}
            </p>
            <CatalogField
              kind="CLOSED_SMALL"
              label={t('stayAction')}
              value={actions[row.id] ?? 'SHIFT'}
              onChange={(v) =>
                setActions((prev) => ({
                  ...prev,
                  [row.id]: String(v) as TransferStayDecision['action'],
                }))
              }
              options={[
                { value: 'SHIFT', label: t('actionShift') },
                { value: 'KEEP', label: t('actionKeep') },
                { value: 'CANCEL', label: t('actionCancel') },
              ]}
            />
          </div>
        ))}
      </form>
    </EraModal>
  );
}
