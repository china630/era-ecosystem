'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Create departure is a modal on `/tours` — keep deep link. */
export default function NewTourRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/tours?new=1');
  }, [router]);
  return null;
}
