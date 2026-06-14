'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Legacy route — redirects to B2B sales contracts admin. */
export default function ContractPricingRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin/contracts');
  }, [router]);
  return null;
}
