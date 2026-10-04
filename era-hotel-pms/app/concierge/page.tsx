'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import {
  CARD_CONTAINER_CLASS,
  CatalogField,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  Field,
  FieldRow,
  FORM_STACK_CLASS,
  PRIMARY_BUTTON_CLASS,
  PageHeader,
  SECONDARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';
import { EraModal, EraModalFooter } from '@/components/EraModal';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { useHotelLookupOptions, withOrphanOption } from '@/lib/hotel-lookups';

type Product = {
  id: string;
  code: string;
  name: string;
  price: number | string;
  category: string;
  supplierName?: string | null;
};
type Order = {
  id: string;
  status: 'REQUESTED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
  product: { name: string };
  guest: { fullName: string };
};

const productFormId = 'concierge-product-form';
const LOOKUP_KINDS = ['CONCIERGE_CATEGORY'] as const;

export default function ConciergePage() {
  const t = useTranslations('concierge');
  const tc = useTranslations('common');
  const { can } = useAuth();
  const canWrite = can(PERMISSIONS.RESERVATIONS_WRITE);
  const { byKind } = useHotelLookupOptions([...LOOKUP_KINDS]);
  const categoryOptions = useMemo(() => byKind.CONCIERGE_CATEGORY ?? [], [byKind]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [category, setCategory] = useState('');

  const load = useCallback(async () => {
    const [p, o] = await Promise.all([
      fetch('/api/concierge').then((r) => r.json()),
      fetch('/api/concierge?view=orders').then((r) => r.json()),
    ]);
    setProducts(Array.isArray(p) ? p : []);
    setOrders(Array.isArray(o) ? o : []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const categoryLabel = useCallback(
    (code: string) => categoryOptions.find((o) => o.value === code)?.label ?? code,
    [categoryOptions],
  );

  async function complete(orderId: string) {
    const res = await fetch('/api/concierge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'complete', orderId }),
    });
    const data = await res.json();
    if (!res.ok) {
      showApiError(data, tc('error'));
      return;
    }
    showSuccess(t('orderCompleted'));
    await load();
  }

  async function createProduct(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!category) {
      showApiError({ error: t('categoryRequired') });
      return;
    }
    const fd = new FormData(e.currentTarget);
    const commissionRaw = String(fd.get('commissionPct') ?? '').trim();
    setBusy(true);
    const res = await fetch('/api/concierge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'createProduct',
        code: String(fd.get('code') ?? ''),
        name: String(fd.get('name') ?? ''),
        category,
        price: Number(fd.get('price') ?? 0),
        supplierName: String(fd.get('supplierName') ?? '') || undefined,
        commissionPct: commissionRaw ? Number(commissionRaw) : undefined,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      showApiError(data, tc('error'));
      return;
    }
    showSuccess(t('productCreated'));
    setModalOpen(false);
    await load();
  }

  return (
    <>
      <PageHeader
        title={t('title')}
        actions={
          canWrite ? (
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              onClick={() => {
                setCategory(categoryOptions[0]?.value ?? '');
                setModalOpen(true);
              }}
            >
              <Plus className="h-4 w-4" aria-hidden />
              {t('addProduct')}
            </button>
          ) : null
        }
      />
      <section className={`${CARD_CONTAINER_CLASS} mb-4 p-4`}>
        <h2 className="mb-3 text-sm font-semibold text-[#34495E]">{t('catalog')}</h2>
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('code')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('name')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('category')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('supplier')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('price')}</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS}>{p.code}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{p.name}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{categoryLabel(p.category)}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{p.supplierName ?? '—'}</td>
                  <td className={`${DATA_TABLE_TD_CLASS} text-right`}>{Number(p.price).toFixed(2)} AZN</td>
                </tr>
              ))}
              {products.length === 0 ? (
                <tr>
                  <td colSpan={5} className={`${DATA_TABLE_TD_CLASS} text-[#7F8C8D]`}>
                    {t('emptyCatalog')}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
      <section className={`${CARD_CONTAINER_CLASS} p-4`}>
        <h2 className="mb-3 text-sm font-semibold text-[#34495E]">{t('orders')}</h2>
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('guest')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('product')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('status')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS}>{o.guest.fullName}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{o.product.name}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{t(`status.${o.status}`)}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {canWrite && o.status !== 'COMPLETED' && o.status !== 'CANCELLED' ? (
                      <button
                        type="button"
                        className={SECONDARY_BUTTON_CLASS}
                        onClick={() => void complete(o.id)}
                      >
                        {t('completeAndCharge')}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={4} className={`${DATA_TABLE_TD_CLASS} text-[#7F8C8D]`}>
                    {t('emptyOrders')}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <EraModal
        open={modalOpen}
        title={t('addProduct')}
        onClose={() => setModalOpen(false)}
        footer={
          <EraModalFooter
            formId={productFormId}
            onCancel={() => setModalOpen(false)}
            busy={busy}
            submitLabel={tc('add')}
          />
        }
      >
        <form id={productFormId} onSubmit={createProduct} className={FORM_STACK_CLASS}>
          <FieldRow cols={2}>
            <Field label={tc('code')} preset="code" name="code" required defaultValue="" />
            <CatalogField
              kind="CLOSED_SMALL"
              label={t('category')}
              value={category}
              emptyLabel={null}
              options={withOrphanOption(categoryOptions, category)}
              onChange={(value) => setCategory((Array.isArray(value) ? value[0] : value) ?? '')}
            />
          </FieldRow>
          <Field label={tc('name')} preset="shortText" name="name" required defaultValue="" />
          <FieldRow cols={2}>
            <Field
              label={t('price')}
              preset="amount"
              type="number"
              name="price"
              min={0}
              step="0.01"
              required
              defaultValue=""
            />
            <Field
              label={t('commissionPct')}
              preset="amount"
              type="number"
              name="commissionPct"
              min={0}
              max={100}
              step="0.01"
              defaultValue=""
            />
          </FieldRow>
          <Field label={t('supplier')} preset="shortText" name="supplierName" defaultValue="" />
        </form>
      </EraModal>
    </>
  );
}
