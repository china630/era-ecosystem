'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CatalogField, Field, FieldTextarea, showApiError, showSuccess } from '@era/satellite-kit/ui';
import { EraModal, EraModalFooter } from '@/components/EraModal';

import { DESK_PAYMENT_METHODS } from '@/lib/desk-payment-methods';

const PAY_METHODS = DESK_PAYMENT_METHODS;

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

export function FolioDeletePaymentModal({
  open,
  onClose,
  onDone,
  paymentId,
}: {
  open: boolean;
  onClose: () => void;
  onDone?: () => void;
  paymentId: string | null;
}) {
  const t = useTranslations('folio');
  const tc = useTranslations('common');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  async function submit() {
    if (!paymentId || !reason.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/folios/payments/${paymentId}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('error'));
        return;
      }
      showSuccess(t('deletePaymentSuccess'));
      onDone?.();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <EraModal
      open={open}
      title={t('deletePaymentTitle')}
      onClose={onClose}
      footer={
        <EraModalFooter
          onCancel={onClose}
          onSubmit={() => void submit()}
          busy={busy}
          submitDisabled={!reason.trim()}
          submitLabel={t('deletePayment')}
        />
      }
    >
      <p className="m-0 mb-2 text-[13px] text-[#34495E]">{t('deletePaymentHint')}</p>
      <FieldTextarea label={t('refundReason')} value={reason} onChange={(e) => setReason(e.target.value)} />
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
  const [bankTerminalId, setBankTerminalId] = useState('');
  const [bankTerminals, setBankTerminals] = useState<{ id: string; label: string }[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMethod('CASH');
    setBankTerminalId('');
    void fetch('/api/fiscal/devices?kind=BANK_POS')
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { devices?: { id: string; label: string }[] } | null) => {
        const devices = body?.devices ?? [];
        setBankTerminals(devices);
        setBankTerminalId(devices[0]?.id ?? '');
      })
      .catch(() => setBankTerminals([]));
  }, [open]);

  async function submit() {
    if (!chargeId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/folios/charges/${chargeId}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentMethod: method,
          bankTerminalId: method === 'CARD' ? bankTerminalId.trim() || undefined : undefined,
        }),
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
          submitDisabled={method === 'CARD' && bankTerminals.length > 0 && !bankTerminalId.trim()}
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
      {method === 'CARD' ? (
        bankTerminals.length > 0 ? (
          <CatalogField
            kind="CLOSED_SMALL"
            label={t('bankTerminal')}
            value={bankTerminalId}
            onChange={(v) => setBankTerminalId(String(v ?? ''))}
            options={bankTerminals.map((row) => ({ value: row.id, label: row.label }))}
            emptyLabel={null}
          />
        ) : (
          <p className="m-0 text-[12px] text-amber-800">{t('noBankTerminal')}</p>
        )
      ) : null}
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
