'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Legacy route — notes are highlighted in reservation list. */
export default function FoWithNotesRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/reports/reservations?hasNotes=1');
  }, [router]);

  return null;
}
