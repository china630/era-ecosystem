'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Airport was a duplicate of `/transfers` — fold into hasFlight filter. */
export default function AirportTransferRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/transfers?hasFlight=1');
  }, [router]);
  return null;
}
