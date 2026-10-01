'use client';

import { useTranslations } from 'next-intl';
import { SimpleCrudPage } from '@/components/wave-b/SimpleCrudPage';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

export default function MaidsPage() {
  const { can } = useAuth();
  const t = useTranslations('maidManagement');
  const th = useTranslations('housekeeping');
  const tc = useTranslations('common');
  return (
    <SimpleCrudPage
      title={t('title')}
      subtitle={t('hint')}
      emptyMessage={t('empty')}
      apiPath="/api/housekeeping/maids"
      canWrite={can(PERMISSIONS.HOUSEKEEPING_MANAGE)}
      addLabel={tc('add')}
      addFields={[
        { name: 'code', label: t('code'), preset: 'code', required: true },
        { name: 'name', label: t('name'), preset: 'longText', required: true },
        {
          name: 'department',
          label: t('department'),
          required: true,
          defaultValue: 'ROOMS',
          options: [
            { value: 'ROOMS', label: th('dept.ROOMS') },
            { value: 'PUBLIC_AREA', label: th('dept.PUBLIC_AREA') },
            { value: 'LAUNDRY', label: th('dept.LAUNDRY') },
          ],
        },
      ]}
      columns={[
        { key: 'code', header: t('code') },
        { key: 'name', header: t('name') },
        {
          key: 'department',
          header: t('department'),
          render: (r) => {
            const code = String(r.department ?? 'ROOMS');
            if (code === 'PUBLIC_AREA' || code === 'LAUNDRY' || code === 'ROOMS') return th(`dept.${code}`);
            return code;
          },
        },
        { key: 'tasks', header: t('tasks'), render: (r) => String((r.tasks as unknown[])?.length ?? 0) },
      ]}
    />
  );
}
