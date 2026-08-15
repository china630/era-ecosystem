'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import {
  CARD_CONTAINER_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  EraListFilterBar,
  useDebouncedValue,
  Field,
  FieldSelect,
  FORM_STACK_CLASS,
  MODAL_CHECKBOX_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';
import { EraModal, EraModalFooter } from '@/components/EraModal';
import FinanceBoundaryBanner from '@/components/FinanceBoundaryBanner';
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
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<ProductRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const debouncedQ = useDebouncedValue(q, 300);
  const [typeFilter, setTypeFilter] = useState('');
  const [retireFilter, setRetireFilter] = useState<RetireFilter>('ALL');

  async function load() {
    try {
      const [pRes, wRes] = await Promise.all([
        fetch('/api/stock/products'),
        fetch('/api/stock/warehouses'),
      ]);
      const [p, w] = await Promise.all([pRes.json(), wRes.json()]);
      if (!pRes.ok) {
        showApiError(p, tc('loadError'));
        return;
      }
      setProducts(p);
      setWarehouses(w);
      if (p[0]) setProductId(p[0].id);
      if (w[0]) setWarehouseId(w[0].id);
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
    }
  }

  useEffect(() => {
    if (can(PERMISSIONS.MASTER_DATA_MANAGE)) void load();
  }, [can]);

  const filteredProducts = useMemo(
    () =>
      products.filter(
        (p) =>
          matchesCodeNameQuery(p, debouncedQ) &&
          matchesProductType(p, typeFilter) &&
          matchesRetireFilter(p, retireFilter),
      ),
    [products, debouncedQ, typeFilter, retireFilter],
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
    try {
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
      if (!res.ok) {
        showApiError(data, tc('error'));
        return;
      }
      showSuccess(t('movementPosted'));
      setReceiptModalOpen(false);
    } catch (err) {
      setBusy(false);
      showApiError({ error: err instanceof Error ? err.message : tc('error') });
    }
  }

  if (!can(PERMISSIONS.MASTER_DATA_MANAGE)) {
    return <p className="text-[13px] text-[#7F8C8D]">{tc('noPermission')}</p>;
  }

  return (
    <>
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

      <EraListFilterBar
        resetLabel={tc('filterReset')}
        onReset={() => {
          setQ('');
          setTypeFilter('');
          setRetireFilter('ALL');
        }}
      >
        <Field
          label={tc('search')}
          preset="longText"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('filterPlaceholder')}
        />
        <FieldSelect
          label={t('productType')}
          preset="select"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="">{t('allProductTypes')}</option>
          <option value="STOCK">STOCK</option>
          <option value="SELLABLE">SELLABLE</option>
        </FieldSelect>
        <FieldSelect
          label={t('active')}
          preset="select"
          value={retireFilter}
          onChange={(e) => setRetireFilter(e.target.value as RetireFilter)}
        >
          <option value="ALL">{t('allRetireStatuses')}</option>
          <option value="ACTIVE">{t('activeOnly')}</option>
          <option value="INACTIVE">{t('inactiveOnly')}</option>
        </FieldSelect>
      </EraListFilterBar>

      <section className={`${CARD_CONTAINER_CLASS} p-4`}>
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
      </section>

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
            try {
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
                showSuccess(wasEdit ? t('productUpdated') : t('productCreated'));
                await load();
              } else {
                showApiError(data, tc('error'));
              }
            } catch (err) {
              setBusy(false);
              showApiError({ error: err instanceof Error ? err.message : tc('error') });
            }
          }}
        >
          <Field
            label={tc('code')}
            preset="code"
            id="pd-code"
            name="code"
            defaultValue={editProduct?.code ?? ''}
            readOnly={!!editProduct}
            required={!editProduct}
          />
          <Field
            label={tc('name')}
            preset="shortText"
            id="pd-name"
            name="name"
            defaultValue={editProduct?.name ?? ''}
            required
          />
          <FieldSelect
            label={t('productType')}
            preset="select"
            id="pd-type"
            name="productType"
            defaultValue={editProduct?.productType ?? 'STOCK'}
          >
            <option value="STOCK">STOCK</option>
            <option value="SELLABLE">SELLABLE</option>
          </FieldSelect>
          <Field
            label={t('unit')}
            preset="code"
            id="pd-unit"
            name="unit"
            defaultValue={editProduct?.unit ?? 'pcs'}
          />
          <Field
            label={t('price')}
            preset="amount"
            id="pd-price"
            name="price"
            type="number"
            step="0.01"
            defaultValue={editProduct?.price ?? ''}
          />
          <Field
            label={t('vatRate')}
            preset="amount"
            id="pd-vat"
            name="vatRate"
            type="number"
            step="0.01"
            placeholder="18"
            defaultValue={editProduct?.vatRate ?? ''}
          />
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
          <FieldSelect
            label={tc('name')}
            preset="selectWide"
            id="stock-product"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
          >
            {activeProducts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code}
              </option>
            ))}
          </FieldSelect>
          <FieldSelect
            label={tc('code')}
            preset="select"
            id="stock-warehouse"
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
          >
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code}
              </option>
            ))}
          </FieldSelect>
          <Field
            label={tc('amount')}
            preset="count"
            id="stock-qty"
            type="number"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
        </form>
      </EraModal>
    </>
  );
}
