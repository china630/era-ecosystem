'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CatalogField, Field, FieldTextarea, showApiError, showSuccess } from '@era/satellite-kit/ui';
import { EraModal, EraModalFooter } from '@/components/EraModal';

const PAY_METHODS = ['CASH', 'CARD', 'BANK_TRANSFER'] as const;

export function FolioVoidModal({
  open,
  onClose,
  onDone,
  chargeId,
}: {
  open: boolean;
  onClose: () => void;
  onDone?: () => void;
  chargeId: string | null;
}) {
  const t = useTranslations('folio');
  const tc = useTranslations('common');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!chargeId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/folios/charges/${chargeId}/void`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('error'));
        return;
      }
      showSuccess(t('chargeVoided'));
      onDone?.();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <EraModal
      open={open}
      title={t('voidTitle')}
      onClose={onClose}
      footer={
        <EraModalFooter
          onCancel={onClose}
          onSubmit={() => void submit()}
          busy={busy}
          submitLabel={t('void')}
        />
      }
    >
      <p className="m-0 text-[13px] text-[#34495E]">{t('voidConfirm')}</p>
    </EraModal>
  );
}

export function FolioPayLineModal({
  open,
  onClose,
  onDone,
  chargeId,
}: {
  open: boolean;
  onClose: () => void;
  onDone?: () => void;
  chargeId: string | null;
}) {
  const t = useTranslations('folio');
  const tc = useTranslations('common');
  const tPay = useTranslations('paymentMethod');
  const [method, setMethod] = useState('CASH');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!chargeId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/folios/charges/${chargeId}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethod: method }),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('error'));
        return;
      }
      showSuccess(t('paymentRecorded'));
      onDone?.();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <EraModal
      open={open}
      title={t('payLineTitle')}
      onClose={onClose}
      footer={
        <EraModalFooter
          onCancel={onClose}
          onSubmit={() => void submit()}
          busy={busy}
          submitLabel={t('pay')}
        />
      }
    >
      <CatalogField
        kind="CLOSED_SMALL"
        label={t('method')}
        value={method}
        onChange={(v) => setMethod(String(v ?? 'CASH'))}
        options={PAY_METHODS.map((m) => ({ value: m, label: tPay(m) }))}
        emptyLabel={null}
      />
    </EraModal>
  );
}

export function FolioRefundModal({
  open,
  onClose,
  onDone,
  payment,
}: {
  open: boolean;
  onClose: () => void;
  onDone?: () => void;
  payment: { id: string; max: number; folioStatus: string } | null;
}) {
  const t = useTranslations('folio');
  const tc = useTranslations('common');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!payment) return;
    setAmount(payment.max.toFixed(2));
    setReason('');
  }, [payment]);

  async function submit() {
    if (!payment) return;
    if (payment.folioStatus === 'TRANSFERRED_AR') {
      showApiError({ error: t('refundBlockedTransferred') }, tc('error'));
      return;
    }
    setBusy(true);
    try {
      const n = amount ? Number(amount) : undefined;
      const res = await fetch(`/api/folios/payments/${payment.id}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: n && n > 0 ? n : undefined,
          reason: reason.trim() || t('refundDefaultReason'),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('error'));
        return;
      }
      showSuccess(t('refundSuccess'));
      onDone?.();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <EraModal
      open={open}
      title={t('refundModalTitle')}
      onClose={onClose}
      footer={
        <EraModalFooter
          onCancel={onClose}
          onSubmit={() => void submit()}
          busy={busy}
          submitLabel={t('refund')}
        />
      }
    >
      <div className="space-y-3">
        <p className="m-0 text-[13px] text-[#7F8C8D]">
          {t('refundModalHint', { max: payment?.max.toFixed(2) ?? '0' })}
        </p>
        <Field
          label={tc('amount')}
          preset="amount"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <FieldTextarea label={t('refundReason')} value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
      </div>
    </EraModal>
  );
}

export function FolioCloseModal({
  open,
  onClose,
  onDone,
  folioId,
}: {
  open: boolean;
  onClose: () => void;
  onDone?: () => void;
  folioId: string | null;
}) {
  const t = useTranslations('folio');
  const tc = useTranslations('common');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!folioId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/folios/${folioId}/close`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('error'));
        return;
      }
      showSuccess(t('folioClosed'));
      onDone?.();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <EraModal
      open={open}
      title={t('closeFolioTitle')}
      onClose={onClose}
      footer={
        <EraModalFooter
          onCancel={onClose}
          onSubmit={() => void submit()}
          busy={busy}
          submitLabel={t('closeFolio')}
        />
      }
    >
      <p className="m-0 text-[13px] text-[#34495E]">{t('closeFolioConfirm')}</p>
    </EraModal>
  );
}
