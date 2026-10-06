import { yearStartYmd, ymdParam } from '@/lib/reports/civil-days';
import { queryOccupancySeries, type OccupancySeries } from './monthly-daily-analysis.report';

/** Year to the closed day; the layout turns the day series into a day × month matrix. */
export function queryAnnualOccupancy(yearStart: Date | string, businessDate: Date | string): Promise<OccupancySeries> {
  const to = ymdParam(businessDate);
  const from = ymdParam(yearStart);
  return queryOccupancySeries(from.slice(0, 4) === to.slice(0, 4) ? from : yearStartYmd(to), to);
}
