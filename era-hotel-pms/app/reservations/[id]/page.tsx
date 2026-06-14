'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@era/satellite-kit/ui';
import AppShell from '@/components/layout/AppShell';
import { ReservationCardEditor } from '@/components/reservation-card/ReservationCardEditor';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

export default function ReservationPage() {
  const params = useParams();
  const router = useRouter();
  const { can } = useAuth();
  const t = useTranslations('reservationCard');
  const tb = useTranslations('booking');
  const tc = useTranslations('common');
  const id = typeof params.id === 'string' ? params.id : null;

  if (!can(PERMISSIONS.RESERVATIONS_READ)) {
    return (
      <AppShell maxWidthClass="max-w-[min(96vw,1400px)]">
        <p className="text-[13px] text-[#7F8C8D]">{tc('noPermission')}</p>
      </AppShell>
    );
  }

  if (!id) {
    return (
      <AppShell maxWidthClass="max-w-[min(96vw,1400px)]">
        <p className="text-[13px] text-[#7F8C8D]">{tc('loadError')}</p>
      </AppShell>
    );
  }

  return (
    <AppShell maxWidthClass="max-w-[min(96vw,1400px)]">
      <PageHeader
        title={tb('reservationCardTitle')}
        actions={
          <Link href="/" className="text-[13px] text-[#2980B9] hover:underline">
            {t('backToRack')}
          </Link>
        }
      />
      <ReservationCardEditor
        layout="page"
        open
        reservationId={id}
        onClose={() => router.push('/')}
      />
    </AppShell>
  );
}
