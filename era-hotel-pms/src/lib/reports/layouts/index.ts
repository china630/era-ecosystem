import type { ReportLayout } from '../layout';
import type { LayoutCtx } from './common';
import { buildFlashLayout } from './flash';
import {
  buildCashReportLayout,
  buildCumulativeRevenueLayout,
  buildDepartmentPaymentsLayout,
  buildDepartmentRevenuesLayout,
  buildDeptCurrencyLayout,
  buildDeptPivotLayout,
  buildDiscountsLayout,
  buildFolioTransactionsLayout,
  buildTransferredDiscountsLayout,
  buildTrialBalanceLayout,
} from './financial';
import {
  buildAnnualOccupancyLayout,
  buildForecastBoardLayout,
  buildForecastCompareLayout,
  buildForecastLayout,
  buildForecastWoRevLayout,
  buildMonthlyDailyLayout,
  buildOccupancyGraphDetailLayout,
  buildOccupancyGraphLayout,
  buildRoomTypeYoyLayout,
  buildThreeYearOccLayout,
  buildThreeYearRevLayout,
} from './occupancy';
import { buildInHouseLayout, buildMainCurrentLayout } from './guests';
import {
  buildAgencyAnalysisLayout,
  buildAgencyForecastMonthLayout,
  buildAgencyMonthlyLayout,
  buildAgencyMonthlyOccLayout,
  buildAgencyNationalityOccLayout,
  buildAgencyNationalityRevLayout,
  buildAgencyProfitabilityLayout,
  buildAgencyRoomTypeOccLayout,
  buildAgencyRoomTypeRevLayout,
  buildCancelByCancelLayout,
  buildCancelByCreateLayout,
  buildCrmReportLayout,
  buildCubeLayout,
  buildDefiniteReservationLayout,
  buildDistributionLayout,
  buildGuestDemographicsLayout,
  buildManagerViewLayout,
  buildNationalityMarketYoyLayout,
  buildNationalityMonthlyOccLayout,
  buildQuotaLayout,
  buildReservationSalesLayout,
  buildReservationsByCreateLayout,
  buildSalesLayout,
  buildSegmentAnalysisLayout,
} from './commercial';

export type { LayoutCtx } from './common';

type Builder = (slug: string, data: never, ctx: LayoutCtx) => ReportLayout;

/** One builder per catalog slug, grouped by Elektra table family. */
export const REPORT_LAYOUT_BUILDERS: Record<string, Builder> = {
  // Flash: KPI per period, revenue Net/VAT/Total, payments
  'daily-management': buildFlashLayout,
  'daily-management-summary': buildFlashLayout,
  'date-range-management': buildFlashLayout,
  // Ledger / financial
  'trial-balance-period': buildTrialBalanceLayout,
  'trial-balance': buildTrialBalanceLayout,
  'cash-report': buildCashReportLayout,
  'folio-transactions': buildFolioTransactionsLayout,
  'department-revenues': buildDepartmentRevenuesLayout,
  'department-payments': buildDepartmentPaymentsLayout,
  'cumulative-revenue': buildCumulativeRevenueLayout,
  'dept-currency': buildDeptCurrencyLayout,
  discounts: buildDiscountsLayout,
  'transferred-discounts': buildTransferredDiscountsLayout,
  'dept-pivot': buildDeptPivotLayout,
  // Day series / matrices
  'monthly-daily-analysis': buildMonthlyDailyLayout,
  'annual-occupancy': buildAnnualOccupancyLayout,
  'occupancy-graph': buildOccupancyGraphLayout,
  'occupancy-graph-detail': buildOccupancyGraphDetailLayout,
  'forecast-wo-rev': buildForecastWoRevLayout,
  'forecast-board': buildForecastBoardLayout,
  'board-forecast': buildForecastBoardLayout,
  forecast: buildForecastLayout,
  'forecast-compare': buildForecastCompareLayout,
  'room-type-yoy': buildRoomTypeYoyLayout,
  'three-year-occ': buildThreeYearOccLayout,
  'three-year-rev': buildThreeYearRevLayout,
  // Guest lists
  'in-house': buildInHouseLayout,
  'main-current': buildMainCurrentLayout,
  // Analysis
  sales: buildSalesLayout,
  distribution: buildDistributionLayout,
  quota: buildQuotaLayout,
  'manager-view': buildManagerViewLayout,
  // Agency / market
  'agency-analysis': buildAgencyAnalysisLayout,
  'agency-monthly': buildAgencyMonthlyLayout,
  'agency-room-type-occ': buildAgencyRoomTypeOccLayout,
  'agency-monthly-occ': buildAgencyMonthlyOccLayout,
  'agency-room-type-rev': buildAgencyRoomTypeRevLayout,
  'agency-nationality-rev': buildAgencyNationalityRevLayout,
  'agency-nationality-occ': buildAgencyNationalityOccLayout,
  'agency-forecast-month': buildAgencyForecastMonthLayout,
  'segment-analysis': buildSegmentAnalysisLayout,
  'nationality-monthly-occ': buildNationalityMonthlyOccLayout,
  'nationality-market-yoy': buildNationalityMarketYoyLayout,
  'agency-profitability': buildAgencyProfitabilityLayout,
  // Booking
  'reservation-sales': buildReservationSalesLayout,
  'reservations-by-create': buildReservationsByCreateLayout,
  'cancel-by-cancel': buildCancelByCancelLayout,
  'cancel-by-create': buildCancelByCreateLayout,
  'definite-reservation': buildDefiniteReservationLayout,
  'crm-report': buildCrmReportLayout,
  'guest-demographics': buildGuestDemographicsLayout,
  // Cubes
  'revenue-cube': buildCubeLayout,
  'reservation-cube': buildCubeLayout,
  'folio-cube': buildCubeLayout,
  'agency-sales-cube': buildCubeLayout,
};

export function hasReportLayout(slug: string): boolean {
  return slug in REPORT_LAYOUT_BUILDERS;
}

export function buildReportLayout(slug: string, data: unknown, ctx: LayoutCtx): ReportLayout {
  const builder = REPORT_LAYOUT_BUILDERS[slug];
  if (!builder) throw new Error(`No report layout for slug: ${slug}`);
  return builder(slug, data as never, ctx);
}
