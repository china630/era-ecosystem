'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CatalogField, Field, SECONDARY_BUTTON_CLASS, showApiError, showSuccess } from '@era/satellite-kit/ui';
import { EraModal, EraModalFooter } from '@/components/EraModal';
import {
  accountBalance,
  pickTargetFolio,
  resolvePayer,
  type FolioParty,
  type PayerGuest,
} from '@/lib/folio-payer';

const METHODS = ['CASH', 'CARD', 'BANK_TRANSFER', 'COMPANY_ACCOUNT', 'LOYALTY_POINTS'] as const;

type FolioRow = {
  id: string;
  type: string;
  status: string;
  reservationGuestId?: string | null;
  charges: Array<{ amount: number | string; qty?: number | null }>;
  payments?: Array<{ amount: number | string; kind?: string | null }>;
};

type StayTarget = {
  reservationId: string;
  roomNumber: string;
  guests: PayerGuest[];
};

export function FolioPaymentModal({
  open,
  onClose,
  onDone,
  onOpenStay,
  reservationId,
  party = 'guest',
  guests,
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
  const [method, setMethod] = useState<string>('CASH');
  const [bankReference, setBankReference] = useState('');
  const [busy, setBusy] = useState(false);

  const knownStay = Boolean(reservationId);
  const activeStayId = knownStay ? reservationId! : stayId;
  const partyGuests = useMemo(() => {
    if (knownStay) return guests ?? [];
    return stays.find((s) => s.reservationId === stayId)?.guests ?? [];
  }, [knownStay, guests, stays, stayId]);
  const payer = party === 'guest' ? resolvePayer(partyGuests) : { kind: 'none' as const };
  const selectedGuest =
    payer.kind === 'fixed'
      ? payer.guest
      : payer.kind === 'pick'
        ? partyGuests.find((g) => g.id === guestId) ?? null
        : null;

  useEffect(() => {
    if (!open) return;
    setAmount('');
    setMethod('CASH');
    setBankReference('');
    setGuestId('');
    setStayId(reservationId ?? '');
    setFolios([]);
  }, [open, reservationId]);

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

  const folio = pickTargetFolio(folios, party, selectedGuest);
  const balance = folio ? accountBalance(folio) : 0;
  const asDeposit = party === 'guest' && balance <= 0.01;
  const methods = asDeposit ? METHODS.filter((m) => m !== 'LOYALTY_POINTS') : METHODS;
  useEffect(() => {
    if (asDeposit && method === 'LOYALTY_POINTS') setMethod('CASH');
  }, [asDeposit, method]);
  const needsGuest = party === 'guest' && payer.kind === 'pick' && !selectedGuest;
  const needsStay = !knownStay && !activeStayId;
  const amountN = Number(amount);
  const canSubmit =
    !needsStay &&
    !needsGuest &&
    amountN > 0 &&
    (asDeposit || Boolean(folio)) &&
    (method !== 'BANK_TRANSFER' || bankReference.trim().length > 0);

  async function submit() {
    if (!canSubmit || !activeStayId) return;
    setBusy(true);
    try {
      const res = asDeposit
        ? await fetch(`/api/reservations/${activeStayId}/deposits`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              amount: amountN,
              paymentMethod: method,
              registerRef: method === 'BANK_TRANSFER' ? bankReference.trim() : undefined,
            }),
          })
        : await fetch('/api/folios', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              folioId: folio!.id,
              amount: amountN,
              paymentMethod: method,
              bankReference: method === 'BANK_TRANSFER' ? bankReference.trim() : undefined,
            }),
          });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('error'));
        return;
      }
      showSuccess(asDeposit ? t('depositRecordedShort') : t('paymentRecorded'));
      onDone?.();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  const payerLabel =
    party === 'agency' ? t('partyAgency') : party === 'company' ? t('partyCompany') : selectedGuest?.name ?? '';

  return (
    <EraModal
      open={open}
      title={t('acceptPaymentTitle')}
      onClose={onClose}
      footer={
        <EraModalFooter
          onCancel={onClose}
          onSubmit={() => void submit()}
          busy={busy}
          submitDisabled={!canSubmit}
          submitLabel={asDeposit ? t('acceptDeposit') : t('acceptPayment')}
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
        {party === 'guest' && payer.kind === 'pick' ? (
          <CatalogField
            kind="CLOSED_SMALL"
            label={t('pickGuest')}
            value={guestId}
            onChange={(v) => setGuestId(String(v ?? ''))}
            options={partyGuests.map((g) => ({ value: g.id, label: g.name }))}
            emptyLabel={null}
          />
        ) : null}
        {payerLabel ? (
          <p className="m-0 text-[13px] text-[#34495E]">
            {t('payer')}: <strong>{payerLabel}</strong>
            {folio ? ` — ${balance.toFixed(2)} AZN` : ''}
          </p>
        ) : null}
        {asDeposit && activeStayId && !needsGuest ? (
          <p className="m-0 text-[12px] text-[#7F8C8D]">{t('depositBecauseZero')}</p>
        ) : null}
        {!asDeposit && activeStayId && !needsGuest && !folio ? (
          <p className="m-0 text-[12px] text-amber-800">{t('noOpenFolio')}</p>
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
          onChange={(v) => setMethod(String(v ?? 'CASH'))}
          options={methods.map((m) => ({ value: m, label: tPay(m) }))}
          emptyLabel={null}
        />
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
