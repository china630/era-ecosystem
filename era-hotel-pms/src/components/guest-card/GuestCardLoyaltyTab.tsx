'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Field, ModalFooter, ModalShell, showApiError } from '@era/satellite-kit/ui';
import { HotelDataGrid } from "@/components/HotelDataGrid";
import { hotelDateKey } from '@/lib/hotel-calendar';

export function GuestCardLoyaltyTab({
  loyaltyTier,
  cards,
  pointEntries,
  guestId,
  locked = false,
  onReload,
  onReloadPoints,
}: {
  loyaltyTier: string;
  cards: Array<{ id: string; cardNumber: string; tier: string | null; points: number | null; active: boolean }>;
  pointEntries: Array<{
    id: string;
    entryDate: string;
    points: number;
    description?: string | null;
    balanceAfter?: number | null;
  }>;
  guestId: string | null;
  locked?: boolean;
  onReload: () => void;
  onReloadPoints: () => void;
}) {
  const t = useTranslations('guestCard');
  const tc = useTranslations('common');
  const [cardOpen, setCardOpen] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [pointsOpen, setPointsOpen] = useState(false);
  const [entryDate, setEntryDate] = useState(hotelDateKey());
  const [points, setPoints] = useState('100');
  const [busy, setBusy] = useState(false);

  async function addCard() {
    if (!guestId) return;
    if (!cardNumber.trim()) {
      showApiError({ error: tc('requiredNamed', { field: t('loyalty.cardNumber') }) });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/guests/${guestId}/loyalty-cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardNumber: cardNumber.trim() }),
      });
      if (!res.ok) {
        showApiError(await res.json().catch(() => ({})), tc('failed'));
        return;
      }
      setCardOpen(false);
      setCardNumber('');
      onReload();
    } finally {
      setBusy(false);
    }
  }

  async function addPoints() {
    if (!guestId) return;
    const missing = [
      !entryDate ? t('loyalty.entryDate') : '',
      !points.trim() ? t('loyalty.points') : '',
    ].filter(Boolean);
    if (missing.length > 0) {
      showApiError({ error: tc('requiredNamed', { field: missing.join(', ') }) });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/guests/${guestId}/loyalty/points`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entryDate,
          points: Number(points),
          description: t('loyalty.manualEntry'),
        }),
      });
      if (!res.ok) {
        showApiError(await res.json().catch(() => ({})), tc('failed'));
        return;
      }
      setPointsOpen(false);
      onReloadPoints();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 text-[13px]">
      <p>
        {t('loyalty.tier')}: <strong>{loyaltyTier || '—'}</strong>
      </p>
      <HotelDataGrid
        rows={cards as Array<Record<string, unknown>>}
        columns={[
          { key: 'cardNumber', header: t('loyalty.cardNumber') },
          { key: 'tier', header: t('loyalty.tierCol') },
          { key: 'points', header: t('loyalty.points') },
          { key: 'active', header: t('loyalty.active'), render: (r) => (r.active ? '✓' : '—') },
        ]}
        rowKey={(r) => String(r.id)}
        emptyMessage={t('loyalty.empty')}
        pagination={false}
      />
      {guestId && !locked ? (
        <button
          type="button"
          className="text-[12px] font-medium text-[#2980B9]"
          onClick={() => setCardOpen(true)}
        >
          + {t('loyalty.addCard')}
        </button>
      ) : null}
      <h3 className="font-semibold text-[#34495E]">{t('loyalty.pointsHistory')}</h3>
      <HotelDataGrid
        rows={pointEntries as Array<Record<string, unknown>>}
        columns={[
          { key: 'entryDate', header: t('loyalty.entryDate'), render: (r) => String(r.entryDate).slice(0, 10) },
          { key: 'points', header: t('loyalty.points') },
          { key: 'description', header: t('loyalty.description') },
          { key: 'balanceAfter', header: t('loyalty.balanceAfter') },
        ]}
        rowKey={(r) => String(r.id)}
        emptyMessage={t('loyalty.pointsEmpty')}
        pagination={false}
      />
      {guestId && !locked ? (
        <button
          type="button"
          className="text-[12px] font-medium text-[#2980B9]"
          onClick={() => {
            setEntryDate(hotelDateKey());
            setPointsOpen(true);
          }}
        >
          + {t('loyalty.addPoints')}
        </button>
      ) : null}
      <ModalShell
        open={cardOpen}
        title={t('loyalty.addCard')}
        onClose={() => setCardOpen(false)}
        closeLabel={tc('close')}
        footer={
          <ModalFooter
            onCancel={() => setCardOpen(false)}
            onSubmit={() => void addCard()}
            busy={busy}
            cancelLabel={tc('cancel')}
            submitLabel={tc('save')}
          />
        }
      >
        <Field label={t('loyalty.cardNumber')} preset="shortText" value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} required />
      </ModalShell>
      <ModalShell
        open={pointsOpen}
        title={t('loyalty.addPoints')}
        onClose={() => setPointsOpen(false)}
        closeLabel={tc('close')}
        footer={
          <ModalFooter
            onCancel={() => setPointsOpen(false)}
            onSubmit={() => void addPoints()}
            busy={busy}
            cancelLabel={tc('cancel')}
            submitLabel={tc('save')}
          />
        }
      >
        <div className="space-y-3">
          <Field label={t('loyalty.entryDate')} preset="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} required />
          <Field label={t('loyalty.points')} preset="amount" value={points} onChange={(e) => setPoints(e.target.value)} required />
        </div>
      </ModalShell>
    </div>
  );
}
