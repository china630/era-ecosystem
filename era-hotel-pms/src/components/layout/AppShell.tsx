'use client';

import { APP_SHELL_CLASS, CARD_CONTAINER_CLASS } from '@era/satellite-kit/ui';
import type { ReactNode } from 'react';
import AppSidebar from '@/components/AppSidebar';

export default function AppShell({
  children,
  maxWidthClass = 'max-w-6xl',
}: {
  children: ReactNode;
  maxWidthClass?: string;
}) {
  return (
    <div className={APP_SHELL_CLASS}>
      <div className="flex min-h-screen">
        <AppSidebar />
        <main className={`min-w-0 flex-1 px-4 py-6 lg:px-8 ${maxWidthClass} mx-auto w-full`}>
          {children}
        </main>
      </div>
    </div>
  );
}

export function PageSection({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`${CARD_CONTAINER_CLASS} p-4 ${className}`}>{children}</section>;
}

export function StatusMessage({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p className="mb-4 rounded-lg border border-[#D5DADF] bg-white px-4 py-2 text-[13px] text-[#34495E]">
      {children}
    </p>
  );
}
