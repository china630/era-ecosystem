'use client';

import { CARD_CONTAINER_CLASS } from '@era/satellite-kit/ui';
import type { ReactNode } from 'react';

/** Page content wrapper — sidebar lives in HotelOpsShell (root layout). */
export default function AppShell({
  children,
  maxWidthClass: _maxWidthClass,
}: {
  children: ReactNode;
  maxWidthClass?: string;
}) {
  return <>{children}</>;
}

export function PageSection({
  children,
  className = '',
  title,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <section className={`${CARD_CONTAINER_CLASS} p-4 ${className}`}>
      {title ? <h2 className="mb-3 text-sm font-semibold text-[#34495E]">{title}</h2> : null}
      {children}
    </section>
  );
}

export function StatusMessage({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p className="mb-4 rounded-lg border border-[#D5DADF] bg-white px-4 py-2 text-[13px] text-[#34495E]">
      {children}
    </p>
  );
}
