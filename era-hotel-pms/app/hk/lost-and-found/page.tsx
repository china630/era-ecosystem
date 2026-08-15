'use client';

import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { SimpleCrudPage } from '@/components/wave-b/SimpleCrudPage';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

export default function LostAndFoundPage() {
  const { can } = useAuth();
  const searchParams = useSearchParams();
  const guestId = searchParams.get('guestId');
  const t = useTranslations('lostAndFound');
  const tc = useTranslations('common');
  const apiPath = guestId
    ? `/api/housekeeping/lost-found?guestId=${encodeURIComponent(guestId)}`
    : '/api/housekeeping/lost-found';
  return (
    <SimpleCrudPage
      title={t('title')}
      apiPath={apiPath}
      postPath="/api/housekeeping/lost-found"
      canWrite={can(PERMISSIONS.HOUSEKEEPING_MANAGE)}
      addLabel={tc('add')}
      addFields={[
        { name: 'location', label: t('location'), preset: 'longText', required: true },
        { name: 'description', label: t('description'), preset: 'longText', required: true, multiline: true },
      ]}
      buildAddBody={(values) => ({
        foundDate: new Date().toISOString().slice(0, 10),
        location: values.location,
        description: values.description,
        ...(guestId ? { guestId } : {}),
      })}
      columns={[
        { key: 'foundDate', header: t('date'), render: (r) => String(r.foundDate).slice(0, 10) },
        { key: 'location', header: t('location') },
        { key: 'description', header: t('description') },
        { key: 'status', header: t('status') },
      ]}
    />
  );
}
