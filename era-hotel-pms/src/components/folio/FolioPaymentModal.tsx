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
import { DESK_PAYMENT_METHODS } from '@/lib/desk-payment-methods';

const METHODS = DESK_PAYMENT_METHODS;

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
  const [bankTerminalId, setBankTerminalId] = useState('');
  const [bankTerminals, setBankTerminals] = useState<{ id: string; label: string }[]>([]);
  const [codes, setCodes] = useState<Array<{ id: string; code: string; name?: string | null }>>([]);
  const [revenueCodeId, setRevenueCodeId] = useState('');
  const [pocket, setPocket] = useState<FolioParty>(party);
  const [busy, setBusy] = useState(false);

  const knownStay = Boolean(reservationId);
  const activeStayId = knownStay ? reservationId! : stayId;
  const partyGuests = useMemo(() => {
    if (knownStay) return guests ?? [];
    return stays.find((s) => s.reservationId === stayId)?.guests ?? [];
  }, [knownStay, guests, stays, stayId]);
  const payer = pocket === 'guest' ? resolvePayer(partyGuests) : { kind: 'none' as const };
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
    setBankTerminalId('');
    setGuestId('');
    setStayId(reservationId ?? '');
    setFolios([]);
    setRevenueCodeId('');
    setPocket(party);
  }, [open, reservationId, party]);

  useEffect(() => {
    if (!open) return;
    void fetch('/api/master/revenue-codes')
      .then((r) => r.json())
      .then((data) => {
        const rows = (data.data ?? data) as Array<{ id: string; code: string; name?: string | null; active?: boolean }>;
        const list = Array.isArray(rows) ? rows.filter((row) => row.active !== false) : [];
        setCodes(list);
        setRevenueCodeId((prev) => prev || list[0]?.id || '');
      })
      .catch(() => setCodes([]));
  }, [open]);

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

  const folio = pickTargetFolio(folios, pocket, selectedGuest);
  const balance = folio ? accountBalance(folio) : 0;
  const methods = METHODS.filter((m) => m !== 'DEPOSIT');
  const needsGuest = pocket === 'guest' && payer.kind === 'pick' && !selectedGuest;
  const needsStay = !knownStay && !activeStayId;
  const amountN = Number(amount);
  const canSubmit =
    !needsStay &&
    !needsGuest &&
    amountN > 0 &&
    Boolean(revenueCodeId) &&
    (method !== 'BANK_TRANSFER' || bankReference.trim().length > 0) &&
    (method !== 'CARD' || (bankTerminals.length > 0 && bankTerminalId.trim().length > 0));
  async function submit() {
    if (!canSubmit || !activeStayId) return;
    setBusy(true);
    try {
      const res = await fetch('/api/folios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folioId: folio?.id,
          reservationId: folio ? undefined : activeStayId,
          folioType: pocket === 'agency' ? 'AGENCY' : pocket === 'company' ? 'COMPANY' : 'GUEST',
          revenueCodeId,
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

  const payerLabel =
    pocket === 'agency' ? t('partyAgency') : pocket === 'company' ? t('partyCompany') : selectedGuest?.name ?? '';

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
            onChange={(v) => setPocket((String(v ?? 'guest') as FolioParty))}
            options={[
              { value: 'guest', label: t('partyGuest') },
              { value: 'agency', label: t('partyAgency') },
              { value: 'company', label: t('partyCompany') },
            ]}
            emptyLabel={null}
          />
        ) : null}
        {pocket === 'guest' && payer.kind === 'pick' ? (
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
        <CatalogField
          kind="SEARCHABLE"
          label={t('xercMaddesi')}
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
        <CatalogField
          kind="CLOSED_SMALL"
          label={t('method')}
          value={method}
          onChange={(v) => setMethod(String(v ?? 'CASH'))}
          options={methods.map((m) => ({ value: m, label: tPay(m) }))}
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
