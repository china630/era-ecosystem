'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { PageHeader, PRIMARY_BUTTON_CLASS } from '@era/satellite-kit/ui';
import AppShell, { StatusMessage } from '@/components/layout/AppShell';

export default function MinibarPage() {
  const t = useTranslations('minibarControl');
  const [items, setItems] = useState<Array<{ id: string; code: string; name: string; price: number }>>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/housekeeping/minibar');
    const data = await res.json();
    if (res.ok) setItems(data.items ?? []);
    else setMsg(data.error);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function addItem() {
    const code = window.prompt('Item code');
    const name = window.prompt('Name');
    const price = Number(window.prompt('Price', '5'));
    if (!code || !name) return;
    await fetch('/api/housekeeping/minibar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, name, price }),
    });
    await load();
  }

  return (
    <AppShell>
      <PageHeader title={t('title')} actions={<button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void addItem()}>+</button>} />
      <StatusMessage>{msg}</StatusMessage>
      <ul className="space-y-2 text-[13px]">
        {items.map((i) => (
          <li key={i.id} className="rounded border px-3 py-2">
            {i.code} — {i.name} · {i.price} AZN
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
