'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  CatalogField,
  Field,
  SECONDARY_BUTTON_CLASS,
  TEXT_MUTED_CLASS,
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
import { DESK_PAYMENT_METHODS } from '@/lib/desk-payment-methods';
import {
  PAYMENT_CATEGORIES,
  type PaymentCategory,
  isPaymentCategory,
} from '@/lib/payment-category';

const METHODS = DESK_PAYMENT_METHODS;

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

export function FolioPaymentModal({
  open,
  onClose,
  onDone,
  onOpenStay,
  reservationId,
  party = 'guest',
  guests,
  hasCompany,
  hasAgency,
}: {
  open: boolean;
  onClose: () => void;
  onDone?: () => void;
  /** Header flow: open the stay card on the folio tab. */
  onOpenStay?: (reservationId: string) => void;
  /** Set when the stay is already known (reservation card). */
  reservationId?: string | null;
  party?: FolioParty;
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
  const [guestId, setGuestId] = useState('');
  const [folios, setFolios] = useState<FolioRow[]>([]);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('');
  const [bankReference, setBankReference] = useState('');
  const [bankTerminalId, setBankTerminalId] = useState('');
  const [bankTerminals, setBankTerminals] = useState<{ id: string; label: string }[]>([]);
  const [paymentCategory, setPaymentCategory] = useState<'' | PaymentCategory>('');
  const [pocket, setPocket] = useState<'' | FolioParty>('');
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

  const categoryOptions = useMemo(() => {
    const open = folios.filter((row) => row.status === 'OPEN');
    const folio =
      pocket && open.length > 0
        ? pickTargetFolio(open, pocket, selectedGuest ?? undefined)
        : undefined;
    const charges = folio?.charges ?? open.flatMap((row) => row.charges);
    const payments = folio?.payments ?? open.flatMap((row) => row.payments ?? []);
    return PAYMENT_CATEGORIES.map((cat) => {
      const pair = stayCategoryMoneyPair(charges, payments, cat);
      const label = t(`paymentCategory_${cat}`);
      const suffix =
        pair.debt > 0.01
          ? ` (${pair.debt.toFixed(2)})`
          : pair.unused > 0.01
            ? ` (+${pair.unused.toFixed(2)})`
            : '';
      return {
        value: cat,
        label: `${label}${suffix}`,
        debt: pair.debt,
      };
    });
  }, [folios, pocket, selectedGuest, t]);

  useEffect(() => {
    if (!open) return;
    setAmount('');
    setMethod('');
    setBankReference('');
    setBankTerminalId('');
    setGuestId('');
    setStayId(reservationId ?? '');
    setFolios([]);
    setPaymentCategory('');
    setPocket('');
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
    if (!open || knownStay || party !== 'guest') return;
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
  }, [open, knownStay, party, query]);

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

  const categoryPair = useMemo(() => {
    if (!paymentCategory || !isPaymentCategory(paymentCategory)) return { debt: 0, unused: 0 };
    const charges = folio?.charges ?? [];
    const payments = folio?.payments ?? [];
    return stayCategoryMoneyPair(charges, payments, paymentCategory);
  }, [folio, paymentCategory]);
  const categoryDebt = categoryPair.debt;
  const categoryUnused = categoryPair.unused;

  useEffect(() => {
    if (!open || !paymentCategory || !pocket) return;
    if (categoryDebt > 0.01) setAmount(categoryDebt.toFixed(2));
  }, [open, paymentCategory, pocket, categoryDebt]);

  const methods = METHODS.filter((m) => m !== 'DEPOSIT');
  const needsGuest = pocket === 'guest' && payer.kind === 'pick' && !selectedGuest;
  const needsPocket = !pocket;
  const needsCategory = !paymentCategory;
  const needsStay = !knownStay && !activeStayId;
  const amountN = Number(amount);
  const overCategory = categoryDebt > 0.01 && amountN > categoryDebt + 0.01;
  const methodOk =
    method.length > 0 &&
    (method !== 'BANK_TRANSFER' || bankReference.trim().length > 0) &&
    (method !== 'CARD' || (bankTerminals.length > 0 && bankTerminalId.trim().length > 0));
  const canSubmit =
    !needsStay &&
    !needsGuest &&
    !needsPocket &&
    !needsCategory &&
    !overCategory &&
    amountN > 0 &&
    methodOk;

  async function submit() {
    if (!canSubmit || !activeStayId || !paymentCategory) return;
    setBusy(true);
    try {
      const res = await fetch('/api/folios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reservationId: activeStayId,
          folioType:
            pocket === 'agency' ? 'AGENCY' : pocket === 'company' ? 'COMPANY' : 'GUEST',
          reservationGuestId: pocket === 'guest' ? selectedGuest?.id : undefined,
          paymentCategory,
          amount: amountN,
          paymentMethod: method,
          bankReference: method === 'BANK_TRANSFER' ? bankReference.trim() : undefined,
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

  const pickedStay = knownStay ? null : stays.find((row) => row.reservationId === stayId);
  const companyOnStay = knownStay ? hasCompany : pickedStay?.hasCompany;
  const agencyOnStay = knownStay ? hasAgency : pickedStay?.hasAgency;
  const pocketOptions = [
    { value: 'guest', label: t('partyGuest') },
    ...(agencyOnStay === false ? [] : [{ value: 'agency', label: t('partyAgency') }]),
    ...(companyOnStay === false ? [] : [{ value: 'company', label: t('partyCompany') }]),
  ];

  return (
    <EraModal
      open={open}
      title={t('extraPayment')}
      onClose={onClose}
      footer={
        <EraModalFooter
          onCancel={onClose}
          onSubmit={() => void submit()}
          busy={busy}
          submitDisabled={!canSubmit}
          submitLabel={t('extraPayment')}
        />
      }
    >
      <div className="space-y-3">
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
            emptyLabel={t('pickPaymentCategory')}
          />
        ) : null}
        {paymentCategory && pocket ? (
          <p className={`m-0 text-[12px] ${TEXT_MUTED_CLASS}`}>
            {categoryDebt > 0.01
              ? t('categoryDebtHint', { amount: categoryDebt.toFixed(2) })
              : categoryUnused > 0.01
                ? t('categoryCreditHint', { amount: categoryUnused.toFixed(2) }) +
                  ' — ' +
                  t('categoryRefundHintShort')
                : t('pocketDebtHint')}
          </p>
        ) : null}
        {!pocket && activeStayId ? null : pocket === 'guest' && payer.kind === 'pick' ? (
          <CatalogField
            kind="CLOSED_SMALL"
            label={t('pickGuest')}
            value={guestId}
            onChange={(v) => setGuestId(String(v ?? ''))}
            options={namedGuests.map((g) => ({ value: g.id, label: g.name }))}
            emptyLabel={t('pickGuest')}
          />
        ) : null}
        {overCategory ? (
          <p className="m-0 text-[12px] text-[#C0392B]">
            {t('paymentExceedsArticle', { max: categoryDebt.toFixed(2) })}
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
          kind="CLOSED_SMALL"
          label={t('method')}
          value={method}
          onChange={(v) => setMethod(String(v ?? ''))}
          options={methods.map((m) => ({ value: m, label: tPay(m) }))}
          emptyLabel={t('pickMethod')}
        />
        {method === 'CL_AGENCY' || method === 'CL_COMPANY' || method === 'COMPANY_ACCOUNT' ? (
          <p className="m-0 text-[12px] text-[#7F8C8D]">{t('cityLedgerTenderHint')}</p>
        ) : null}
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
        {method === 'BANK_TRANSFER' ? (
          <Field
            label={t('bankReference')}
            preset="longText"
            value={bankReference}
            onChange={(e) => setBankReference(e.target.value)}
            placeholder={t('bankReferencePlaceholder')}
          />
        ) : null}
        {onOpenStay && activeStayId ? (
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            onClick={() => {
              onOpenStay(activeStayId);
              onClose();
            }}
          >
            {t('openStayFolio')}
          </button>
        ) : null}
      </div>
    </EraModal>
  );
}
