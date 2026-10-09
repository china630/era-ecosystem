'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CatalogField, Field, showApiError, showSuccess } from '@era/satellite-kit/ui';
import { EraModal, EraModalFooter } from '@/components/EraModal';

type RevenueCode = { id: string; code: string; name?: string | null };

export function FolioChargeModal({
  open,
  onClose,
  onDone,
  reservationId,
}: {
  open: boolean;
  onClose: () => void;
  onDone?: () => void;
  reservationId: string;
}) {
  const t = useTranslations('folio');
  const tc = useTranslations('common');
  const [codes, setCodes] = useState<RevenueCode[]>([]);
  const [revenueCodeId, setRevenueCodeId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAmount('');
    setDescription('');
    void fetch('/api/master/revenue-codes')
      .then((r) => r.json())
      .then((data) => {
        const rows = (data.data ?? data) as RevenueCode[];
        const list = Array.isArray(rows) ? rows : [];
        setCodes(list);
        setRevenueCodeId(list[0]?.id ?? '');
      })
      .catch(() => setCodes([]));
  }, [open]);

  const amountN = Number(amount);
  const canSubmit = Boolean(revenueCodeId) && amountN !== 0 && description.trim().length > 0;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    try {
      const res = await fetch('/api/folios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reservationId,
          revenueCodeId,
          amount: amountN,
          qty: 1,
          description: description.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('error'));
        return;
      }
      showSuccess(t('chargePosted'));
      onDone?.();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <EraModal
      open={open}
      title={t('postCharge')}
      onClose={onClose}
      footer={
        <EraModalFooter
          onCancel={onClose}
          onSubmit={() => void submit()}
          busy={busy}
          submitDisabled={!canSubmit}
          submitLabel={t('postCharge')}
        />
      }
    >
      <div className="space-y-3">
        <CatalogField
          kind="SEARCHABLE"
          label={t('revenueCode')}
          value={revenueCodeId}
          onChange={(v) => setRevenueCodeId(String(v ?? ''))}
          options={codes.map((c) => ({
            value: c.id,
            label: c.name ? `${c.code} — ${c.name}` : c.code,
          }))}
          emptyLabel={null}
        />
        <Field
          label={tc('amount')}
          preset="amount"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <Field
          label={t('chargeDescription')}
          preset="longText"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
    </EraModal>
  );
}
