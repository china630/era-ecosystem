'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import type { Locale } from '@era/i18n-common';
import {
  Activity,
  BedDouble,
  Building2,
  CalendarDays,
  Car,
  ClipboardList,
  FileBarChart,
  HeartPulse,
  Home,
  LayoutGrid,
  Plus,
  Link2,
  Moon,
  Package,
  Radio,
  Settings,
  Smartphone,
  Sparkles,
  TrendingUp,
  Users,
  UtensilsCrossed,
  Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  EraAppRouteShell,
  HeaderOrganization,
  HeaderProfileMenu,
  SatelliteHeaderLocale,
  SatelliteNotificationBell,
  type EraOpsNavItem,
  type EraOpsNavSection,
  type HeaderProfileMenuItem,
} from '@era/satellite-kit/ui';
import { HotelHeaderTierBar } from '@/components/HotelHeaderTierBar';
import ReservationCardModal from '@/components/ReservationCardModal';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

type NavDef = {
  id: string;
  href?: string;
  labelKey: string;
  icon: LucideIcon;
  external?: boolean;
  show?: boolean;
};

function posCalendarHref(): string {
  return (
    process.env.NEXT_PUBLIC_FNB_POS_URL ??
    process.env.NEXT_PUBLIC_FB_POS_URL ??
    'http://localhost:3202'
  );
}

export default function HotelOpsShell({ children }: { children: React.ReactNode }) {
  const { user, can } = useAuth();
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const searchParams = useSearchParams();
  const openReservation = searchParams.get('openReservation') === '1';
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const t = useTranslations('nav');
  const tMeta = useTranslations('meta');
  const tHeader = useTranslations('header');
  const tNotify = useTranslations('notifications');
  const locale = useLocale() as Locale;
  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  useEffect(() => {
    if (searchParams.get('openReservation') !== '1' && searchParams.get('newBooking') !== '1') {
      return;
    }
    setBookingModalOpen(true);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('openReservation');
    params.delete('newBooking');
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [searchParams, pathname, router]);

  function mapNavItem(def: NavDef): EraOpsNavItem | null {
    if (def.show === false) return null;
    return {
      id: def.id,
      href: def.href,
      label: t(def.labelKey as 'chessboard'),
      icon: def.icon,
      external: def.external,
    };
  }

  function sectionItems(defs: NavDef[]): EraOpsNavItem[] {
    return defs.map(mapNavItem).filter((item): item is EraOpsNavItem => item !== null);
  }

  const navSections: EraOpsNavSection[] = useMemo(
    () =>
      [
        {
          id: 'hotel_esas',
          title: t('esas'),
          icon: Home,
          flat: true,
          items: [
            {
              id: 'home-esas',
              href: '/executive',
              label: t('esas'),
              icon: Home,
              active:
                pathname === '/executive' || pathname.startsWith('/executive/'),
            },
            {
              id: 'home-forecast',
              href: '/executive/forecast',
              label: t('forecast'),
              icon: TrendingUp,
              active: pathname.startsWith('/executive/forecast'),
            },
          ],
        },
        {
          id: 'hotel_core',
          title: t('sectionCore'),
          icon: LayoutGrid,
          items: sectionItems([
            { id: 'core-rack', href: '/', labelKey: 'chessboard', icon: LayoutGrid, show: true },
            {
              id: 'core-plan',
              href: '/room-plan',
              labelKey: 'roomPlan',
              icon: BedDouble,
              show: can(PERMISSIONS.RESERVATIONS_READ),
            },
            {
              id: 'core-res-list',
              href: '/reports/reservations',
              labelKey: 'reservationList',
              icon: ClipboardList,
              show: can(PERMISSIONS.RESERVATIONS_READ),
            },
            {
              id: 'core-group-res',
              href: '/reports/group-reservations',
              labelKey: 'groupReservations',
              icon: ClipboardList,
              show: can(PERMISSIONS.RESERVATIONS_READ),
            },
            {
              id: 'core-inhouse',
              href: '/in-house',
              labelKey: 'inHouse',
              icon: Users,
              show: can(PERMISSIONS.FOLIO_READ) || can(PERMISSIONS.RESERVATIONS_READ),
            },
            {
              id: 'core-eod',
              href: '/reports/end-of-day-logs',
              labelKey: 'endOfDayLogs',
              icon: FileBarChart,
              show: can(PERMISSIONS.NIGHT_AUDIT_RUN),
            },
            {
              id: 'core-room-changes',
              href: '/reports/room-changes',
              labelKey: 'roomChanges',
              icon: FileBarChart,
              show: can(PERMISSIONS.REPORTS_READ),
            },
            {
              id: 'core-daily-inhouse',
              href: '/reports/inhouse-daily',
              labelKey: 'dailyInhouseList',
              icon: FileBarChart,
              show: can(PERMISSIONS.REPORTS_READ),
            },
            {
              id: 'core-na',
              href: '/operations',
              labelKey: 'operations',
              icon: Moon,
              show: can(PERMISSIONS.NIGHT_AUDIT_RUN) || can(PERMISSIONS.RESERVATIONS_CANCEL),
            },
          ]),
        },
        {
          id: 'hotel_reports',
          title: t('sectionReports'),
          icon: FileBarChart,
          items: sectionItems([
            {
              id: 'rep-res-times',
              href: '/reports/reservation-times',
              labelKey: 'actualCheckTimes',
              icon: FileBarChart,
              show: can(PERMISSIONS.REPORTS_READ),
            },
          ]),
        },
        {
          id: 'hotel_housekeeping',
          title: t('sectionHousekeeping'),
          icon: Wrench,
          items: sectionItems([
            {
              id: 'hk-ops',
              href: '/housekeeping',
              labelKey: 'housekeeping',
              icon: Wrench,
              show: can(PERMISSIONS.HOUSEKEEPING_MANAGE) || can(PERMISSIONS.ROOMS_STATUS),
            },
            {
              id: 'hk-mobile',
              href: '/hk/mobile',
              labelKey: 'hkMobile',
              icon: Smartphone,
              show: can(PERMISSIONS.HOUSEKEEPING_MANAGE) || can(PERMISSIONS.ROOMS_STATUS),
            },
            {
              id: 'hk-minibar',
              href: '/housekeeping/minibar',
              labelKey: 'minibarControl',
              icon: Package,
              show: can(PERMISSIONS.HOUSEKEEPING_MANAGE),
            },
            {
              id: 'hk-maids',
              href: '/housekeeping/maids',
              labelKey: 'maidManagement',
              icon: Users,
              show: can(PERMISSIONS.HOUSEKEEPING_MANAGE),
            },
            {
              id: 'hk-ooo',
              href: '/housekeeping/closed-rooms',
              labelKey: 'closedRoomList',
              icon: Wrench,
              show: can(PERMISSIONS.ROOMS_STATUS),
            },
            {
              id: 'hk-lost',
              href: '/housekeeping/lost-and-found',
              labelKey: 'lostAndFound',
              icon: Package,
              show: can(PERMISSIONS.HOUSEKEEPING_MANAGE) || can(PERMISSIONS.ROOMS_STATUS),
            },
          ]),
        },
        {
          id: 'hotel_distribution',
          title: t('sectionDistribution'),
          icon: Radio,
          items: sectionItems([
            {
              id: 'dist-channel',
              href: '/channel',
              labelKey: 'channel',
              icon: Radio,
              show: can(PERMISSIONS.CHANNEL_MANAGE),
            },
            {
              id: 'dist-contracts',
              href: '/admin/contract-pricing',
              labelKey: 'contractPricing',
              icon: TrendingUp,
              show: can(PERMISSIONS.MASTER_DATA_MANAGE),
            },
            {
              id: 'dist-promo',
              href: '/admin/promotion-codes',
              labelKey: 'promotionCodes',
              icon: Settings,
              show: can(PERMISSIONS.MASTER_DATA_MANAGE),
            },
            {
              id: 'dist-agencies',
              href: '/admin/travel-agencies',
              labelKey: 'travelAgencies',
              icon: Users,
              show: can(PERMISSIONS.MASTER_DATA_MANAGE),
            },
            {
              id: 'dist-child-matrix',
              href: '/admin/child-matrix',
              labelKey: 'childMatrix',
              icon: Settings,
              show: can(PERMISSIONS.MASTER_DATA_MANAGE),
            },
          ]),
        },
        {
          id: 'hotel_guest_experience',
          title: t('sectionGuests'),
          icon: Users,
          items: sectionItems([
            {
              id: 'gx-guests',
              href: '/guests',
              labelKey: 'guests',
              icon: Users,
              show: can(PERMISSIONS.RESERVATIONS_READ),
            },
          ]),
        },
        {
          id: 'hotel_spa_scheduling',
          title: t('sectionSpa'),
          icon: Sparkles,
          items: sectionItems([
            {
              id: 'spa-proc',
              href: '/procedures',
              labelKey: 'procedures',
              icon: Activity,
              show: can(PERMISSIONS.MEDICAL_MANAGE),
            },
            {
              id: 'spa-list',
              href: '/spa/reservations',
              labelKey: 'spaReservationList',
              icon: Sparkles,
              show: can(PERMISSIONS.MEDICAL_MANAGE),
            },
            {
              id: 'spa-staff',
              href: '/spa/staff-match',
              labelKey: 'serviceStaffMatch',
              icon: Users,
              show: can(PERMISSIONS.MEDICAL_MANAGE),
            },
            {
              id: 'spa-rooms',
              href: '/spa/places',
              labelKey: 'placesAndRooms',
              icon: BedDouble,
              show: can(PERMISSIONS.MEDICAL_MANAGE),
            },
          ]),
        },
        {
          id: 'hotel_transfers',
          title: t('sectionTransfers'),
          icon: Car,
          items: sectionItems([
            {
              id: 'tr-main',
              href: '/transfers',
              labelKey: 'transfers',
              icon: Car,
              show: can(PERMISSIONS.RESERVATIONS_WRITE),
            },
            {
              id: 'tr-airport',
              href: '/transfers/airport',
              labelKey: 'airportTransfer',
              icon: Car,
              show: can(PERMISSIONS.RESERVATIONS_WRITE),
            },
          ]),
        },
        {
          id: 'hotel_banquets',
          title: t('sectionBanquets'),
          icon: UtensilsCrossed,
          items: sectionItems([
            {
              id: 'bq-main',
              href: '/banquets',
              labelKey: 'banquets',
              icon: UtensilsCrossed,
              show: can(PERMISSIONS.RESERVATIONS_READ),
            },
          ]),
        },
        {
          id: 'hotel_medical_sanatorium',
          title: t('sectionMedical'),
          icon: HeartPulse,
          items: sectionItems([
            {
              id: 'md-main',
              href: '/medical',
              labelKey: 'medical',
              icon: HeartPulse,
              show: can(PERMISSIONS.MEDICAL_MANAGE),
            },
          ]),
        },
        {
          id: 'hotel_setup_advanced',
          title: t('sectionSetup'),
          icon: Building2,
          items: sectionItems([
            {
              id: 'su-master',
              href: '/admin/master-data',
              labelKey: 'masterData',
              icon: Building2,
              show: can(PERMISSIONS.MASTER_DATA_MANAGE),
            },
          ]),
        },
        {
          id: 'general',
          title: t('sectionGeneral'),
          icon: FileBarChart,
          items: sectionItems([
            {
              id: 'gn-occ',
              href: '/reports/occupancy',
              labelKey: 'occupancy',
              icon: FileBarChart,
              show: can(PERMISSIONS.REPORTS_READ),
            },
            {
              id: 'gn-inv',
              href: '/reports/invoices',
              labelKey: 'invoices',
              icon: FileBarChart,
              show: can(PERMISSIONS.REPORTS_READ),
            },
            {
              id: 'gn-agency',
              href: '/reports/agency-ledger',
              labelKey: 'agencyLedger',
              icon: ClipboardList,
              show: can(PERMISSIONS.REPORTS_READ),
            },
            {
              id: 'gn-recon',
              href: '/reports/reconciliation',
              labelKey: 'reconciliation',
              icon: Activity,
              show: can(PERMISSIONS.REPORTS_READ),
            },
            {
              id: 'gn-stock',
              href: '/admin/stock',
              labelKey: 'stock',
              icon: Package,
              show: can(PERMISSIONS.MASTER_DATA_MANAGE),
            },
            {
              id: 'gn-int',
              href: '/admin/integration',
              labelKey: 'integration',
              icon: Link2,
              show: can(PERMISSIONS.MASTER_DATA_MANAGE),
            },
            {
              id: 'gn-users',
              href: '/admin/users',
              labelKey: 'users',
              icon: Users,
              show: can(PERMISSIONS.USERS_MANAGE),
            },
            {
              id: 'gn-pos',
              href: posCalendarHref(),
              labelKey: 'posCalendar',
              icon: CalendarDays,
              external: true,
              show: can(PERMISSIONS.RESERVATIONS_READ),
            },
          ]),
        },
      ].filter((section) => section.items.length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- can() identity stable enough per render
    [t, can, user?.role],
  );

  const headerQuickLinkClass = (active: boolean) =>
    [
      'hidden items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition sm:inline-flex',
      active
        ? 'border-[#2980B9]/40 bg-[#EBF5FB] text-[#2980B9]'
        : 'border-[#D5DADF] bg-white text-[#34495E] hover:border-[#2980B9]/30 hover:bg-[#F8F9FA]',
    ].join(' ');

  const headerLeft = (
    <div className="hidden min-w-0 items-center gap-2 lg:flex">
      <Link href="/" className={headerQuickLinkClass(pathname === '/')}>
        <LayoutGrid className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>{t('chessboard')}</span>
      </Link>
      {can(PERMISSIONS.RESERVATIONS_READ) ? (
        <Link
          href="/room-plan"
          className={headerQuickLinkClass(
            pathname === '/room-plan' || pathname.startsWith('/room-plan/'),
          )}
        >
          <BedDouble className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{t('roomPlan')}</span>
        </Link>
      ) : null}
      {can(PERMISSIONS.RESERVATIONS_WRITE) ? (
        <button
          type="button"
          className={headerQuickLinkClass(openReservation && bookingModalOpen)}
          onClick={() => {
            setBookingModalOpen(true);
            const params = new URLSearchParams(searchParams.toString());
            params.delete('openReservation');
            params.delete('newBooking');
            const qs = params.toString();
            if (qs) router.replace(`${pathname}?${qs}`, { scroll: false });
          }}
        >
          <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{t('newBooking')}</span>
        </button>
      ) : null}
    </div>
  );

  const profileItems: HeaderProfileMenuItem[] = [
    { label: tHeader('settings', { defaultValue: 'Settings' }), href: '/admin/master-data' },
    { label: tHeader('help', { defaultValue: 'Help' }), href: '/help' },
  ];

  const organizationName = user?.organizationName ?? null;

  return (
    <>
      <EraAppRouteShell
        brandTitle={tMeta('title')}
        navSections={navSections}
        headerLeft={headerLeft}
        profile={
        user ? (
          <HeaderProfileMenu
            displayName={user.fullName || user.login}
            items={profileItems}
            onLogout={() => void logout()}
            logoutLabel={t('logout')}
            menuAriaLabel={tHeader('profileMenu', { defaultValue: 'Account menu' })}
          />
        ) : undefined
      }
      organization={
        <HeaderOrganization variant="label" organizationName={organizationName} />
      }
      notifications={
        <SatelliteNotificationBell
          labels={{
            bellAria: tNotify('bellAria'),
            title: tNotify('title'),
            empty: tNotify('empty'),
            markAll: tNotify('markAll'),
            close: tNotify('close'),
          }}
        />
      }
      locale={
        <SatelliteHeaderLocale
          locale={locale}
          labels={{ groupAria: 'AZ / RU / EN' }}
        />
      }
      tierBar={<HotelHeaderTierBar />}
      >
        {children}
      </EraAppRouteShell>
      {can(PERMISSIONS.RESERVATIONS_WRITE) ? (
        <ReservationCardModal
          open={bookingModalOpen}
          onClose={() => setBookingModalOpen(false)}
        />
      ) : null}
    </>
  );
}
