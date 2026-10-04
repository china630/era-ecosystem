'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ReportPackRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/settings/policies#reports');
  }, [router]);
  return null;
}
