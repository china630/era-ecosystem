'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PricingPolicyRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/settings/policies#pricing');
  }, [router]);
  return null;
}
