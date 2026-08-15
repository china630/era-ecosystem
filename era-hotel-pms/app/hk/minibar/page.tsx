'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Field,
  ModalFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';

export default function MinibarPage() {
  const t = useTranslations('minibarControl');
  const tc = useTranslations('common');
  const [items, setItems] = useState<Array<{ id: string; code: string; name: string; price: number }>>([]);
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [price, setPrice] = useState('5');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/housekeeping/minibar');
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('loadError'));
        return;
      }
      setItems(data.items ?? []);
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
    }
  }, [tc]);

  useEffect(() => {
    void load();
  }, [load]);

  function openModal() {
    setCode('');
    setName('');
    setPrice('5');
    setOpen(true);
  }

  async function submit() {
    if (!code.trim() || !name.trim()) {
      showApiError({ error: tc('required') });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/housekeeping/minibar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, name, price: Number(price) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showApiError(data, tc('failed'));
        return;
      }
      showSuccess(tc('saved'));
      setOpen(false);
      await load();
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('failed') });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title={t('title')}
        actions={
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={openModal}>
            {tc('add')}
          </button>
        }
      />
      <ul className="space-y-2 text-[13px]">
        {items.map((i) => (
          <li key={i.id} className="rounded border px-3 py-2">
            {i.code} — {i.name} · {i.price} AZN
          </li>
        ))}
      </ul>
      <ModalShell
        open={open}
        title={t('title')}
        onClose={() => !busy && setOpen(false)}
        closeLabel={tc('close')}
        footer={
          <ModalFooter
            onCancel={() => !busy && setOpen(false)}
            onSubmit={() => void submit()}
            busy={busy}
            cancelLabel={tc('cancel')}
            submitLabel={tc('save')}
          />
        }
      >
        <div className="space-y-3">
          <Field label={tc('code')} preset="code" value={code} onChange={(e) => setCode(e.target.value)} required />
          <Field label={tc('name')} preset="longText" value={name} onChange={(e) => setName(e.target.value)} required />
          <Field
            label={tc('amount')}
            preset="amount"
            type="number"
            min={0}
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
          />
        </div>
      </ModalShell>
    </>
  );
}
