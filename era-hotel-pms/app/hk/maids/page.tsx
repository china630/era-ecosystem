'use client';

import { useTranslations } from 'next-intl';
import { SimpleCrudPage } from '@/components/wave-b/SimpleCrudPage';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

export default function MaidsPage() {
  const { can } = useAuth();
  const t = useTranslations('maidManagement');
  const tc = useTranslations('common');
  return (
    <SimpleCrudPage
      title={t('title')}
      apiPath="/api/housekeeping/maids"
      canWrite={can(PERMISSIONS.HOUSEKEEPING_MANAGE)}
      addLabel={tc('add')}
      addFields={[
        { name: 'code', label: t('code'), preset: 'code', required: true },
        { name: 'name', label: t('name'), preset: 'longText', required: true },
      ]}
      columns={[
        { key: 'code', header: t('code') },
        { key: 'name', header: t('name') },
        { key: 'tasks', header: t('tasks'), render: (r) => String((r.tasks as unknown[])?.length ?? 0) },
      ]}
    />
  );
}
