'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  CatalogField,
  EraListFilterBar,
  Field,
  ModalFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';

type ViewMode = 'catalog' | 'postings';

export default function MinibarPage() {
  const t = useTranslations('minibarControl');
  const th = useTranslations('housekeeping');
  const tc = useTranslations('common');
  const [items, setItems] = useState<Array<{ id: string; code: string; name: string; price: number }>>([]);
  const [rooms, setRooms] = useState<Array<{ id: string; roomNumber: string; floor?: number }>>([]);
  const [floor, setFloor] = useState('');
  const [view, setView] = useState<ViewMode>('catalog');
  const [postings, setPostings] = useState<
    Array<{ id: string; qty: number; item?: { name: string }; room?: { roomNumber: string } }>
  >([]);
  const [roomId, setRoomId] = useState('');
  const [itemId, setItemId] = useState('');
  const [qty, setQty] = useState('1');
  const [productOpen, setProductOpen] = useState(false);
  const [postOpen, setPostOpen] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [price, setPrice] = useState('5');
  const [financeSku, setFinanceSku] = useState('');
  const [financeSkuOptions, setFinanceSkuOptions] = useState<Array<{ value: string; label: string }>>([]);
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

  useEffect(() => {
    if (!productOpen) return;
    let cancelled = false;
    void (async () => {
      const res = await fetch('/api/housekeeping/finance-products?limit=50');
      if (!res.ok || cancelled) return;
      const parsed = await res.json().catch(() => null);
      const payload = (parsed?.data ?? parsed) as {
        items?: Array<{ value: string; label: string }>;
      } | null;
      if (!cancelled) setFinanceSkuOptions(payload?.items ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [productOpen]);

  function openProductModal() {
    setCode('');
    setName('');
    setPrice('5');
    setFinanceSku('');
    setProductOpen(true);
  }

  function openPostModal() {
    setRoomId('');
    setItemId('');
    setQty('1');
    setPostOpen(true);
  }

  async function submitProduct() {
    if (!code.trim() || !name.trim()) {
      showApiError({ error: tc('required') });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/housekeeping/minibar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          name,
          price: Number(price),
          financeSku: financeSku.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showApiError(data, tc('failed'));
        return;
      }
      showSuccess(tc('saved'));
      setProductOpen(false);
      await load();
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('failed') });
    } finally {
      setBusy(false);
    }
  }

  async function submitPost() {
    if (!roomId || !itemId) {
      showApiError({ error: tc('required') });
      return;
    }
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
      setPostOpen(false);
      setView('postings');
      await load();
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
  const catalogEmpty = items.length === 0;
  const filteredPostings = useMemo(() => {
    if (!floor) return postings;
    const roomNums = new Set(visibleRooms.map((r) => r.roomNumber));
    return postings.filter((p) => (p.room?.roomNumber ? roomNums.has(p.room.roomNumber) : true));
  }, [postings, floor, visibleRooms]);

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('hint')}
        actions={
          <div className="flex flex-wrap gap-2">
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={openProductModal}>
              {tc('add')}
            </button>
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              disabled={catalogEmpty}
              onClick={openPostModal}
            >
              {t('post')}
            </button>
          </div>
        }
      />
      <EraListFilterBar
        resetLabel={tc('filterReset')}
        onReset={() => {
          setFloor('');
          setView('catalog');
        }}
      >
        <CatalogField
          kind="CLOSED_SMALL"
          label={t('viewMode')}
          value={view}
          onChange={(v) => setView(String(v) === 'postings' ? 'postings' : 'catalog')}
          options={[
            { value: 'catalog', label: t('catalog') },
            { value: 'postings', label: t('recent') },
          ]}
        />
        <CatalogField
          kind="CLOSED_SMALL"
          label={t('floorFilter')}
          value={floor}
          onChange={(v) => setFloor(String(v))}
          options={[
            { value: '', label: t('floorAll') },
            ...floors.map((f) => ({ value: String(f), label: String(f) })),
          ]}
        />
      </EraListFilterBar>
      <div className="overflow-x-auto rounded border border-[#D5DADF] bg-white">
        {view === 'catalog' ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-[12px] text-[#7F8C8D]">
                <th className="px-3 py-2">{tc('code')}</th>
                <th className="px-3 py-2">{tc('name')}</th>
                <th className="px-3 py-2">{tc('amount')}</th>
              </tr>
            </thead>
            <tbody>
              {catalogEmpty ? (
                <tr>
                  <td className="px-3 py-3 text-[#7F8C8D]" colSpan={3}>
                    {t('emptyCatalog')}
                  </td>
                </tr>
              ) : (
                items.map((i) => (
                  <tr key={i.id} className="border-b border-[#ECF0F1]">
                    <td className="px-3 py-2 font-medium">{i.code}</td>
                    <td className="px-3 py-2">{i.name}</td>
                    <td className="px-3 py-2">{Number(i.price).toFixed(2)} AZN</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-[12px] text-[#7F8C8D]">
                <th className="px-3 py-2">{th('colRoom')}</th>
                <th className="px-3 py-2">{t('item')}</th>
                <th className="px-3 py-2">{t('qty')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredPostings.length === 0 ? (
                <tr>
                  <td className="px-3 py-3 text-[#7F8C8D]" colSpan={3}>
                    {catalogEmpty ? t('postNeedsCatalog') : t('noPostings')}
                  </td>
                </tr>
              ) : (
                filteredPostings.map((p) => (
                  <tr key={p.id} className="border-b border-[#ECF0F1]">
                    <td className="px-3 py-2">{p.room?.roomNumber ?? '—'}</td>
                    <td className="px-3 py-2">{p.item?.name ?? '—'}</td>
                    <td className="px-3 py-2">×{p.qty}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
      <ModalShell
        open={productOpen}
        title={t('title')}
        onClose={() => !busy && setProductOpen(false)}
        closeLabel={tc('close')}
        footer={
          <ModalFooter
            onCancel={() => !busy && setProductOpen(false)}
            onSubmit={() => void submitProduct()}
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
          <CatalogField
            kind="SEARCHABLE"
            label={t('financeSku')}
            value={financeSku}
            serverSearch
            onQueryChange={(q) => {
              void fetch(`/api/housekeeping/finance-products?limit=50&q=${encodeURIComponent(q)}`)
                .then((r) => (r.ok ? r.json() : null))
                .then((parsed) => {
                  const payload = (parsed?.data ?? parsed) as {
                    items?: Array<{ value: string; label: string }>;
                  } | null;
                  setFinanceSkuOptions(payload?.items ?? []);
                })
                .catch(() => setFinanceSkuOptions([]));
            }}
            options={
              financeSku && !financeSkuOptions.some((option) => option.value === financeSku)
                ? [{ value: financeSku, label: financeSku }, ...financeSkuOptions]
                : financeSkuOptions
            }
            onChange={(next) => setFinanceSku(Array.isArray(next) ? next[0] ?? '' : next)}
          />
        </div>
      </ModalShell>
      <ModalShell
        open={postOpen}
        title={t('postTitle')}
        onClose={() => !busy && setPostOpen(false)}
        closeLabel={tc('close')}
        footer={
          <ModalFooter
            onCancel={() => !busy && setPostOpen(false)}
            onSubmit={() => void submitPost()}
            busy={busy}
            cancelLabel={tc('cancel')}
            submitLabel={t('post')}
            submitDisabled={catalogEmpty || !roomId || !itemId}
          />
        }
      >
        <div className="space-y-3">
          {catalogEmpty ? <p className="text-sm text-[#7F8C8D]">{t('postNeedsCatalog')}</p> : null}
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
            options={items.map((i) => ({ value: i.id, label: `${i.code} · ${i.name} · ${Number(i.price).toFixed(2)} AZN` }))}
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
        </div>
      </ModalShell>
    </>
  );
}
