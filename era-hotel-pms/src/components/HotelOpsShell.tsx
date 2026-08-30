'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import type { Locale } from '@era/i18n-common';
import {
  Activity,
  BarChart3,
  BedDouble,
  BookOpen,
  Building2,
  CalendarDays,
  Bus,
  Car,
  ClipboardList,
  DollarSign,
  FileBarChart,
  FileText,
  HeartPulse,
  Home,
  LayoutGrid,
  Package,
  Plus,
  Link2,
  Moon,
  Radio,
  Settings,
  ShoppingBag,
  Smartphone,
  Sparkles,
  TrendingUp,
  Users,
  UtensilsCrossed,
  Wrench,
  Banknote,
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
import GroupBookingModal from '@/components/GroupBookingModal';
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

function souvenirRetailHref(): string {
  return (
    process.env.NEXT_PUBLIC_SATELLITE_RETAIL_URL ??
    process.env.NEXT_PUBLIC_RETAIL_POS_URL ??
    'http://localhost:3204'
  );
}

export default function HotelOpsShell({ children }: { children: React.ReactNode }) {
  const { user, can, isPlatformSuperAdmin, canRunElektrawebImport } = useAuth();
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const searchParams = useSearchParams();
  const openReservation = searchParams.get('openReservation') === '1';
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
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
    const openRoom =
      searchParams.get('openReservation') === '1' || searchParams.get('newBooking') === '1';
    const openGroup = searchParams.get('groupBooking') === '1';
    if (!openRoom && !openGroup) return;
    if (openRoom) setBookingModalOpen(true);
    if (openGroup) setGroupModalOpen(true);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('openReservation');
    params.delete('newBooking');
    params.delete('groupBooking');
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
            {
              id: 'home-unit-econ',
              href: '/executive/unit-economics',
              label: t('unitEconomics'),
              icon: TrendingUp,
              active: pathname.startsWith('/executive/unit-economics'),
            },
          ],
        },
        {
          id: 'hotel_core',
          title: t('sectionFrontOffice'),
          icon: LayoutGrid,
          items: sectionItems([
            {
              id: 'fo-rta',
              href: '/fo/availability',
              labelKey: 'roomTypeAvailability',
              icon: CalendarDays,
              show: can(PERMISSIONS.RESERVATIONS_READ),
            },
            {
              id: 'fo-res-list',
              href: '/fo/reservations',
              labelKey: 'reservationList',
              icon: ClipboardList,
              show: can(PERMISSIONS.RESERVATIONS_READ),
            },
            {
              id: 'fo-rack',
              href: '/fo/rack',
              labelKey: 'chessboard',
              icon: LayoutGrid,
              show: true,
            },
            {
              id: 'fo-plan',
              href: '/fo/room-plan',
              labelKey: 'roomPlan',
              icon: BedDouble,
              show: can(PERMISSIONS.RESERVATIONS_READ),
            },
            {
              id: 'fo-groups',
              href: '/fo/groups',
              labelKey: 'groupReservations',
              icon: ClipboardList,
              show: can(PERMISSIONS.RESERVATIONS_READ),
            },
            {
              id: 'fo-inhouse',
              href: '/fo/in-house',
              labelKey: 'inHouse',
              icon: Users,
              show: can(PERMISSIONS.FOLIO_READ) || can(PERMISSIONS.RESERVATIONS_READ),
            },
            {
              id: 'fo-laundry',
              href: '/fo/laundry',
              labelKey: 'foLaundry',
              icon: Package,
              show: can(PERMISSIONS.FOLIO_CHARGE) || can(PERMISSIONS.HOUSEKEEPING_MANAGE),
            },
            {
              id: 'fo-room-changes',
              href: '/fo/room-changes',
              labelKey: 'roomChanges',
              icon: FileBarChart,
              show: can(PERMISSIONS.REPORTS_READ),
            },
            {
              id: 'fo-res-times',
              href: '/fo/reservation-times',
              labelKey: 'actualCheckTimes',
              icon: FileBarChart,
              show: can(PERMISSIONS.REPORTS_READ),
            },
            {
              id: 'fo-agency-inbox',
              href: '/fo/agency-inbox',
              labelKey: 'agencyInbox',
              icon: FileBarChart,
              show: can(PERMISSIONS.RESERVATIONS_WRITE),
            },
          ]),
        },
        {
          id: 'hotel_front_cash',
          title: t('sectionFrontCash'),
          icon: Banknote,
          items: sectionItems([
            {
              id: 'fc-pending',
              href: '/front-cash/pending',
              labelKey: 'pendingSettlement',
              icon: Banknote,
              show: can(PERMISSIONS.FOLIO_PAYMENT) || can(PERMISSIONS.FOLIO_VOID),
            },
            {
              id: 'fc-agency',
              href: '/front-cash/agency-ledger',
              labelKey: 'agencyLedger',
              icon: ClipboardList,
              show: can(PERMISSIONS.REPORTS_READ),
            },
            {
              id: 'fc-tx',
              href: '/front-cash/transactions',
              labelKey: 'cashTransactions',
              icon: Banknote,
              show: can(PERMISSIONS.FOLIO_PAYMENT) || can(PERMISSIONS.FOLIO_READ),
            },
          ]),
        },
        {
          id: 'hotel_night_audit',
          title: t('sectionNightAudit'),
          icon: Moon,
          items: sectionItems([
            {
              id: 'na-eod',
              href: '/night-audit',
              labelKey: 'endOfDay',
              icon: Moon,
              show: can(PERMISSIONS.NIGHT_AUDIT_RUN) || can(PERMISSIONS.RESERVATIONS_CANCEL),
            },
            {
              id: 'na-reports',
              href: '/night-audit/reports',
              labelKey: 'eodReports',
              icon: FileBarChart,
              show: can(PERMISSIONS.NIGHT_AUDIT_RUN) || can(PERMISSIONS.REPORTS_READ),
            },
            {
              id: 'na-logs',
              href: '/night-audit/logs',
              labelKey: 'endOfDayLogs',
              icon: FileBarChart,
              show: can(PERMISSIONS.NIGHT_AUDIT_RUN),
            },
            {
              id: 'na-res-updates',
              href: '/night-audit/reservation-updates',
              labelKey: 'reservationUpdates',
              icon: ClipboardList,
              show: can(PERMISSIONS.REPORTS_READ),
            },
            {
              id: 'na-year-end',
              href: '/night-audit/year-end',
              labelKey: 'endOfYear',
              icon: CalendarDays,
              show: can(PERMISSIONS.NIGHT_AUDIT_RUN),
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
              href: '/hk',
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
              href: '/hk/minibar',
              labelKey: 'minibarControl',
              icon: Package,
              show: can(PERMISSIONS.HOUSEKEEPING_MANAGE),
            },
            {
              id: 'hk-maids',
              href: '/hk/maids',
              labelKey: 'maidManagement',
              icon: Users,
              show: can(PERMISSIONS.HOUSEKEEPING_MANAGE),
            },
            {
              id: 'hk-roster',
              href: '/hk/roster',
              labelKey: 'hkRoster',
              icon: Users,
              show: can(PERMISSIONS.HOUSEKEEPING_MANAGE),
            },
            {
              id: 'hk-rotation',
              href: '/hk/rotation',
              labelKey: 'hkRotation',
              icon: Wrench,
              show: can(PERMISSIONS.HOUSEKEEPING_MANAGE),
            },
            {
              id: 'hk-laundry',
              href: '/hk/laundry',
              labelKey: 'hkLaundry',
              icon: Package,
              show: can(PERMISSIONS.HOUSEKEEPING_MANAGE),
            },
            {
              id: 'hk-forecast',
              href: '/hk/forecast',
              labelKey: 'hkForecast',
              icon: CalendarDays,
              show: can(PERMISSIONS.HOUSEKEEPING_MANAGE),
            },
            {
              id: 'hk-discrepancy',
              href: '/hk/discrepancy',
              labelKey: 'hkDiscrepancy',
              icon: ClipboardList,
              show: can(PERMISSIONS.HOUSEKEEPING_MANAGE),
            },
            {
              id: 'hk-ooo',
              href: '/hk/closed-rooms',
              labelKey: 'closedRoomList',
              icon: Wrench,
              show: can(PERMISSIONS.ROOMS_STATUS),
            },
            {
              id: 'hk-lost',
              href: '/hk/lost-and-found',
              labelKey: 'lostAndFound',
              icon: Package,
              show: can(PERMISSIONS.HOUSEKEEPING_MANAGE) || can(PERMISSIONS.ROOMS_STATUS),
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
          id: 'hotel_distribution',
          title: t('sectionDistribution'),
          icon: Radio,
          items: sectionItems([
            {
              id: 'dist-channel',
              href: '/distribution/channel',
              labelKey: 'channel',
              icon: Radio,
              show: can(PERMISSIONS.CHANNEL_MANAGE),
            },
            {
              id: 'dist-contracts',
              href: '/distribution/contracts',
              labelKey: 'salesContracts',
              icon: TrendingUp,
              show: can(PERMISSIONS.MASTER_DATA_MANAGE),
            },
            {
              id: 'dist-allotment-blocks',
              href: '/distribution/allotment-blocks',
              labelKey: 'allotmentBlocks',
              icon: TrendingUp,
              show: can(PERMISSIONS.MASTER_DATA_MANAGE),
            },
            {
              id: 'dist-promo',
              href: '/distribution/promotion-codes',
              labelKey: 'promotionCodes',
              icon: Settings,
              show: can(PERMISSIONS.MASTER_DATA_MANAGE),
            },
            {
              id: 'dist-agencies',
              href: '/distribution/travel-agencies',
              labelKey: 'travelAgencies',
              icon: Users,
              show: can(PERMISSIONS.MASTER_DATA_MANAGE),
            },
            {
              id: 'dist-child-matrix',
              href: '/distribution/child-matrix',
              labelKey: 'childMatrix',
              icon: Settings,
              show: can(PERMISSIONS.MASTER_DATA_MANAGE),
            },
            {
              id: 'dist-yield-rules',
              href: '/distribution/yield-rules',
              labelKey: 'yieldRules',
              icon: TrendingUp,
              show: can(PERMISSIONS.MASTER_DATA_MANAGE),
            },
          ]),
        },
        {
          id: 'hotel_service',
          title: t('sectionService'),
          icon: Wrench,
          items: sectionItems([
            {
              id: 'svc-ops',
              href: '/service',
              labelKey: 'serviceOps',
              icon: Wrench,
              show: can(PERMISSIONS.HOUSEKEEPING_MANAGE) || can(PERMISSIONS.ROOMS_STATUS),
            },
            {
              id: 'svc-guest',
              href: '/service/guest',
              labelKey: 'serviceGuestPortal',
              icon: Smartphone,
              show: can(PERMISSIONS.RESERVATIONS_READ),
            },
          ]),
        },
        {
          id: 'hotel_migration_pro',
          title: t('sectionMigration'),
          icon: FileText,
          items: sectionItems([
            {
              id: 'migration-queue',
              href: '/migration',
              labelKey: 'migrationQueue',
              icon: ClipboardList,
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
              id: 'tr-tours',
              href: '/tours',
              labelKey: 'tours',
              icon: Bus,
              show: can(PERMISSIONS.RESERVATIONS_WRITE),
            },
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
            {
              id: 'tr-fleet',
              href: '/fleet',
              labelKey: 'fleet',
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
          id: 'hotel_settings',
          title: t('sectionSettings'),
          icon: Settings,
          items: sectionItems([
            {
              id: 'set-master',
              href: '/settings/master-data',
              labelKey: 'masterData',
              icon: Building2,
              show: can(PERMISSIONS.MASTER_DATA_MANAGE),
            },
            {
              id: 'set-bar',
              href: '/settings/bar-calendar',
              labelKey: 'barCalendar',
              icon: Building2,
              show: can(PERMISSIONS.MASTER_DATA_MANAGE),
            },
            {
              id: 'set-pricing-policy',
              href: '/settings/pricing-policy',
              labelKey: 'pricingPolicy',
              icon: Banknote,
              show: can(PERMISSIONS.MASTER_DATA_MANAGE),
            },
            {
              id: 'set-hk-policy',
              href: '/settings/hk-policy',
              labelKey: 'hkPolicy',
              icon: Wrench,
              show: can(PERMISSIONS.HOUSEKEEPING_MANAGE) || can(PERMISSIONS.MASTER_DATA_MANAGE),
            },
            {
              id: 'set-pricing-components',
              href: '/settings/pricing-components',
              labelKey: 'pricingComponents',
              icon: Banknote,
              show: can(PERMISSIONS.MASTER_DATA_MANAGE),
            },
            {
              id: 'set-package-prices',
              href: '/settings/package-prices',
              labelKey: 'packagePrices',
              icon: Banknote,
              show: can(PERMISSIONS.MASTER_DATA_MANAGE),
            },
            {
              id: 'set-agency-medical-sku',
              href: '/settings/agency-medical-sku',
              labelKey: 'agencyMedicalSku',
              icon: Banknote,
              show: can(PERMISSIONS.MASTER_DATA_MANAGE),
            },
            {
              id: 'set-users',
              href: '/settings/users',
              labelKey: 'users',
              icon: Users,
              show: can(PERMISSIONS.USERS_MANAGE),
            },
            {
              id: 'set-int',
              href: '/settings/integration',
              labelKey: 'integration',
              icon: Link2,
              show: can(PERMISSIONS.MASTER_DATA_MANAGE),
            },
            {
              id: 'set-audit',
              href: '/settings/audit',
              labelKey: 'auditViewer',
              icon: ClipboardList,
              show: can(PERMISSIONS.REPORTS_READ),
            },
            {
              id: 'set-stock',
              href: '/settings/stock',
              labelKey: 'stock',
              icon: Package,
              show: can(PERMISSIONS.MASTER_DATA_MANAGE),
            },
            {
              id: 'set-import',
              href: '/settings/import',
              labelKey: 'elektrawebImport',
              icon: FileText,
              show: canRunElektrawebImport,
            },
          ]),
        },
        {
          id: 'hotel_reports',
          title: t('sectionReports'),
          icon: BarChart3,
          items: sectionItems([
            {
              id: 'rep-overview',
              href: '/reports',
              labelKey: 'reportsOverview',
              icon: BarChart3,
              show: can(PERMISSIONS.REPORTS_READ),
            },
            {
              id: 'rep-analysis',
              href: '/reports/analysis',
              labelKey: 'reportsAnalysis',
              icon: FileBarChart,
              show: can(PERMISSIONS.REPORTS_READ),
            },
            {
              id: 'rep-occ',
              href: '/reports/occupancy',
              labelKey: 'reportsOccupancy',
              icon: BedDouble,
              show: can(PERMISSIONS.REPORTS_READ),
            },
            {
              id: 'rep-daily',
              href: '/reports/daily',
              labelKey: 'reportsDaily',
              icon: CalendarDays,
              show: can(PERMISSIONS.REPORTS_READ),
            },
            {
              id: 'rep-financial',
              href: '/reports/financial',
              labelKey: 'reportsFinancial',
              icon: DollarSign,
              show: can(PERMISSIONS.REPORTS_READ),
            },
            {
              id: 'rep-agency',
              href: '/reports/agency',
              labelKey: 'reportsAgency',
              icon: Users,
              show: can(PERMISSIONS.REPORTS_READ),
            },
            {
              id: 'rep-booking',
              href: '/reports/booking',
              labelKey: 'reportsBooking',
              icon: BookOpen,
              show: can(PERMISSIONS.REPORTS_READ),
            },
            {
              id: 'rep-nightly-pack',
              href: '/reports/nightly-pack',
              labelKey: 'reportsNightlyPack',
              icon: Package,
              show: can(PERMISSIONS.REPORTS_READ),
            },
          ]),
        },
        {
          id: 'hotel_reports_other',
          title: t('reportsOther'),
          icon: FileText,
          items: sectionItems([
            {
              id: 'rep-other-invoices',
              href: '/reports/invoices',
              labelKey: 'reportsInvoices',
              icon: FileText,
              show: can(PERMISSIONS.REPORTS_READ),
            },
            {
              id: 'rep-other-recon',
              href: '/reports/reconciliation',
              labelKey: 'reportsReconciliation',
              icon: ClipboardList,
              show: can(PERMISSIONS.REPORTS_READ),
            },
            {
              id: 'rep-other-dedup',
              href: '/reports/guest-dedup',
              labelKey: 'guestDedup',
              icon: Users,
              show: can(PERMISSIONS.REPORTS_READ),
            },
            {
              id: 'rep-pos',
              href: posCalendarHref(),
              labelKey: 'posCalendar',
              icon: CalendarDays,
              external: true,
              show: can(PERMISSIONS.RESERVATIONS_READ),
            },
            {
              id: 'rep-retail',
              href: souvenirRetailHref(),
              labelKey: 'souvenirShop',
              icon: ShoppingBag,
              external: true,
              show: can(PERMISSIONS.RESERVATIONS_READ),
            },
          ]),
        },
      ].filter((section) => section.items.length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- can() identity stable enough per render
    [t, can, user?.role, isPlatformSuperAdmin, canRunElektrawebImport],
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
      {can(PERMISSIONS.RESERVATIONS_WRITE) ? (
        <>
          <button
            type="button"
            className={headerQuickLinkClass(openReservation && bookingModalOpen)}
            title={t('roomBooking')}
            aria-label={t('roomBooking')}
            onClick={() => {
              setBookingModalOpen(true);
              const params = new URLSearchParams(searchParams.toString());
              params.delete('openReservation');
              params.delete('newBooking');
              params.delete('groupBooking');
              const qs = params.toString();
              if (qs) router.replace(`${pathname}?${qs}`, { scroll: false });
            }}
          >
            <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>{t('roomBooking')}</span>
          </button>
          <button
            type="button"
            className={headerQuickLinkClass(groupModalOpen)}
            title={t('groupBooking')}
            aria-label={t('groupBooking')}
            onClick={() => {
              setGroupModalOpen(true);
              const params = new URLSearchParams(searchParams.toString());
              params.delete('openReservation');
              params.delete('newBooking');
              params.delete('groupBooking');
              const qs = params.toString();
              if (qs) router.replace(`${pathname}?${qs}`, { scroll: false });
            }}
          >
            <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>{t('groupBooking')}</span>
          </button>
        </>
      ) : null}
    </div>
  );

  const profileItems: HeaderProfileMenuItem[] = [
    { label: tHeader('settings', { defaultValue: 'Settings' }), href: '/settings/master-data' },
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
        <>
          <ReservationCardModal
            open={bookingModalOpen}
            onClose={() => setBookingModalOpen(false)}
          />
          <GroupBookingModal
            open={groupModalOpen}
            onClose={() => setGroupModalOpen(false)}
          />
        </>
      ) : null}
    </>
  );
}
