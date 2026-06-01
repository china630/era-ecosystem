'use client';

import { useTranslations } from 'next-intl';
import { SimpleCrudPage } from '@/components/wave-b/SimpleCrudPage';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

export default function MaidsPage() {
  const { can } = useAuth();
  const t = useTranslations('maidManagement');
  return (
    <SimpleCrudPage
      title={t('title')}
      apiPath="/api/housekeeping/maids"
      canWrite={can(PERMISSIONS.HOUSEKEEPING_MANAGE)}
      onAdd={async () => {
        const code = window.prompt('Code');
        const name = window.prompt('Name');
        if (!code || !name) return;
        await fetch('/api/housekeeping/maids', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, name }),
        });
        location.reload();
      }}
      columns={[
        { key: 'code', header: t('code') },
        { key: 'name', header: t('name') },
        { key: 'tasks', header: t('tasks'), render: (r) => String((r.tasks as unknown[])?.length ?? 0) },
      ]}
    />
  );
}
