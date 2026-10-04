'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  CatalogField,
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
  const th = useTranslations('housekeeping');
  const tc = useTranslations('common');
  const [items, setItems] = useState<Array<{ id: string; code: string; name: string; price: number }>>([]);
  const [rooms, setRooms] = useState<Array<{ id: string; roomNumber: string; floor?: number }>>([]);
  const [floor, setFloor] = useState('');
  const [postings, setPostings] = useState<
    Array<{ id: string; qty: number; item?: { name: string }; room?: { roomNumber: string } }>
  >([]);
  const [roomId, setRoomId] = useState('');
  const [itemId, setItemId] = useState('');
  const [qty, setQty] = useState('1');
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
      setRooms(data.rooms ?? []);
      setPostings(data.postings ?? []);
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

  const floors = useMemo(() => {
    const set = new Set<number>();
    for (const room of rooms) {
      if (typeof room.floor === 'number') set.add(room.floor);
    }
    return [...set].sort((a, b) => a - b);
  }, [rooms]);
  const visibleRooms = floor ? rooms.filter((r) => String(r.floor) === floor) : rooms;

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('hint')}
        actions={
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={openModal}>
            {tc('add')}
          </button>
        }
      />
      <h2 className="mb-2 text-sm font-semibold text-[#34495E]">{t('catalog')}</h2>
      {items.length === 0 ? <p className="mb-4 text-[13px] text-[#7F8C8D]">{t('emptyCatalog')}</p> : null}
      <ul className="mb-6 space-y-2 text-[13px]">
        {items.map((i) => (
          <li key={i.id} className="rounded border border-[#D5DADF] bg-white px-3 py-2">
            {i.code} — {i.name} · {i.price} AZN
          </li>
        ))}
      </ul>
      <section className="mb-6 max-w-lg space-y-2">
        <h2 className="text-sm font-semibold text-[#34495E]">{t('postTitle')}</h2>
        <CatalogField
          kind="CLOSED_SMALL"
          label={t('floorFilter')}
          value={floor}
          onChange={(v) => {
            setFloor(String(v));
            setRoomId('');
          }}
          options={[
            { value: '', label: t('floorAll') },
            ...floors.map((f) => ({ value: String(f), label: String(f) })),
          ]}
        />
        <CatalogField
          kind="ENTITY_REF"
          label={th('roomSelect')}
          value={roomId}
          onChange={(v) => setRoomId(String(v))}
          options={visibleRooms.map((r) => ({ value: r.id, label: r.roomNumber }))}
        />
        <CatalogField
          kind="ENTITY_REF"
          label={t('item')}
          value={itemId}
          onChange={(v) => setItemId(String(v))}
          options={items.map((i) => ({ value: i.id, label: `${i.code} · ${i.name} · ${i.price} AZN` }))}
        />
        <div className="flex items-center gap-2 text-sm">
          <span className="text-[#7F8C8D]">{t('qty')}</span>
          <button type="button" className="h-6 w-6 rounded border border-[#D5DADF]" onClick={() => setQty(String(Math.max(1, Number(qty) - 1)))}>
            −
          </button>
          <span className="w-6 text-center">{qty}</span>
          <button type="button" className="h-6 w-6 rounded border border-[#D5DADF]" onClick={() => setQty(String(Number(qty) + 1))}>
            +
          </button>
        </div>
        <button
          type="button"
          className={PRIMARY_BUTTON_CLASS}
          disabled={busy || !roomId || !itemId}
          onClick={() => {
            void (async () => {
              setBusy(true);
              try {
                const res = await fetch('/api/housekeeping/minibar', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ roomId, itemId, qty: Number(qty) }),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                  showApiError(data, tc('failed'));
                  return;
                }
                showSuccess(tc('saved'));
                await load();
              } finally {
                setBusy(false);
              }
            })();
          }}
        >
          {t('post')}
        </button>
      </section>
      <h2 className="mb-2 text-sm font-semibold text-[#34495E]">{t('recent')}</h2>
      {postings.length === 0 ? <p className="text-[13px] text-[#7F8C8D]">{t('noPostings')}</p> : null}
      <ul className="space-y-1 text-[13px]">
        {postings.map((p) => (
          <li key={p.id}>
            {p.room?.roomNumber ?? '—'} · {p.item?.name ?? '—'} · ×{p.qty}
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
