'use client';

import { useTranslations } from 'next-intl';
import { SimpleCrudPage } from '@/components/wave-b/SimpleCrudPage';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

export default function ChildMatrixPage() {
  const { can } = useAuth();
  const t = useTranslations('childMatrix');
  return (
    <SimpleCrudPage
      title={t('title')}
      apiPath="/api/admin/child-matrix"
      canWrite={can(PERMISSIONS.MASTER_DATA_MANAGE)}
      onAdd={async () => {
        const from = Number(window.prompt('Age from', '0'));
        const to = Number(window.prompt('Age to', '6'));
        const pct = Number(window.prompt('Discount %', '50'));
        await fetch('/api/admin/child-matrix', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ageFrom: from, ageTo: to, discountPercent: pct }),
        });
        location.reload();
      }}
      columns={[
        { key: 'ageFrom', header: t('ageFrom') },
        { key: 'ageTo', header: t('ageTo') },
        { key: 'discountPercent', header: t('discount') },
      ]}
    />
  );
}
