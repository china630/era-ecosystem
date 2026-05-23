'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import NewBookingModal from '@/components/NewBookingModal';
import AppShell from '@/components/layout/AppShell';

export default function NewBookingPage() {
  const router = useRouter();
  const [open, setOpen] = useState(true);

  return (
    <AppShell maxWidthClass="max-w-lg">
      <NewBookingModal
        open={open}
        onClose={() => {
          setOpen(false);
          router.push('/');
        }}
      />
    </AppShell>
  );
}
