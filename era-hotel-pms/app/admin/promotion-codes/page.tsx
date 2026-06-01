'use client';

import { useTranslations } from 'next-intl';
import { SimpleCrudPage } from '@/components/wave-b/SimpleCrudPage';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

export default function PromotionCodesPage() {
  const { can } = useAuth();
  const t = useTranslations('promotionCodes');
  return (
    <SimpleCrudPage
      title={t('title')}
      apiPath="/api/admin/promotion-codes"
      canWrite={can(PERMISSIONS.MASTER_DATA_MANAGE)}
      onAdd={async () => {
        const code = window.prompt('Code');
        if (!code) return;
        const pct = Number(window.prompt('Discount %', '10'));
        await fetch('/api/admin/promotion-codes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code,
            discountPercent: pct,
            validFrom: new Date().toISOString().slice(0, 10),
          }),
        });
        window.location.reload();
      }}
      columns={[
        { key: 'code', header: t('code') },
        { key: 'discountPercent', header: t('discount') },
        { key: 'active', header: t('active'), render: (r) => String(r.active) },
      ]}
    />
  );
}
