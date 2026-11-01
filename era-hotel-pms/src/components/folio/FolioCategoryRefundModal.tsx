'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  CatalogField,
  Field,
  FieldTextarea,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';
import { EraModal, EraModalFooter } from '@/components/EraModal';
import { stayCategoryMoneyPair } from '@/lib/folio-money-pair';
import {
  pickTargetFolio,
  type FolioParty,
  type PayerGuest,
} from '@/lib/folio-payer';
import {
  PAYMENT_CATEGORIES,
  type PaymentCategory,
  isPaymentCategory,
} from '@/lib/payment-category';

type FolioRow = {
  id: string;
  type: string;
  status: string;
  reservationGuestId?: string | null;
  charges: Array<{
    amount: number | string;
    qty?: number | null;
    revenueCodeId?: string | null;
    paymentCategory?: string | null;
    revenueCode?: { paymentCategory?: string | null; systemRole?: string | null } | null;
  }>;
  payments?: Array<{
    id?: string;
    amount: number | string;
    kind?: string | null;
    voidedAt?: string | null;
    revenueCodeId?: string | null;
    paymentCategory?: string | null;
    refundOfPaymentId?: string | null;
    revenueCode?: { paymentCategory?: string | null; systemRole?: string | null } | null;
  }>;
};

type StayTarget = {
  reservationId: string;
  roomNumber: string;
  guests: PayerGuest[];
  hasCompany?: boolean;
  hasAgency?: boolean;
};

/** Mid-stay cashier return of unused credit inside one payment category + pocket. */
export function FolioCategoryRefundModal({
  open,
  onClose,
  onDone,
  reservationId,
  guests,
  hasCompany,
  hasAgency,
}: {
  open: boolean;
  onClose: () => void;
  onDone?: () => void;
  /** Set when the stay is already known (reservation card). */
  reservationId?: string | null;
  guests?: PayerGuest[];
  hasCompany?: boolean;
  hasAgency?: boolean;
}) {
  const t = useTranslations('folio');
  const tc = useTranslations('common');
  const tPay = useTranslations('paymentMethod');
  const [query, setQuery] = useState('');
  const [stays, setStays] = useState<StayTarget[]>([]);
  const [stayId, setStayId] = useState(reservationId ?? '');
  const [folios, setFolios] = useState<FolioRow[]>([]);
  const [pocket, setPocket] = useState<'' | FolioParty>('');
  const [guestId, setGuestId] = useState('');
  const [paymentCategory, setPaymentCategory] = useState<'' | PaymentCategory>('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [method, setMethod] = useState<'CASH' | 'CARD'>('CASH');
  const [bankTerminalId, setBankTerminalId] = useState('');
  const [bankTerminals, setBankTerminals] = useState<{ id: string; label: string }[]>([]);
  const [busy, setBusy] = useState(false);

  const knownStay = Boolean(reservationId);
  const activeStayId = knownStay ? reservationId! : stayId;
  const partyGuests = useMemo(() => {
    if (knownStay) return guests ?? [];
    return stays.find((s) => s.reservationId === stayId)?.guests ?? [];
  }, [knownStay, guests, stays, stayId]);

  const namedGuests = partyGuests.filter((guest) => guest.name.trim());
  const payer =
    pocket === 'guest'
      ? namedGuests.length === 0
        ? ({ kind: 'none' } as const)
        : namedGuests.length === 1
          ? ({ kind: 'fixed', guest: namedGuests[0]! } as const)
          : ({ kind: 'pick' } as const)
      : ({ kind: 'none' } as const);
  const selectedGuest =
    payer.kind === 'fixed'
      ? payer.guest
      : payer.kind === 'pick'
        ? namedGuests.find((g) => g.id === guestId) ?? null
        : null;

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setStays([]);
    setStayId(reservationId ?? '');
    setPocket('');
    setGuestId('');
    setPaymentCategory('');
    setAmount('');
    setReason('');
    setMethod('CASH');
    setBankTerminalId('');
    setFolios([]);
  }, [open, reservationId]);

  useEffect(() => {
    if (!open) return;
    void fetch('/api/fiscal/devices?kind=BANK_POS')
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { devices?: { id: string; label: string }[] } | null) => {
        const devices = body?.devices ?? [];
        setBankTerminals(devices.map((row) => ({ id: row.id, label: row.label })));
      })
      .catch(() => setBankTerminals([]));
  }, [open]);

  useEffect(() => {
    if (!open || knownStay) return;
    const handle = window.setTimeout(() => {
      void fetch(`/api/folios/pay-targets?q=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then((data) => {
          const rows = (data.data ?? data) as StayTarget[];
          setStays(Array.isArray(rows) ? rows : []);
        })
        .catch(() => setStays([]));
    }, 200);
    return () => window.clearTimeout(handle);
  }, [open, knownStay, query]);

  useEffect(() => {
    if (!open || !activeStayId) {
      setFolios([]);
      return;
    }
    void fetch(`/api/folios?reservationId=${activeStayId}`)
      .then((r) => r.json())
      .then((data) => {
        const rows = (data.data ?? data) as FolioRow[];
        setFolios(Array.isArray(rows) ? rows : []);
      })
      .catch(() => setFolios([]));
  }, [open, activeStayId]);

  const folio =
    pocket && folios.length > 0
      ? pickTargetFolio(
          folios.filter((row) => row.status === 'OPEN'),
          pocket,
          selectedGuest ?? undefined,
        )
      : undefined;

  const categoryUnused = useMemo(() => {
    if (!paymentCategory || !isPaymentCategory(paymentCategory) || !folio) return 0;
    return stayCategoryMoneyPair(folio.charges, folio.payments ?? [], paymentCategory).unused;
  }, [folio, paymentCategory]);

  const categoryOptions = useMemo(() => {
    const charges = folio?.charges ?? [];
    const payments = folio?.payments ?? [];
    return PAYMENT_CATEGORIES.map((cat) => {
      const unused = stayCategoryMoneyPair(charges, payments, cat).unused;
      const label = t(`paymentCategory_${cat}`);
      return {
        value: cat,
        label: unused > 0.01 ? `${label} (${unused.toFixed(2)})` : label,
        unused,
      };
    }).filter((row) => row.unused > 0.01);
  }, [folio, t]);

  useEffect(() => {
    if (!open || !paymentCategory) return;
    if (categoryUnused > 0.01) setAmount(categoryUnused.toFixed(2));
  }, [open, paymentCategory, categoryUnused]);

  const amountN = Number(amount);
  const overUnused = categoryUnused > 0.01 && amountN > categoryUnused + 0.01;
  const needsGuest = pocket === 'guest' && payer.kind === 'pick' && !selectedGuest;
  const needsStay = !knownStay && !activeStayId;
  // Same CARD rule as Accept payment: terminal required when BANK_POS devices exist.
  const methodOk =
    method === 'CASH' ||
    (method === 'CARD' && bankTerminals.length > 0 && bankTerminalId.trim().length > 0);
  const canSubmit =
    !needsStay &&
    Boolean(pocket) &&
    Boolean(paymentCategory) &&
    !needsGuest &&
    categoryUnused > 0.01 &&
    amountN > 0.01 &&
    !overUnused &&
    reason.trim().length > 0 &&
    methodOk;

  const pickedStay = knownStay ? null : stays.find((row) => row.reservationId === stayId);
  const companyOnStay = knownStay ? hasCompany : pickedStay?.hasCompany;
  const agencyOnStay = knownStay ? hasAgency : pickedStay?.hasAgency;
  const pocketOptions = [
    { value: 'guest', label: t('partyGuest') },
    ...(agencyOnStay === false ? [] : [{ value: 'agency', label: t('partyAgency') }]),
    ...(companyOnStay === false ? [] : [{ value: 'company', label: t('partyCompany') }]),
  ];

  async function submit() {
    if (!canSubmit || !paymentCategory || !activeStayId) return;
    setBusy(true);
    try {
      const res = await fetch('/api/folios/category-refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reservationId: activeStayId,
          paymentCategory,
          amount: amountN,
          reason: reason.trim(),
          paymentMethod: method,
          bankTerminalId: method === 'CARD' ? bankTerminalId.trim() || undefined : undefined,
          folioType:
            pocket === 'agency' ? 'AGENCY' : pocket === 'company' ? 'COMPANY' : 'GUEST',
          reservationGuestId: pocket === 'guest' ? selectedGuest?.id : undefined,
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
      title={t('categoryRefundTitle')}
      onClose={onClose}
      footer={
        <EraModalFooter
          onCancel={onClose}
          onSubmit={() => void submit()}
          busy={busy}
          submitDisabled={!canSubmit}
          submitLabel={t('categoryRefundSubmit')}
        />
      }
    >
      <div className="space-y-3">
        <p className="m-0 text-[13px] text-[#7F8C8D]">{t('categoryRefundHint')}</p>
        {!knownStay ? (
          <CatalogField
            kind="SEARCHABLE"
            label={t('pickStay')}
            value={stayId}
            onChange={(v) => {
              setStayId(String(v ?? ''));
              setGuestId('');
              setPocket('');
              setPaymentCategory('');
            }}
            onQueryChange={setQuery}
            serverSearch
            options={stays.map((s) => ({
              value: s.reservationId,
              label: `${s.roomNumber} — ${s.guests.map((g) => g.name).join(', ') || '—'}`,
            }))}
            emptyLabel={null}
          />
        ) : null}
        {activeStayId ? (
          <CatalogField
            kind="CLOSED_SMALL"
            label={t('pocket')}
            value={pocket}
            onChange={(v) => {
              setPocket((String(v ?? '') as FolioParty) || '');
              setGuestId('');
              setPaymentCategory('');
            }}
            options={pocketOptions}
            emptyLabel={t('pickPocket')}
          />
        ) : null}
        {pocket === 'guest' && payer.kind === 'pick' ? (
          <CatalogField
            kind="CLOSED_SMALL"
            label={t('pickGuest')}
            value={guestId}
            onChange={(v) => setGuestId(String(v ?? ''))}
            options={namedGuests.map((g) => ({ value: g.id, label: g.name }))}
            emptyLabel={t('pickGuest')}
          />
        ) : null}
        {activeStayId && pocket ? (
          <CatalogField
            kind="CLOSED_SMALL"
            label={t('folioCategory')}
            value={paymentCategory}
            onChange={(v) => {
              const next = String(v ?? '');
              setPaymentCategory(isPaymentCategory(next) ? next : '');
            }}
            options={categoryOptions.map((row) => ({ value: row.value, label: row.label }))}
            emptyLabel={
              categoryOptions.length === 0 ? t('categoryRefundNoCredit') : t('pickPaymentCategory')
            }
          />
        ) : null}
        {paymentCategory && categoryUnused > 0.01 ? (
          <p className="m-0 text-[12px] text-[#7F8C8D]">
            {t('categoryCreditHint', { amount: categoryUnused.toFixed(2) })}
          </p>
        ) : null}
        {overUnused ? (
          <p className="m-0 text-[12px] text-[#C0392B]">
            {t('categoryRefundExceeds', { max: categoryUnused.toFixed(2) })}
          </p>
        ) : null}
        <Field
          label={tc('amount')}
          preset="amount"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
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
        {method === 'CARD' && bankTerminals.length > 0 ? (
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
        ) : null}
        {method === 'CARD' && bankTerminals.length === 0 ? (
          <p className="m-0 text-[12px] text-amber-800">{t('noBankTerminal')}</p>
        ) : null}
        <FieldTextarea
          label={t('refundReason')}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
        />
      </div>
    </EraModal>
  );
}
