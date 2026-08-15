'use client';

import type { ReactNode } from 'react';
import { GuestCrmSubnav } from '@/components/guest-crm/GuestCrmSubnav';

export default function GuestCrmLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <GuestCrmSubnav />
      {children}
    </>
  );
}
