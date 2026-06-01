'use client';

import { useTranslations } from 'next-intl';
import { SimpleCrudPage } from '@/components/wave-b/SimpleCrudPage';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

export default function SpaPlacesPage() {
  const { can } = useAuth();
  const t = useTranslations('placesAndRooms');
  return (
    <SimpleCrudPage
      title={t('title')}
      apiPath="/api/spa/places"
      canWrite={can(PERMISSIONS.MASTER_DATA_MANAGE)}
      onAdd={async () => {
        const code = window.prompt('Code');
        const name = window.prompt('Name');
        if (!code || !name) return;
        await fetch('/api/spa/places', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, name }),
        });
        location.reload();
      }}
      columns={[
        { key: 'code', header: 'Code' },
        { key: 'name', header: 'Name' },
        { key: 'capacity', header: 'Capacity' },
      ]}
    />
  );
}
