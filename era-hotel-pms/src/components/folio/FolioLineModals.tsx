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
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  async function submit() {
    if (!chargeId || !reason.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/folios/charges/${chargeId}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      });
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
          submitDisabled={!reason.trim()}
          submitLabel={t('void')}
        />
      }
    >
      <p className="m-0 mb-2 text-[13px] text-[#34495E]">{t('voidConfirm')}</p>
      <FieldTextarea label={t('refundReason')} value={reason} onChange={(e) => setReason(e.target.value)} />
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
      })
      .catch(() => setBankTerminals([]));
  }, [open]);

  async function submit() {
    if (!chargeId) return;
    if (method === 'CARD' && !bankTerminalId.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/folios/charges/${chargeId}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentMethod: method,
          bankTerminalId: method === 'CARD' ? bankTerminalId.trim() : undefined,
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
          submitDisabled={method === 'CARD' && !bankTerminalId.trim()}
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
      {method === 'CARD' ? (
        bankTerminals.length > 0 ? (
          <CatalogField
            kind="CLOSED_SMALL"
            label={t('bankTerminal')}
            value={bankTerminalId}
            onChange={(v) => setBankTerminalId(String(v ?? ''))}
            options={[
              { value: '', label: t('pickTerminal') },
              ...bankTerminals.map((row) => ({ value: row.id, label: row.label })),
            ]}
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
  payment: { id: string; max: number; folioStatus: string; paymentMethod?: string } | null;
}) {
  const t = useTranslations('folio');
  const tc = useTranslations('common');
  const tPay = useTranslations('paymentMethod');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [method, setMethod] = useState<'CASH' | 'CARD'>('CASH');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!payment) return;
    setAmount(payment.max.toFixed(2));
    setReason('');
    setMethod(payment.paymentMethod === 'CARD' ? 'CARD' : 'CASH');
  }, [payment]);

  async function submit() {
    if (!payment || !reason.trim()) return;
    setBusy(true);
    try {
      const n = amount ? Number(amount) : undefined;
      const res = await fetch(`/api/folios/payments/${payment.id}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: n && n > 0 ? n : undefined,
          reason: reason.trim(),
          paymentMethod: method,
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
          submitDisabled={!reason.trim()}
          submitLabel={t('refund')}
        />
      }
    >
      <div className="space-y-3">
        <p className="m-0 text-[13px] text-[#7F8C8D]">
          {t('refundModalHint', { max: payment?.max.toFixed(2) ?? '0' })}
        </p>
        <CatalogField
          kind="OPS_HOT"
          label={t('method')}
          value={method}
          onChange={(v) => setMethod(String(v) === 'CARD' ? 'CARD' : 'CASH')}
          options={[
            { value: 'CASH', label: tPay('CASH') },
            { value: 'CARD', label: tPay('CARD') },
          ]}
          emptyLabel={null}
        />
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

export function FolioTransferModal({
  open,
  onClose,
  onDone,
  chargeId,
  chargeIds,
  paymentIds,
  reservationId,
  guests = [],
  hasCompany = false,
  hasAgency = false,
}: {
  open: boolean;
  onClose: () => void;
  onDone?: () => void;
  chargeId: string | null;
  chargeIds?: string[];
  paymentIds?: string[];
  reservationId?: string;
  guests?: Array<{ id: string; name: string }>;
  hasCompany?: boolean;
  hasAgency?: boolean;
}) {
  const t = useTranslations('folio');
  const tf = useTranslations('foStatus');
  const tc = useTranslations('common');
  const [scope, setScope] = useState<'WITHIN' | 'OTHER'>('WITHIN');
  const [targetFolioType, setTargetFolioType] = useState<'GUEST' | 'AGENCY' | 'COMPANY'>('GUEST');
  const [targetReservationId, setTargetReservationId] = useState('');
  const [note, setNote] = useState('');
  const [query, setQuery] = useState('');
  const [targets, setTargets] = useState<
    { value: string; label: string; guests: { id: string; name: string }[]; hasCompany?: boolean; hasAgency?: boolean }[]
  >([]);
  const [targetGuestId, setTargetGuestId] = useState('');
  const [targetError, setTargetError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setScope('WITHIN');
    setTargetFolioType('GUEST');
    setTargetReservationId('');
    setTargetGuestId('');
    setNote('');
    setQuery('');
    setTargets([]);
    setTargetError('');
  }, [open, chargeId, chargeIds?.join('|'), paymentIds?.join('|')]);

  useEffect(() => {
    if (!open || scope !== 'OTHER') return;
    const handle = setTimeout(() => {
      void fetch(`/api/folios/pay-targets?q=${encodeURIComponent(query)}`)
        .then(async (r) => {
          if (!r.ok) {
            setTargets([]);
            setTargetError(tc('loadError'));
            return;
          }
          const rows = (await r.json()) as {
            reservationId: string;
            roomNumber: string;
            hasCompany?: boolean;
            hasAgency?: boolean;
            guests: { id: string; name: string }[];
          }[];
          setTargetError('');
          setTargets(
            (Array.isArray(rows) ? rows : []).map((row) => ({
              value: row.reservationId,
              label: [row.roomNumber, row.guests.map((g) => g.name).filter(Boolean).join(', ')]
                .filter(Boolean)
                .join(' · '),
              guests: (row.guests ?? []).filter((g) => g.id && g.id !== 'primary-guest'),
              hasCompany: row.hasCompany,
              hasAgency: row.hasAgency,
            })),
          );
        })
        .catch(() => {
          setTargets([]);
          setTargetError(tc('loadError'));
        });
    }, 250);
    return () => clearTimeout(handle);
  }, [open, scope, query, tc]);

  async function submit() {
    const ids = (chargeIds && chargeIds.length > 0 ? chargeIds : chargeId ? [chargeId] : []).filter(Boolean);
    const payIds = (paymentIds ?? []).filter(Boolean);
    if ((ids.length === 0 && payIds.length === 0) || !note.trim()) return;
    if (scope === 'OTHER' && !targetReservationId) return;
    const guestOnTarget =
      targetFolioType === 'GUEST' ? targetGuestId || undefined : undefined;
    const body = {
      note: note.trim(),
      targetFolioType,
      targetReservationId: scope === 'OTHER' ? targetReservationId : reservationId,
      targetReservationGuestId: guestOnTarget,
    };
    setBusy(true);
    try {
      for (const id of ids) {
        const res = await fetch(`/api/folios/charges/${id}/transfer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) {
          showApiError(data, tc('error'));
          return;
        }
      }
      for (const id of payIds) {
        const res = await fetch(`/api/folios/payments/${id}/transfer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) {
          showApiError(data, tc('error'));
          return;
        }
      }
      showSuccess(t('transferDone'));
      onDone?.();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <EraModal
      open={open}
      title={t('transferTitle')}
      onClose={onClose}
      footer={
        <EraModalFooter
          onCancel={onClose}
          onSubmit={() => void submit()}
          busy={busy}
          submitDisabled={
            !note.trim() ||
            (scope === 'OTHER' && !targetReservationId) ||
            (scope === 'OTHER' &&
              targetFolioType === 'GUEST' &&
              (targets.find((row) => row.value === targetReservationId)?.guests.length ?? 0) > 1 &&
              !targetGuestId)
          }
          submitLabel={t('transfer')}
        />
      }
    >
      <div className="space-y-3">
        <CatalogField
          kind="OPS_HOT"
          label={t('transferScope')}
          value={scope}
          onChange={(v) => setScope(String(v) === 'OTHER' ? 'OTHER' : 'WITHIN')}
          options={[
            { value: 'WITHIN', label: t('transferWithin') },
            { value: 'OTHER', label: t('transferOther') },
          ]}
          emptyLabel={null}
        />
        <CatalogField
          kind="CLOSED_SMALL"
          label={t('targetFolio')}
          value={targetFolioType}
          onChange={(v) => setTargetFolioType(String(v) as 'GUEST' | 'AGENCY' | 'COMPANY')}
          options={[
            { value: 'GUEST', label: tf('folioGuest') },
            ...((scope === 'WITHIN' ? hasAgency : targets.find((row) => row.value === targetReservationId)?.hasAgency)
              ? [{ value: 'AGENCY' as const, label: tf('folioAgency') }]
              : []),
            ...((scope === 'WITHIN' ? hasCompany : targets.find((row) => row.value === targetReservationId)?.hasCompany)
              ? [{ value: 'COMPANY' as const, label: tf('folioCompany') }]
              : []),
          ]}
          emptyLabel={null}
        />
        {scope === 'WITHIN' && !hasAgency && !hasCompany ? (
          <p className="m-0 text-[12px] text-[#7F8C8D]">{t('transferNoPayerOnStay')}</p>
        ) : null}
        {scope === 'WITHIN' && (hasAgency || hasCompany) ? (
          <p className="m-0 text-[12px] text-[#7F8C8D]">{t('transferPayerHint')}</p>
        ) : null}
        {scope === 'OTHER' ? (
          <CatalogField
            kind="SEARCHABLE"
            label={t('transferOther')}
            value={targetReservationId}
            onChange={(v) => {
              const next = String(v);
              setTargetReservationId(next);
              const stay = targets.find((row) => row.value === next);
              setTargetGuestId(stay?.guests.length === 1 ? stay.guests[0]!.id : '');
            }}
            onQueryChange={setQuery}
            options={targets}
          />
        ) : null}
        {scope === 'WITHIN' && targetFolioType === 'GUEST' ? (
          <CatalogField
            kind="CLOSED_SMALL"
            label={t('transferGuest')}
            value={targetGuestId}
            onChange={(v) => setTargetGuestId(String(v ?? ''))}
            options={guests.map((guest) => ({ value: guest.id, label: guest.name }))}
          />
        ) : null}
        {scope === 'OTHER' && targetFolioType === 'GUEST' && targetReservationId ? (
          <CatalogField
            kind="CLOSED_SMALL"
            label={t('transferGuest')}
            value={targetGuestId}
            onChange={(v) => setTargetGuestId(String(v ?? ''))}
            options={(targets.find((row) => row.value === targetReservationId)?.guests ?? []).map(
              (guest) => ({ value: guest.id, label: guest.name }),
            )}
          />
        ) : null}
        {scope === 'OTHER' && targetError ? (
          <p className="m-0 text-[13px] text-[#C0392B]">{targetError}</p>
        ) : null}
        <FieldTextarea
          label={t('transferNote')}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
        />
      </div>
    </EraModal>
  );
}

export function FolioMissedNightsModal({
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
  const tf = useTranslations('foStatus');
  const tc = useTranslations('common');
  const [nights, setNights] = useState<{ date: string; amount: number }[]>([]);
  const [total, setTotal] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !reservationId) return;
    setNights([]);
    setTotal(0);
    setLoadError(false);
    void fetch(`/api/reservations/${reservationId}/missed-nights`)
      .then(async (r) => {
        if (!r.ok) {
          setLoadError(true);
          return;
        }
        const body = (await r.json()) as { nights?: { date: string; amount: number }[]; total?: number };
        setNights(body.nights ?? []);
        setTotal(body.total ?? 0);
      })
      .catch(() => setLoadError(true));
  }, [open, reservationId]);

  async function submit() {
    if (!reservationId || nights.length === 0) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/reservations/${reservationId}/missed-nights`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('error'));
        return;
      }
      showSuccess(t('missedNightsPosted'));
      onDone?.();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <EraModal
      open={open}
      title={t('missedNightsTitle')}
      onClose={onClose}
      footer={
        <EraModalFooter
          onCancel={onClose}
          onSubmit={() => void submit()}
          busy={busy}
          submitDisabled={nights.length === 0}
          submitLabel={t('missedNightsPost')}
        />
      }
    >
      {loadError ? (
        <p className="m-0 text-[13px] text-[#C0392B]">{tc('loadError')}</p>
      ) : nights.length === 0 ? (
        <p className="m-0 text-[13px] text-[#34495E]">{t('missedNightsEmpty')}</p>
      ) : (
        <div className="space-y-2 text-[13px] text-[#34495E]">
          {nights.map((night) => (
            <div key={night.date} className="flex justify-between gap-3">
              <span>{night.date}</span>
              <span>{night.amount.toFixed(2)}</span>
            </div>
          ))}
          <div className="flex justify-between gap-3 border-t border-[#D5DADF] pt-2 font-medium">
            <span>{tf('total')}</span>
            <span>{total.toFixed(2)}</span>
          </div>
        </div>
      )}
    </EraModal>
  );
}
