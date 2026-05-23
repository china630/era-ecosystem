'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Activity,
  BedDouble,
  Building2,
  CalendarDays,
  ClipboardList,
  FileBarChart,
  HeartPulse,
  LayoutGrid,
  Link2,
  LogOut,
  Package,
  Radio,
  Settings,
  Users,
  Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { SIDEBAR_LINK_ACTIVE_CLASS, SIDEBAR_LINK_CLASS } from '@era/satellite-kit/ui';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';
import LanguageSwitcher from '@/components/LanguageSwitcher';

type NavItem = {
  href: string;
  labelKey: string;
  icon: LucideIcon;
  external?: boolean;
  show?: boolean;
};

export default function AppSidebar() {
  const pathname = usePathname();
  const { user, can } = useAuth();
  const t = useTranslations('nav');
  const tMeta = useTranslations('meta');

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  const items: NavItem[] = [
    { href: '/', labelKey: 'chessboard', icon: LayoutGrid, show: true },
    {
      href: '/room-plan',
      labelKey: 'roomPlan',
      icon: BedDouble,
      show: can(PERMISSIONS.RESERVATIONS_READ),
    },
    {
      href: '/bookings/new',
      labelKey: 'newBooking',
      icon: CalendarDays,
      show: can(PERMISSIONS.RESERVATIONS_WRITE),
    },
    {
      href: '/reports/occupancy',
      labelKey: 'occupancy',
      icon: FileBarChart,
      show: can(PERMISSIONS.REPORTS_READ),
    },
    {
      href: '/reports/agency-ledger',
      labelKey: 'agencyLedger',
      icon: ClipboardList,
      show: can(PERMISSIONS.REPORTS_READ),
    },
    {
      href: '/reports/reconciliation',
      labelKey: 'reconciliation',
      icon: Activity,
      show: can(PERMISSIONS.REPORTS_READ),
    },
    {
      href: process.env.NEXT_PUBLIC_FB_POS_URL ?? 'http://localhost:3200',
      labelKey: 'posCalendar',
      icon: CalendarDays,
      external: true,
      show: can(PERMISSIONS.RESERVATIONS_READ),
    },
    {
      href: '/admin/master-data',
      labelKey: 'masterData',
      icon: Building2,
      show: can(PERMISSIONS.MASTER_DATA_MANAGE),
    },
    {
      href: '/admin/integration',
      labelKey: 'integration',
      icon: Link2,
      show: can(PERMISSIONS.MASTER_DATA_MANAGE),
    },
    {
      href: '/admin/stock',
      labelKey: 'stock',
      icon: Package,
      show: can(PERMISSIONS.MASTER_DATA_MANAGE),
    },
    {
      href: '/admin/users',
      labelKey: 'users',
      icon: Users,
      show: can(PERMISSIONS.USERS_MANAGE),
    },
    {
      href: '/housekeeping',
      labelKey: 'housekeeping',
      icon: Wrench,
      show: can(PERMISSIONS.HOUSEKEEPING_MANAGE) || can(PERMISSIONS.ROOMS_STATUS),
    },
    {
      href: '/channel',
      labelKey: 'channel',
      icon: Radio,
      show: can(PERMISSIONS.CHANNEL_MANAGE),
    },
    {
      href: '/medical',
      labelKey: 'medical',
      icon: HeartPulse,
      show: can(PERMISSIONS.MEDICAL_MANAGE),
    },
    {
      href: '/operations',
      labelKey: 'operations',
      icon: Settings,
      show: can(PERMISSIONS.NIGHT_AUDIT_RUN) || can(PERMISSIONS.RESERVATIONS_CANCEL),
    },
  ];

  function linkClass(href: string) {
    const active = href !== '/' && pathname.startsWith(href);
    const isHome = href === '/' && pathname === '/';
    return active || isHome ? SIDEBAR_LINK_ACTIVE_CLASS : SIDEBAR_LINK_CLASS;
  }

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-[#D5DADF] bg-white">
      <div className="border-b border-[#D5DADF] px-4 py-4">
        <p className="text-[13px] font-semibold text-[#34495E]">{tMeta('title')}</p>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
        {items
          .filter((item) => item.show !== false)
          .map((item) => {
            const Icon = item.icon;
            const label = t(item.labelKey as 'chessboard');
            const className = linkClass(item.href);
            const content = (
              <>
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                <span className="truncate">{label}</span>
              </>
            );
            if (item.external) {
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className={className}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {content}
                </a>
              );
            }
            return (
              <Link key={item.href} href={item.href} className={className}>
                {content}
              </Link>
            );
          })}
      </nav>
      <div className="space-y-2 border-t border-[#D5DADF] p-3">
        <LanguageSwitcher />
        {user ? (
          <p className="px-1 text-[12px] text-[#7F8C8D]">
            {user.fullName}{' '}
            <span className="text-[#BDC3C7]">({user.role})</span>
          </p>
        ) : null}
        <button
          type="button"
          onClick={logout}
          className={`${SIDEBAR_LINK_CLASS} w-full`}
        >
          <LogOut className="h-4 w-4 shrink-0" aria-hidden />
          {t('logout')}
        </button>
      </div>
    </aside>
  );
}
