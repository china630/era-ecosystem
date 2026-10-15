'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function GuestDebtRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/front-cash/debts?kind=guest');
  }, [router]);
  return null;
}
