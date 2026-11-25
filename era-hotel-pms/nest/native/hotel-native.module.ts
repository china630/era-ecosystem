import { Module } from "@nestjs/common";
import { KitApiController } from "../kit-api.controller";
import { AdminAllotmentBlocksController } from "./controllers/admin_allotment-blocks";
import { AdminAllotmentBlocksIdController } from "./controllers/admin_allotment-blocks__id";
import { AdminAllotmentBlocksIdPickupController } from "./controllers/admin_allotment-blocks__id_pickup";
import { AdminAuditController } from "./controllers/admin_audit";
import { AdminAutoBarController } from "./controllers/admin_auto-bar";
import { AdminChildMatrixController } from "./controllers/admin_child-matrix";
import { AdminChildMatrixIdController } from "./controllers/admin_child-matrix__id";
import { AdminCompaniesController } from "./controllers/admin_companies";
import { AdminContractPricingController } from "./controllers/admin_contract-pricing";
import { AdminContractPricingIdController } from "./controllers/admin_contract-pricing__id";
import { AdminContractsController } from "./controllers/admin_contracts";
import { AdminContractsIdController } from "./controllers/admin_contracts__id";
import { AdminContractsIdAllotmentsController } from "./controllers/admin_contracts__id_allotments";
import { AdminGuestDedupDismissController } from "./controllers/admin_guest-dedup_dismiss";
import { AdminGuestDedupMergeController } from "./controllers/admin_guest-dedup_merge";
import { AdminGuestDedupSummaryController } from "./controllers/admin_guest-dedup_summary";
import { AdminLinksController } from "./controllers/admin_links";
import { AdminMaintenanceController } from "./controllers/admin_maintenance";
import { AdminOpsWipeController } from "./controllers/admin_ops-wipe";
import { AdminPriceSeasonsController } from "./controllers/admin_price-seasons";
import { AdminPriceSeasonsIdController } from "./controllers/admin_price-seasons__id";
import { AdminPricingComponentsController } from "./controllers/admin_pricing-components";
import { AdminPricingComponentsCodeVersionsController } from "./controllers/admin_pricing-components__code_versions";
import { AdminPricingPolicyController } from "./controllers/admin_pricing-policy";
import { AdminPromotionCodesController } from "./controllers/admin_promotion-codes";
import { AdminRatePlansIdSellVersionsController } from "./controllers/admin_rate-plans__id_sell-versions";
import { AdminReportPackController } from "./controllers/admin_report-pack";
import { AdminReportsEmailCronController } from "./controllers/admin_reports_email-cron";
import { AdminRolesController } from "./controllers/admin_roles";
import { AdminRolesCodeController } from "./controllers/admin_roles__code";
import { AdminRolesCodePermissionsController } from "./controllers/admin_roles__code_permissions";
import { AdminTravelAgenciesController } from "./controllers/admin_travel-agencies";
import { AdminTravelAgenciesIdPortalInviteController } from "./controllers/admin_travel-agencies__id_portal-invite";
import { AdminUserLoginsController } from "./controllers/admin_user-logins";
import { AdminUsersController } from "./controllers/admin_users";
import { AdminUsersIdController } from "./controllers/admin_users__id";
import { AdminYieldRulesController } from "./controllers/admin_yield-rules";
import { AdminYieldRulesIdController } from "./controllers/admin_yield-rules__id";
import { AgenciesController } from "./controllers/agencies";
import { AgenciesIdCityLedgerSnapshotController } from "./controllers/agencies__id_city-ledger-snapshot";
import { AgenciesIdLedgerController } from "./controllers/agencies__id_ledger";
import { AgenciesIdSettlementController } from "./controllers/agencies__id_settlement";
import { AgencyLedgerController } from "./controllers/agency_ledger";
import { AgencyReservationsController } from "./controllers/agency_reservations";
import { AgencyReservationsIdAttachmentsController } from "./controllers/agency_reservations__id_attachments";
import { AuthAgencySsoExchangeController } from "./controllers/auth_agency-sso_exchange";
import { AuthLoginController } from "./controllers/auth_login";
import { AuthLogoutController } from "./controllers/auth_logout";
import { AuthMeController } from "./controllers/auth_me";
import { AuthSessionRefreshPermissionsController } from "./controllers/auth_session_refresh-permissions";
import { AuthSsoExchangeController } from "./controllers/auth_sso_exchange";
import { BanquetsController } from "./controllers/banquets";
import { BanquetsCalendarController } from "./controllers/banquets_calendar";
import { BanquetsIdController } from "./controllers/banquets__id";
import { BanquetsIdDaySheetController } from "./controllers/banquets__id_day-sheet";
import { BanquetsIdLinesController } from "./controllers/banquets__id_lines";
import { BanquetsIdResourcesController } from "./controllers/banquets__id_resources";
import { BanquetsIdSettlementController } from "./controllers/banquets__id_settlement";
import { BanquetsIdStaffController } from "./controllers/banquets__id_staff";
import { BookingsQuoteController } from "./controllers/bookings_quote";
import { BusinessDateController } from "./controllers/business-date";
import { CashShiftsController } from "./controllers/cash_shifts";
import { ChannelAvailabilityController } from "./controllers/channel_availability";
import { ChannelBindingController } from "./controllers/channel_binding";
import { ChannelErrorsController } from "./controllers/channel_errors";
import { ChannelHealthController } from "./controllers/channel_health";
import { ChannelMappingsController } from "./controllers/channel_mappings";
import { ChannelOtaCancelController } from "./controllers/channel_ota-cancel";
import { ChannelStopSellController } from "./controllers/channel_stop-sell";
import { ChannelSyncPullController } from "./controllers/channel_sync_pull";
import { ChannelSyncPushController } from "./controllers/channel_sync_push";
import { ClinicCapacityController } from "./controllers/clinic_capacity";
import { CompaniesController } from "./controllers/companies";
import { CompaniesIdCityLedgerSnapshotController } from "./controllers/companies__id_city-ledger-snapshot";
import { CompaniesIdLedgerController } from "./controllers/companies__id_ledger";
import { CompaniesIdSettlementController } from "./controllers/companies__id_settlement";
import { ConciergeController } from "./controllers/concierge";
import { CounterpartiesVoenPreviewController } from "./controllers/counterparties_voen-preview";
import { CronAllotmentBlockCutoffController } from "./controllers/cron_allotment-block-cutoff";
import { CronAutoBarController } from "./controllers/cron_auto-bar";
import { CronChannelAriDrainController } from "./controllers/cron_channel-ari-drain";
import { DispatchController } from "./controllers/dispatch";
import { DistributionAgencyCommissionBatchesController } from "./controllers/distribution_agency-commission_batches";
import { DistributionAgencyCommissionBatchesIdPayController } from "./controllers/distribution_agency-commission_batches__id_pay";
import { DistributionAgencyCommissionBatchesIdSubmitController } from "./controllers/distribution_agency-commission_batches__id_submit";
import { DistributionAgencyCommissionForecastController } from "./controllers/distribution_agency-commission_forecast";
import { DistributionAgencyCommissionLinesController } from "./controllers/distribution_agency-commission_lines";
import { DistributionAgencyCommissionLinesIdDisputeController } from "./controllers/distribution_agency-commission_lines__id_dispute";
import { DistributionAgencyCommissionLinesIdHoldController } from "./controllers/distribution_agency-commission_lines__id_hold";
import { DistributionAgencyCommissionRebuildController } from "./controllers/distribution_agency-commission_rebuild";
import { DistributionAgencyCommissionSummaryController } from "./controllers/distribution_agency-commission_summary";
import { DutySchedulesCatalogController } from "./controllers/duty-schedules_catalog";
import { DutySchedulesDeptAxesController } from "./controllers/duty-schedules__dept_axes";
import { DutySchedulesDeptBindingController } from "./controllers/duty-schedules__dept_binding";
import { DutySchedulesDeptPersonnelController } from "./controllers/duty-schedules__dept_personnel";
import { DutySchedulesDeptWeekController } from "./controllers/duty-schedules__dept_week";
import { ExecutiveDashboardController } from "./controllers/executive_dashboard";
import { ExecutiveForecastController } from "./controllers/executive_forecast";
import { ExecutiveUnitEconomicsController } from "./controllers/executive_unit-economics";
import { FiscalDevicesController } from "./controllers/fiscal_devices";
import { FleetVehiclesController } from "./controllers/fleet_vehicles";
import { FleetVehiclesIdController } from "./controllers/fleet_vehicles__id";
import { FoliosController } from "./controllers/folios";
import { FoliosCategoryRefundController } from "./controllers/folios_category-refund";
import { FoliosChargesChargeIdAdjustController } from "./controllers/folios_charges__chargeId_adjust";
import { FoliosChargesChargeIdPayController } from "./controllers/folios_charges__chargeId_pay";
import { FoliosChargesChargeIdTransferController } from "./controllers/folios_charges__chargeId_transfer";
import { FoliosChargesChargeIdVoidController } from "./controllers/folios_charges__chargeId_void";
import { FoliosDepositsTransferController } from "./controllers/folios_deposits_transfer";
import { FoliosPayTargetsController } from "./controllers/folios_pay-targets";
import { FoliosPaymentsIdRefundController } from "./controllers/folios_payments__id_refund";
import { FoliosPaymentsIdTransferController } from "./controllers/folios_payments__id_transfer";
import { FoliosPaymentsIdVoidController } from "./controllers/folios_payments__id_void";
import { FoliosSettleController } from "./controllers/folios_settle";
import { FoliosIdCloseController } from "./controllers/folios__id_close";
import { FoliosIdIssueInvoiceController } from "./controllers/folios__id_issue-invoice";
import { FoliosIdRetryClInvoiceController } from "./controllers/folios__id_retry-cl-invoice";
import { FoAgencyInboxController } from "./controllers/fo_agency-inbox";
import { FoQuickProfileController } from "./controllers/fo_quick-profile";
import { FoRoomTypeAvailabilityController } from "./controllers/fo_room-type-availability";
import { FoSellableController } from "./controllers/fo_sellable";
import { FoShareRoomingQueueController } from "./controllers/fo_share-rooming-queue";
import { FoShareRoomingSuggestionsController } from "./controllers/fo_share-rooming-suggestions";
import { FoStatusDashboardController } from "./controllers/fo_status-dashboard";
import { FrontCashDeskController } from "./controllers/front-cash_desk";
import { FrontCashFolioBalancesController } from "./controllers/front-cash_folio-balances";
import { FrontCashFolioJournalController } from "./controllers/front-cash_folio-journal";
import { FrontCashGuestDebtController } from "./controllers/front-cash_guest-debt";
import { FrontCashGuestDebtIdPayController } from "./controllers/front-cash_guest-debt__id_pay";
import { FrontCashJournalController } from "./controllers/front-cash_journal";
import { FrontCashTransactionsController } from "./controllers/front-cash_transactions";
import { FrontCashUnsettledDeparturesController } from "./controllers/front-cash_unsettled-departures";
import { FxPreviewController } from "./controllers/fx-preview";
import { GuestsController } from "./controllers/guests";
import { GuestsMrzMatchController } from "./controllers/guests_mrz-match";
import { GuestsIdAccompanyingController } from "./controllers/guests__id_accompanying";
import { GuestsIdAddressesController } from "./controllers/guests__id_addresses";
import { GuestsIdAllergensController } from "./controllers/guests__id_allergens";
import { GuestsIdArchiveController } from "./controllers/guests__id_archive";
import { GuestsIdBookerHistoryController } from "./controllers/guests__id_booker-history";
import { GuestsIdCommentsController } from "./controllers/guests__id_comments";
import { GuestsIdCommunicationsController } from "./controllers/guests__id_communications";
import { GuestsIdContactLogsController } from "./controllers/guests__id_contact-logs";
import { GuestsIdContactsController } from "./controllers/guests__id_contacts";
import { GuestsIdCrmBadgesController } from "./controllers/guests__id_crm-badges";
import { GuestsIdCrmExtensionController } from "./controllers/guests__id_crm-extension";
import { GuestsIdDocumentsController } from "./controllers/guests__id_documents";
import { GuestsIdFamilyController } from "./controllers/guests__id_family";
import { GuestsIdFavoritesController } from "./controllers/guests__id_favorites";
import { GuestsIdFullController } from "./controllers/guests__id_full";
import { GuestsIdIncidentsController } from "./controllers/guests__id_incidents";
import { GuestsIdLoyaltyCardsController } from "./controllers/guests__id_loyalty-cards";
import { GuestsIdLoyaltyController } from "./controllers/guests__id_loyalty";
import { GuestsIdLoyaltyPointsController } from "./controllers/guests__id_loyalty_points";
import { GuestsIdNotesController } from "./controllers/guests__id_notes";
import { GuestsIdPreferencesController } from "./controllers/guests__id_preferences";
import { GuestsIdReclaimsController } from "./controllers/guests__id_reclaims";
import { GuestsIdReservationAnalyticsController } from "./controllers/guests__id_reservation-analytics";
import { GuestsIdSpecialDatesController } from "./controllers/guests__id_special-dates";
import { GuestsIdSpecialNotesController } from "./controllers/guests__id_special-notes";
import { GuestsIdStatsController } from "./controllers/guests__id_stats";
import { GuestsIdSurveysController } from "./controllers/guests__id_surveys";
import { GuestsIdTagsController } from "./controllers/guests__id_tags";
import { GuestsIdTasksController } from "./controllers/guests__id_tasks";
import { GuestsIdTimeSharesController } from "./controllers/guests__id_time-shares";
import { HealthController } from "./controllers/health";
import { HotelIntegrationSettingsController } from "./controllers/hotel_integration-settings";
import { HotelProfileController } from "./controllers/hotel_profile";
import { HotelProfileLogoController } from "./controllers/hotel_profile_logo";
import { HousekeepingClosedRoomsController } from "./controllers/housekeeping_closed-rooms";
import { HousekeepingClosedRoomsIdReturnController } from "./controllers/housekeeping_closed-rooms__id_return";
import { HousekeepingConditionController } from "./controllers/housekeeping_condition";
import { HousekeepingConsumptionController } from "./controllers/housekeeping_consumption";
import { HousekeepingConsumptionIdController } from "./controllers/housekeeping_consumption__id";
import { HousekeepingConsumptionIdReverseController } from "./controllers/housekeeping_consumption__id_reverse";
import { HousekeepingDiscrepancyController } from "./controllers/housekeeping_discrepancy";
import { HousekeepingEgController } from "./controllers/housekeeping_eg";
import { HousekeepingFinanceProductsController } from "./controllers/housekeeping_finance-products";
import { HousekeepingForecastController } from "./controllers/housekeeping_forecast";
import { HousekeepingLaundryController } from "./controllers/housekeeping_laundry";
import { HousekeepingLaundryCatalogController } from "./controllers/housekeeping_laundry_catalog";
import { HousekeepingLostFoundController } from "./controllers/housekeeping_lost-found";
import { HousekeepingMaidsController } from "./controllers/housekeeping_maids";
import { HousekeepingMinibarController } from "./controllers/housekeeping_minibar";
import { HousekeepingNeededByController } from "./controllers/housekeeping_needed-by";
import { HousekeepingNsrController } from "./controllers/housekeeping_nsr";
import { HousekeepingOutcomeController } from "./controllers/housekeeping_outcome";
import { HousekeepingPersonnelController } from "./controllers/housekeeping_personnel";
import { HousekeepingPolicyController } from "./controllers/housekeeping_policy";
import { HousekeepingRosterController } from "./controllers/housekeeping_roster";
import { HousekeepingRotationController } from "./controllers/housekeeping_rotation";
import { HousekeepingSheetController } from "./controllers/housekeeping_sheet";
import { HousekeepingStayLinenController } from "./controllers/housekeeping_stay-linen";
import { HousekeepingTasksController } from "./controllers/housekeeping_tasks";
import { ImportController } from "./controllers/import";
import { ImportEntityController } from "./controllers/import__entity";
import { IntegrationsChannexWebhookController } from "./controllers/integrations_channex_webhook";
import { IntegrationsDoorLockUnlockController } from "./controllers/integrations_door-lock_unlock";
import { IntegrationsElektrawebBridgeController } from "./controllers/integrations_elektraweb-bridge";
import { IntegrationsElektrawebBridgeHealthController } from "./controllers/integrations_elektraweb-bridge_health";
import { IntegrationsElektrawebBridgeLoginController } from "./controllers/integrations_elektraweb-bridge_login";
import { IntegrationsElektrawebBridgeOutboxController } from "./controllers/integrations_elektraweb-bridge_outbox";
import { IntegrationsElektrawebBridgeOutboxIdAckController } from "./controllers/integrations_elektraweb-bridge_outbox__id_ack";
import { IntegrationsMinibarSensorController } from "./controllers/integrations_minibar-sensor";
import { IntegrationsOtaChannelController } from "./controllers/integrations_ota__channel";
import { IntegrationErpInboundController } from "./controllers/integration_erp_inbound";
import { IntegrationErpSimulateController } from "./controllers/integration_erp_simulate";
import { IntegrationGlStatusController } from "./controllers/integration_gl-status";
import { IntegrationMasterDataSyncController } from "./controllers/integration_master-data-sync";
import { IntegrationMockLicensingController } from "./controllers/integration_mock-licensing";
import { IntegrationMockReceiverController } from "./controllers/integration_mock-receiver";
import { IntegrationOutboundLogController } from "./controllers/integration_outbound-log";
import { IntegrationRetryController } from "./controllers/integration_retry";
import { IntegrationStaffProvisionController } from "./controllers/integration_staff-provision";
import { InternalV1AgencyCommissionCommissionOffsetAppliedController } from "./controllers/internal_v1_agency-commission_commission-offset-applied";
import { InternalV1AgencyCommissionCommissionPaidController } from "./controllers/internal_v1_agency-commission_commission-paid";
import { InternalV1CityLedgerPaymentAppliedController } from "./controllers/internal_v1_city-ledger_payment-applied";
import { InternalV1ConsumptionController } from "./controllers/internal_v1_consumption";
import { InternalV1FolioChargesReceivedController } from "./controllers/internal_v1_folio-charges_received";
import { InternalV1GuestsByIdentityController } from "./controllers/internal_v1_guests_by-identity";
import { InternalV1PlacementExportSliceController } from "./controllers/internal_v1_placement_export-slice";
import { InternalV1PlacementImportSliceController } from "./controllers/internal_v1_placement_import-slice";
import { InternalV1PlacementPreflightController } from "./controllers/internal_v1_placement_preflight";
import { InternalV1ReservationsCheckedOutController } from "./controllers/internal_v1_reservations_checked-out";
import { InternalV1ReservationsClinicSyncController } from "./controllers/internal_v1_reservations_clinic-sync";
import { InternalV1RevenueCodesController } from "./controllers/internal_v1_revenue-codes";
import { InternalV1StaysByExternalRefController } from "./controllers/internal_v1_stays_by-external-ref";
import { InternalV1WorkforceRolesController } from "./controllers/internal_v1_workforce_roles";
import { LocaleController } from "./controllers/locale";
import { LoyaltyBalanceController } from "./controllers/loyalty_balance";
import { MasterBarRatesController } from "./controllers/master_bar-rates";
import { MasterBarRatesIdController } from "./controllers/master_bar-rates__id";
import { MasterBedTypesController } from "./controllers/master_bed-types";
import { MasterBedTypesIdController } from "./controllers/master_bed-types__id";
import { MasterBookingSourcesController } from "./controllers/master_booking-sources";
import { MasterDepartmentsController } from "./controllers/master_departments";
import { MasterDepartmentsIdController } from "./controllers/master_departments__id";
import { MasterInventoryCapsController } from "./controllers/master_inventory-caps";
import { MasterLookupsController } from "./controllers/master_lookups";
import { MasterLookupsIdController } from "./controllers/master_lookups__id";
import { MasterMealPlansController } from "./controllers/master_meal-plans";
import { MasterRatePlansController } from "./controllers/master_rate-plans";
import { MasterRatePlansIdController } from "./controllers/master_rate-plans__id";
import { MasterRevenueCodesController } from "./controllers/master_revenue-codes";
import { MasterRevenueCodesIdController } from "./controllers/master_revenue-codes__id";
import { MasterRevenueGlMappingsController } from "./controllers/master_revenue-gl-mappings";
import { MasterRoomTypesController } from "./controllers/master_room-types";
import { MasterRoomTypesIdController } from "./controllers/master_room-types__id";
import { MasterRoomViewsController } from "./controllers/master_room-views";
import { MasterRoomViewsIdController } from "./controllers/master_room-views__id";
import { MdmPersonLookupController } from "./controllers/mdm_person-lookup";
import { MdmPersonMergeController } from "./controllers/mdm_person-merge";
import { MdmPersonOpsProfileController } from "./controllers/mdm_person-ops-profile";
import { MedicalAlertsController } from "./controllers/medical_alerts";
import { MedicalOrdersController } from "./controllers/medical_orders";
import { MigrationRegistrationsController } from "./controllers/migration_registrations";
import { MigrationRegistrationsIdPrefillController } from "./controllers/migration_registrations__id_prefill";
import { MigrationIdSubmitController } from "./controllers/migration__id_submit";
import { NightAuditEodReportsController } from "./controllers/night-audit_eod-reports";
import { NightAuditPreviewController } from "./controllers/night-audit_preview";
import { NightAuditReservationUpdatesController } from "./controllers/night-audit_reservation-updates";
import { NightAuditRunController } from "./controllers/night-audit_run";
import { NightAuditRunsController } from "./controllers/night-audit_runs";
import { NightAuditStatusController } from "./controllers/night-audit_status";
import { NightAuditYearEndController } from "./controllers/night-audit_year-end";
import { NotificationsController } from "./controllers/notifications";
import { NotificationsReadAllController } from "./controllers/notifications_read-all";
import { NotificationsUnreadCountController } from "./controllers/notifications_unread-count";
import { NotificationsIdReadController } from "./controllers/notifications__id_read";
import { PaymentMethodsController } from "./controllers/payment-methods";
import { PlatformBillingSnapshotController } from "./controllers/platform_billing-snapshot";
import { PmsBuffetGuestNightsController } from "./controllers/pms_buffet-guest-nights";
import { PmsGuestEntitlementsController } from "./controllers/pms_guest-entitlements";
import { PmsInHouseController } from "./controllers/pms_in-house";
import { PmsPosShiftStatusController } from "./controllers/pms_pos-shift-status";
import { PmsReservationsReservationIdFolioSummaryController } from "./controllers/pms_reservations__reservationId_folio-summary";
import { PmsRoomChargesController } from "./controllers/pms_room-charges";
import { PosReservationsController } from "./controllers/pos_reservations";
import { PosResourcesController } from "./controllers/pos_resources";
import { PosRoomChargeController } from "./controllers/pos_room-charge";
import { ProceduresController } from "./controllers/procedures";
import { ProceduresAppointmentsController } from "./controllers/procedures_appointments";
import { ProceduresAppointmentsIdController } from "./controllers/procedures_appointments__id";
import { PublicBookingRatesController } from "./controllers/public_booking_rates";
import { PublicV1AvailabilityController } from "./controllers/public_v1_availability";
import { PublicV1BookingsController } from "./controllers/public_v1_bookings";
import { PublicV1HoldsController } from "./controllers/public_v1_holds";
import { ReportsAgencyClSummaryController } from "./controllers/reports_agency-cl-summary";
import { ReportsAgencyProfitabilityController } from "./controllers/reports_agency-profitability";
import { ReportsBookingSourcesController } from "./controllers/reports_booking-sources";
import { ReportsCancellationsController } from "./controllers/reports_cancellations";
import { ReportsEventProfitabilityController } from "./controllers/reports_event-profitability";
import { ReportsGuestDemographicsController } from "./controllers/reports_guest-demographics";
import { ReportsInhouseDailyController } from "./controllers/reports_inhouse-daily";
import { ReportsInvoicesController } from "./controllers/reports_invoices";
import { ReportsInvoicesIdController } from "./controllers/reports_invoices__id";
import { ReportsNightAuditRunsController } from "./controllers/reports_night-audit-runs";
import { ReportsOccupancyController } from "./controllers/reports_occupancy";
import { ReportsPackController } from "./controllers/reports_pack";
import { ReportsPackDownloadController } from "./controllers/reports_pack_download";
import { ReportsPaymentVoidsController } from "./controllers/reports_payment-voids";
import { ReportsReconciliationController } from "./controllers/reports_reconciliation";
import { ReportsReservationNotesController } from "./controllers/reports_reservation-notes";
import { ReportsReservationTimesController } from "./controllers/reports_reservation-times";
import { ReportsReservationsGridController } from "./controllers/reports_reservations-grid";
import { ReportsRoomChangesController } from "./controllers/reports_room-changes";
import { ReportsSlugLayoutController } from "./controllers/reports__slug_layout";
import { ReportsSlugPdfController } from "./controllers/reports__slug_pdf";
import { ReportsSlugXlsxController } from "./controllers/reports__slug_xlsx";
import { ReservationGroupsController } from "./controllers/reservation-groups";
import { ReservationGroupsAssignController } from "./controllers/reservation-groups_assign";
import { ReservationGroupsBookController } from "./controllers/reservation-groups_book";
import { ReservationGroupsIdController } from "./controllers/reservation-groups__id";
import { ReservationsController } from "./controllers/reservations";
import { ReservationsArrivalsController } from "./controllers/reservations_arrivals";
import { ReservationsGuestOverlapsController } from "./controllers/reservations_guest-overlaps";
import { ReservationsIdController } from "./controllers/reservations__id";
import { ReservationsIdAddRoomController } from "./controllers/reservations__id_add-room";
import { ReservationsIdAmendmentsController } from "./controllers/reservations__id_amendments";
import { ReservationsIdAmendmentsPreviewController } from "./controllers/reservations__id_amendments_preview";
import { ReservationsIdAssignController } from "./controllers/reservations__id_assign";
import { ReservationsIdAttachmentsController } from "./controllers/reservations__id_attachments";
import { ReservationsIdCancelController } from "./controllers/reservations__id_cancel";
import { ReservationsIdCardAuthorizationsController } from "./controllers/reservations__id_card-authorizations";
import { ReservationsIdCheckInController } from "./controllers/reservations__id_check-in";
import { ReservationsIdCheckOutController } from "./controllers/reservations__id_check-out";
import { ReservationsIdClinicCheckoutController } from "./controllers/reservations__id_clinic-checkout";
import { ReservationsIdDepositTargetsController } from "./controllers/reservations__id_deposit-targets";
import { ReservationsIdDepositsController } from "./controllers/reservations__id_deposits";
import { ReservationsIdDepositsApplyController } from "./controllers/reservations__id_deposits_apply";
import { ReservationsIdDepositsSettleController } from "./controllers/reservations__id_deposits_settle";
import { ReservationsIdEarlyCheckoutPreviewController } from "./controllers/reservations__id_early-checkout-preview";
import { ReservationsIdEarlyLateFeesController } from "./controllers/reservations__id_early-late-fees";
import { ReservationsIdExtrasController } from "./controllers/reservations__id_extras";
import { ReservationsIdFolioRoutingController } from "./controllers/reservations__id_folio-routing";
import { ReservationsIdFullController } from "./controllers/reservations__id_full";
import { ReservationsIdGuestOverlapsController } from "./controllers/reservations__id_guest-overlaps";
import { ReservationsIdJournalController } from "./controllers/reservations__id_journal";
import { ReservationsIdLockController } from "./controllers/reservations__id_lock";
import { ReservationsIdMissedNightsController } from "./controllers/reservations__id_missed-nights";
import { ReservationsIdPackagesController } from "./controllers/reservations__id_packages";
import { ReservationsIdPaxPaxIdClinicAdmitController } from "./controllers/reservations__id_pax__paxId_clinic-admit";
import { ReservationsIdPaxPaxIdDepartController } from "./controllers/reservations__id_pax__paxId_depart";
import { ReservationsIdPaxPaxIdMoveController } from "./controllers/reservations__id_pax__paxId_move";
import { ReservationsIdPaymentCardsController } from "./controllers/reservations__id_payment-cards";
import { ReservationsIdPricingChargeAllController } from "./controllers/reservations__id_pricing_charge-all";
import { ReservationsIdPricingPostNightController } from "./controllers/reservations__id_pricing_post-night";
import { ReservationsIdPricingRecalcController } from "./controllers/reservations__id_pricing_recalc";
import { ReservationsIdPricingSpreadController } from "./controllers/reservations__id_pricing_spread";
import { ReservationsIdRelocateController } from "./controllers/reservations__id_relocate";
import { ReservationsIdRestoreController } from "./controllers/reservations__id_restore";
import { ReservationsIdRoomChangesController } from "./controllers/reservations__id_room-changes";
import { ReservationsIdScheduleController } from "./controllers/reservations__id_schedule";
import { ReservationsIdStaySplitController } from "./controllers/reservations__id_stay-split";
import { ReservationsIdSwapRoomController } from "./controllers/reservations__id_swap-room";
import { ReservationsIdTasksController } from "./controllers/reservations__id_tasks";
import { ReservationsIdUndoCheckoutController } from "./controllers/reservations__id_undo-checkout";
import { RoomPlanController } from "./controllers/room-plan";
import { RoomServiceQrController } from "./controllers/room-service_qr";
import { RoomsController } from "./controllers/rooms";
import { RoomsIdController } from "./controllers/rooms__id";
import { RoomsIdStatusController } from "./controllers/rooms__id_status";
import { ServiceGuestRequestController } from "./controllers/service_guest-request";
import { ServiceRecurringController } from "./controllers/service_recurring";
import { ServiceRequestsController } from "./controllers/service_requests";
import { ServiceRequestsIdController } from "./controllers/service_requests__id";
import { SettlementPendingController } from "./controllers/settlement_pending";
import { SettlementPendingBasketPayController } from "./controllers/settlement_pending_basket_pay";
import { SettlementPendingSummaryController } from "./controllers/settlement_pending_summary";
import { SettlementPendingIdPayController } from "./controllers/settlement_pending__id_pay";
import { SettlementPendingIdVoidController } from "./controllers/settlement_pending__id_void";
import { SpaPlacesController } from "./controllers/spa_places";
import { SpaSlotsController } from "./controllers/spa_slots";
import { StockMovementsController } from "./controllers/stock_movements";
import { StockProductsController } from "./controllers/stock_products";
import { StockProductsIdController } from "./controllers/stock_products__id";
import { StockWarehousesController } from "./controllers/stock_warehouses";
import { TourismFailedController } from "./controllers/tourism_failed";
import { TourismIdRetryController } from "./controllers/tourism__id_retry";
import { ToursBookingsIdController } from "./controllers/tours_bookings__id";
import { ToursBookingsIdBoardController } from "./controllers/tours_bookings__id_board";
import { ToursBookingsIdPayController } from "./controllers/tours_bookings__id_pay";
import { ToursDeparturesController } from "./controllers/tours_departures";
import { ToursDeparturesIdController } from "./controllers/tours_departures__id";
import { ToursDeparturesIdBookingsController } from "./controllers/tours_departures__id_bookings";
import { ToursDeparturesIdCloseBoardingController } from "./controllers/tours_departures__id_close-boarding";
import { ToursDeparturesIdManifestController } from "./controllers/tours_departures__id_manifest";
import { ToursInHouseController } from "./controllers/tours_in-house";
import { ToursPolicyController } from "./controllers/tours_policy";
import { ToursTemplatesController } from "./controllers/tours_templates";
import { TransfersController } from "./controllers/transfers";
import { TransfersIdController } from "./controllers/transfers__id";
import { GuestAppRoutesController } from "./controllers/guest_app_routes";
import { StayMobilityRoutesController } from "./controllers/stay_mobility_routes";

@Module({
  controllers: [
    KitApiController,
    AdminAllotmentBlocksController,
    AdminAllotmentBlocksIdController,
    AdminAllotmentBlocksIdPickupController,
    AdminAuditController,
    AdminAutoBarController,
    AdminChildMatrixController,
    AdminChildMatrixIdController,
    AdminCompaniesController,
    AdminContractPricingController,
    AdminContractPricingIdController,
    AdminContractsController,
    AdminContractsIdController,
    AdminContractsIdAllotmentsController,
    AdminGuestDedupDismissController,
    AdminGuestDedupMergeController,
    AdminGuestDedupSummaryController,
    AdminLinksController,
    AdminMaintenanceController,
    AdminOpsWipeController,
    AdminPriceSeasonsController,
    AdminPriceSeasonsIdController,
    AdminPricingComponentsController,
    AdminPricingComponentsCodeVersionsController,
    AdminPricingPolicyController,
    AdminPromotionCodesController,
    AdminRatePlansIdSellVersionsController,
    AdminReportPackController,
    AdminReportsEmailCronController,
    AdminRolesController,
    AdminRolesCodeController,
    AdminRolesCodePermissionsController,
    AdminTravelAgenciesController,
    AdminTravelAgenciesIdPortalInviteController,
    AdminUserLoginsController,
    AdminUsersController,
    AdminUsersIdController,
    AdminYieldRulesController,
    AdminYieldRulesIdController,
    AgenciesController,
    AgenciesIdCityLedgerSnapshotController,
    AgenciesIdLedgerController,
    AgenciesIdSettlementController,
    AgencyLedgerController,
    AgencyReservationsController,
    AgencyReservationsIdAttachmentsController,
    AuthAgencySsoExchangeController,
    AuthLoginController,
    AuthLogoutController,
    AuthMeController,
    AuthSessionRefreshPermissionsController,
    AuthSsoExchangeController,
    BanquetsController,
    BanquetsCalendarController,
    BanquetsIdController,
    BanquetsIdDaySheetController,
    BanquetsIdLinesController,
    BanquetsIdResourcesController,
    BanquetsIdSettlementController,
    BanquetsIdStaffController,
    BookingsQuoteController,
    BusinessDateController,
    CashShiftsController,
    ChannelAvailabilityController,
    ChannelBindingController,
    ChannelErrorsController,
    ChannelHealthController,
    ChannelMappingsController,
    ChannelOtaCancelController,
    ChannelStopSellController,
    ChannelSyncPullController,
    ChannelSyncPushController,
    ClinicCapacityController,
    CompaniesController,
    CompaniesIdCityLedgerSnapshotController,
    CompaniesIdLedgerController,
    CompaniesIdSettlementController,
    ConciergeController,
    CounterpartiesVoenPreviewController,
    CronAllotmentBlockCutoffController,
    CronAutoBarController,
    CronChannelAriDrainController,
    DispatchController,
    DistributionAgencyCommissionBatchesController,
    DistributionAgencyCommissionBatchesIdPayController,
    DistributionAgencyCommissionBatchesIdSubmitController,
    DistributionAgencyCommissionForecastController,
    DistributionAgencyCommissionLinesController,
    DistributionAgencyCommissionLinesIdDisputeController,
    DistributionAgencyCommissionLinesIdHoldController,
    DistributionAgencyCommissionRebuildController,
    DistributionAgencyCommissionSummaryController,
    DutySchedulesCatalogController,
    DutySchedulesDeptAxesController,
    DutySchedulesDeptBindingController,
    DutySchedulesDeptPersonnelController,
    DutySchedulesDeptWeekController,
    ExecutiveDashboardController,
    ExecutiveForecastController,
    ExecutiveUnitEconomicsController,
    FiscalDevicesController,
    FleetVehiclesController,
    FleetVehiclesIdController,
    FoliosController,
    FoliosCategoryRefundController,
    FoliosChargesChargeIdAdjustController,
    FoliosChargesChargeIdPayController,
    FoliosChargesChargeIdTransferController,
    FoliosChargesChargeIdVoidController,
    FoliosDepositsTransferController,
    FoliosPayTargetsController,
    FoliosPaymentsIdRefundController,
    FoliosPaymentsIdTransferController,
    FoliosPaymentsIdVoidController,
    FoliosSettleController,
    FoliosIdCloseController,
    FoliosIdIssueInvoiceController,
    FoliosIdRetryClInvoiceController,
    FoAgencyInboxController,
    FoQuickProfileController,
    FoRoomTypeAvailabilityController,
    FoSellableController,
    FoShareRoomingQueueController,
    FoShareRoomingSuggestionsController,
    FoStatusDashboardController,
    FrontCashDeskController,
    FrontCashFolioBalancesController,
    FrontCashFolioJournalController,
    FrontCashGuestDebtController,
    FrontCashGuestDebtIdPayController,
    FrontCashJournalController,
    FrontCashTransactionsController,
    FrontCashUnsettledDeparturesController,
    FxPreviewController,
    GuestsController,
    GuestsMrzMatchController,
    GuestsIdAccompanyingController,
    GuestsIdAddressesController,
    GuestsIdAllergensController,
    GuestsIdArchiveController,
    GuestsIdBookerHistoryController,
    GuestsIdCommentsController,
    GuestsIdCommunicationsController,
    GuestsIdContactLogsController,
    GuestsIdContactsController,
    GuestsIdCrmBadgesController,
    GuestsIdCrmExtensionController,
    GuestsIdDocumentsController,
    GuestsIdFamilyController,
    GuestsIdFavoritesController,
    GuestsIdFullController,
    GuestsIdIncidentsController,
    GuestsIdLoyaltyCardsController,
    GuestsIdLoyaltyController,
    GuestsIdLoyaltyPointsController,
    GuestsIdNotesController,
    GuestsIdPreferencesController,
    GuestsIdReclaimsController,
    GuestsIdReservationAnalyticsController,
    GuestsIdSpecialDatesController,
    GuestsIdSpecialNotesController,
    GuestsIdStatsController,
    GuestsIdSurveysController,
    GuestsIdTagsController,
    GuestsIdTasksController,
    GuestsIdTimeSharesController,
    HealthController,
    HotelIntegrationSettingsController,
    HotelProfileController,
    HotelProfileLogoController,
    HousekeepingClosedRoomsController,
    HousekeepingClosedRoomsIdReturnController,
    HousekeepingConditionController,
    HousekeepingConsumptionController,
    HousekeepingConsumptionIdController,
    HousekeepingConsumptionIdReverseController,
    HousekeepingDiscrepancyController,
    HousekeepingEgController,
    HousekeepingFinanceProductsController,
    HousekeepingForecastController,
    HousekeepingLaundryController,
    HousekeepingLaundryCatalogController,
    HousekeepingLostFoundController,
    HousekeepingMaidsController,
    HousekeepingMinibarController,
    HousekeepingNeededByController,
    HousekeepingNsrController,
    HousekeepingOutcomeController,
    HousekeepingPersonnelController,
    HousekeepingPolicyController,
    HousekeepingRosterController,
    HousekeepingRotationController,
    HousekeepingSheetController,
    HousekeepingStayLinenController,
    HousekeepingTasksController,
    ImportController,
    ImportEntityController,
    IntegrationsChannexWebhookController,
    IntegrationsDoorLockUnlockController,
    IntegrationsElektrawebBridgeController,
    IntegrationsElektrawebBridgeHealthController,
    IntegrationsElektrawebBridgeLoginController,
    IntegrationsElektrawebBridgeOutboxController,
    IntegrationsElektrawebBridgeOutboxIdAckController,
    IntegrationsMinibarSensorController,
    IntegrationsOtaChannelController,
    IntegrationErpInboundController,
    IntegrationErpSimulateController,
    IntegrationGlStatusController,
    IntegrationMasterDataSyncController,
    IntegrationMockLicensingController,
    IntegrationMockReceiverController,
    IntegrationOutboundLogController,
    IntegrationRetryController,
    IntegrationStaffProvisionController,
    InternalV1AgencyCommissionCommissionOffsetAppliedController,
    InternalV1AgencyCommissionCommissionPaidController,
    InternalV1CityLedgerPaymentAppliedController,
    InternalV1ConsumptionController,
    InternalV1FolioChargesReceivedController,
    InternalV1GuestsByIdentityController,
    InternalV1PlacementExportSliceController,
    InternalV1PlacementImportSliceController,
    InternalV1PlacementPreflightController,
    InternalV1ReservationsCheckedOutController,
    InternalV1ReservationsClinicSyncController,
    InternalV1RevenueCodesController,
    InternalV1StaysByExternalRefController,
    InternalV1WorkforceRolesController,
    LocaleController,
    LoyaltyBalanceController,
    MasterBarRatesController,
    MasterBarRatesIdController,
    MasterBedTypesController,
    MasterBedTypesIdController,
    MasterBookingSourcesController,
    MasterDepartmentsController,
    MasterDepartmentsIdController,
    MasterInventoryCapsController,
    MasterLookupsController,
    MasterLookupsIdController,
    MasterMealPlansController,
    MasterRatePlansController,
    MasterRatePlansIdController,
    MasterRevenueCodesController,
    MasterRevenueCodesIdController,
    MasterRevenueGlMappingsController,
    MasterRoomTypesController,
    MasterRoomTypesIdController,
    MasterRoomViewsController,
    MasterRoomViewsIdController,
    MdmPersonLookupController,
    MdmPersonMergeController,
    MdmPersonOpsProfileController,
    MedicalAlertsController,
    MedicalOrdersController,
    MigrationRegistrationsController,
    MigrationRegistrationsIdPrefillController,
    MigrationIdSubmitController,
    NightAuditEodReportsController,
    NightAuditPreviewController,
    NightAuditReservationUpdatesController,
    NightAuditRunController,
    NightAuditRunsController,
    NightAuditStatusController,
    NightAuditYearEndController,
    NotificationsController,
    NotificationsReadAllController,
    NotificationsUnreadCountController,
    NotificationsIdReadController,
    PaymentMethodsController,
    PlatformBillingSnapshotController,
    PmsBuffetGuestNightsController,
    PmsGuestEntitlementsController,
    PmsInHouseController,
    PmsPosShiftStatusController,
    PmsReservationsReservationIdFolioSummaryController,
    PmsRoomChargesController,
    PosReservationsController,
    PosResourcesController,
    PosRoomChargeController,
    ProceduresController,
    ProceduresAppointmentsController,
    ProceduresAppointmentsIdController,
    PublicBookingRatesController,
    PublicV1AvailabilityController,
    PublicV1BookingsController,
    PublicV1HoldsController,
    ReportsAgencyClSummaryController,
    ReportsAgencyProfitabilityController,
    ReportsBookingSourcesController,
    ReportsCancellationsController,
    ReportsEventProfitabilityController,
    ReportsGuestDemographicsController,
    ReportsInhouseDailyController,
    ReportsInvoicesController,
    ReportsInvoicesIdController,
    ReportsNightAuditRunsController,
    ReportsOccupancyController,
    ReportsPackController,
    ReportsPackDownloadController,
    ReportsPaymentVoidsController,
    ReportsReconciliationController,
    ReportsReservationNotesController,
    ReportsReservationTimesController,
    ReportsReservationsGridController,
    ReportsRoomChangesController,
    ReportsSlugLayoutController,
    ReportsSlugPdfController,
    ReportsSlugXlsxController,
    ReservationGroupsController,
    ReservationGroupsAssignController,
    ReservationGroupsBookController,
    ReservationGroupsIdController,
    ReservationsController,
    ReservationsArrivalsController,
    ReservationsGuestOverlapsController,
    ReservationsIdController,
    ReservationsIdAddRoomController,
    ReservationsIdAmendmentsController,
    ReservationsIdAmendmentsPreviewController,
    ReservationsIdAssignController,
    ReservationsIdAttachmentsController,
    ReservationsIdCancelController,
    ReservationsIdCardAuthorizationsController,
    ReservationsIdCheckInController,
    ReservationsIdCheckOutController,
    ReservationsIdClinicCheckoutController,
    ReservationsIdDepositTargetsController,
    ReservationsIdDepositsController,
    ReservationsIdDepositsApplyController,
    ReservationsIdDepositsSettleController,
    ReservationsIdEarlyCheckoutPreviewController,
    ReservationsIdEarlyLateFeesController,
    ReservationsIdExtrasController,
    ReservationsIdFolioRoutingController,
    ReservationsIdFullController,
    ReservationsIdGuestOverlapsController,
    ReservationsIdJournalController,
    ReservationsIdLockController,
    ReservationsIdMissedNightsController,
    ReservationsIdPackagesController,
    ReservationsIdPaxPaxIdClinicAdmitController,
    ReservationsIdPaxPaxIdDepartController,
    ReservationsIdPaxPaxIdMoveController,
    ReservationsIdPaymentCardsController,
    ReservationsIdPricingChargeAllController,
    ReservationsIdPricingPostNightController,
    ReservationsIdPricingRecalcController,
    ReservationsIdPricingSpreadController,
    ReservationsIdRelocateController,
    ReservationsIdRestoreController,
    ReservationsIdRoomChangesController,
    ReservationsIdScheduleController,
    ReservationsIdStaySplitController,
    ReservationsIdSwapRoomController,
    ReservationsIdTasksController,
    ReservationsIdUndoCheckoutController,
    RoomPlanController,
    RoomServiceQrController,
    RoomsController,
    RoomsIdController,
    RoomsIdStatusController,
    ServiceGuestRequestController,
    ServiceRecurringController,
    ServiceRequestsController,
    ServiceRequestsIdController,
    SettlementPendingController,
    SettlementPendingBasketPayController,
    SettlementPendingSummaryController,
    SettlementPendingIdPayController,
    SettlementPendingIdVoidController,
    SpaPlacesController,
    SpaSlotsController,
    StockMovementsController,
    StockProductsController,
    StockProductsIdController,
    StockWarehousesController,
    TourismFailedController,
    TourismIdRetryController,
    ToursBookingsIdController,
    ToursBookingsIdBoardController,
    ToursBookingsIdPayController,
    ToursDeparturesController,
    ToursDeparturesIdController,
    ToursDeparturesIdBookingsController,
    ToursDeparturesIdCloseBoardingController,
    ToursDeparturesIdManifestController,
    ToursInHouseController,
    ToursPolicyController,
    ToursTemplatesController,
    TransfersController,
    TransfersIdController,
    GuestAppRoutesController,
    StayMobilityRoutesController,
  ],
})
export class HotelNativeModule {}
