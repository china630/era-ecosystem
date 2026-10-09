'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

/** Old folio screen. The account lives on the reservation card Folio tab. */
export default function FolioRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const reservationId = String(params.reservationId ?? '');

  useEffect(() => {
    if (!reservationId) return;
    router.replace(`/fo/room-plan?folioStay=${encodeURIComponent(reservationId)}`);
  }, [reservationId, router]);

  return null;
}
