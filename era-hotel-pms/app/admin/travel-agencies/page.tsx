'use client';

import { useTranslations } from 'next-intl';
import { SimpleCrudPage } from '@/components/wave-b/SimpleCrudPage';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

export default function TravelAgenciesPage() {
  const { can } = useAuth();
  const t = useTranslations('travelAgencies');
  return (
    <SimpleCrudPage
      title={t('title')}
      apiPath="/api/admin/travel-agencies"
      canWrite={can(PERMISSIONS.MASTER_DATA_MANAGE)}
      onAdd={async () => {
        const code = window.prompt('Code');
        const name = window.prompt('Name');
        if (!code || !name) return;
        await fetch('/api/admin/travel-agencies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, name }),
        });
        location.reload();
      }}
      columns={[
        { key: 'code', header: t('code') },
        { key: 'name', header: t('name') },
        { key: 'commissionPercent', header: t('commission') },
        { key: 'active', header: t('active'), render: (r) => String(r.active ?? true) },
      ]}
    />
  );
}
