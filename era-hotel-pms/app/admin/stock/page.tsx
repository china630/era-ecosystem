'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import {
  FORM_FIELD_GROUP_CLASS,
  FORM_STACK_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
} from '@era/satellite-kit/ui';
import { PageHeader } from '@era/satellite-kit/ui';
import { EraModal, EraModalFooter } from '@/components/EraModal';
import AppShell, { PageSection, StatusMessage } from '@/components/layout/AppShell';
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
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);

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

  const formId = 'stock-receipt-form';

  async function receipt(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
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
    setBusy(false);
    setMsg(res.ok ? t('movementPosted') : data.error);
    if (res.ok) setModalOpen(false);
  }

  if (!can(PERMISSIONS.MASTER_DATA_MANAGE)) {
    return (
      <AppShell maxWidthClass="max-w-3xl">
        <p className="text-[13px] text-[#7F8C8D]">{tc('noPermission')}</p>
      </AppShell>
    );
  }

  return (
    <AppShell maxWidthClass="max-w-3xl">
      <PageHeader
        title={t('title')}
        actions={
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            {t('receipt')}
          </button>
        }
      />
      <StatusMessage>{msg}</StatusMessage>
      <PageSection>
        <ul className="space-y-1 text-[13px] text-[#7F8C8D]">
          {products.map((p) => (
            <li key={p.id}>
              {p.code} — {p.name}
            </li>
          ))}
        </ul>
      </PageSection>

      <EraModal
        open={modalOpen}
        title={t('receipt')}
        onClose={() => setModalOpen(false)}
        footer={
          <EraModalFooter formId={formId} onCancel={() => setModalOpen(false)} busy={busy} submitLabel={t('receipt')} />
        }
      >
        <form id={formId} onSubmit={receipt} className={FORM_STACK_CLASS}>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="stock-product">
              {tc('name')}
            </label>
            <select
              id="stock-product"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className={MODAL_INPUT_CLASS}
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code}
                </option>
              ))}
            </select>
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="stock-warehouse">
              {tc('code')}
            </label>
            <select
              id="stock-warehouse"
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className={MODAL_INPUT_CLASS}
            >
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code}
                </option>
              ))}
            </select>
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="stock-qty">
              {tc('amount')}
            </label>
            <input
              id="stock-qty"
              type="number"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className={MODAL_INPUT_CLASS}
            />
          </div>
        </form>
      </EraModal>
    </AppShell>
  );
}
