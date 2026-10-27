'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CatalogField, Field, SECONDARY_BUTTON_CLASS, showApiError, showSuccess } from '@era/satellite-kit/ui';
import { EraModal, EraModalFooter } from '@/components/EraModal';
import { stayMoneyPair } from '@/lib/folio-money-pair';
import {
  pickTargetFolio,
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
  charges: Array<{
    amount: number | string;
    qty?: number | null;
    revenueCodeId?: string | null;
    revenueCode?: { code?: string | null } | null;
  }>;
  payments?: Array<{
    id?: string;
    amount: number | string;
    kind?: string | null;
    voidedAt?: string | null;
    revenueCodeId?: string | null;
    refundOfPaymentId?: string | null;
    revenueCode?: { code?: string | null } | null;
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
  const [method, setMethod] = useState<string>('CASH');
  const [bankReference, setBankReference] = useState('');
  const [bankTerminalId, setBankTerminalId] = useState('');
  const [bankTerminals, setBankTerminals] = useState<{ id: string; label: string }[]>([]);
  const [codes, setCodes] = useState<
    Array<{ id: string; code: string; name?: string | null; systemRole?: string | null }>
  >([]);
  const [revenueCodeId, setRevenueCodeId] = useState('');
  const [pocket, setPocket] = useState<'' | FolioParty>('');
  const [busy, setBusy] = useState(false);

  const knownStay = Boolean(reservationId);
  const activeStayId = knownStay ? reservationId! : stayId;
  const partyGuests = useMemo(() => {
    if (knownStay) return guests ?? [];
    return stays.find((s) => s.reservationId === stayId)?.guests ?? [];
  }, [knownStay, guests, stays, stayId]);
  const selectedCode = codes.find((row) => row.id === revenueCodeId) ?? null;
  const roomArticle = ['ROOM', 'PKG', 'RATE_ADJ', 'CITY_TAX'].includes(selectedCode?.systemRole ?? '');
  const namedGuests = partyGuests.filter((guest) => guest.name.trim());
  const payer =
    pocket === 'guest' && !roomArticle
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
    setAmount('');
    setMethod('CASH');
    setBankReference('');
    setBankTerminalId('');
    setGuestId('');
    setStayId(reservationId ?? '');
    setFolios([]);
    setRevenueCodeId('');
    setPocket('');
  }, [open, reservationId]);

  useEffect(() => {
    if (!open) return;
    void fetch('/api/master/revenue-codes')
      .then((r) => r.json())
      .then((data) => {
        const rows = (data.data ?? data) as Array<{
          id: string;
          code: string;
          name?: string | null;
          active?: boolean;
          systemRole?: string | null;
        }>;
        const list = Array.isArray(rows) ? rows.filter((row) => row.active !== false) : [];
        setCodes(list);
        setRevenueCodeId('');
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

  const folio = roomArticle || !pocket ? undefined : pickTargetFolio(folios, pocket, selectedGuest);
  const openFolios = folios.filter((row) => row.status === 'OPEN');
  const roomFolio = roomArticle
    ? openFolios.find(
        (row) =>
          stayMoneyPair(
            row.charges.filter((charge) => charge.revenueCodeId === revenueCodeId),
            (row.payments ?? []).filter((payment) => payment.revenueCodeId === revenueCodeId),
          ).debt > 0.01,
      ) ?? openFolios.find((row) => row.charges.some((charge) => charge.revenueCodeId === revenueCodeId))
    : undefined;
  const debtFolios = roomArticle ? (roomFolio ? [roomFolio] : []) : folio ? [folio] : [];
  const articleDebt = stayMoneyPair(
    debtFolios.flatMap((row) => row.charges).filter((row) => row.revenueCodeId === revenueCodeId),
    debtFolios.flatMap((row) => row.payments ?? []).filter((row) => row.revenueCodeId === revenueCodeId),
  ).debt;
  const methods = METHODS.filter((m) => m !== 'DEPOSIT');
  const needsGuest = !roomArticle && pocket === 'guest' && payer.kind === 'pick' && !selectedGuest;
  const needsPocket = !roomArticle && !pocket;
  const needsStay = !knownStay && !activeStayId;
  const amountN = Number(amount);
  const overArticle = articleDebt > 0.01 && amountN > articleDebt + 0.01;
  const canSubmit =
    !needsStay &&
    !needsGuest &&
    !needsPocket &&
    !overArticle &&
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
          reservationId: activeStayId,
          folioType: roomArticle ? undefined : pocket === 'agency' ? 'AGENCY' : pocket === 'company' ? 'COMPANY' : 'GUEST',
          reservationGuestId: roomArticle ? undefined : selectedGuest?.id,
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
        <CatalogField
          kind="SEARCHABLE"
          label={t('xercMaddesi')}
          value={revenueCodeId}
          onChange={(v) => {
            setRevenueCodeId(String(v ?? ''));
            setPocket('');
            setGuestId('');
          }}
          options={codes.map((c) => ({
            value: c.id,
            label: c.name ? `${c.code} — ${c.name}` : c.code,
          }))}
          emptyLabel={t('pickArticle')}
        />
        {activeStayId && revenueCodeId && !roomArticle ? (
          <CatalogField
            kind="CLOSED_SMALL"
            label={t('pocket')}
            value={pocket}
            onChange={(v) => setPocket((String(v ?? '') as FolioParty) || '')}
            options={pocketOptions}
            emptyLabel={t('pickPocket')}
          />
        ) : null}
        {roomArticle && activeStayId ? (
          <p className="m-0 text-[12px] text-[#7F8C8D]">
            {t('roomPaymentFollowsPayer', {
              name:
                roomFolio?.type === 'AGENCY'
                  ? t('partyAgency')
                  : roomFolio?.type === 'COMPANY'
                    ? t('partyCompany')
                    : t('partyGuest'),
            })}
          </p>
        ) : null}
        {!roomArticle && pocket === 'guest' && payer.kind === 'pick' ? (
          <CatalogField
            kind="CLOSED_SMALL"
            label={t('pickGuest')}
            value={guestId}
            onChange={(v) => setGuestId(String(v ?? ''))}
            options={namedGuests.map((g) => ({ value: g.id, label: g.name }))}
            emptyLabel={t('pickGuest')}
          />
        ) : null}
        {overArticle ? (
          <p className="m-0 text-[12px] text-[#C0392B]">
            {t('paymentExceedsArticle', { max: articleDebt.toFixed(2) })}
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
          onChange={(v) => setMethod(String(v ?? 'CASH'))}
          options={methods.map((m) => ({ value: m, label: tPay(m) }))}
          emptyLabel={null}
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
