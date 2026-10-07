'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { CARD_CONTAINER_CLASS, PageHeader } from '@era/satellite-kit/ui';
import { FamilyPanel } from '@/components/guest-card/GuestCardCrmDialog';
import GuestCardModal from '@/components/GuestCardModal';

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations('guestCard');
  const [openGuestId, setOpenGuestId] = useState<string | null>(null);

  return (
    <>
      <PageHeader
        title={t('crmPages.familyTitle')}
        leading={
          <Link href="/guests" className="text-[13px] text-[#2980B9] hover:underline">
            {t('crmPages.backToGuests')}
          </Link>
        }
      />
      <div className={`${CARD_CONTAINER_CLASS} p-3`}>
        <FamilyPanel guestId={id} onOpenGuest={setOpenGuestId} />
      </div>
      {openGuestId ? (
        <GuestCardModal open guestId={openGuestId} onClose={() => setOpenGuestId(null)} />
      ) : null}
    </>
  );
}
