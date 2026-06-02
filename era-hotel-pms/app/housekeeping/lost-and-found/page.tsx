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
  const apiPath = guestId
    ? `/api/housekeeping/lost-found?guestId=${encodeURIComponent(guestId)}`
    : '/api/housekeeping/lost-found';
  return (
    <SimpleCrudPage
      title={t('title')}
      apiPath={apiPath}
      canWrite={can(PERMISSIONS.HOUSEKEEPING_MANAGE)}
      onAdd={async () => {
        const location = window.prompt('Location');
        const description = window.prompt('Description');
        if (!location || !description) return;
        await fetch('/api/housekeeping/lost-found', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            foundDate: new Date().toISOString().slice(0, 10),
            location,
            description,
            ...(guestId ? { guestId } : {}),
          }),
        });
        window.location.reload();
      }}
      columns={[
        { key: 'foundDate', header: t('date'), render: (r) => String(r.foundDate).slice(0, 10) },
        { key: 'location', header: t('location') },
        { key: 'description', header: t('description') },
        { key: 'status', header: t('status') },
      ]}
    />
  );
}
