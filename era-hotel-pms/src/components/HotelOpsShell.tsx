'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import type { Locale } from '@era/i18n-common';
import {
  Activity,
  BarChart3,
  BedDouble,
  Building2,
  CalendarDays,
  Bus,
  Car,
  ClipboardList,
  FileBarChart,
  FileText,
  Trash2,
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
  useOpsNavProfile,
  visibleOpsNavSections,
  type EraOpsNavItem,
  type EraOpsNavSection,
  type HeaderProfileMenuItem,
  type OpsNavCondition,
  type OpsNavProfile,
} from '@era/satellite-kit/ui';
import { HotelHeaderTierBar } from '@/components/HotelHeaderTierBar';
import ReservationCardModal from '@/components/ReservationCardModal';
import GroupBookingModal from '@/components/GroupBookingModal';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { normalizeHotelPermission } from '@/lib/auth/hotel-permission-rename';

type NavDef = OpsNavCondition & {
  id: string;
  href?: string;
  labelKey: string;
  icon: LucideIcon;
  external?: boolean;
  children?: NavDef[];
};

type HotelNavItem = EraOpsNavItem & OpsNavCondition;
type HotelNavSection = Omit<EraOpsNavSection, 'items'> & { items: HotelNavItem[] };

/** Same rule as the hotel API: owner and platform super admin bypass; legacy keys read through the rename map. */
function allowHotel(permission: string, profile: OpsNavProfile): boolean {
  if (profile.isPlatformSuperAdmin || profile.isOwner) return true;
  const want = normalizeHotelPermission(permission) ?? permission;
  return profile.permissions.some((p) => (normalizeHotelPermission(p) ?? p) === want);
}

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
  const { profile, status: navStatus } = useOpsNavProfile();
  const canRunElektrawebImport = profile?.raw.canRunElektrawebImport === true;
  const isPlatformSuperAdmin = profile?.isPlatformSuperAdmin === true;
  const can = useCallback(
    (permission: string) =>
      navStatus === 'ready' && profile != null && allowHotel(permission, profile),
    [navStatus, profile],
  );
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

  function navHrefActive(href: string): boolean {
    const hash = href.indexOf('#');
    const bare = hash >= 0 ? href.slice(0, hash) : href;
    const qIndex = bare.indexOf('?');
    const path = qIndex >= 0 ? bare.slice(0, qIndex) : bare;
    const query = qIndex >= 0 ? bare.slice(qIndex + 1) : '';
    if (path === '/') return pathname === '/';
    // Parent items that have their own siblings under the same prefix.
    // `/night-audit` must not stay lit on `/night-audit/logs`.
    const exactOnly = path === '/reports' || path === '/night-audit';
    const pathOk = exactOnly ? pathname === path : pathname === path || pathname.startsWith(`${path}/`);
    if (!pathOk) return false;
    if (!query) {
      if (path === '/settings/integration') {
        const view = searchParams.get('view');
        return !view || view === 'events';
      }
      return true;
    }
    const want = new URLSearchParams(query);
    for (const [key, value] of want) {
      if (searchParams.get(key) !== value) return false;
    }
    return pathname === path;
  }

  function sectionItems(defs: NavDef[]): HotelNavItem[] {
    return defs.map(function mapDef({ labelKey, children, ...def }): HotelNavItem {
      return {
        ...def,
        label: t(labelKey as 'chessboard'),
        active: def.href ? navHrefActive(def.href) : undefined,
        children: children?.map((child) => mapDef(child)),
      };
    });
  }

  const navSections: HotelNavSection[] = useMemo(
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
              anyPermission: [PERMISSIONS.SCREEN_REPORTS, PERMISSIONS.SCREEN_FO],
            },
            {
              id: 'home-forecast',
              href: '/executive/forecast',
              label: t('forecast'),
              icon: TrendingUp,
              active: pathname.startsWith('/executive/forecast'),
              anyPermission: [PERMISSIONS.SCREEN_REPORTS, PERMISSIONS.SCREEN_FO],
            },
            {
              id: 'home-unit-econ',
              href: '/executive/unit-economics',
              label: t('unitEconomics'),
              icon: TrendingUp,
              active: pathname.startsWith('/executive/unit-economics'),
              anyPermission: [PERMISSIONS.SCREEN_SETTINGS, PERMISSIONS.SCREEN_FO],
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
              permission: PERMISSIONS.SCREEN_FO,
            },
            {
              id: 'fo-res-list',
              href: '/fo/reservations',
              labelKey: 'reservationList',
              icon: ClipboardList,
              permission: PERMISSIONS.SCREEN_FO,
            },
            {
              id: 'fo-plan',
              href: '/fo/room-plan',
              labelKey: 'roomPlan',
              icon: BedDouble,
              permission: PERMISSIONS.SCREEN_FO,
            },
            {
              id: 'fo-rack',
              href: '/fo/rack',
              labelKey: 'chessboard',
              icon: LayoutGrid,
              permission: PERMISSIONS.SCREEN_FO,
            },
            {
              id: 'fo-groups',
              href: '/fo/groups',
              labelKey: 'groupReservations',
              icon: ClipboardList,
              permission: PERMISSIONS.SCREEN_FO,
            },
            {
              id: 'fo-inhouse',
              href: '/fo/in-house',
              labelKey: 'inHouse',
              icon: Users,
              anyPermission: [PERMISSIONS.SCREEN_FOLIO, PERMISSIONS.SCREEN_FO],
            },
            {
              id: 'fo-laundry',
              href: '/fo/laundry',
              labelKey: 'foLaundry',
              icon: Package,
              anyPermission: [PERMISSIONS.FOLIO_CHARGE, PERMISSIONS.SCREEN_HK],
            },
            {
              id: 'fo-room-changes',
              href: '/fo/room-changes',
              labelKey: 'roomChanges',
              icon: FileBarChart,
              permission: PERMISSIONS.SCREEN_REPORTS,
            },
            {
              id: 'fo-res-times',
              href: '/fo/reservation-times',
              labelKey: 'actualCheckTimes',
              icon: FileBarChart,
              permission: PERMISSIONS.SCREEN_REPORTS,
            },
            {
              id: 'fo-agency-inbox',
              href: '/fo/agency-inbox',
              labelKey: 'agencyInbox',
              icon: FileBarChart,
              permission: PERMISSIONS.SCREEN_TOURS,
            },
          ]),
        },
        {
          id: 'hotel_front_cash',
          title: t('sectionFrontCash'),
          icon: Banknote,
          items: sectionItems([
            {
              id: 'fc-desk',
              href: '/front-cash/desk',
              labelKey: 'frontCashDesk',
              icon: Banknote,
              permission: PERMISSIONS.SCREEN_FRONT_CASH,
            },
            {
              id: 'fc-pending',
              href: '/front-cash/pending',
              labelKey: 'pendingSettlement',
              icon: Banknote,
              anyPermission: [PERMISSIONS.FOLIO_PAYMENT, PERMISSIONS.FOLIO_VOID],
            },
            {
              id: 'fc-balances',
              href: '/front-cash/folio-balances',
              labelKey: 'folioBalances',
              icon: ClipboardList,
              permission: PERMISSIONS.SCREEN_FOLIO,
            },
            {
              id: 'fc-journal',
              href: '/front-cash/folio-journal',
              labelKey: 'folioJournal',
              icon: FileBarChart,
              permission: PERMISSIONS.SCREEN_FOLIO,
            },
            {
              id: 'fc-agency',
              href: '/front-cash/agency-ledger',
              labelKey: 'agencyLedger',
              icon: ClipboardList,
              permission: PERMISSIONS.SCREEN_REPORTS,
            },
            {
              id: 'fc-company',
              href: '/front-cash/company-ledger',
              labelKey: 'companyLedger',
              icon: Building2,
              permission: PERMISSIONS.SCREEN_REPORTS,
            },
            {
              id: 'fc-tx',
              href: '/front-cash/transactions',
              labelKey: 'cashTransactions',
              icon: Banknote,
              anyPermission: [PERMISSIONS.FOLIO_PAYMENT, PERMISSIONS.SCREEN_FOLIO],
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
              anyPermission: [PERMISSIONS.SCREEN_NIGHT_AUDIT, PERMISSIONS.SCREEN_FO],
            },
            {
              id: 'na-reports',
              href: '/night-audit/reports',
              labelKey: 'eodReports',
              icon: FileBarChart,
              anyPermission: [PERMISSIONS.SCREEN_NIGHT_AUDIT, PERMISSIONS.SCREEN_REPORTS],
            },
            {
              id: 'na-logs',
              href: '/night-audit/logs',
              labelKey: 'endOfDayLogs',
              icon: FileBarChart,
              permission: PERMISSIONS.SCREEN_NIGHT_AUDIT,
            },
            {
              id: 'na-year-end',
              href: '/night-audit/year-end',
              labelKey: 'endOfYear',
              icon: CalendarDays,
              permission: PERMISSIONS.SCREEN_NIGHT_AUDIT,
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
              permission: PERMISSIONS.SCREEN_HK,
            },
            {
              id: 'hk-mobile',
              href: '/hk/mobile',
              labelKey: 'hkMobile',
              icon: Smartphone,
              permission: PERMISSIONS.SCREEN_HK,
            },
            {
              id: 'hk-minibar',
              href: '/hk/minibar',
              labelKey: 'minibarControl',
              icon: Package,
              permission: PERMISSIONS.SCREEN_HK,
            },
            {
              id: 'hk-stock',
              href: '/settings/stock',
              labelKey: 'minibarCatalog',
              icon: Package,
              permission: PERMISSIONS.SCREEN_SETTINGS,
            },
            {
              id: 'hk-maids',
              href: '/hk/maids',
              labelKey: 'maidManagement',
              icon: Users,
              permission: PERMISSIONS.SCREEN_HK,
            },
            {
              id: 'hk-roster',
              href: '/hk/roster',
              labelKey: 'hkRoster',
              icon: Users,
              permission: PERMISSIONS.SCREEN_HK,
            },
            {
              id: 'hk-rotation',
              href: '/hk/rotation',
              labelKey: 'hkRotation',
              icon: Wrench,
              permission: PERMISSIONS.SCREEN_HK,
            },
            {
              id: 'hk-laundry',
              href: '/hk/laundry',
              labelKey: 'hkLaundry',
              icon: Package,
              permission: PERMISSIONS.SCREEN_HK,
            },
            {
              id: 'hk-forecast',
              href: '/hk/forecast',
              labelKey: 'hkForecast',
              icon: CalendarDays,
              permission: PERMISSIONS.SCREEN_HK,
            },
            {
              id: 'hk-discrepancy',
              href: '/hk/discrepancy',
              labelKey: 'hkDiscrepancy',
              icon: ClipboardList,
              permission: PERMISSIONS.SCREEN_HK,
            },
            {
              id: 'hk-ooo',
              href: '/hk/closed-rooms',
              labelKey: 'closedRoomList',
              icon: Wrench,
              permission: PERMISSIONS.SCREEN_HK,
            },
            {
              id: 'hk-lost',
              href: '/hk/lost-and-found',
              labelKey: 'lostAndFound',
              icon: Package,
              permission: PERMISSIONS.SCREEN_HK,
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
              permission: PERMISSIONS.SCREEN_FO,
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
              permission: PERMISSIONS.SCREEN_DISTRIBUTION,
            },
            {
              id: 'dist-contracts',
              href: '/distribution/contracts',
              labelKey: 'salesContracts',
              icon: TrendingUp,
              permission: PERMISSIONS.SCREEN_SETTINGS,
            },
            {
              id: 'dist-allotment-blocks',
              href: '/distribution/allotment-blocks',
              labelKey: 'allotmentBlocks',
              icon: TrendingUp,
              permission: PERMISSIONS.SCREEN_SETTINGS,
            },
            {
              id: 'dist-promo',
              href: '/distribution/promotion-codes',
              labelKey: 'promotionCodes',
              icon: Settings,
              permission: PERMISSIONS.SCREEN_SETTINGS,
            },
            {
              id: 'dist-agencies',
              href: '/distribution/travel-agencies',
              labelKey: 'travelAgencies',
              icon: Users,
              permission: PERMISSIONS.SCREEN_SETTINGS,
            },
            {
              id: 'dist-companies',
              href: '/distribution/companies',
              labelKey: 'companies',
              icon: Building2,
              permission: PERMISSIONS.SCREEN_SETTINGS,
            },
          ]),
        },
        {
          id: 'hotel_rates_pricing',
          title: t('sectionRatesPricing'),
          icon: Banknote,
          items: sectionItems([
            {
              id: 'price-bar',
              href: '/settings/bar-calendar',
              labelKey: 'barCalendar',
              icon: CalendarDays,
              permission: PERMISSIONS.SCREEN_SETTINGS,
            },
            {
              id: 'price-policy',
              href: '/settings/policies#pricing',
              labelKey: 'pricingPolicy',
              icon: Banknote,
              permission: PERMISSIONS.SCREEN_SETTINGS,
            },
            {
              id: 'price-child-matrix',
              href: '/settings/child-matrix',
              labelKey: 'childMatrix',
              icon: Users,
              permission: PERMISSIONS.SCREEN_SETTINGS,
            },
            {
              id: 'price-yield-rules',
              href: '/settings/yield-rules',
              labelKey: 'yieldRules',
              icon: TrendingUp,
              permission: PERMISSIONS.SCREEN_SETTINGS,
            },
            {
              id: 'price-components',
              href: '/settings/pricing-components',
              labelKey: 'pricingComponents',
              icon: Banknote,
              permission: PERMISSIONS.SCREEN_SETTINGS,
            },
            {
              id: 'price-packages',
              href: '/settings/package-prices',
              labelKey: 'packagePrices',
              icon: Banknote,
              permission: PERMISSIONS.SCREEN_SETTINGS,
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
              permission: PERMISSIONS.SCREEN_HK,
            },
            {
              id: 'svc-guest',
              href: '/service/guest',
              labelKey: 'serviceGuestPortal',
              icon: Smartphone,
              permission: PERMISSIONS.SCREEN_FO,
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
              permission: PERMISSIONS.SCREEN_FO,
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
              permission: PERMISSIONS.SCREEN_MEDICAL,
            },
            {
              id: 'spa-list',
              href: '/spa/reservations',
              labelKey: 'spaReservationList',
              icon: Sparkles,
              permission: PERMISSIONS.SCREEN_MEDICAL,
            },
            {
              id: 'spa-staff',
              href: '/spa/staff-match',
              labelKey: 'serviceStaffMatch',
              icon: Users,
              permission: PERMISSIONS.SCREEN_MEDICAL,
            },
            {
              id: 'spa-rooms',
              href: '/spa/places',
              labelKey: 'placesAndRooms',
              icon: BedDouble,
              permission: PERMISSIONS.SCREEN_MEDICAL,
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
              permission: PERMISSIONS.SCREEN_TOURS,
            },
            {
              id: 'tr-main',
              href: '/transfers',
              labelKey: 'transfers',
              icon: Car,
              permission: PERMISSIONS.SCREEN_TOURS,
            },
            {
              id: 'tr-airport',
              href: '/transfers/airport',
              labelKey: 'airportTransfer',
              icon: Car,
              permission: PERMISSIONS.SCREEN_TOURS,
            },
            {
              id: 'tr-fleet',
              href: '/fleet',
              labelKey: 'fleet',
              icon: Car,
              permission: PERMISSIONS.SCREEN_TOURS,
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
              permission: PERMISSIONS.SCREEN_FO,
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
              permission: PERMISSIONS.SCREEN_MEDICAL,
            },
          ]),
        },
        {
          id: 'hotel_reports',
          title: t('sectionReports'),
          icon: BarChart3,
          items: sectionItems([
            {
              id: 'rep-workspace',
              href: '/reports',
              labelKey: 'reportsAll',
              icon: BarChart3,
              permission: PERMISSIONS.SCREEN_REPORTS,
            },
            {
              id: 'rep-nightly-pack',
              href: '/reports/nightly-pack',
              labelKey: 'reportsNightlyPack',
              icon: Package,
              permission: PERMISSIONS.SCREEN_REPORTS,
            },
            {
              id: 'rep-occ-grid',
              href: '/reports/occupancy/grid',
              labelKey: 'reportsOccupancyGrid',
              icon: BarChart3,
              permission: PERMISSIONS.SCREEN_REPORTS,
            },
            {
              id: 'rep-analytics',
              href: '/reports/analytics',
              labelKey: 'analytics',
              icon: BarChart3,
              permission: PERMISSIONS.SCREEN_REPORTS,
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
              permission: PERMISSIONS.SCREEN_REPORTS,
            },
            {
              id: 'rep-other-recon',
              href: '/reports/reconciliation',
              labelKey: 'reportsReconciliation',
              icon: ClipboardList,
              permission: PERMISSIONS.SCREEN_REPORTS,
            },
            {
              id: 'rep-other-dedup',
              href: '/reports/guest-dedup',
              labelKey: 'guestDedup',
              icon: Users,
              permission: PERMISSIONS.SCREEN_REPORTS,
            },
            {
              id: 'rep-pos',
              href: posCalendarHref(),
              labelKey: 'posCalendar',
              icon: CalendarDays,
              external: true,
              permission: PERMISSIONS.SCREEN_FO,
            },
            {
              id: 'rep-retail',
              href: souvenirRetailHref(),
              labelKey: 'souvenirShop',
              icon: ShoppingBag,
              external: true,
              permission: PERMISSIONS.SCREEN_FO,
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
              permission: PERMISSIONS.SCREEN_SETTINGS,
            },
            {
              id: 'set-policies',
              href: '/settings/policies',
              labelKey: 'policies',
              icon: Wrench,
              anyPermission: [PERMISSIONS.SCREEN_HK, PERMISSIONS.SCREEN_SETTINGS],
            },
            {
              id: 'set-accounts',
              labelKey: 'accounts',
              icon: Users,
              anyPermission: [
                PERMISSIONS.SCREEN_SETTINGS_USERS,
                PERMISSIONS.SCREEN_SETTINGS_ACCESS,
              ],
              children: [
                {
                  id: 'set-users',
                  href: '/settings/users',
                  labelKey: 'users',
                  icon: Users,
                  permission: PERMISSIONS.SCREEN_SETTINGS_USERS,
                },
                {
                  id: 'set-access',
                  href: '/settings/access',
                  labelKey: 'access',
                  icon: Users,
                  permission: PERMISSIONS.SCREEN_SETTINGS_ACCESS,
                },
                {
                  id: 'set-logins',
                  href: '/settings/logins',
                  labelKey: 'logins',
                  icon: ClipboardList,
                  permission: PERMISSIONS.SCREEN_SETTINGS_USERS,
                },
              ],
            },
            {
              id: 'set-int',
              href: '/settings/integration',
              labelKey: 'integrationEvents',
              icon: Link2,
              permission: PERMISSIONS.SCREEN_SETTINGS,
            },
            {
              id: 'set-int-gl',
              href: '/settings/integration?view=gl',
              labelKey: 'integrationGl',
              icon: Link2,
              permission: PERMISSIONS.SCREEN_SETTINGS,
            },
            {
              id: 'set-int-journal',
              href: '/settings/integration?view=journal',
              labelKey: 'integrationJournal',
              icon: Link2,
              permission: PERMISSIONS.SCREEN_SETTINGS,
            },
            {
              id: 'set-audit',
              href: '/settings/audit',
              labelKey: 'auditViewer',
              icon: ClipboardList,
              permission: PERMISSIONS.SCREEN_REPORTS,
            },
            {
              id: 'set-import',
              href: '/settings/import',
              labelKey: 'elektrawebImport',
              icon: FileText,
              permission: PERMISSIONS.API_IMPORT_ELEKTRAWEB,
              when: canRunElektrawebImport,
            },
            {
              id: 'set-ops-wipe',
              href: '/settings/ops-wipe',
              labelKey: 'opsWipe',
              icon: Trash2,
              permission: PERMISSIONS.SCREEN_SETTINGS,
              when: isPlatformSuperAdmin,
            },
          ]),
        },
      ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t identity stable enough per render
    [t, pathname, searchParams, canRunElektrawebImport, isPlatformSuperAdmin],
  );
  const visibleSections = useMemo(
    () => visibleOpsNavSections(navSections, navStatus, profile, allowHotel),
    [navSections, navStatus, profile],
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

  const organizationName = profile?.organizationName ?? null;

  const resolveActive = useCallback((currentPath: string, href: string) => {
    if (href === '/') return currentPath === '/';
    const hrefs = visibleSections.flatMap((section) =>
      section.items.map((item) => item.href).filter((value): value is string => Boolean(value)),
    );
    const matches = hrefs.filter((value) => currentPath === value || currentPath.startsWith(`${value}/`));
    const best = [...matches].sort((a, b) => b.length - a.length)[0];
    return best === href;
  }, [visibleSections]);

  return (
    <>
      <EraAppRouteShell
        brandTitle={tMeta('title')}
        navSections={visibleSections}
        resolveActive={resolveActive}
        headerLeft={headerLeft}
        profile={
        profile ? (
          <HeaderProfileMenu
            displayName={profile.displayName}
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
