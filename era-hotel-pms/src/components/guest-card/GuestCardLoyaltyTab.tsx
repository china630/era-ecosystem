'use client';

import { useTranslations } from 'next-intl';
import { HotelDataGrid } from "@/components/HotelDataGrid";

export function GuestCardLoyaltyTab({
  loyaltyTier,
  cards,
  pointEntries,
  guestId,
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
  onReload: () => void;
  onReloadPoints: () => void;
}) {
  const t = useTranslations('guestCard');

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
      {guestId ? (
        <button
          type="button"
          className="text-[12px] font-medium text-[#2980B9]"
          onClick={async () => {
            const cardNumber = window.prompt(t('loyalty.cardNumber'));
            if (!cardNumber) return;
            await fetch(`/api/guests/${guestId}/loyalty-cards`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ cardNumber }),
            });
            onReload();
          }}
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
      {guestId ? (
        <button
          type="button"
          className="text-[12px] font-medium text-[#2980B9]"
          onClick={async () => {
            const entryDate = window.prompt(t('loyalty.entryDate'), new Date().toISOString().slice(0, 10));
            const pts = window.prompt(t('loyalty.points'), '100');
            if (!entryDate || !pts) return;
            await fetch(`/api/guests/${guestId}/loyalty/points`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                entryDate,
                points: Number(pts),
                description: t('loyalty.manualEntry'),
              }),
            });
            onReloadPoints();
          }}
        >
          + {t('loyalty.addPoints')}
        </button>
      ) : null}
    </div>
  );
}
