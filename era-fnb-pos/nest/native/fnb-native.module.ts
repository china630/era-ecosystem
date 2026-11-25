import { Module } from "@nestjs/common";
import { AdminAuditController } from "./controllers/admin_audit";
import { AdminBuffetCostRunExportController } from "./controllers/admin_buffet_cost-run-export";
import { AdminBuffetCoversRollupController } from "./controllers/admin_buffet_covers-rollup";
import { AdminBuffetForecastPackController } from "./controllers/admin_buffet_forecast-pack";
import { AdminBuffetGuestNightsController } from "./controllers/admin_buffet_guest-nights";
import { AdminBuffetGuestNightsSyncHotelController } from "./controllers/admin_buffet_guest-nights_sync-hotel";
import { AdminBuffetHybridHandoffController } from "./controllers/admin_buffet_hybrid-handoff";
import { AdminBuffetLinesLineIdController } from "./controllers/admin_buffet_lines__lineId";
import { AdminBuffetManagementEatersController } from "./controllers/admin_buffet_management-eaters";
import { AdminBuffetManagementEatersIdController } from "./controllers/admin_buffet_management-eaters__id";
import { AdminBuffetManagementMealsController } from "./controllers/admin_buffet_management-meals";
import { AdminBuffetManagementMealsIdController } from "./controllers/admin_buffet_management-meals__id";
import { AdminBuffetMenuItemsController } from "./controllers/admin_buffet_menu-items";
import { AdminBuffetPlansController } from "./controllers/admin_buffet_plans";
import { AdminBuffetPlansIdController } from "./controllers/admin_buffet_plans__id";
import { AdminBuffetPlansIdCopyLinesFromLastController } from "./controllers/admin_buffet_plans__id_copy-lines-from-last";
import { AdminBuffetPlansIdCopyController } from "./controllers/admin_buffet_plans__id_copy";
import { AdminBuffetPlansIdLinesController } from "./controllers/admin_buffet_plans__id_lines";
import { AdminBuffetPlansIdMaterialsController } from "./controllers/admin_buffet_plans__id_materials";
import { AdminBuffetPlansIdPublishDailyMenuController } from "./controllers/admin_buffet_plans__id_publish-daily-menu";
import { AdminBuffetStaffPlansController } from "./controllers/admin_buffet_staff-plans";
import { AdminBuffetStaffPlansCostRunExportController } from "./controllers/admin_buffet_staff-plans_cost-run-export";
import { AdminBuffetStaffPlansIdController } from "./controllers/admin_buffet_staff-plans__id";
import { AdminBuffetStaffPlansIdSlotsController } from "./controllers/admin_buffet_staff-plans__id_slots";
import { AdminBuffetTemplatesController } from "./controllers/admin_buffet_templates";
import { AdminBuffetTemplatesIdController } from "./controllers/admin_buffet_templates__id";
import { AdminBuffetTemplatesIdCaptureFromPlanController } from "./controllers/admin_buffet_templates__id_capture-from-plan";
import { AdminBuffetTemplatesIdSlotsController } from "./controllers/admin_buffet_templates__id_slots";
import { AdminBuffetTemplatesIdSpawnController } from "./controllers/admin_buffet_templates__id_spawn";
import { AdminCedvelBindingController } from "./controllers/admin_cedvel_binding";
import { AdminCedvelPersonnelController } from "./controllers/admin_cedvel_personnel";
import { AdminCedvelWeekController } from "./controllers/admin_cedvel_week";
import { AdminDailyMenuController } from "./controllers/admin_daily-menu";
import { AdminFinanceProductsController } from "./controllers/admin_finance-products";
import { AdminHotelRevenueCodesController } from "./controllers/admin_hotel-revenue-codes";
import { AdminIntegrationSettingsController } from "./controllers/admin_integration-settings";
import { AdminLimitHoldersController } from "./controllers/admin_limit-holders";
import { AdminLimitHoldersIdSettleController } from "./controllers/admin_limit-holders__id_settle";
import { AdminLinksController } from "./controllers/admin_links";
import { AdminRolesController } from "./controllers/admin_roles";
import { AdminRolesCodeController } from "./controllers/admin_roles__code";
import { AdminRolesCodePermissionsController } from "./controllers/admin_roles__code_permissions";
import { AuthLoginController } from "./controllers/auth_login";
import { AuthLogoutController } from "./controllers/auth_logout";
import { AuthMeController } from "./controllers/auth_me";
import { AuthPinController } from "./controllers/auth_pin";
import { AuthSessionRefreshPermissionsController } from "./controllers/auth_session_refresh-permissions";
import { AuthSsoExchangeController } from "./controllers/auth_sso_exchange";
import { AuthTerminalController } from "./controllers/auth_terminal";
import { BanquetsController } from "./controllers/banquets";
import { BillingContextController } from "./controllers/billing_context";
import { DashboardTodayController } from "./controllers/dashboard_today";
import { DeliveryInboxController } from "./controllers/delivery-inbox";
import { DeliveryInboxIdAcceptController } from "./controllers/delivery-inbox__id_accept";
import { EditionController } from "./controllers/edition";
import { EventsDispatchController } from "./controllers/events_dispatch";
import { FiscalDevicesController } from "./controllers/fiscal_devices";
import { HallsController } from "./controllers/halls";
import { HallsIdController } from "./controllers/halls__id";
import { HealthController } from "./controllers/health";
import { ImportController } from "./controllers/import";
import { ImportEntityController } from "./controllers/import__entity";
import { InHouseController } from "./controllers/in-house";
import { IntegrationSettlementConfirmedController } from "./controllers/integration_settlement-confirmed";
import { IntegrationStaffProvisionController } from "./controllers/integration_staff-provision";
import { InternalV1KafeBootstrapOwnerController } from "./controllers/internal_v1_kafe_bootstrap-owner";
import { InternalV1ShiftsOpenController } from "./controllers/internal_v1_shifts_open";
import { InternalV1WorkforceRolesController } from "./controllers/internal_v1_workforce_roles";
import { KdsLinesController } from "./controllers/kds_lines";
import { KdsLinesLineIdController } from "./controllers/kds_lines__lineId";
import { LaborClockController } from "./controllers/labor_clock";
import { LaborRosterController } from "./controllers/labor_roster";
import { LocaleController } from "./controllers/locale";
import { MenuController } from "./controllers/menu";
import { MenuCategoriesController } from "./controllers/menu_categories";
import { MenuCategoriesIdController } from "./controllers/menu_categories__id";
import { MenuExportController } from "./controllers/menu_export";
import { MenuSoldOutController } from "./controllers/menu_sold-out";
import { MenuSuggestController } from "./controllers/menu_suggest";
import { MenuIdController } from "./controllers/menu__id";
import { MenuIdPricesController } from "./controllers/menu__id_prices";
import { OfflineReplayController } from "./controllers/offline_replay";
import { OutletsController } from "./controllers/outlets";
import { OutletsSelectController } from "./controllers/outlets_select";
import { OutletsIdController } from "./controllers/outlets__id";
import { PaymentMethodsController } from "./controllers/payment-methods";
import { PlatformBillingSnapshotController } from "./controllers/platform_billing-snapshot";
import { PmsGuestEntitlementsController } from "./controllers/pms_guest-entitlements";
import { PublicMenuSlugController } from "./controllers/public_menu__slug";
import { ReportsHandoverController } from "./controllers/reports_handover";
import { ReportsJournalController } from "./controllers/reports_journal";
import { ReportsXController } from "./controllers/reports_x";
import { ReservationsController } from "./controllers/reservations";
import { ReservationsIdOpenTicketController } from "./controllers/reservations__id_open-ticket";
import { SalesController } from "./controllers/sales";
import { SettingsBuffetCostController } from "./controllers/settings_buffet-cost";
import { SettingsBusinessDayController } from "./controllers/settings_business-day";
import { SettingsIntegrationsController } from "./controllers/settings_integrations";
import { SettingsPresetsController } from "./controllers/settings_presets";
import { ShiftsCloseController } from "./controllers/shifts_close";
import { ShiftsDropController } from "./controllers/shifts_drop";
import { ShiftsOpenController } from "./controllers/shifts_open";
import { TablesController } from "./controllers/tables";
import { TablesIdController } from "./controllers/tables__id";
import { TicketsController } from "./controllers/tickets";
import { TicketsRoomServiceController } from "./controllers/tickets_room-service";
import { TicketsVoidEmptyController } from "./controllers/tickets_void-empty";
import { TicketsIdController } from "./controllers/tickets__id";
import { TicketsIdDeferToHubController } from "./controllers/tickets__id_defer-to-hub";
import { TicketsIdDiscountController } from "./controllers/tickets__id_discount";
import { TicketsIdFireCourseController } from "./controllers/tickets__id_fire-course";
import { TicketsIdFireController } from "./controllers/tickets__id_fire";
import { TicketsIdLinesController } from "./controllers/tickets__id_lines";
import { TicketsIdLinesLineIdController } from "./controllers/tickets__id_lines__lineId";
import { TicketsIdLinesLineIdVoidController } from "./controllers/tickets__id_lines__lineId_void";
import { TicketsIdMoveController } from "./controllers/tickets__id_move";
import { TicketsIdPayController } from "./controllers/tickets__id_pay";
import { TicketsIdRoomChargeController } from "./controllers/tickets__id_room-charge";
import { TicketsIdSplitController } from "./controllers/tickets__id_split";
import { TicketsIdVoidController } from "./controllers/tickets__id_void";
import { WebhooksPmsReservationLifecycleController } from "./controllers/webhooks_pms_reservation-lifecycle";
import { KitApiController } from "../kit-api.controller";

@Module({
  controllers: [
    KitApiController,
    AdminAuditController,
    AdminBuffetCostRunExportController,
    AdminBuffetCoversRollupController,
    AdminBuffetForecastPackController,
    AdminBuffetGuestNightsController,
    AdminBuffetGuestNightsSyncHotelController,
    AdminBuffetHybridHandoffController,
    AdminBuffetLinesLineIdController,
    AdminBuffetManagementEatersController,
    AdminBuffetManagementEatersIdController,
    AdminBuffetManagementMealsController,
    AdminBuffetManagementMealsIdController,
    AdminBuffetMenuItemsController,
    AdminBuffetPlansController,
    AdminBuffetPlansIdController,
    AdminBuffetPlansIdCopyLinesFromLastController,
    AdminBuffetPlansIdCopyController,
    AdminBuffetPlansIdLinesController,
    AdminBuffetPlansIdMaterialsController,
    AdminBuffetPlansIdPublishDailyMenuController,
    AdminBuffetStaffPlansController,
    AdminBuffetStaffPlansCostRunExportController,
    AdminBuffetStaffPlansIdController,
    AdminBuffetStaffPlansIdSlotsController,
    AdminBuffetTemplatesController,
    AdminBuffetTemplatesIdController,
    AdminBuffetTemplatesIdCaptureFromPlanController,
    AdminBuffetTemplatesIdSlotsController,
    AdminBuffetTemplatesIdSpawnController,
    AdminCedvelBindingController,
    AdminCedvelPersonnelController,
    AdminCedvelWeekController,
    AdminDailyMenuController,
    AdminFinanceProductsController,
    AdminHotelRevenueCodesController,
    AdminIntegrationSettingsController,
    AdminLimitHoldersController,
    AdminLimitHoldersIdSettleController,
    AdminLinksController,
    AdminRolesController,
    AdminRolesCodeController,
    AdminRolesCodePermissionsController,
    AuthLoginController,
    AuthLogoutController,
    AuthMeController,
    AuthPinController,
    AuthSessionRefreshPermissionsController,
    AuthSsoExchangeController,
    AuthTerminalController,
    BanquetsController,
    BillingContextController,
    DashboardTodayController,
    DeliveryInboxController,
    DeliveryInboxIdAcceptController,
    EditionController,
    EventsDispatchController,
    FiscalDevicesController,
    HallsController,
    HallsIdController,
    HealthController,
    ImportController,
    ImportEntityController,
    InHouseController,
    IntegrationSettlementConfirmedController,
    IntegrationStaffProvisionController,
    InternalV1KafeBootstrapOwnerController,
    InternalV1ShiftsOpenController,
    InternalV1WorkforceRolesController,
    KdsLinesController,
    KdsLinesLineIdController,
    LaborClockController,
    LaborRosterController,
    LocaleController,
    MenuController,
    MenuCategoriesController,
    MenuCategoriesIdController,
    MenuExportController,
    MenuSoldOutController,
    MenuSuggestController,
    MenuIdController,
    MenuIdPricesController,
    OfflineReplayController,
    OutletsController,
    OutletsSelectController,
    OutletsIdController,
    PaymentMethodsController,
    PlatformBillingSnapshotController,
    PmsGuestEntitlementsController,
    PublicMenuSlugController,
    ReportsHandoverController,
    ReportsJournalController,
    ReportsXController,
    ReservationsController,
    ReservationsIdOpenTicketController,
    SalesController,
    SettingsBuffetCostController,
    SettingsBusinessDayController,
    SettingsIntegrationsController,
    SettingsPresetsController,
    ShiftsCloseController,
    ShiftsDropController,
    ShiftsOpenController,
    TablesController,
    TablesIdController,
    TicketsController,
    TicketsRoomServiceController,
    TicketsVoidEmptyController,
    TicketsIdController,
    TicketsIdDeferToHubController,
    TicketsIdDiscountController,
    TicketsIdFireCourseController,
    TicketsIdFireController,
    TicketsIdLinesController,
    TicketsIdLinesLineIdController,
    TicketsIdLinesLineIdVoidController,
    TicketsIdMoveController,
    TicketsIdPayController,
    TicketsIdRoomChargeController,
    TicketsIdSplitController,
    TicketsIdVoidController,
    WebhooksPmsReservationLifecycleController,
  ],
})
export class FnbNativeModule {}
