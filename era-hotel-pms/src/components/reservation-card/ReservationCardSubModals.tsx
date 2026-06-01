'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { EraModal } from '@/components/EraModal';
import { EraDataGrid, MODAL_INPUT_CLASS, PRIMARY_BUTTON_CLASS, showApiError, showSuccess } from '@era/satellite-kit/ui';

type SubModal = 'creditCard' | 'packages' | 'tasks' | 'folioRouting' | null;

export function useReservationSubModals(reservationId: string | null) {
  const [open, setOpen] = useState<SubModal>(null);
  return {
    openSubModal: (m: SubModal) => setOpen(m),
    subModalProps: { reservationId, open, onClose: () => setOpen(null) },
  };
}

export function ReservationCardSubModals({
  reservationId,
  open,
  onClose,
}: {
  reservationId: string | null;
  open: SubModal;
  onClose: () => void;
}) {
  const t = useTranslations('reservationCard');
  const tc = useTranslations('common');
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [routing, setRouting] = useState<{ folios: unknown[]; rules: unknown[] } | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!reservationId || !open) return;
    setLoading(true);
    try {
      const path =
        open === 'creditCard'
          ? 'payment-cards'
          : open === 'packages'
            ? 'packages'
            : open === 'tasks'
              ? 'tasks'
              : 'folio-routing';
      const res = await fetch(`/api/reservations/${reservationId}/${path}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      if (open === 'folioRouting') {
        setRouting(json);
        setRows([]);
      } else {
        setRows(Array.isArray(json) ? json : []);
        setRouting(null);
      }
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
    } finally {
      setLoading(false);
    }
  }, [reservationId, open, tc]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  async function addRow() {
    if (!reservationId || !open) return;
    if (open === 'creditCard') {
      const lastFour = window.prompt(t('subModal.lastFour'), '4242');
      if (!lastFour || lastFour.length !== 4) return;
      await fetch(`/api/reservations/${reservationId}/payment-cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lastFour, cardBrand: 'VISA' }),
      });
    } else if (open === 'packages') {
      const packageCode = window.prompt(t('subModal.packageCode'));
      const packageName = window.prompt(t('subModal.packageName'));
      const amount = window.prompt(t('subModal.amount'), '0');
      if (!packageCode || !packageName) return;
      await fetch(`/api/reservations/${reservationId}/packages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageCode, packageName, amount: Number(amount) || 0 }),
      });
    } else if (open === 'tasks') {
      const title = window.prompt(t('subModal.taskTitle'));
      if (!title) return;
      await fetch(`/api/reservations/${reservationId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
    }
    showSuccess(tc('success'));
    await load();
  }

  const titles: Record<Exclude<SubModal, null>, string> = {
    creditCard: t('bottom.creditCard'),
    packages: t('bottom.packages'),
    tasks: t('bottom.tasks', { count: rows.length }),
    folioRouting: t('bottom.folioRouting'),
  };

  if (!open || !reservationId) return null;

  return (
    <EraModal open title={titles[open]} onClose={onClose} maxWidthClass="max-w-lg w-full">
      {loading ? (
        <p className="text-[13px] text-[#7F8C8D]">{tc('loading')}</p>
      ) : open === 'folioRouting' && routing ? (
        <div className="space-y-2 text-[12px]">
          <p className="font-semibold">{t('subModal.routingRules')}</p>
          <pre className="max-h-40 overflow-auto rounded bg-[#F8FAFC] p-2">
            {JSON.stringify(routing.rules, null, 2)}
          </pre>
          <p className="font-semibold">{t('subModal.folios')}</p>
          <pre className="max-h-40 overflow-auto rounded bg-[#F8FAFC] p-2">
            {JSON.stringify(routing.folios, null, 2)}
          </pre>
        </div>
      ) : (
        <>
          <EraDataGrid
            rows={rows}
            columns={
              open === 'creditCard'
                ? [
                    { key: 'cardBrand', header: t('subModal.brand') },
                    { key: 'lastFour', header: t('subModal.lastFour') },
                    { key: 'holderName', header: t('subModal.holder') },
                  ]
                : open === 'packages'
                  ? [
                      { key: 'packageCode', header: t('subModal.packageCode') },
                      { key: 'packageName', header: t('subModal.packageName') },
                      { key: 'amount', header: t('amount') },
                    ]
                  : [
                      { key: 'title', header: t('subModal.taskTitle') },
                      { key: 'status', header: t('subModal.status') },
                    ]
            }
            rowKey={(r) => String(r.id)}
            emptyMessage={tc('empty')}
          />
          <button type="button" className={`${PRIMARY_BUTTON_CLASS} mt-3`} onClick={() => void addRow()}>
            {tc('add')}
          </button>
        </>
      )}
    </EraModal>
  );
}
