'use client';

import { useTranslations } from 'next-intl';
import { SimpleCrudPage } from '@/components/wave-b/SimpleCrudPage';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

export default function SpaPlacesPage() {
  const { can } = useAuth();
  const t = useTranslations('placesAndRooms');
  const tc = useTranslations('common');
  return (
    <SimpleCrudPage
      title={t('title')}
      apiPath="/api/spa/places"
      canWrite={can(PERMISSIONS.MASTER_DATA_MANAGE)}
      addLabel={tc('add')}
      addFields={[
        { name: 'code', label: tc('code'), preset: 'code', required: true },
        { name: 'name', label: tc('name'), preset: 'longText', required: true },
      ]}
      columns={[
        { key: 'code', header: tc('code') },
        { key: 'name', header: tc('name') },
        { key: 'capacity', header: 'Capacity' },
      ]}
    />
  );
}
