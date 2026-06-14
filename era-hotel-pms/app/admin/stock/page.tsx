'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  FORM_FIELD_GROUP_CLASS,
  FORM_STACK_CLASS,
  MODAL_CHECKBOX_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
} from '@era/satellite-kit/ui';
import { PageHeader } from '@era/satellite-kit/ui';
import { EraModal, EraModalFooter } from '@/components/EraModal';
import AppShell, { PageSection, StatusMessage } from '@/components/layout/AppShell';
import FinanceBoundaryBanner from '@/components/FinanceBoundaryBanner';
import { ListFilterInput } from '@/components/master-data/ListFilterInput';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { matchesCodeNameQuery, matchesProductType } from '@/lib/list-filter';
import { matchesRetireFilter, type RetireFilter } from '@/lib/master-data/retire-policy';

type ProductRow = {
  id: string;
  code: string;
  name: string;
  productType: string;
  unit: string;
  price?: string | null;
  vatRate?: string | null;
  active?: boolean;
};

export default function StockAdminPage() {
  const { can } = useAuth();
  const t = useTranslations('stock');
  const tc = useTranslations('common');
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [warehouses, setWarehouses] = useState<{ id: string; code: string }[]>([]);
  const [productId, setProductId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [qty, setQty] = useState('10');
  const [msg, setMsg] = useState<string | null>(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<ProductRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [retireFilter, setRetireFilter] = useState<RetireFilter>('ALL');

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

  const filteredProducts = useMemo(
    () =>
      products.filter(
        (p) =>
          matchesCodeNameQuery(p, search) &&
          matchesProductType(p, typeFilter) &&
          matchesRetireFilter(p, retireFilter),
      ),
    [products, search, typeFilter, retireFilter],
  );

  const activeProducts = useMemo(
    () => products.filter((p) => p.active !== false),
    [products],
  );

  const receiptFormId = 'stock-receipt-form';
  const productFormId = 'stock-product-form';

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
    if (res.ok) setReceiptModalOpen(false);
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
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              onClick={() => {
                setEditProduct(null);
                setProductModalOpen(true);
              }}
            >
              <Plus className="h-4 w-4" aria-hidden />
              {tc('add')}
            </button>
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setReceiptModalOpen(true)}>
              {t('receipt')}
            </button>
          </div>
        }
      />
      <FinanceBoundaryBanner target="inventory" labelKey="openInventoryInFinance" />
      <StatusMessage>{msg}</StatusMessage>
      <PageSection>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <ListFilterInput value={search} onChange={setSearch} placeholder={t('filterPlaceholder')} />
          <select
            className={`${MODAL_INPUT_CLASS} max-w-[160px] text-[13px]`}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">{t('allProductTypes')}</option>
            <option value="STOCK">STOCK</option>
            <option value="SELLABLE">SELLABLE</option>
          </select>
          <select
            className={`${MODAL_INPUT_CLASS} max-w-[140px] text-[13px]`}
            value={retireFilter}
            onChange={(e) => setRetireFilter(e.target.value as RetireFilter)}
          >
            <option value="ALL">{t('allRetireStatuses')}</option>
            <option value="ACTIVE">{t('activeOnly')}</option>
            <option value="INACTIVE">{t('inactiveOnly')}</option>
          </select>
        </div>
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('code')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('name')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('productType')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('unit')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('price')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('active')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((p) => (
                <tr key={p.id} className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS}>{p.code}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{p.name}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{p.productType}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{p.unit}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{p.price ? `${p.price} AZN` : '—'}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{p.active === false ? t('retired') : t('activeLabel')}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    <button
                      type="button"
                      className="text-[#2980B9] hover:underline"
                      onClick={() => {
                        setEditProduct(p);
                        setProductModalOpen(true);
                      }}
                    >
                      {tc('edit')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PageSection>

      <EraModal
        open={productModalOpen}
        title={editProduct ? t('editProduct') : t('addProduct')}
        onClose={() => setProductModalOpen(false)}
        footer={
          <EraModalFooter
            formId={productFormId}
            onCancel={() => setProductModalOpen(false)}
            busy={busy}
            submitLabel={editProduct ? tc('save') : tc('add')}
          />
        }
      >
        <form
          key={editProduct?.id ?? 'new-pd'}
          id={productFormId}
          className={FORM_STACK_CLASS}
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const fd = new FormData(e.currentTarget);
            const body = editProduct
              ? {
                  name: fd.get('name'),
                  productType: fd.get('productType'),
                  unit: (fd.get('unit') as string) || 'pcs',
                  price: fd.get('price') ? Number(fd.get('price')) : null,
                  currency: (fd.get('currency') as string) || 'AZN',
                  vatRate: fd.get('vatRate') ? Number(fd.get('vatRate')) : null,
                  active: fd.get('active') === 'on',
                }
              : {
                  code: fd.get('code'),
                  name: fd.get('name'),
                  productType: fd.get('productType'),
                  unit: (fd.get('unit') as string) || 'pcs',
                  price: fd.get('price') ? Number(fd.get('price')) : undefined,
                  currency: (fd.get('currency') as string) || 'AZN',
                  vatRate: fd.get('vatRate') ? Number(fd.get('vatRate')) : undefined,
                };
            const res = await fetch(
              editProduct ? `/api/stock/products/${editProduct.id}` : '/api/stock/products',
              {
                method: editProduct ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
              },
            );
            const data = await res.json();
            setBusy(false);
            if (res.ok) {
              setProductModalOpen(false);
              const wasEdit = !!editProduct;
              setEditProduct(null);
              setMsg(wasEdit ? t('productUpdated') : t('productCreated'));
              await load();
            } else {
              setMsg(data.error ?? tc('error'));
            }
          }}
        >
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="pd-code">{tc('code')}</label>
            <input
              id="pd-code"
              name="code"
              className={MODAL_INPUT_CLASS}
              defaultValue={editProduct?.code ?? ''}
              readOnly={!!editProduct}
              required={!editProduct}
            />
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="pd-name">{tc('name')}</label>
            <input id="pd-name" name="name" className={MODAL_INPUT_CLASS} defaultValue={editProduct?.name ?? ''} required />
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="pd-type">{t('productType')}</label>
            <select
              id="pd-type"
              name="productType"
              className={MODAL_INPUT_CLASS}
              defaultValue={editProduct?.productType ?? 'STOCK'}
            >
              <option value="STOCK">STOCK</option>
              <option value="SELLABLE">SELLABLE</option>
            </select>
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="pd-unit">{t('unit')}</label>
            <input id="pd-unit" name="unit" className={MODAL_INPUT_CLASS} defaultValue={editProduct?.unit ?? 'pcs'} />
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="pd-price">{t('price')}</label>
            <input
              id="pd-price"
              name="price"
              type="number"
              step="0.01"
              className={MODAL_INPUT_CLASS}
              defaultValue={editProduct?.price ?? ''}
            />
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="pd-vat">{t('vatRate')}</label>
            <input
              id="pd-vat"
              name="vatRate"
              type="number"
              step="0.01"
              className={MODAL_INPUT_CLASS}
              placeholder="18"
              defaultValue={editProduct?.vatRate ?? ''}
            />
          </div>
          {editProduct && (
            <label className="flex items-center gap-2 text-[13px] text-[#34495E]">
              <input
                name="active"
                type="checkbox"
                className={MODAL_CHECKBOX_CLASS}
                defaultChecked={editProduct.active !== false}
              />
              {t('active')}
            </label>
          )}
          <input type="hidden" name="currency" value="AZN" />
        </form>
      </EraModal>

      <EraModal
        open={receiptModalOpen}
        title={t('receipt')}
        onClose={() => setReceiptModalOpen(false)}
        footer={
          <EraModalFooter formId={receiptFormId} onCancel={() => setReceiptModalOpen(false)} busy={busy} submitLabel={t('receipt')} />
        }
      >
        <form id={receiptFormId} onSubmit={receipt} className={FORM_STACK_CLASS}>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="stock-product">{tc('name')}</label>
            <select
              id="stock-product"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className={MODAL_INPUT_CLASS}
            >
              {activeProducts.map((p) => (
                <option key={p.id} value={p.id}>{p.code}</option>
              ))}
            </select>
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="stock-warehouse">{tc('code')}</label>
            <select
              id="stock-warehouse"
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className={MODAL_INPUT_CLASS}
            >
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.code}</option>
              ))}
            </select>
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="stock-qty">{tc('amount')}</label>
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
