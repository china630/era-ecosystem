'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Legacy route — open booking modal on home instead of a stuck full-screen overlay. */
export default function NewBookingPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/?openReservation=1');
  }, [router]);

  return null;
}
