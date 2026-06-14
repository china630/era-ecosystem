'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@era/satellite-kit/ui';
import { PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from '@era/satellite-kit/ui';
import AppShell, { PageSection } from '@/components/layout/AppShell';

type Product = { id: string; code: string; name: string; price: number; category: string };
type Order = { id: string; status: string; product: { name: string }; guest: { fullName: string } };

export default function ConciergePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  const load = useCallback(async () => {
    const [p, o] = await Promise.all([
      fetch('/api/concierge').then((r) => r.json()),
      fetch('/api/concierge?view=orders').then((r) => r.json()),
    ]);
    setProducts(p);
    setOrders(o);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function complete(orderId: string) {
    await fetch('/api/concierge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'complete', orderId }),
    });
    await load();
  }

  return (
    <AppShell maxWidthClass="max-w-4xl">
      <PageHeader title="Concierge & excursions" />
      <PageSection className="mb-4">
        <h2 className="mb-2 font-semibold text-[#34495E]">Catalog</h2>
        <ul className="space-y-2 text-[13px]">
          {products.map((p) => (
            <li key={p.id} className="rounded border border-[#ECEFF1] p-2">
              {p.code} — {p.name} ({Number(p.price).toFixed(2)} AZN) · {p.category}
            </li>
          ))}
        </ul>
      </PageSection>
      <PageSection>
        <h2 className="mb-2 font-semibold text-[#34495E]">Orders</h2>
        <ul className="space-y-2 text-[13px]">
          {orders.map((o) => (
            <li key={o.id} className="flex items-center justify-between rounded border border-[#ECEFF1] p-2">
              <span>{o.guest.fullName} — {o.product.name} ({o.status})</span>
              {o.status !== 'COMPLETED' && (
                <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void complete(o.id)}>
                  Complete + charge
                </button>
              )}
            </li>
          ))}
        </ul>
      </PageSection>
    </AppShell>
  );
}
