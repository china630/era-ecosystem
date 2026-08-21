import { registerPdfRenderer } from './pdf-renderers';
import {
  renderOccupancyGraphPdf,
  renderOccupancyGraphDetailPdf,
  renderForecastWoRevPdf,
  renderForecastBoardPdf,
  renderForecastPdf,
  renderForecastComparePdf,
  renderRoomTypeYoyPdf,
} from './pdf-renderers-p1-occupancy';
import {
  renderDailyManagementSummaryPdf,
  renderMainCurrentPdf,
  renderDateRangeManagementPdf,
} from './pdf-renderers-p1-daily';
import {
  renderTrialBalancePdf,
  renderDepartmentPaymentsPdf,
  renderCumulativeRevenuePdf,
  renderDeptCurrencyPdf,
  renderDiscountsPdf,
  renderTransferredDiscountsPdf,
  renderDeptPivotPdf,
} from './pdf-renderers-p1-financial';
import {
  renderAgencyAnalysisPdf,
  renderAgencyMonthlyPdf,
  renderAgencyRoomTypeOccPdf,
  renderAgencyMonthlyOccPdf,
  renderAgencyRoomTypeRevPdf,
  renderAgencyNationalityRevPdf,
  renderAgencyNationalityOccPdf,
  renderAgencyForecastMonthPdf,
  renderSegmentAnalysisPdf,
  renderNationalityMonthlyOccPdf,
  renderNationalityMarketYoyPdf,
} from './pdf-renderers-p1-agency';
import {
  renderReservationSalesPdf,
  renderReservationsByCreatePdf,
  renderCancelByCancelPdf,
  renderCancelByCreatePdf,
  renderDefiniteReservationPdf,
  renderCrmReportPdf,
} from './pdf-renderers-p1-booking';

registerPdfRenderer('occupancy-graph', renderOccupancyGraphPdf as never);
registerPdfRenderer('occupancy-graph-detail', renderOccupancyGraphDetailPdf as never);
registerPdfRenderer('forecast-wo-rev', renderForecastWoRevPdf as never);
registerPdfRenderer('forecast-board', renderForecastBoardPdf as never);
registerPdfRenderer('forecast', renderForecastPdf as never);
registerPdfRenderer('forecast-compare', renderForecastComparePdf as never);
registerPdfRenderer('board-forecast', renderForecastBoardPdf as never);
registerPdfRenderer('room-type-yoy', renderRoomTypeYoyPdf as never);

registerPdfRenderer('daily-management-summary', renderDailyManagementSummaryPdf as never);
registerPdfRenderer('main-current', renderMainCurrentPdf as never);
registerPdfRenderer('date-range-management', renderDateRangeManagementPdf as never);

registerPdfRenderer('trial-balance', renderTrialBalancePdf as never);
registerPdfRenderer('department-payments', renderDepartmentPaymentsPdf as never);
registerPdfRenderer('cumulative-revenue', renderCumulativeRevenuePdf as never);
registerPdfRenderer('dept-currency', renderDeptCurrencyPdf as never);
registerPdfRenderer('discounts', renderDiscountsPdf as never);
registerPdfRenderer('transferred-discounts', renderTransferredDiscountsPdf as never);
registerPdfRenderer('dept-pivot', renderDeptPivotPdf as never);

registerPdfRenderer('agency-analysis', renderAgencyAnalysisPdf as never);
registerPdfRenderer('agency-monthly', renderAgencyMonthlyPdf as never);
registerPdfRenderer('agency-room-type-occ', renderAgencyRoomTypeOccPdf as never);
registerPdfRenderer('agency-monthly-occ', renderAgencyMonthlyOccPdf as never);
registerPdfRenderer('agency-room-type-rev', renderAgencyRoomTypeRevPdf as never);
registerPdfRenderer('agency-nationality-rev', renderAgencyNationalityRevPdf as never);
registerPdfRenderer('agency-nationality-occ', renderAgencyNationalityOccPdf as never);
registerPdfRenderer('agency-forecast-month', renderAgencyForecastMonthPdf as never);
registerPdfRenderer('segment-analysis', renderSegmentAnalysisPdf as never);
registerPdfRenderer('nationality-monthly-occ', renderNationalityMonthlyOccPdf as never);
registerPdfRenderer('nationality-market-yoy', renderNationalityMarketYoyPdf as never);

registerPdfRenderer('reservation-sales', renderReservationSalesPdf as never);
registerPdfRenderer('reservations-by-create', renderReservationsByCreatePdf as never);
registerPdfRenderer('cancel-by-cancel', renderCancelByCancelPdf as never);
registerPdfRenderer('cancel-by-create', renderCancelByCreatePdf as never);
registerPdfRenderer('definite-reservation', renderDefiniteReservationPdf as never);
registerPdfRenderer('crm-report', renderCrmReportPdf as never);
