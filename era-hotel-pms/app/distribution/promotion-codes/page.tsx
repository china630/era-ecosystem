'use client';

import { useTranslations } from 'next-intl';
import { SimpleCrudPage } from '@/components/wave-b/SimpleCrudPage';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

export default function PromotionCodesPage() {
  const { can } = useAuth();
  const t = useTranslations('promotionCodes');
  const tc = useTranslations('common');
  return (
    <SimpleCrudPage
      title={t('title')}
      apiPath="/api/admin/promotion-codes"
      canWrite={can(PERMISSIONS.MASTER_DATA_MANAGE)}
      addLabel={tc('add')}
      addFields={[
        { name: 'code', label: t('code'), preset: 'code', required: true },
        { name: 'discountPercent', label: t('discount'), preset: 'count', type: 'number', defaultValue: '10', required: true },
      ]}
      buildAddBody={(values) => ({
        code: values.code,
        discountPercent: Number(values.discountPercent),
        validFrom: new Date().toISOString().slice(0, 10),
      })}
      columns={[
        { key: 'code', header: t('code') },
        { key: 'discountPercent', header: t('discount') },
        { key: 'active', header: t('active'), render: (r) => String(r.active) },
      ]}
    />
  );
}
