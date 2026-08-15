'use client';

import { useTranslations } from 'next-intl';
import { SimpleCrudPage } from '@/components/wave-b/SimpleCrudPage';

export default function ClosedRoomsPage() {
  const t = useTranslations('closedRoomList');
  return (
    <SimpleCrudPage
      title={t('title')}
      apiPath="/api/housekeeping/closed-rooms"
      columns={[
        { key: 'roomNumber', header: t('room') },
        { key: 'status', header: t('status') },
        { key: 'type', header: t('type'), render: (r) => String((r.roomType as { code?: string })?.code ?? '') },
      ]}
    />
  );
}
