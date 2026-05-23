'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import AppNav from '@/components/AppNav';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

export default function StockAdminPage() {
  const { can } = useAuth();
  const t = useTranslations('stock');
  const tc = useTranslations('common');
  const [products, setProducts] = useState<{ id: string; code: string; name: string }[]>([]);
  const [warehouses, setWarehouses] = useState<{ id: string; code: string }[]>([]);
  const [productId, setProductId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [qty, setQty] = useState('10');
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const [p, w] = await Promise.all([
      fetch('/api/stock/products').then((r) => r.json()),
      fetch('/api/stock/warehouses').then((r) => r.json()),
    ]);
    setProducts(p);
    setWarehouses(w);
    if (p[0]) setProductId(p[0].id);
    if (w[0]) setWarehouseId(w[0].id);
  }

  useEffect(() => {
    if (can(PERMISSIONS.MASTER_DATA_MANAGE)) load();
  }, [can]);

  async function receipt(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/stock/movements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId,
        warehouseId,
        type: 'RECEIPT',
        qty: parseFloat(qty),
        reference: t('manualReceipt'),
      }),
    });
    const data = await res.json();
    setMsg(res.ok ? t('movementPosted') : data.error);
  }

  if (!can(PERMISSIONS.MASTER_DATA_MANAGE)) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <AppNav />
        <p className="text-slate-400">{tc('noPermission')}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <AppNav />
      <h1 className="mb-4 text-xl font-semibold">{t('title')}</h1>
      {msg && <p className="mb-4 text-sm text-slate-300">{msg}</p>}
      <ul className="mb-4 text-xs text-slate-400">
        {products.map((p) => (
          <li key={p.id}>
            {p.code} — {p.name}
          </li>
        ))}
      </ul>
      <form onSubmit={receipt} className="flex flex-wrap gap-2 text-sm">
        <select value={productId} onChange={(e) => setProductId(e.target.value)} className="rounded border border-slate-600 bg-slate-800 px-2 py-1">
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code}
            </option>
          ))}
        </select>
        <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className="rounded border border-slate-600 bg-slate-800 px-2 py-1">
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.code}
            </option>
          ))}
        </select>
        <input type="number" value={qty} onChange={(e) => setQty(e.target.value)} className="w-20 rounded border border-slate-600 bg-slate-800 px-2 py-1" />
        <button type="submit" className="rounded bg-sky-700 px-3 py-1">
          {t('receipt')}
        </button>
      </form>
    </div>
  );
}
