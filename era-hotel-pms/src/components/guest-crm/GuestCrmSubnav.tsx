'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { crmTabButtons, reservationDetailsButtons } from '@/lib/guest-crm-config';

export function GuestCrmSubnav() {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();
  const t = useTranslations('guestCard');

  if (!id) return null;

  const prefix = `/guests/${id}`;
  const seen = new Set<string>();
  const items = [...crmTabButtons(id), ...reservationDetailsButtons(id)].filter((item) => {
    if (!item.href || item.disabled || item.external) return false;
    if (!item.href.startsWith(prefix)) return false;
    if (seen.has(item.href)) return false;
    seen.add(item.href);
    return true;
  });

  return (
    <nav
      className="mb-4 flex gap-1 overflow-x-auto border-b border-[#D5DADF] pb-2"
      aria-label="Guest CRM"
    >
      {items.map((item) => {
        const href = item.href!;
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={item.buttonId}
            href={href}
            className={[
              'shrink-0 truncate rounded px-2.5 py-1.5 text-[13px]',
              active
                ? 'bg-[#EBF5FB] font-medium text-[#2980B9]'
                : 'text-[#34495E] hover:bg-[#F5F7F8]',
            ].join(' ')}
          >
            {t(item.labelKey as 'crm.tasks')}
          </Link>
        );
      })}
    </nav>
  );
}
