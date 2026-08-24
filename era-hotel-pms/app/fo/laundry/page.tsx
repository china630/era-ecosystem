'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { PageHeader, PRIMARY_BUTTON_CLASS, showApiError, showSuccess } from '@era/satellite-kit/ui';

type Ticket = {
  id: string;
  status: string;
  guestName: string;
  dueAt: string | null;
  folioChargeId: string | null;
};

export default function FoLaundryPage() {
  const t = useTranslations('housekeeping');
  const tc = useTranslations('common');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [scanByTicket, setScanByTicket] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await fetch('/api/housekeeping/laundry');
    const json = await res.json();
    if (!res.ok) {
      showApiError(json, tc('loadError'));
      return;
    }
    setTickets(json.tickets ?? []);
  }, [tc]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <PageHeader title={t('foLaundryTitle')} />
      <p className="mb-4 max-w-xl text-sm text-[#7F8C8D]">{t('foLaundryHint')}</p>
      <ul className="text-sm">
        {tickets.map((tk) => (
          <li key={tk.id} className="mb-3 flex flex-wrap items-center gap-2">
            <span>
              {tk.guestName} · {tk.status}
              {tk.dueAt ? ` · ${tk.dueAt.slice(0, 16)}` : ''}
              {tk.folioChargeId ? ` · folio ${tk.folioChargeId.slice(0, 8)}` : ''}
            </span>
            {tk.status === 'IN_PLANT' ? (
              <>
                <input
                  type="file"
                  className="text-xs"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () =>
                      setScanByTicket((m) => ({ ...m, [tk.id]: String(reader.result ?? file.name) }));
                    reader.readAsDataURL(file);
                  }}
                />
                <button
                  type="button"
                  className={PRIMARY_BUTTON_CLASS}
                  onClick={async () => {
                    const key = scanByTicket[tk.id];
                    if (!key) {
                      showApiError({ error: t('returnScanRequired') }, tc('failed'));
                      return;
                    }
                    const res = await fetch('/api/housekeeping/laundry', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        deliverTicketId: tk.id,
                        returnScanKey: key,
                        actorRole: 'FO',
                      }),
                    });
                    if (!res.ok) showApiError(await res.json(), tc('failed'));
                    else {
                      showSuccess(tc('saved'));
                      await load();
                    }
                  }}
                >
                  {t('deliverLaundry')}
                </button>
              </>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  );
}
