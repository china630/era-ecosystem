import { queryTrialBalancePeriod } from './trial-balance-period.service';
import { queryCashReport } from './cash-report.service';
import { queryFolioTransactions } from './folio-transactions.service';
import { queryDepartmentRevenues } from './department-revenues.service';
import { queryDailyManagement } from './daily-management.report';
import { queryMonthlyDailyAnalysis } from './monthly-daily-analysis.report';
import { queryInHouse } from './in-house.report';
import { queryAnnualOccupancy } from './annual-occupancy.report';
import {
  queryOccupancyGraph,
  queryOccupancyGraphDetail,
  queryForecastWoRev,
  queryForecastBoard,
  queryForecast,
  queryForecastCompare,
  queryBoardForecast,
  queryRoomTypeYoy,
} from './occupancy-p1.report';
import { querySales, queryDistribution, queryQuota, queryManagerView } from './analysis-p1.report';
import {
  queryDailyManagementSummary,
  queryMainCurrent,
  queryDateRangeManagement,
} from './daily-p1.report';
import {
  queryTrialBalance,
  queryDepartmentPayments,
  queryCumulativeRevenue,
  queryDeptCurrency,
  queryDiscounts,
  queryTransferredDiscounts,
  queryDeptPivot,
} from './financial-p1.report';
import {
  queryAgencyAnalysis,
  queryAgencyMonthly,
  queryAgencyRoomTypeOcc,
  queryAgencyMonthlyOcc,
  queryAgencyRoomTypeRev,
  queryAgencyNationalityRev,
  queryAgencyNationalityOcc,
  queryAgencyForecastMonth,
  querySegmentAnalysis,
  queryNationalityMonthlyOcc,
  queryNationalityMarketYoy,
  queryAgencyProfitability,
} from './agency-p1.report';
import {
  queryReservationSales,
  queryReservationsByCreate,
  queryCancelByCancel,
  queryCancelByCreate,
  queryDefiniteReservation,
  queryCrmReport,
  queryGuestDemographics,
} from './booking-p1.report';
import {
  queryRevenueCube,
  queryFolioCube,
  queryReservationCube,
  queryAgencySalesCube,
  type CubeDimension,
} from './cubes-p2.report';
import { queryThreeYearOcc, queryThreeYearRev } from './comparative-p2.report';

export type ReportQueryExtras = { dim?: string };

function asDim(value: string | undefined, fallback: CubeDimension): CubeDimension {
  const allowed: CubeDimension[] = ['date', 'department', 'agency', 'revenueCode', 'roomType'];
  if (value && (allowed as string[]).includes(value)) return value as CubeDimension;
  return fallback;
}

const QUERY_MAP: Record<string, (from: string, to: string, extras?: ReportQueryExtras) => Promise<unknown>> = {
  'trial-balance-period': queryTrialBalancePeriod,
  'cash-report': queryCashReport,
  'folio-transactions': queryFolioTransactions,
  'department-revenues': queryDepartmentRevenues,
  'daily-management': (from) => queryDailyManagement(new Date(from)),
  'in-house': (from) => queryInHouse(new Date(from)),
  'monthly-daily-analysis': (from, to) => queryMonthlyDailyAnalysis(new Date(from), new Date(to)),
  'annual-occupancy': (from, to) => queryAnnualOccupancy(new Date(from), new Date(to)),

  'occupancy-graph': (from, to) => queryOccupancyGraph(new Date(from), new Date(to)),
  'occupancy-graph-detail': (from, to) => queryOccupancyGraphDetail(new Date(from), new Date(to)),
  'forecast-wo-rev': (from, to) => queryForecastWoRev(new Date(from), new Date(to)),
  'forecast-board': (from, to) => queryForecastBoard(new Date(from), new Date(to)),
  'forecast': (from, to) => queryForecast(new Date(from), new Date(to)),
  'forecast-compare': (from, to) => queryForecastCompare(new Date(from), new Date(to)),
  'board-forecast': (from, to) => queryBoardForecast(new Date(from), new Date(to)),
  'room-type-yoy': (from, to) => queryRoomTypeYoy(new Date(from), new Date(to)),

  sales: (from, to) => querySales(new Date(from), new Date(to)),
  distribution: (from, to) => queryDistribution(new Date(from), new Date(to)),
  quota: (from, to) => queryQuota(new Date(from), new Date(to)),
  'manager-view': (from, to) => queryManagerView(new Date(from), new Date(to)),

  'daily-management-summary': (from) => queryDailyManagementSummary(new Date(from)),
  'main-current': (from) => queryMainCurrent(new Date(from)),
  'date-range-management': (from, to) => queryDateRangeManagement(new Date(from), new Date(to)),

  'trial-balance': (from) => queryTrialBalance(new Date(from)),
  'department-payments': (from) => queryDepartmentPayments(new Date(from)),
  'cumulative-revenue': (from, to) => queryCumulativeRevenue(new Date(from), new Date(to)),
  'dept-currency': (from) => queryDeptCurrency(new Date(from)),
  discounts: (from) => queryDiscounts(new Date(from)),
  'transferred-discounts': (from) => queryTransferredDiscounts(new Date(from)),
  'dept-pivot': (from) => queryDeptPivot(new Date(from)),

  'agency-analysis': (from, to) => queryAgencyAnalysis(new Date(from), new Date(to)),
  'agency-monthly': (from, to) => queryAgencyMonthly(new Date(from), new Date(to)),
  'agency-room-type-occ': (from, to) => queryAgencyRoomTypeOcc(new Date(from), new Date(to)),
  'agency-monthly-occ': (from, to) => queryAgencyMonthlyOcc(new Date(from), new Date(to)),
  'agency-room-type-rev': (from, to) => queryAgencyRoomTypeRev(new Date(from), new Date(to)),
  'agency-nationality-rev': (from, to) => queryAgencyNationalityRev(new Date(from), new Date(to)),
  'agency-nationality-occ': (from, to) => queryAgencyNationalityOcc(new Date(from), new Date(to)),
  'agency-forecast-month': (from, to) => queryAgencyForecastMonth(new Date(from), new Date(to)),
  'segment-analysis': (from, to) => querySegmentAnalysis(new Date(from), new Date(to)),
  'nationality-monthly-occ': (from, to) => queryNationalityMonthlyOcc(new Date(from), new Date(to)),
  'nationality-market-yoy': (from, to) => queryNationalityMarketYoy(new Date(from), new Date(to)),
  'agency-profitability': (from, to) => queryAgencyProfitability(new Date(from), new Date(to)),

  'reservation-sales': (from, to) => queryReservationSales(new Date(from), new Date(to)),
  'reservations-by-create': (from, to) => queryReservationsByCreate(new Date(from), new Date(to)),
  'cancel-by-cancel': (from, to) => queryCancelByCancel(new Date(from), new Date(to)),
  'cancel-by-create': (from, to) => queryCancelByCreate(new Date(from), new Date(to)),
  'definite-reservation': (from, to) => queryDefiniteReservation(new Date(from), new Date(to)),
  'crm-report': (from, to) => queryCrmReport(new Date(from), new Date(to)),
  'guest-demographics': (from, to) => queryGuestDemographics(new Date(from), new Date(to)),

  'revenue-cube': (from, to, extras) =>
    queryRevenueCube(new Date(from), new Date(to), asDim(extras?.dim, 'department')),
  'folio-cube': (from, to, extras) =>
    queryFolioCube(new Date(from), new Date(to), asDim(extras?.dim, 'department')),
  'reservation-cube': (from, to, extras) =>
    queryReservationCube(new Date(from), new Date(to), asDim(extras?.dim, 'roomType')),
  'agency-sales-cube': (from, to, extras) =>
    queryAgencySalesCube(new Date(from), new Date(to), asDim(extras?.dim, 'agency')),
  'three-year-occ': (from, to) => queryThreeYearOcc(new Date(from), new Date(to)),
  'three-year-rev': (from, to) => queryThreeYearRev(new Date(from), new Date(to)),
};

export function isImplementedReportSlug(slug: string): boolean {
  return slug in QUERY_MAP;
}

/** @deprecated use isImplementedReportSlug */
export const isP0ReportSlug = isImplementedReportSlug;

export function queryReport(
  slug: string,
  from: string,
  to: string,
  extras?: ReportQueryExtras,
): Promise<unknown> {
  const fn = QUERY_MAP[slug];
  if (!fn) throw new Error(`No query for slug: ${slug}`);
  return fn(from, to, extras);
}

export { queryTrialBalancePeriod } from './trial-balance-period.service';
export { queryCashReport } from './cash-report.service';
export { queryFolioTransactions } from './folio-transactions.service';
export { queryDepartmentRevenues } from './department-revenues.service';
export { queryDailyManagement } from './daily-management.report';
export { queryMonthlyDailyAnalysis } from './monthly-daily-analysis.report';
export { queryInHouse } from './in-house.report';
export { queryAnnualOccupancy } from './annual-occupancy.report';
