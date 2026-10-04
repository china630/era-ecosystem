'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HkPolicyRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/settings/policies#hk');
  }, [router]);
  return null;
}
