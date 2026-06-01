'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

export type ActionItem = {
  href?: string;
  labelKey: string;
  disabled?: boolean;
  external?: boolean;
  disabledReasonKey?: string;
  badgeCount?: number;
  buttonId?: string;
};

export function GuestCardActionGrid({ actions }: { actions: ActionItem[] }) {
  const t = useTranslations('guestCard');

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {actions.map((a) => {
        const label = t(a.labelKey as 'crm.tasks');
        const title = a.disabled
          ? a.disabledReasonKey?.startsWith('satellite.')
            ? t(a.disabledReasonKey as 'satellite.notConfigured')
            : a.disabledReasonKey
              ? t(a.disabledReasonKey as 'comingSoon')
              : t('comingSoon')
          : undefined;
        const badge =
          a.badgeCount != null && a.badgeCount > 0 ? (
            <span className="ml-1.5 inline-flex min-w-[1.25rem] rounded-full bg-rose-600 px-1.5 text-[10px] font-bold text-white">
              {a.badgeCount}
            </span>
          ) : null;

        if (a.href && !a.disabled) {
          const className =
            'relative rounded-lg bg-[#2980B9] px-3 py-3 text-center text-[13px] font-medium text-white hover:bg-[#2471A3]';
          if (a.external) {
            return (
              <a
                key={a.buttonId ?? a.labelKey}
                href={a.href}
                target="_blank"
                rel="noopener noreferrer"
                className={className}
                title={t('satellite.openExternal')}
              >
                {label}
                {badge}
              </a>
            );
          }
          return (
            <Link key={a.buttonId ?? a.labelKey} href={a.href} className={className} title={title}>
              {label}
              {badge}
            </Link>
          );
        }

        return (
          <span
            key={a.buttonId ?? a.labelKey}
            className="relative rounded-lg bg-[#2980B9]/40 px-3 py-3 text-center text-[13px] text-white/90"
            title={title}
          >
            {label}
            {badge}
          </span>
        );
      })}
    </div>
  );
}
