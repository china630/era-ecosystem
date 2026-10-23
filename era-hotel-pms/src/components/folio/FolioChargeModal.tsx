'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CatalogField, Field, showApiError, showSuccess } from '@era/satellite-kit/ui';
import { EraModal, EraModalFooter } from '@/components/EraModal';
import type { PayerGuest } from '@/lib/folio-payer';

type RevenueCode = {
  id: string;
  code: string;
  name?: string | null;
  active?: boolean;
  systemRole?: string | null;
};

const ROOM_ROLES = ['ROOM', 'PKG', 'RATE_ADJ', 'CITY_TAX'];

export function FolioChargeModal({
  open,
  onClose,
  onDone,
  reservationId,
  pocketOptions,
  guests,
}: {
  open: boolean;
  onClose: () => void;
  onDone?: () => void;
  reservationId: string;
  pocketOptions?: Array<{ value: 'GUEST' | 'AGENCY' | 'COMPANY'; label: string }>;
  guests?: PayerGuest[];
}) {
  const t = useTranslations('folio');
  const tc = useTranslations('common');
  const [codes, setCodes] = useState<RevenueCode[]>([]);
  const [revenueCodeId, setRevenueCodeId] = useState('');
  const [folioType, setFolioType] = useState<'' | 'GUEST' | 'AGENCY' | 'COMPANY'>('');
  const [guestId, setGuestId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAmount('');
    setDescription('');
    setFolioType('');
    setGuestId('');
    setRevenueCodeId('');
    void fetch('/api/master/revenue-codes')
      .then((r) => r.json())
      .then((data) => {
        const rows = (data.data ?? data) as RevenueCode[];
        const list = Array.isArray(rows) ? rows.filter((row) => row.active !== false) : [];
        setCodes(list);
      })
      .catch(() => setCodes([]));
  }, [open]);

  const selected = codes.find((row) => row.id === revenueCodeId) ?? null;
  const roomArticle = ROOM_ROLES.includes(selected?.systemRole ?? '');
  const namedGuests = (guests ?? []).filter((guest) => guest.name.trim());
  const selectedGuest =
    namedGuests.length === 1 ? namedGuests[0]! : namedGuests.find((guest) => guest.id === guestId) ?? null;
  const needsGuest = !roomArticle && folioType === 'GUEST' && namedGuests.length > 1 && !selectedGuest;
  const needsPocket = !roomArticle && Boolean(pocketOptions && pocketOptions.length > 0) && !folioType;
  const amountN = Number(amount);
  const canSubmit =
    Boolean(revenueCodeId) &&
    !needsGuest &&
    !needsPocket &&
    amountN !== 0 &&
    description.trim().length > 0;

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
          folioType: roomArticle ? undefined : folioType || undefined,
          reservationGuestId: roomArticle || folioType !== 'GUEST' ? undefined : selectedGuest?.id,
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
      title={t('extraCharge')}
      onClose={onClose}
      footer={
        <EraModalFooter
          onCancel={onClose}
          onSubmit={() => void submit()}
          busy={busy}
          submitDisabled={!canSubmit}
          submitLabel={t('extraCharge')}
        />
      }
    >
      <div className="space-y-3">
        <CatalogField
          kind="SEARCHABLE"
          label={t('xercMaddesi')}
          value={revenueCodeId}
          onChange={(v) => {
            setRevenueCodeId(String(v ?? ''));
            setFolioType('');
            setGuestId('');
          }}
          options={codes.map((c) => ({
            value: c.id,
            label: c.name ? `${c.code} — ${c.name}` : c.code,
          }))}
          emptyLabel={t('pickArticle')}
        />
        {!roomArticle && pocketOptions && pocketOptions.length > 0 && revenueCodeId ? (
          <CatalogField
            kind="CLOSED_SMALL"
            label={t('pocket')}
            value={folioType}
            onChange={(v) => setFolioType((String(v ?? '') as 'GUEST' | 'AGENCY' | 'COMPANY') || '')}
            options={pocketOptions}
            emptyLabel={t('pickPocket')}
          />
        ) : null}
        {!roomArticle && folioType === 'GUEST' && namedGuests.length > 1 ? (
          <CatalogField
            kind="CLOSED_SMALL"
            label={t('pickGuest')}
            value={guestId}
            onChange={(v) => setGuestId(String(v ?? ''))}
            options={namedGuests.map((guest) => ({ value: guest.id, label: guest.name }))}
            emptyLabel={t('pickGuest')}
          />
        ) : null}
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
