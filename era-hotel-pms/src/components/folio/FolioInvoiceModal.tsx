'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { SECONDARY_BUTTON_CLASS, showApiError, showSuccess } from '@era/satellite-kit/ui';
import { EraModal } from '@/components/EraModal';
import { accountBalance } from '@/lib/folio-payer';

type FolioRow = {
  id: string;
  type: string;
  status: string;
  charges: Array<{ amount: number | string; qty?: number | null }>;
  payments?: Array<{ amount: number | string; kind?: string | null }>;
};

export function FolioInvoiceModal({
  open,
  onClose,
  onDone,
  folios,
}: {
  open: boolean;
  onClose: () => void;
  onDone?: () => void;
  folios: FolioRow[];
}) {
  const t = useTranslations('folio');
  const tc = useTranslations('common');
  const [busyId, setBusyId] = useState<string | null>(null);
  const candidates = folios.filter((f) => f.charges.length > 0);

  async function issue(folioId: string) {
    setBusyId(folioId);
    try {
      const res = await fetch(`/api/folios/${folioId}/issue-invoice`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('error'));
        return;
      }
      const number = (data.data ?? data).invoiceNumber as string | undefined;
      showSuccess(t('invoiceIssued', { number: number ?? '' }));
      onDone?.();
      onClose();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <EraModal open={open} title={t('invoiceTitle')} onClose={onClose}>
      {candidates.length === 0 ? (
        <p className="m-0 text-[13px] text-[#7F8C8D]">{t('invoiceEmpty')}</p>
      ) : (
        <ul className="m-0 space-y-2 p-0">
          {candidates.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-3 text-[13px]">
              <span>
                {f.type} — {accountBalance(f).toFixed(2)} AZN
              </span>
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                disabled={busyId != null}
                onClick={() => void issue(f.id)}
              >
                {t('issueInvoice')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </EraModal>
  );
}
