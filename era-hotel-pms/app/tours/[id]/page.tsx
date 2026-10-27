'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

/** Legacy detail URL → list + roster modal (ADR D5: grids + modals only). */
export default function TourDepartureRedirectPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  useEffect(() => {
    if (id) router.replace(`/tours?roster=${id}`);
  }, [id, router]);

  return null;
}
