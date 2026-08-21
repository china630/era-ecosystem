export type ReportDateMode = 'business_date' | 'month_to_closed' | 'year_to_closed' | 'range';
export type ReportCategory = 'analysis' | 'occupancy' | 'daily' | 'financial' | 'agency' | 'booking';
export type ReportPhase = 'P0' | 'P1' | 'P2';
export type ReportDelivery = 'SCREEN' | 'PDF' | 'BOTH';

export interface ReportDef {
  slug: string;
  category: ReportCategory;
  titleKey: string;
  dateMode: ReportDateMode;
  phase: ReportPhase;
  delivery: ReportDelivery;
  packDefault: boolean;
  packOrder?: number;
  landscape?: boolean;
}

export const REPORT_CATALOG: ReportDef[] = [
  // ── P0 nightly pack ──
  { slug: 'daily-management',       category: 'daily',     titleKey: 'reportsPdf.dailyManagement',      dateMode: 'business_date',   phase: 'P0', delivery: 'BOTH', packDefault: true,  packOrder: 1 },
  { slug: 'trial-balance-period',   category: 'financial', titleKey: 'reportsPdf.trialBalancePeriod',    dateMode: 'business_date',   phase: 'P0', delivery: 'BOTH', packDefault: true,  packOrder: 2 },
  { slug: 'cash-report',            category: 'financial', titleKey: 'reportsPdf.cashReport',            dateMode: 'business_date',   phase: 'P0', delivery: 'BOTH', packDefault: true,  packOrder: 3 },
  { slug: 'monthly-daily-analysis', category: 'occupancy', titleKey: 'reportsPdf.monthlyDailyAnalysis',  dateMode: 'month_to_closed', phase: 'P0', delivery: 'BOTH', packDefault: true,  packOrder: 4 },
  { slug: 'in-house',               category: 'daily',     titleKey: 'reportsPdf.inHouse',              dateMode: 'business_date',   phase: 'P0', delivery: 'BOTH', packDefault: true,  packOrder: 5 },
  { slug: 'annual-occupancy',       category: 'occupancy', titleKey: 'reportsPdf.annualOccupancy',      dateMode: 'year_to_closed',  phase: 'P0', delivery: 'BOTH', packDefault: true,  packOrder: 6 },
  { slug: 'folio-transactions',     category: 'financial', titleKey: 'reportsPdf.folioTransactions',    dateMode: 'business_date',   phase: 'P0', delivery: 'BOTH', packDefault: true,  packOrder: 7 },
  { slug: 'department-revenues',    category: 'financial', titleKey: 'reportsPdf.departmentRevenues',   dateMode: 'business_date',   phase: 'P0', delivery: 'BOTH', packDefault: true,  packOrder: 8 },

  // ── P1 analysis / occupancy ──
  { slug: 'occupancy-graph',          category: 'occupancy', titleKey: 'reportsPdf.occupancyGraph',          dateMode: 'range',           phase: 'P1', delivery: 'BOTH', packDefault: false },
  { slug: 'occupancy-graph-detail',   category: 'occupancy', titleKey: 'reportsPdf.occupancyGraphDetail',    dateMode: 'range',           phase: 'P1', delivery: 'BOTH', packDefault: false },
  { slug: 'forecast-wo-rev',          category: 'occupancy', titleKey: 'reportsPdf.forecastWoRev',            dateMode: 'range',           phase: 'P1', delivery: 'BOTH', packDefault: false },
  { slug: 'forecast-board',           category: 'occupancy', titleKey: 'reportsPdf.forecastBoard',            dateMode: 'range',           phase: 'P1', delivery: 'BOTH', packDefault: false },
  { slug: 'forecast',                 category: 'occupancy', titleKey: 'reportsPdf.forecast',                 dateMode: 'range',           phase: 'P1', delivery: 'BOTH', packDefault: false },
  { slug: 'forecast-compare',         category: 'occupancy', titleKey: 'reportsPdf.forecastCompare',          dateMode: 'range',           phase: 'P1', delivery: 'BOTH', packDefault: false },
  { slug: 'board-forecast',           category: 'occupancy', titleKey: 'reportsPdf.boardForecast',            dateMode: 'range',           phase: 'P1', delivery: 'BOTH', packDefault: false },
  { slug: 'room-type-yoy',            category: 'occupancy', titleKey: 'reportsPdf.roomTypeYoy',              dateMode: 'range',           phase: 'P1', delivery: 'BOTH', packDefault: false },

  // ── P1 analysis screens ──
  { slug: 'sales',                    category: 'analysis',  titleKey: 'reportsPdf.sales',                    dateMode: 'range',           phase: 'P1', delivery: 'SCREEN', packDefault: false },
  { slug: 'distribution',             category: 'analysis',  titleKey: 'reportsPdf.distribution',             dateMode: 'range',           phase: 'P1', delivery: 'SCREEN', packDefault: false },
  { slug: 'quota',                    category: 'analysis',  titleKey: 'reportsPdf.quota',                    dateMode: 'range',           phase: 'P1', delivery: 'SCREEN', packDefault: false },
  { slug: 'manager-view',             category: 'analysis',  titleKey: 'reportsPdf.managerView',              dateMode: 'range',           phase: 'P1', delivery: 'SCREEN', packDefault: false },

  // ── P1 daily ──
  { slug: 'daily-management-summary', category: 'daily',     titleKey: 'reportsPdf.dailyManagementSummary',   dateMode: 'business_date',   phase: 'P1', delivery: 'BOTH', packDefault: false },
  { slug: 'main-current',             category: 'daily',     titleKey: 'reportsPdf.mainCurrent',              dateMode: 'business_date',   phase: 'P1', delivery: 'BOTH', packDefault: false },
  { slug: 'date-range-management',    category: 'daily',     titleKey: 'reportsPdf.dateRangeManagement',      dateMode: 'range',           phase: 'P1', delivery: 'BOTH', packDefault: false },

  // ── P1 financial ──
  { slug: 'trial-balance',            category: 'financial', titleKey: 'reportsPdf.trialBalance',             dateMode: 'business_date',   phase: 'P1', delivery: 'BOTH', packDefault: false },
  { slug: 'department-payments',      category: 'financial', titleKey: 'reportsPdf.departmentPayments',       dateMode: 'business_date',   phase: 'P1', delivery: 'BOTH', packDefault: false },
  { slug: 'cumulative-revenue',       category: 'financial', titleKey: 'reportsPdf.cumulativeRevenue',        dateMode: 'range',           phase: 'P1', delivery: 'BOTH', packDefault: false },
  { slug: 'dept-currency',            category: 'financial', titleKey: 'reportsPdf.deptCurrency',             dateMode: 'business_date',   phase: 'P1', delivery: 'BOTH', packDefault: false },
  { slug: 'discounts',                category: 'financial', titleKey: 'reportsPdf.discounts',                dateMode: 'business_date',   phase: 'P1', delivery: 'BOTH', packDefault: false },
  { slug: 'transferred-discounts',    category: 'financial', titleKey: 'reportsPdf.transferredDiscounts',     dateMode: 'business_date',   phase: 'P1', delivery: 'BOTH', packDefault: false },
  { slug: 'dept-pivot',               category: 'financial', titleKey: 'reportsPdf.deptPivot',                dateMode: 'business_date',   phase: 'P1', delivery: 'BOTH', packDefault: false },

  // ── P1 agency ──
  { slug: 'agency-analysis',          category: 'agency',    titleKey: 'reportsPdf.agencyAnalysis',           dateMode: 'range',           phase: 'P1', delivery: 'BOTH', packDefault: false },
  { slug: 'agency-monthly',           category: 'agency',    titleKey: 'reportsPdf.agencyMonthly',            dateMode: 'month_to_closed', phase: 'P1', delivery: 'BOTH', packDefault: false },
  { slug: 'agency-room-type-occ',     category: 'agency',    titleKey: 'reportsPdf.agencyRoomTypeOcc',        dateMode: 'month_to_closed', phase: 'P1', delivery: 'BOTH', packDefault: false },
  { slug: 'agency-monthly-occ',       category: 'agency',    titleKey: 'reportsPdf.agencyMonthlyOcc',         dateMode: 'month_to_closed', phase: 'P1', delivery: 'BOTH', packDefault: false },
  { slug: 'agency-room-type-rev',     category: 'agency',    titleKey: 'reportsPdf.agencyRoomTypeRev',        dateMode: 'range',           phase: 'P1', delivery: 'BOTH', packDefault: false },
  { slug: 'agency-nationality-rev',   category: 'agency',    titleKey: 'reportsPdf.agencyNationalityRev',     dateMode: 'range',           phase: 'P1', delivery: 'BOTH', packDefault: false },
  { slug: 'agency-nationality-occ',   category: 'agency',    titleKey: 'reportsPdf.agencyNationalityOcc',     dateMode: 'month_to_closed', phase: 'P1', delivery: 'BOTH', packDefault: false },
  { slug: 'agency-forecast-month',    category: 'agency',    titleKey: 'reportsPdf.agencyForecastMonth',      dateMode: 'range',           phase: 'P1', delivery: 'BOTH', packDefault: false },
  { slug: 'segment-analysis',         category: 'agency',    titleKey: 'reportsPdf.segmentAnalysis',          dateMode: 'range',           phase: 'P1', delivery: 'BOTH', packDefault: false },
  { slug: 'nationality-monthly-occ',  category: 'agency',    titleKey: 'reportsPdf.nationalityMonthlyOcc',    dateMode: 'month_to_closed', phase: 'P1', delivery: 'BOTH', packDefault: false },
  { slug: 'nationality-market-yoy',   category: 'agency',    titleKey: 'reportsPdf.nationalityMarketYoy',     dateMode: 'range',           phase: 'P1', delivery: 'BOTH', packDefault: false },
  { slug: 'agency-profitability',     category: 'agency',    titleKey: 'reportsPdf.agencyProfitability',      dateMode: 'range',           phase: 'P1', delivery: 'SCREEN', packDefault: false },

  // ── P1 booking ──
  { slug: 'reservation-sales',        category: 'booking',   titleKey: 'reportsPdf.reservationSales',         dateMode: 'range',           phase: 'P1', delivery: 'BOTH', packDefault: false },
  { slug: 'reservations-by-create',   category: 'booking',   titleKey: 'reportsPdf.reservationsByCreate',     dateMode: 'range',           phase: 'P1', delivery: 'BOTH', packDefault: false },
  { slug: 'cancel-by-cancel',         category: 'booking',   titleKey: 'reportsPdf.cancelByCancel',           dateMode: 'range',           phase: 'P1', delivery: 'BOTH', packDefault: false },
  { slug: 'cancel-by-create',         category: 'booking',   titleKey: 'reportsPdf.cancelByCreate',           dateMode: 'range',           phase: 'P1', delivery: 'BOTH', packDefault: false },
  { slug: 'definite-reservation',     category: 'booking',   titleKey: 'reportsPdf.definiteReservation',      dateMode: 'range',           phase: 'P1', delivery: 'BOTH', packDefault: false },
  { slug: 'crm-report',               category: 'booking',   titleKey: 'reportsPdf.crmReport',                dateMode: 'range',           phase: 'P1', delivery: 'BOTH', packDefault: false },
  { slug: 'guest-demographics',       category: 'booking',   titleKey: 'reportsPdf.guestDemographics',        dateMode: 'range',           phase: 'P1', delivery: 'SCREEN', packDefault: false },

  // ── P2 cubes / comparative ──
  { slug: 'three-year-occ',           category: 'occupancy', titleKey: 'reportsPdf.threeYearOcc',             dateMode: 'range',           phase: 'P2', delivery: 'BOTH', packDefault: false },
  { slug: 'three-year-rev',           category: 'financial', titleKey: 'reportsPdf.threeYearRev',             dateMode: 'range',           phase: 'P2', delivery: 'BOTH', packDefault: false },
  { slug: 'revenue-cube',             category: 'analysis',  titleKey: 'reportsPdf.revenueCube',              dateMode: 'range',           phase: 'P2', delivery: 'SCREEN', packDefault: false },
  { slug: 'reservation-cube',         category: 'analysis',  titleKey: 'reportsPdf.reservationCube',          dateMode: 'range',           phase: 'P2', delivery: 'SCREEN', packDefault: false },
  { slug: 'folio-cube',               category: 'analysis',  titleKey: 'reportsPdf.folioCube',                dateMode: 'range',           phase: 'P2', delivery: 'SCREEN', packDefault: false },
  { slug: 'agency-sales-cube',        category: 'analysis',  titleKey: 'reportsPdf.agencySalesCube',          dateMode: 'range',           phase: 'P2', delivery: 'SCREEN', packDefault: false },
];

export function getReportBySlug(slug: string): ReportDef | undefined {
  return REPORT_CATALOG.find((r) => r.slug === slug);
}

export function getPackDefaults(): ReportDef[] {
  return REPORT_CATALOG
    .filter((r) => r.packDefault)
    .sort((a, b) => (a.packOrder ?? 99) - (b.packOrder ?? 99));
}

export interface PackEligibleReport {
  id: string;
  titleKey: string;
}

export function getPackEligibleReports(): PackEligibleReport[] {
  // Current pack settings UI toggles the default-enabled P0 set.
  return getPackDefaults().map((r) => ({ id: r.slug, titleKey: r.titleKey }));
}

export function validatePackSlugs(slugs: string[]): { ok: true; slugs: string[] } | { ok: false; message: string } {
  if (!Array.isArray(slugs) || slugs.length === 0) {
    return { ok: false, message: 'ZIP pack has no enabled members' };
  }
  const unknown = slugs.filter((s) => !getReportBySlug(s));
  if (unknown.length > 0) {
    return { ok: false, message: `Unknown pack slug: ${unknown[0]}` };
  }
  return { ok: true, slugs };
}

export function reportHref(def: ReportDef): string {
  if (def.slug === 'daily-management') return '/reports/daily/management';
  if (def.slug === 'agency-profitability') return '/reports/agency-profitability';
  if (def.slug.endsWith('-cube')) return `/reports/analysis/cubes?cube=${def.slug}`;
  return `/reports/${def.category}/${def.slug}`;
}

export function getReportsByCategory(category: ReportCategory): Array<ReportDef & { id: string; href: string }> {
  return REPORT_CATALOG.filter((r) => r.category === category).map((r) => ({
    ...r,
    id: r.slug,
    href: reportHref(r),
  }));
}
